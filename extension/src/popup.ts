// Popup: shows the last analysis result, or a "how to use" prompt if empty.
// Settings are gone — the inline card is now the primary UI.

import { browserAPI } from "./browser-compat";
import { loadLastOutcome } from "./storage";
import type { AnalyzeOutcome, Recommendation } from "./types";

const REC_META: Record<Recommendation, { icon: string; label: string; color: string; bg: string; border: string }> = {
  READ:  { icon: "✅", label: "READ",  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  MAYBE: { icon: "🟡", label: "MAYBE", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  SKIP:  { icon: "⛔", label: "SKIP",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

function renderEmpty(root: HTMLElement): void {
  root.innerHTML = `
    <div class="ap-popup-empty">
      <div class="ap-popup-empty__icon">📊</div>
      <p class="ap-popup-empty__title">No analysis yet</p>
      <p class="ap-popup-empty__hint">
        Select text on any page, then right-click and choose
        <strong>"Analyze this post"</strong> — or press <kbd>Alt+A</kbd>.
      </p>
      <p class="ap-popup-empty__hint">
        The verdict chip appears anchored to your selection.
      </p>
    </div>
  `;
}

function renderResult(root: HTMLElement, outcome: AnalyzeOutcome): void {
  if (outcome.status === "error") {
    root.innerHTML = `
      <div class="ap-popup-error">
        <span class="ap-popup-error__icon">⚠️</span>
        <p class="ap-popup-error__msg">${esc(outcome.error)}</p>
        <p class="ap-popup-empty__hint">Select text and right-click <strong>"Analyze this post"</strong> to try again.</p>
      </div>
    `;
    return;
  }

  const { result, readingMinutes } = outcome;
  const meta = REC_META[result.recommendation];

  const topReasons = result.reasons.slice(0, 3).map((r) => `<li>${esc(r)}</li>`).join("");

  root.innerHTML = `
    <div class="ap-popup-result" style="background:${meta.bg};border-color:${meta.border}">
      <div class="ap-popup-result__header">
        <span class="ap-popup-result__icon">${meta.icon}</span>
        <span class="ap-popup-result__label" style="color:${meta.color}">${meta.label}</span>
        <span class="ap-popup-result__score">${result.signal_score}<span class="ap-popup-result__score-max">/100</span></span>
      </div>
      <ul class="ap-popup-result__reasons">${topReasons}</ul>
      <p class="ap-popup-result__meta">~${readingMinutes} min read</p>
    </div>
    <p class="ap-popup-footer">Select text → right-click → <strong>Analyze this post</strong></p>
  `;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function init(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) return;

  void browserAPI.action.setBadgeText({ text: "" });

  const outcome = await loadLastOutcome();
  if (!outcome) {
    renderEmpty(root);
  } else {
    renderResult(root, outcome);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => void init());
}
