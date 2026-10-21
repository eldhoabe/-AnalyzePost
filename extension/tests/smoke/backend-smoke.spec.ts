// Cross-stack smoke test (spec section 14): reproduces the Post A / Post B
// worked examples through the REAL pipeline -- real backend (scripted LLM
// client only, see backend/tests/smoke_server.py), real JEV engine, real
// /analyze HTTP route, real background service worker, real popup. Nothing
// here is stubbed except the LLM call itself, which is the one piece that
// costs money / needs a real API key.
//
// Requires the scripted backend already running on :8000 -- see
// scripts/smoke-test.sh, which is what `bash scripts/smoke-test.sh` (repo
// root) runs.
//
// Drives the popup's PASTE path, not its text-selection-grab path. That's
// not a simplification of convenience -- the selection-grab path
// (background.ts's grabActiveSelection, via chrome.scripting.executeScript
// under the activeTab permission) turns out to be un-drivable from
// Playwright at all: activeTab's temporary grant only activates on a
// genuine user gesture invoking the extension (a real toolbar-icon click),
// and navigating straight to chrome-extension://<id>/popup.html -- the
// only way Playwright can open an MV3 popup -- doesn't count as one.
// Confirmed directly: chrome.scripting.executeScript against the source
// tab in this exact setup throws "Cannot access contents of the page.
// Extension manifest must request permission to access the respective
// host." -- Chrome's standard missing-host-permission error, not a bug in
// background.ts (real toolbar clicks do grant activeTab correctly; this
// is a Playwright/MV3-testing limitation, not a product one). Combined
// with the right-click context-menu path also being un-drivable
// (Playwright can't operate native OS context menus), NEITHER of
// background.ts's two real entry points can be exercised end-to-end here
// -- both are covered instead by background.test.ts, which mocks
// chrome.scripting/chrome.tabs/chrome.contextMenus directly, sidestepping
// the permission question entirely, plus the manual checklist in the
// README. What Playwright *can* drive for real is the paste path (no
// activeTab dependency), which still exercises the real popup -> real
// background.ts (handleAnalyzeSelection's paste branch) -> real backend
// chain this test exists to prove.

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

let context: BrowserContext;
let extensionId: string;

test.beforeEach(async () => {
  context = await launchExtension();
  extensionId = await getExtensionId(context);
});

test.afterEach(async () => {
  await context.close();
});

async function analyzePastedText(text: string): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.click("#analyze-button");

  // No real tab/selection to grab in this harness (see file header) --
  // expected to land on the paste fallback every time.
  await popup.waitForSelector("#paste-input", { timeout: 10_000 });
  await popup.fill("#paste-input", text);
  await popup.click("#paste-analyze-button");

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
  const popup = await analyzePastedText(POST_A_TEXT);

  await expect(popup.locator(".result-card")).toHaveAttribute("data-signal-level", "HIGH");
  await expect(popup.locator(".result-reasons-intro")).toHaveText("Worth reading because:");
});

test("Post B (relevant but generic) comes back SKIP / LOW through the real backend -- despite being just as relevant as Post A", async () => {
  const popup = await analyzePastedText(POST_B_TEXT);

  await expect(popup.locator(".result-card")).toHaveAttribute("data-signal-level", "LOW");
  await expect(popup.locator(".result-reasons-intro")).toHaveText("Skip because:");
});
