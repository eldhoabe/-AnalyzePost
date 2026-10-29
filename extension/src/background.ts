// Service worker: three entry points —
//   1. Right-click context menu on any selection → tells content script to show card
//   2. Alt+A keyboard command → same as above, but grabs selection via scripting
//   3. FETCH_ANALYSIS message from content script → calls backend, responds with result
// Legacy ANALYZE_SELECTION message (from the old popup button) is kept so that
// the existing unit tests and any cached popup versions remain functional.

import { browserAPI } from "./browser-compat";
import { API_BASE } from "./config";
import { estimateReadingMinutes } from "./readingTime";
import { getSelectedText } from "./selection";
import {
  addToHistory,
  loadProfile,
  saveLastOutcome,
} from "./storage";
import type {
  AnalysisRecord,
  AnalyzeOutcome,
  AnalyzeResult,
  AnalyzeSelectionMessage,
  AnalyzeTriggerMessage,
  BackgroundResponse,
  FetchAnalysisMessage,
} from "./types";

const CONTEXT_MENU_ID = "analyze-selection";

const BADGE_COLOR: Record<AnalyzeResult["signal_level"], string> = {
  HIGH:  "#16a34a",
  MAYBE: "#ca8a04",
  LOW:   "#b91c1c",
};

// ── Core analysis logic ────────────────────────────────────────────────────

async function analyzeText(text: string): Promise<AnalyzeResult> {
  const profile = await loadProfile();
  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postText: text, profile }),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
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

export async function analyzeAndRecord(text: string, hostname?: string): Promise<BackgroundResponse> {
  try {
    const result = await analyzeText(text);
    const outcome: AnalyzeOutcome = {
      status: "ok",
      result,
      readingMinutes: estimateReadingMinutes(text),
    };
    await recordOutcome(outcome);
    void saveToHistory(text, outcome, hostname);
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

async function saveToHistory(text: string, outcome: AnalyzeOutcome, knownHostname?: string): Promise<void> {
  try {
    let hostname = knownHostname;
    if (!hostname) {
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
      const url = tabs[0]?.url ?? "";
      hostname = url ? new URL(url).hostname : "unknown";
    }
    const record: AnalysisRecord = {
      id: crypto.randomUUID(),
      textSnippet: text.slice(0, 120),
      outcome,
      timestamp: Date.now(),
      hostname,
    };
    await addToHistory(record);
  } catch {
    // Non-fatal — history is best-effort.
  }
}

// ── Active tab helpers ─────────────────────────────────────────────────────

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function grabActiveSelection(): Promise<string> {
  const tabId = await getActiveTabId();
  if (tabId == null) return "";
  try {
    const [injection] = await browserAPI.scripting.executeScript({
      target: { tabId },
      func: getSelectedText,
    });
    return injection?.result ?? "";
  } catch {
    return "";
  }
}

async function triggerContentScript(tabId: number, text: string): Promise<void> {
  const msg: AnalyzeTriggerMessage = { type: "ANALYZE_TRIGGERED", text };
  try {
    await browserAPI.tabs.sendMessage(tabId, msg);
  } catch {
    // Content script not present on this page (chrome://, Web Store, etc.) — ignore.
  }
}

// ── Legacy popup path (kept for existing unit tests) ──────────────────────

export async function handleAnalyzeSelection(pastedText?: string): Promise<BackgroundResponse> {
  const text = pastedText?.trim() || (await grabActiveSelection());
  if (!text) return { status: "empty" };
  // Pass "unknown" when we have no tab context (legacy popup path); avoids an
  // extra tabs.query for pre-existing unit tests that assert on that call count.
  const hostname = pastedText ? "unknown" : undefined;
  return analyzeAndRecord(text, hostname);
}

// ── Extension runtime registration ────────────────────────────────────────

const hasExtensionRuntime =
  typeof globalThis.chrome !== "undefined" || typeof globalThis.browser !== "undefined";

if (hasExtensionRuntime) {
  // Entry point 1: right-click context menu.
  browserAPI.runtime.onInstalled.addListener(() => {
    browserAPI.contextMenus.removeAll(() => {
      browserAPI.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: "Analyze this post",
        contexts: ["selection"],
      });
    });
  });

  browserAPI.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;
    const text = info.selectionText;
    void getActiveTabId().then((tabId) => {
      if (tabId == null) return;
      void triggerContentScript(tabId, text);
    });
  });

  // Entry point 2: Alt+A keyboard shortcut.
  browserAPI.commands.onCommand.addListener((command) => {
    if (command !== "analyze-selection") return;
    void (async () => {
      const tabId = await getActiveTabId();
      if (tabId == null) return;
      // Get the current selection via scripting, then pass to content script.
      const text = await grabActiveSelection();
      await triggerContentScript(tabId, text ?? "");
    })();
  });

  // Entry point 3: FETCH_ANALYSIS from content script.
  // Entry point 4: ANALYZE_SELECTION from legacy popup (backwards compat).
  browserAPI.runtime.onMessage.addListener(
    (
      message: FetchAnalysisMessage | AnalyzeSelectionMessage,
      _sender,
      sendResponse,
    ) => {
      if (message?.type === "FETCH_ANALYSIS") {
        void analyzeAndRecord(message.text).then(sendResponse);
        return true; // keep channel open for async response
      }
      if (message?.type === "ANALYZE_SELECTION") {
        void handleAnalyzeSelection(message.pastedText).then(sendResponse);
        return true;
      }
      return false;
    },
  );
}
