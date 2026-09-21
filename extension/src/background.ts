// Service worker: relays a popup's "analyze the current post" request to
// the content script on the relevant LinkedIn tab, then to the backend.

import { API_BASE } from "./config";
import { loadProfile } from "./storage";
import type { AnalyzeResult, ExtractedPost } from "./types";

type AnalyzeMessage = { type: "ANALYZE_CURRENT_POST" };
type ExtractMessage = { type: "EXTRACT_POST" };
type BackgroundResponse = { ok: true; result: AnalyzeResult } | { ok: false; error: string };

async function findLinkedInTabId(): Promise<number | null> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.url?.includes("linkedin.com")) {
    return activeTab.id ?? null;
  }

  // The active tab isn't LinkedIn (e.g. the user is on the extension's
  // own page). Fall back to the most recently accessed LinkedIn tab
  // instead of giving up -- a real popup never steals tab focus, but
  // this keeps things working in the same edge cases either way.
  const linkedInTabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
  const mostRecent = [...linkedInTabs].sort(
    (a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
  )[0];
  return mostRecent?.id ?? null;
}

async function extractPostFromLinkedInTab(): Promise<ExtractedPost | null> {
  const tabId = await findLinkedInTabId();
  if (tabId == null) return null;

  const message: ExtractMessage = { type: "EXTRACT_POST" };
  return chrome.tabs.sendMessage(tabId, message);
}

async function fetchAnalysis(post: ExtractedPost): Promise<AnalyzeResult> {
  const profile = await loadProfile();
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

export async function handleAnalyzeCurrentPost(): Promise<BackgroundResponse> {
  try {
    const post = await extractPostFromLinkedInTab();
    if (!post) {
      return {
        ok: false,
        error: "Couldn't find a LinkedIn post on this tab. Open a post and try again.",
      };
    }

    const result = await fetchAnalysis(post);
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Couldn't reach the analysis backend.",
    };
  }
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: AnalyzeMessage, _sender, sendResponse) => {
    if (message?.type === "ANALYZE_CURRENT_POST") {
      void handleAnalyzeCurrentPost().then(sendResponse);
      return true; // keep the message channel open for the async response
    }
    return false;
  });
}
