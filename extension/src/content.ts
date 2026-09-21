// Finds the LinkedIn post the user is currently looking at and extracts
// its author, text, and URL. Manual/single-post extraction only for v1
// (spec section 9/15): LinkedIn's DOM can change, so this deliberately
// does not attempt to crawl or watch the whole feed.

import type { ExtractedPost } from "./types";

// Ordered by how stable each selector is expected to be. data-urn is a
// long-standing LinkedIn convention for identifying a feed item and is
// far less likely to change than obfuscated class names.
const POST_CONTAINER_SELECTORS = [
  "[data-urn^='urn:li:activity']",
  ".feed-shared-update-v2",
  "article",
];

const AUTHOR_SELECTORS = [".update-components-actor__name", "a[href*='/in/']"];

const TEXT_SELECTORS = [
  ".feed-shared-update-v2__description .break-words",
  ".feed-shared-update-v2__description",
  ".update-components-text",
];

export function findPostContainer(
  root: ParentNode,
  selectionNode: Node | null,
): Element | null {
  if (selectionNode) {
    const el =
      selectionNode.nodeType === Node.ELEMENT_NODE
        ? (selectionNode as Element)
        : selectionNode.parentElement;
    const container = el?.closest(POST_CONTAINER_SELECTORS.join(","));
    if (container) return container;
  }

  for (const selector of POST_CONTAINER_SELECTORS) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function firstMatch(container: Element, selectors: string[]): Element | null {
  for (const selector of selectors) {
    const found = container.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function extractAuthor(container: Element): string | null {
  const text = firstMatch(container, AUTHOR_SELECTORS)?.textContent?.trim();
  return text || null;
}

function extractText(container: Element): string {
  const el = firstMatch(container, TEXT_SELECTORS) ?? container;
  return el.textContent?.trim() ?? "";
}

function extractUrl(container: Element): string {
  const permalink = container.querySelector<HTMLAnchorElement>("a[href*='/feed/update/']");
  if (permalink) return permalink.href;

  const urn = container.getAttribute("data-urn");
  if (urn) return `https://www.linkedin.com/feed/update/${urn}/`;

  return typeof location !== "undefined" ? location.href : "";
}

export function extractPost(
  root: ParentNode = document,
  selectionNode: Node | null = typeof window !== "undefined"
    ? (window.getSelection()?.anchorNode ?? null)
    : null,
): ExtractedPost | null {
  const container = findPostContainer(root, selectionNode);
  if (!container) return null;

  const text = extractText(container);
  if (!text) return null;

  return {
    author: extractAuthor(container),
    text,
    url: extractUrl(container),
  };
}

// LinkedIn's feed re-renders/reconciles its DOM frequently (observed
// live: the same query can go from several matches to zero matches
// between two checks a few seconds apart, with no scrolling in between --
// not stale selectors, an actual transient state). A single synchronous
// extractPost() call can race that and come back empty even when a post
// is clearly on screen. Retry a few times with a short delay before
// truly giving up, rather than failing on the first unlucky read.
export function extractPostWithRetry(
  root: ParentNode = document,
  selectionNode: Node | null = typeof window !== "undefined"
    ? (window.getSelection()?.anchorNode ?? null)
    : null,
  maxAttempts = 5,
  delayMs = 200,
): Promise<ExtractedPost | null> {
  return new Promise((resolve) => {
    let attempt = 0;
    const tryOnce = () => {
      const post = extractPost(root, selectionNode);
      if (post || attempt >= maxAttempts - 1) {
        resolve(post);
        return;
      }
      attempt++;
      setTimeout(tryOnce, delayMs);
    };
    tryOnce();
  });
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "EXTRACT_POST") {
      void extractPostWithRetry().then(sendResponse);
      return true;
    }
    return false;
  });
}
