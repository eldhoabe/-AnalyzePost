// Cross-stack smoke test (spec section 14): reproduces the Post A / Post B
// worked examples through the REAL pipeline -- real backend (scripted LLM
// client only, see backend/tests/smoke_server.py), real JEV engine, real
// /analyze HTTP route, real content script, real background service
// worker, real popup. Nothing here is stubbed except the LLM call itself,
// which is the one piece that costs money / needs a real API key.
//
// Requires the scripted backend already running on :8000 -- see
// scripts/smoke-test.sh, which is what `npm run smoke` (repo root) runs.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { getExtensionId, launchExtension } from "../extension-harness";

// Must match backend/tests/fixtures.py exactly: the scripted backend keys
// its canned LLM responses on exact post text equality.
const POST_A_TEXT =
  "We migrated 12 .NET Framework services to .NET 8.\n\n" +
  "The biggest problem wasn't the code migration. It was a hidden " +
  "dependency in an old authentication library.\n\n" +
  "Here's how we discovered it...";

const POST_B_TEXT =
  "AI is changing everything.\n\n" +
  "Here are 5 things every developer needs to know in 2026...";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linkedinPageHtml(text: string, urn: string): string {
  return `<!doctype html>
<html>
  <body>
    <div class="feed-shared-update-v2" data-urn="urn:li:activity:${urn}">
      <div class="feed-shared-update-v2__description"><span class="break-words">${escapeHtml(
        text,
      )}</span></div>
    </div>
  </body>
</html>`;
}

let context: BrowserContext;
let extensionId: string;

test.beforeEach(async () => {
  context = await launchExtension();
  extensionId = await getExtensionId(context);
});

test.afterEach(async () => {
  await context.close();
});

async function analyzeLinkedInPost(text: string, urn: string): Promise<Page> {
  const linkedInPage = await context.newPage();
  await linkedInPage.route("https://www.linkedin.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: linkedinPageHtml(text, urn) }),
  );
  await linkedInPage.goto("https://www.linkedin.com/feed/");
  await linkedInPage.bringToFront();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.click("#analyze-button");

  await Promise.race([
    popup.waitForSelector(".result-card", { timeout: 15_000 }),
    popup.waitForSelector("#error", { timeout: 15_000 }),
  ]);

  const errorEl = popup.locator("#error");
  if (await errorEl.count()) {
    const message = await errorEl.textContent();
    throw new Error(
      `Popup showed an error instead of a result (is the scripted backend running on :8000? ` +
        `see scripts/smoke-test.sh): ${message}`,
    );
  }

  return popup;
}

test("Post A (concrete migration story) comes back READ / HIGH through the real backend", async () => {
  const popup = await analyzeLinkedInPost(POST_A_TEXT, "7001111111111111111");

  await expect(popup.locator(".result-card")).toHaveAttribute("data-signal-level", "HIGH");
  await expect(popup.locator(".result-recommendation")).toHaveText("Recommendation: READ");
});

test("Post B (relevant but generic) comes back SKIP / LOW through the real backend -- despite being just as relevant as Post A", async () => {
  const popup = await analyzeLinkedInPost(POST_B_TEXT, "7002222222222222222");

  await expect(popup.locator(".result-card")).toHaveAttribute("data-signal-level", "LOW");
  await expect(popup.locator(".result-recommendation")).toHaveText("Recommendation: SKIP");
});
