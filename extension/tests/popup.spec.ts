// Real-browser test: loads the actual built extension into Chromium
// (headless, pre-installed in this environment) and drives the popup.
//
// The seam we stub is chrome.runtime.sendMessage -- the contract between
// popup.ts and background.ts -- rather than the network call itself.
// That keeps this test focused on "does the popup correctly call
// background and render whatever comes back" (background.ts's own
// LinkedIn-tab-finding and fetch logic isn't real-browser-testable here
// without a live, authenticated LinkedIn tab; see README for the manual
// checklist that covers that).

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { AnalyzeResult } from "../src/types";
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

type BackgroundResponse = { ok: true; result: AnalyzeResult } | { ok: false; error: string };

async function openPopupStubbedWith(response: BackgroundResponse): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript((resp) => {
    // @ts-expect-error -- stubbing the extension messaging bridge for the test
    window.chrome.runtime.sendMessage = async () => resp;
  }, response);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

test("shows the initial button with no console errors", async () => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.locator("#analyze-button")).toHaveText("Should I Read This?");
  expect(errors).toEqual([]);
});

test("renders a HIGH SIGNAL / READ result card", async () => {
  const page = await openPopupStubbedWith({ ok: true, result: HIGH_SIGNAL_RESULT });

  await page.click("#analyze-button");

  await expect(page.locator(".result-card")).toHaveAttribute("data-signal-level", "HIGH");
  await expect(page.locator(".result-badge")).toHaveText("🟢 HIGH SIGNAL");
  await expect(page.locator(".result-score")).toHaveText("Signal: 91");
  await expect(page.locator(".result-reasons li")).toHaveCount(3);
  await expect(page.locator(".result-recommendation")).toHaveText("Recommendation: READ");
});

test("renders a LOW SIGNAL / SKIP result card", async () => {
  const page = await openPopupStubbedWith({ ok: true, result: LOW_SIGNAL_RESULT });

  await page.click("#analyze-button");

  await expect(page.locator(".result-card")).toHaveAttribute("data-signal-level", "LOW");
  await expect(page.locator(".result-badge")).toHaveText("🔴 LOW SIGNAL");
  await expect(page.locator(".result-recommendation")).toHaveText("Recommendation: SKIP");
});

test("renders a visible error state when background reports failure", async () => {
  const page = await openPopupStubbedWith({
    ok: false,
    error: "Couldn't find a LinkedIn post on this tab. Open a post and try again.",
  });

  await page.click("#analyze-button");

  await expect(page.locator("#error")).toBeVisible();
  await expect(page.locator("#error")).toHaveText(
    "Couldn't find a LinkedIn post on this tab. Open a post and try again.",
  );
  await expect(page.locator("#retry-button")).toBeVisible();
});

test("renders a visible error state when sendMessage itself throws", async () => {
  const page = await context.newPage();
  await page.addInitScript(() => {
    // @ts-expect-error -- stubbing the extension messaging bridge for the test
    window.chrome.runtime.sendMessage = async () => {
      throw new Error("Extension context invalidated");
    };
  });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await page.click("#analyze-button");

  await expect(page.locator("#error")).toHaveText("Extension context invalidated");
});

test("retry button returns to the idle button after an error", async () => {
  const page = await openPopupStubbedWith({ ok: false, error: "network down" });

  await page.click("#analyze-button");
  await expect(page.locator("#retry-button")).toBeVisible();
  await page.click("#retry-button");

  await expect(page.locator("#analyze-button")).toHaveText("Should I Read This?");
});
