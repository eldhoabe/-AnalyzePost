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

export interface ExtractedPost {
  author: string | null;
  text: string;
  url: string;
}

export const DEFAULT_PROFILE: Profile = {
  role: "",
  interests: [],
};
