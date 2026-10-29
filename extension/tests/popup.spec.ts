// Real-browser test: loads the actual built extension into Chromium and drives
// the popup in its new role as a last-result viewer.
//
// The seam we stub is chrome.storage.session.get (the key "lastOutcome") —
// the same key that loadLastOutcome() reads in storage.ts. This lets us
// control exactly what the popup sees without a live background service worker.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { AnalyzeOutcome, AnalyzeResult } from "../src/types";
import { getExtensionId, launchExtension } from "./extension-harness";

const HIGH_SIGNAL_RESULT: AnalyzeResult = {
  recommendation: "READ",
  signal_level: "HIGH",
  signal_score: 91,
  relevance: 91,
  specificity: 88,
  originality: 82,
  practical_value: 90,
  personal_experience: 86,
  engagement_bait: 12,
  promotional: 5,
  ai_style: 18,
  reasons: [
    "Specific production incident",
    "Contains measurable results",
    "Highly relevant to your AWS and architecture interests",
  ],
};

const LOW_SIGNAL_RESULT: AnalyzeResult = {
  recommendation: "SKIP",
  signal_level: "LOW",
  signal_score: 24,
  relevance: 32,
  specificity: 21,
  originality: 18,
  practical_value: 24,
  personal_experience: 14,
  engagement_bait: 88,
  promotional: 35,
  ai_style: 81,
  reasons: ["Mostly generic advice", "No concrete experience", "Heavy engagement-bait language"],
};

let context: BrowserContext;
let extensionId: string;

test.beforeEach(async () => {
  context = await launchExtension();
  extensionId = await getExtensionId(context);
});

test.afterEach(async () => {
  await context.close();
});

/** Open the popup with chrome.storage.session.get stubbed to return `outcome`. */
async function openPopupWithOutcome(outcome: AnalyzeOutcome | null): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript((stored) => {
    // Stub only the session.get call; leave everything else untouched.
    // @ts-expect-error — patching the extension API for test isolation
    window.chrome.storage.session.get = (_key: string, cb: (r: Record<string, unknown>) => void) => {
      cb(stored === null ? {} : { lastOutcome: stored });
    };
  }, outcome);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

// ── Empty state ────────────────────────────────────────────────────────────────

test("shows the empty state with no console errors when no prior analysis", async () => {
  const errors: string[] = [];
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.addInitScript(() => {
    // @ts-expect-error
    window.chrome.storage.session.get = (_key: string, cb: (r: Record<string, unknown>) => void) => cb({});
  });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.locator(".ap-popup-empty__title")).toHaveText("No analysis yet");
  await expect(page.locator(".ap-popup-empty__hint").first()).toContainText("Analyze this post");
  expect(errors).toEqual([]);
});

// ── Result states ──────────────────────────────────────────────────────────────

test("renders a READ result from the last analysis", async () => {
  const outcome: AnalyzeOutcome = {
    status: "ok",
    result: HIGH_SIGNAL_RESULT,
    readingMinutes: 5,
  };
  const page = await openPopupWithOutcome(outcome);

  await expect(page.locator(".ap-popup-result")).toBeVisible();
  await expect(page.locator(".ap-popup-result__label")).toHaveText("READ");
  await expect(page.locator(".ap-popup-result__score")).toContainText("91");
  await expect(page.locator(".ap-popup-result__reasons li")).toHaveCount(3);
  await expect(page.locator(".ap-popup-result__meta")).toContainText("5 min");
});

test("renders a SKIP result from the last analysis", async () => {
  const outcome: AnalyzeOutcome = {
    status: "ok",
    result: LOW_SIGNAL_RESULT,
    readingMinutes: 3,
  };
  const page = await openPopupWithOutcome(outcome);

  await expect(page.locator(".ap-popup-result")).toBeVisible();
  await expect(page.locator(".ap-popup-result__label")).toHaveText("SKIP");
  await expect(page.locator(".ap-popup-result__score")).toContainText("24");
  await expect(page.locator(".ap-popup-result__meta")).toContainText("3 min");
});

test("shows footer hint to use right-click on any result", async () => {
  const outcome: AnalyzeOutcome = {
    status: "ok",
    result: HIGH_SIGNAL_RESULT,
    readingMinutes: 2,
  };
  const page = await openPopupWithOutcome(outcome);

  await expect(page.locator(".ap-popup-footer")).toContainText("Analyze this post");
});

// ── Error state ────────────────────────────────────────────────────────────────

test("renders the error state when the last analysis failed", async () => {
  const outcome: AnalyzeOutcome = { status: "error", error: "Backend returned 500" };
  const page = await openPopupWithOutcome(outcome);

  await expect(page.locator(".ap-popup-error")).toBeVisible();
  await expect(page.locator(".ap-popup-error__msg")).toHaveText("Backend returned 500");
  // Hint to re-trigger analysis should still be shown.
  await expect(page.locator(".ap-popup-empty__hint")).toContainText("Analyze this post");
});
