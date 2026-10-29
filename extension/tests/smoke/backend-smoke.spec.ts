// Cross-stack smoke test (spec section 14): reproduces the Post A / Post B
// worked examples through the REAL pipeline — real backend (scripted LLM
// client, see backend/tests/smoke_server.py), real JEV engine, real /analyze
// HTTP route, real background service worker.  Nothing is stubbed except the
// LLM call itself, which is the one piece that costs money / needs a real key.
//
// Requires the scripted backend already running on :8000 — see
// scripts/smoke-test.sh.
//
// The popup no longer has a paste-text path (it was removed when the popup
// was repurposed as a last-result viewer).  We drive the pipeline instead by
// sending an ANALYZE_SELECTION message directly from an extension-page
// context — the same legacy message path that background.ts still handles for
// backward compat.  This exercises the full chain:
//
//   page.evaluate → chrome.runtime.sendMessage (ANALYZE_SELECTION)
//     → background.ts handleAnalyzeSelection
//       → real HTTP POST /analyze on :8000
//         → JEV scoring
//           → AnalyzeOutcome returned to sendMessage callback
//
// The right-click context-menu path and the Alt+A keyboard path are
// un-drivable from Playwright (see the file history for the explanation);
// they are covered by background.test.ts + the README manual checklist.

import { expect, test, type BrowserContext } from "@playwright/test";
import type { AnalyzeOutcome } from "../../src/types";
import { getExtensionId, launchExtension } from "../extension-harness";

// Must match backend/tests/fixtures.py exactly: the scripted backend keys its
// canned LLM responses on exact post-text equality.
const POST_A_TEXT =
  "We migrated 12 .NET Framework services to .NET 8.\n\n" +
  "The biggest problem wasn't the code migration. It was a hidden " +
  "dependency in an old authentication library.\n\n" +
  "Here's how we discovered it...";

const POST_B_TEXT =
  "AI is changing everything.\n\n" +
  "Here are 5 things every developer needs to know in 2026...";

let context: BrowserContext;
let extensionId: string;

test.beforeEach(async () => {
  context = await launchExtension();
  extensionId = await getExtensionId(context);
});

test.afterEach(async () => {
  await context.close();
});

/**
 * Send an ANALYZE_SELECTION message from an extension page so that
 * background.ts receives it and calls the real backend.  Returns the
 * AnalyzeOutcome (or throws if the backend is unreachable).
 */
async function analyzeViaBackground(text: string): Promise<AnalyzeOutcome> {
  // Any extension page gives us the chrome API — reuse the popup URL.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  const outcome = await page.evaluate(async (postText: string) => {
    return new Promise<unknown>((resolve, reject) => {
      // @ts-ignore — chrome is available inside the extension page
      chrome.runtime.sendMessage(
        { type: "ANALYZE_SELECTION", pastedText: postText },
        (resp: unknown) => {
          // @ts-ignore
          if (chrome.runtime.lastError) {
            // @ts-ignore
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(resp);
          }
        },
      );
    });
  }, text);

  await page.close();

  const result = outcome as AnalyzeOutcome;
  if (result.status === "error") {
    throw new Error(
      `Backend returned an error (is the scripted backend running on :8000? ` +
        `see scripts/smoke-test.sh): ${result.error}`,
    );
  }
  return result;
}

test("Post A (concrete migration story) comes back READ / HIGH through the real backend", async () => {
  const outcome = await analyzeViaBackground(POST_A_TEXT);

  expect(outcome.status).toBe("ok");
  if (outcome.status !== "ok") return;

  expect(outcome.result.signal_level).toBe("HIGH");
  expect(outcome.result.recommendation).toBe("READ");
});

test("Post B (relevant but generic) comes back SKIP / LOW through the real backend", async () => {
  const outcome = await analyzeViaBackground(POST_B_TEXT);

  expect(outcome.status).toBe("ok");
  if (outcome.status !== "ok") return;

  expect(outcome.result.signal_level).toBe("LOW");
  expect(outcome.result.recommendation).toBe("SKIP");
});
