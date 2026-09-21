// Calls the backend's /analyze route. Lives in its own module (imported by
// popup.ts, not background.ts) deliberately: see background.ts's own
// comment for why the network call doesn't belong in the service worker.

import { API_BASE } from "./config";
import type { AnalyzeResult, ExtractedPost, Profile } from "./types";

export async function fetchAnalysis(
  post: ExtractedPost,
  profile: Profile,
): Promise<AnalyzeResult> {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postText: post.text, profile }),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }
  return (await response.json()) as AnalyzeResult;
}
