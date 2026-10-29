// Service worker: two entry points (right-click a selection anywhere, or
// the popup button) both funnel into analyzeAndRecord(), which posts to
// the backend, estimates reading time, persists the outcome so the popup
// can show it later, and sets a colored/scored toolbar badge.

import { browserAPI } from "./browser-compat";
import { API_BASE } from "./config";
import { estimateReadingMinutes } from "./readingTime";
import { getSelectedText } from "./selection";
import { loadProfile, saveLastOutcome } from "./storage";
import type {
  AnalyzeOutcome,
  AnalyzeResult,
  AnalyzeSelectionMessage,
  BackgroundResponse,
} from "./types";

const CONTEXT_MENU_ID = "analyze-selection";

const BADGE_COLOR: Record<AnalyzeResult["signal_level"], string> = {
  HIGH: "#16a34a",
  MAYBE: "#ca8a04",
  LOW: "#b91c1c",
};

async function analyzeText(text: string): Promise<AnalyzeResult> {
  const profile = await loadProfile();
  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postText: text, profile }),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }
  return (await response.json()) as AnalyzeResult;
}

async function recordOutcome(outcome: AnalyzeOutcome): Promise<void> {
  await saveLastOutcome(outcome);

  if (outcome.status === "ok") {
    await browserAPI.action.setBadgeText({ text: String(outcome.result.signal_score) });
    await browserAPI.action.setBadgeBackgroundColor({
      color: BADGE_COLOR[outcome.result.signal_level],
    });
  } else {
    await browserAPI.action.setBadgeText({ text: "!" });
    await browserAPI.action.setBadgeBackgroundColor({ color: "#b91c1c" });
  }
}

export async function analyzeAndRecord(text: string): Promise<BackgroundResponse> {
  try {
    const result = await analyzeText(text);
    const outcome: AnalyzeOutcome = {
      status: "ok",
      result,
      readingMinutes: estimateReadingMinutes(text),
    };
    await recordOutcome(outcome);
    return outcome;
  } catch (error) {
    const outcome: AnalyzeOutcome = {
      status: "error",
      error: error instanceof Error ? error.message : "Couldn't reach the analysis backend.",
    };
    await recordOutcome(outcome);
    return outcome;
  }
}

async function grabActiveSelection(): Promise<string> {
  const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return "";

  try {
    const [injection] = await browserAPI.scripting.executeScript({
      target: { tabId: tab.id },
      func: getSelectedText,
    });
    return injection?.result ?? "";
  } catch {
    // Restricted page (chrome://, the Web Store, ...) -- fall through to
    // the paste UI rather than surfacing this as an error.
    return "";
  }
}

export async function handleAnalyzeSelection(pastedText?: string): Promise<BackgroundResponse> {
  const text = pastedText?.trim() || (await grabActiveSelection());
  if (!text) return { status: "empty" };
  return analyzeAndRecord(text);
}

// Guarded (rather than called unconditionally) so importing this module
// never throws in an environment where neither `chrome` nor `browser` has
// been set up yet -- e.g. a test file's static imports run before its
// beforeEach installs a chrome mock. Checked directly via typeof (always
// safe for a possibly-undeclared global) rather than through browserAPI,
// since browserAPI's own resolution throws when neither global exists.
const hasExtensionRuntime =
  typeof globalThis.chrome !== "undefined" || typeof globalThis.browser !== "undefined";

if (hasExtensionRuntime) {
  // --- Entry point 1: right-click a selection, anywhere ---

  browserAPI.runtime.onInstalled.addListener(() => {
    browserAPI.contextMenus.removeAll(() => {
      browserAPI.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: "Should I Read This?",
        contexts: ["selection"],
      });
    });
  });

  browserAPI.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;
    void analyzeAndRecord(info.selectionText);
  });

  // --- Entry point 2: the popup button (with a paste fallback) ---

  browserAPI.runtime.onMessage.addListener(
    (message: AnalyzeSelectionMessage, _sender, sendResponse) => {
      if (message?.type === "ANALYZE_SELECTION") {
        void handleAnalyzeSelection(message.pastedText).then(sendResponse);
        return true; // keep the message channel open for the async response
      }
      return false;
    },
  );
}
