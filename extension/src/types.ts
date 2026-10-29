// Mirrors backend/app/models.py's AnalyzeRequest/AnalyzeResponse contract.

export interface Profile {
  role: string;
  interests: string[];
}

export type Recommendation = "READ" | "MAYBE" | "SKIP";
export type SignalLevel = "HIGH" | "MAYBE" | "LOW";

export interface ExtractedPost {
  text: string;
}

export interface AnalyzeResult {
  recommendation: Recommendation;
  signal_level: SignalLevel;
  signal_score: number;
  relevance: number;
  specificity: number;
  originality: number;
  practical_value: number;
  personal_experience: number;
  engagement_bait: number;
  promotional: number;
  ai_style: number;
  reasons: string[];
}

// Legacy popup message (kept for backwards compat with existing tests).
export interface AnalyzeSelectionMessage {
  type: "ANALYZE_SELECTION";
  pastedText?: string;
}

// Background → Content Script: background has the text, content script needs to
// capture the current Range and show the loading state.
export interface AnalyzeTriggerMessage {
  type: "ANALYZE_TRIGGERED";
  text: string; // empty string → content script uses fallback article/main detection
}

// Content Script → Background: content script delegates the actual fetch to the
// background so no API key or host permission is needed in the content script.
export interface FetchAnalysisMessage {
  type: "FETCH_ANALYSIS";
  text: string;
  requestId: number;
}

// Persisted to chrome.storage.session so the popup can show the last result on
// open. "empty" is a transient reply, never persisted.
export type AnalyzeOutcome =
  | { status: "ok"; result: AnalyzeResult; readingMinutes: number }
  | { status: "error"; error: string };

export type BackgroundResponse = AnalyzeOutcome | { status: "empty" };

export const DEFAULT_PROFILE: Profile = {
  role: "",
  interests: [],
};

// Extension settings stored in chrome.storage.local.

/**
 * How the card behaves after a verdict arrives:
 *   verdict-only    – chip only, never auto-opens
 *   auto-compact    – chip → compact card (auto-hides) [DEFAULT]
 *   auto-stay       – chip → full card (auto-hides)
 *   click-to-open   – chip only; user clicks to open full card
 *
 * Migration: old { autoOpenCard: true }  → "auto-stay"
 *            old { autoOpenCard: false } → "click-to-open"
 *            no stored value             → "auto-compact" (new default)
 */
export type DisplayMode =
  | "verdict-only"
  | "auto-compact"
  | "auto-stay"
  | "click-to-open";

/**
 * How long the auto-opened card stays before collapsing.
 *   "verdict-aware" – READ 6 s, MAYBE 9 s, SKIP 6 s [DEFAULT]
 *   "off"           – never auto-hides
 *   number          – fixed milliseconds (4000 | 6000 | 9000 | 15000)
 */
export type AutoHideMs = "verdict-aware" | "off" | number;

export interface Settings {
  displayMode: DisplayMode;
  autoHideMs: AutoHideMs;
  keepChip: boolean;       // false = chip fades after 30 s (default)
  disabledSites: string[]; // hostnames where the inline card is suppressed
}

export const DEFAULT_SETTINGS: Settings = {
  displayMode: "auto-compact",
  autoHideMs: "verdict-aware",
  keepChip: false,
  disabledSites: [],
};

// One entry in the 20-item history stored in chrome.storage.local.
export interface AnalysisRecord {
  id: string;
  textSnippet: string; // first 120 chars of the analyzed text
  outcome: AnalyzeOutcome;
  timestamp: number; // Date.now()
  hostname: string;
}
