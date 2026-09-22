// Mirrors backend/app/models.py's AnalyzeRequest/AnalyzeResponse contract.

export interface Profile {
  role: string;
  interests: string[];
}

export type Recommendation = "READ" | "MAYBE" | "SKIP";
export type SignalLevel = "HIGH" | "MAYBE" | "LOW";

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

export interface AnalyzeSelectionMessage {
  type: "ANALYZE_SELECTION";
  pastedText?: string;
}

// Persisted to chrome.storage.session so the popup can show the last
// result on open. "empty" (no selection, no paste yet) is intentionally
// excluded -- it's a transient reply, never worth restoring later.
export type AnalyzeOutcome =
  | { status: "ok"; result: AnalyzeResult; readingMinutes: number }
  | { status: "error"; error: string };

export type BackgroundResponse = AnalyzeOutcome | { status: "empty" };

export const DEFAULT_PROFILE: Profile = {
  role: "",
  interests: [],
};
