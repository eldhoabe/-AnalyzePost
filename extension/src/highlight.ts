// CSS Custom Highlight API wrapper. Gracefully degrades on browsers that don't
// support it (no highlight, card still shows). Never mutates the page DOM.

const HIGHLIGHT_NAMES = {
  shimmer: "ap-shimmer",
  read: "ap-read",
  maybe: "ap-maybe",
  skip: "ap-skip",
} as const;

type HighlightKey = keyof typeof HIGHLIGHT_NAMES;

const SUPPORTED =
  typeof CSS !== "undefined" &&
  "highlights" in CSS &&
  typeof Highlight !== "undefined";

let rulesInjected = false;

export function injectHighlightRules(): void {
  if (rulesInjected || !SUPPORTED) return;
  const style = document.createElement("style");
  style.dataset.apHighlights = "1";
  style.textContent = `
    ::highlight(ap-shimmer)  { background-color: rgba(234, 179, 8,   0.28); }
    ::highlight(ap-read)     { background-color: rgba(22,  163, 74,  0.12); }
    ::highlight(ap-maybe)    { background-color: rgba(217, 119, 6,   0.12); }
    ::highlight(ap-skip)     { background-color: rgba(220, 38,  38,  0.12); }
  `;
  document.head.appendChild(style);
  rulesInjected = true;
}

export function applyHighlight(range: Range, key: HighlightKey): void {
  if (!SUPPORTED) return;
  clearAllHighlights();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (CSS as any).highlights.set(HIGHLIGHT_NAMES[key], new Highlight(range));
}

export function clearHighlight(key: HighlightKey): void {
  if (!SUPPORTED) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (CSS as any).highlights.delete(HIGHLIGHT_NAMES[key]);
}

export function clearAllHighlights(): void {
  if (!SUPPORTED) return;
  for (const name of Object.values(HIGHLIGHT_NAMES)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (CSS as any).highlights.delete(name);
  }
}
