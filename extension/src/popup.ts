// Popup UI (spec sections 4 and 10): a single button that asks
// background.ts to analyze the current post, then renders a READ/MAYBE/
// SKIP result card. Rendering is kept as small pure DOM functions so it
// can be driven directly in a real browser without needing a live
// LinkedIn tab or backend (see tests/popup.spec.ts).

import type { AnalyzeResult, SignalLevel } from "./types";

type AnalyzeMessage = { type: "ANALYZE_CURRENT_POST" };
type BackgroundResponse = { ok: true; result: AnalyzeResult } | { ok: false; error: string };

const SIGNAL_META: Record<SignalLevel, { emoji: string; label: string }> = {
  HIGH: { emoji: "🟢", label: "HIGH SIGNAL" },
  MAYBE: { emoji: "🟡", label: "MAYBE" },
  LOW: { emoji: "🔴", label: "LOW SIGNAL" },
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

export function renderResult(root: HTMLElement, result: AnalyzeResult): void {
  const meta = SIGNAL_META[result.signal_level];
  root.innerHTML = "";

  const card = document.createElement("div");
  card.className = "result-card";
  card.dataset.signalLevel = result.signal_level;

  const badge = document.createElement("div");
  badge.className = "result-badge";
  badge.textContent = `${meta.emoji} ${meta.label}`;
  card.appendChild(badge);

  const score = document.createElement("div");
  score.className = "result-score";
  score.textContent = `Signal: ${result.signal_score}`;
  card.appendChild(score);

  const reasons = document.createElement("ul");
  reasons.className = "result-reasons";
  for (const reason of result.reasons) {
    const item = document.createElement("li");
    item.textContent = reason;
    reasons.appendChild(item);
  }
  card.appendChild(reasons);

  const recommendation = document.createElement("div");
  recommendation.className = "result-recommendation";
  recommendation.textContent = `Recommendation: ${result.recommendation}`;
  card.appendChild(recommendation);

  root.appendChild(card);

  const again = document.createElement("button");
  again.id = "analyze-again-button";
  again.textContent = "Analyze another post";
  again.addEventListener("click", () => renderIdle(root));
  root.appendChild(again);
}

async function runAnalysis(root: HTMLElement): Promise<void> {
  renderLoading(root);
  try {
    const message: AnalyzeMessage = { type: "ANALYZE_CURRENT_POST" };
    const response = (await chrome.runtime.sendMessage(message)) as
      | BackgroundResponse
      | undefined;

    if (!response) {
      renderError(root, "No response from the extension. Try reloading the page.");
      return;
    }
    if (!response.ok) {
      renderError(root, response.error);
      return;
    }
    renderResult(root, response.result);
  } catch (error) {
    renderError(root, error instanceof Error ? error.message : "Something went wrong.");
  }
}

export function init(): void {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) return;
  renderIdle(root);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}
