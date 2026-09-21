// Service worker: relays a popup's "extract the current post" request to
// the content script on the relevant LinkedIn tab.
//
// Deliberately does NOT call the backend itself. Chrome can suspend an MV3
// service worker when it judges it idle, which can silently drop an
// in-flight fetch() -- and having DevTools open on the service worker
// masks this entirely, because Chrome keeps an inspected service worker
// alive. (Observed directly: this extension worked with the background
// service worker's DevTools open and failed once closed -- the textbook
// symptom.) popup.ts does the backend fetch instead (see src/analyze.ts):
// a popup page stays alive for as long as it's open and isn't subject to
// the same suspension.

import type { ExtractedPost } from "./types";

type ExtractMessage = { type: "EXTRACT_CURRENT_POST" };
type BackgroundResponse = { ok: true; post: ExtractedPost } | { ok: false; error: string };

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

  const message = { type: "EXTRACT_POST" };
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Chrome only injects content_scripts into a tab on a real document
    // load. A tab that was already open before the extension was
    // installed/reloaded has no listener yet, and this is the (fairly
    // cryptic) error chrome.tabs.sendMessage throws in that case --
    // reword it into something the user can actually act on.
    if (error instanceof Error && error.message.includes("Receiving end does not exist")) {
      throw new Error(
        "This LinkedIn tab hasn't loaded the extension yet. Reload the tab and try again.",
      );
    }
    throw error;
  }
}

export async function handleExtractCurrentPost(): Promise<BackgroundResponse> {
  try {
    const post = await extractPostFromLinkedInTab();
    if (!post) {
      return {
        ok: false,
        error: "Couldn't find a LinkedIn post on this tab. Open a post and try again.",
      };
    }
    return { ok: true, post };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Couldn't read the LinkedIn post.",
    };
  }
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: ExtractMessage, _sender, sendResponse) => {
    if (message?.type === "EXTRACT_CURRENT_POST") {
      void handleExtractCurrentPost().then(sendResponse);
      return true; // keep the message channel open for the async response
    }
    return false;
  });
}
