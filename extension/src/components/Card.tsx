import { useState } from "preact/hooks";
import type { AnalyzeResult } from "../types";
import { VERDICT_META, SIGNAL_META, topSignals, barColor } from "./Chip";

interface CardProps {
  result: AnalyzeResult;
  readingMinutes: number;
  isWholePost: boolean;
  compact?: boolean;
  isPinned?: boolean;
  showCountdown?: boolean;
  isCountdownPaused?: boolean;
  dwellMs?: number;
  onClose: () => void;
  onCollapse: () => void;
  onReanalyze: () => void;
  onEngage?: () => void;
  onPinToggle?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocusIn?: (e: FocusEvent) => void;
  onFocusOut?: (e: FocusEvent) => void;
  onExpandToFull?: () => void;
}

const REASONS_INTRO: Record<string, string> = {
  READ:  "Worth reading because",
  MAYBE: "Mixed signal",
  SKIP:  "Skip because",
};

// r=8 → circumference ≈ 50.27
const RING_R = 8;
const RING_C = +(2 * Math.PI * RING_R).toFixed(2); // 50.27

export function Card({
  result,
  readingMinutes,
  isWholePost,
  compact = false,
  isPinned = false,
  showCountdown = false,
  isCountdownPaused = false,
  dwellMs = 6000,
  onClose,
  onCollapse,
  onReanalyze,
  onEngage,
  onPinToggle,
  onPointerEnter,
  onPointerLeave,
  onFocusIn,
  onFocusOut,
  onExpandToFull,
}: CardProps) {
  const [showAll, setShowAll] = useState(false);
  const meta = VERDICT_META[result.recommendation];
  const displayedSignals = compact
    ? topSignals(result, 3)
    : showAll
    ? SIGNAL_META
    : topSignals(result, 3);

  function handleCopy() {
    const text = [
      `${meta.label} · ${result.signal_score}/100`,
      "",
      REASONS_INTRO[result.recommendation] + ":",
      ...result.reasons.map((r) => `• ${r}`),
      "",
      `Reading time: ~${readingMinutes} min`,
    ].join("\n");
    void navigator.clipboard.writeText(text).catch(() => undefined);
    onEngage?.();
  }

  function handleReanalyze() {
    onReanalyze();
    onEngage?.();
  }

  const levelCls =
    result.signal_level === "HIGH" ? "read" :
    result.signal_level === "MAYBE" ? "maybe" : "skip";

  return (
    <div
      class={`ap-card${compact ? " ap-card--compact" : ""}`}
      role="dialog"
      aria-label={`Analysis: ${meta.label}`}
      onPointerEnter={onPointerEnter ? () => onPointerEnter() : undefined}
      onPointerLeave={onPointerLeave ? () => onPointerLeave() : undefined}
      onFocusIn={onFocusIn ? (e: FocusEvent) => onFocusIn(e) : undefined}
      onFocusOut={onFocusOut ? (e: FocusEvent) => onFocusOut(e) : undefined}
    >
      {/* Header */}
      <div class={`ap-card__head ap-card__head--${levelCls}`}>
        <div class="ap-card__verdict">
          <span class="ap-card__icon" aria-hidden="true">{meta.icon}</span>
          <span class={`ap-card__label ap-card__label--${levelCls}`}>{meta.label}</span>
          <span class="ap-card__score">· {result.signal_score}</span>
        </div>

        {showCountdown && (
          <>
            <svg
              class="ap-countdown"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              aria-hidden="true"
              style={{
                "--ap-dwell-ms": `${dwellMs}ms`,
                "--ap-play": isCountdownPaused ? "paused" : "running",
              } as Record<string, string>}
            >
              <circle class="ap-countdown__track" r={RING_R} cx="10" cy="10" />
              <circle
                class="ap-countdown__ring"
                r={RING_R}
                cx="10"
                cy="10"
                style={{ "--ap-ring-c": String(RING_C) } as Record<string, string>}
              />
            </svg>
            <span class="ap-hides-soon" aria-hidden="true">hides soon</span>
          </>
        )}

        {!compact && onPinToggle && (
          <button
            class={`ap-card__close-btn${isPinned ? " ap-card__close-btn--active" : ""}`}
            onClick={() => { onPinToggle(); onEngage?.(); }}
            aria-label={isPinned ? "Unpin card" : "Pin card open"}
            aria-pressed={isPinned}
          >
            📌
          </button>
        )}

        <button
          class="ap-card__close-btn"
          onClick={onCollapse}
          aria-label="Collapse to chip"
        >
          ↙
        </button>
        <button
          class="ap-card__close-btn"
          onClick={onClose}
          aria-label="Dismiss analysis"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div
        class="ap-card__body"
        onClick={compact ? onExpandToFull : undefined}
        style={compact ? { cursor: "pointer" } : undefined}
      >
        {isWholePost && !compact && (
          <p class="ap-card__whole-post">Analyzed the whole post.</p>
        )}

        <div class="ap-signals" role="list" aria-label="Signal scores">
          {displayedSignals.map((sig) => {
            const val = result[sig.key] as number;
            return (
              <div class="ap-signal-row" role="listitem" key={sig.key}>
                <span class="ap-signal-row__label">{sig.label}</span>
                <div
                  class="ap-signal-row__bar-wrap"
                  role="presentation"
                  aria-label={`${sig.label}: ${val}`}
                >
                  <div
                    class="ap-signal-row__bar-fill"
                    style={{
                      width: `${val}%`,
                      background: barColor(sig.key as string, val),
                    }}
                  />
                </div>
                <span class="ap-signal-row__val" aria-hidden="true">{val}</span>
              </div>
            );
          })}
        </div>

        {compact ? (
          <p class="ap-card__reading-time ap-card__reading-time--compact">
            ~{readingMinutes} min read · click to expand
          </p>
        ) : (
          <>
            {!showAll && (
              <button
                class="ap-disclosure"
                onClick={() => { setShowAll(true); onEngage?.(); }}
                aria-expanded="false"
              >
                Show all 8 signals
              </button>
            )}
            {showAll && (
              <button
                class="ap-disclosure"
                onClick={() => setShowAll(false)}
                aria-expanded="true"
              >
                Show fewer
              </button>
            )}

            <ul class="ap-reasons" aria-label={REASONS_INTRO[result.recommendation]}>
              {result.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Footer — full card only */}
      {!compact && (
        <div class="ap-card__foot">
          <span class="ap-card__reading-time">~{readingMinutes} min read</span>
          <button class="ap-card__action" onClick={handleCopy} aria-label="Copy result to clipboard">
            Copy
          </button>
          <button class="ap-card__action" onClick={handleReanalyze}>
            Re-analyze
          </button>
        </div>
      )}
    </div>
  );
}
