// Popup UI: a "Should I Read This?" button that grabs the current
// selection on the active tab (or offers a paste fallback if there isn't
// one), then renders a READ/MAYBE/SKIP result card. On open, shows the
// last result if one is persisted, instead of always starting idle.
// Rendering is kept as small pure DOM functions so it can be driven
// directly in a real browser without needing a live site or backend
// (see tests/popup.spec.ts).

import { browserAPI } from "./browser-compat";
import { loadLastOutcome } from "./storage";
import type { AnalyzeResult, AnalyzeSelectionMessage, BackgroundResponse, Recommendation, SignalLevel } from "./types";

const SIGNAL_META: Record<SignalLevel, { emoji: string; label: string }> = {
  HIGH: { emoji: "🟢", label: "HIGH SIGNAL" },
  MAYBE: { emoji: "🟡", label: "MAYBE" },
  LOW: { emoji: "🔴", label: "LOW SIGNAL" },
};

const REASONS_INTRO: Record<Recommendation, string> = {
  READ: "Worth reading because:",
  MAYBE: "Mixed signal:",
  SKIP: "Skip because:",
};

export function renderIdle(root: HTMLElement): void {
  root.innerHTML = "";
  const button = document.createElement("button");
  button.id = "analyze-button";
  button.textContent = "Should I Read This?";
  button.addEventListener("click", () => void runAnalysis(root));
  root.appendChild(button);
}

export function renderLoading(root: HTMLElement): void {
  root.innerHTML = `<p id="status">Analyzing…</p>`;
}

export function renderError(root: HTMLElement, message: string): void {
  root.innerHTML = "";

  const error = document.createElement("p");
  error.id = "error";
  error.setAttribute("role", "alert");
  error.textContent = message;
  root.appendChild(error);

  const retry = document.createElement("button");
  retry.id = "retry-button";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => renderIdle(root));
  root.appendChild(retry);
}

export function renderPasteFallback(root: HTMLElement): void {
  root.innerHTML = "";

  const status = document.createElement("p");
  status.id = "status";
  status.textContent = "No text selected. Paste something to analyze:";
  root.appendChild(status);

  const textarea = document.createElement("textarea");
  textarea.id = "paste-input";
  textarea.rows = 6;
  textarea.placeholder = "Paste the text here…";
  root.appendChild(textarea);

  const submit = document.createElement("button");
  submit.id = "paste-analyze-button";
  submit.textContent = "Analyze pasted text";
  submit.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (text) void runAnalysis(root, text);
  });
  root.appendChild(submit);

  const cancel = document.createElement("button");
  cancel.id = "paste-cancel-button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => renderIdle(root));
  root.appendChild(cancel);
}

export function renderResult(root: HTMLElement, result: AnalyzeResult, readingMinutes: number): void {
  const meta = SIGNAL_META[result.signal_level];
  root.innerHTML = "";

  const card = document.createElement("div");
  card.className = "result-card";
  card.dataset.signalLevel = result.signal_level;

  const badge = document.createElement("div");
  badge.className = "result-badge";
  badge.textContent = `${meta.emoji} ${meta.label} — ${result.signal_score}`;
  card.appendChild(badge);

  const intro = document.createElement("div");
  intro.className = "result-reasons-intro";
  intro.textContent = REASONS_INTRO[result.recommendation];
  card.appendChild(intro);

  const reasons = document.createElement("ul");
  reasons.className = "result-reasons";
  for (const reason of result.reasons) {
    const item = document.createElement("li");
    item.textContent = reason;
    reasons.appendChild(item);
  }
  card.appendChild(reasons);

  const readingTime = document.createElement("div");
  readingTime.className = "result-reading-time";
  readingTime.textContent = `Estimated reading time: ${readingMinutes} min`;
  card.appendChild(readingTime);

  root.appendChild(card);

  const again = document.createElement("button");
  again.id = "analyze-again-button";
  again.textContent = "Analyze something else";
  again.addEventListener("click", () => renderIdle(root));
  root.appendChild(again);
}

async function runAnalysis(root: HTMLElement, pastedText?: string): Promise<void> {
  renderLoading(root);
  try {
    const message: AnalyzeSelectionMessage = { type: "ANALYZE_SELECTION", pastedText };
    const response = (await browserAPI.runtime.sendMessage(message)) as BackgroundResponse | undefined;

    if (!response) {
      renderError(root, "No response from the extension. Try reloading the page.");
      return;
    }
    if (response.status === "empty") {
      renderPasteFallback(root);
      return;
    }
    if (response.status === "error") {
      renderError(root, response.error);
      return;
    }
    renderResult(root, response.result, response.readingMinutes);
  } catch (error) {
    renderError(root, error instanceof Error ? error.message : "Something went wrong.");
  }
}

export async function init(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) return;

  const last = await loadLastOutcome();
  if (last?.status === "ok") {
    renderResult(root, last.result, last.readingMinutes);
    void browserAPI.action.setBadgeText({ text: "" });
  } else if (last?.status === "error") {
    renderError(root, last.error);
    void browserAPI.action.setBadgeText({ text: "" });
  } else {
    renderIdle(root);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => void init());
}
