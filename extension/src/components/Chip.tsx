import type { AnalyzeResult, Recommendation, SignalLevel } from "../types";

const VERDICT_META: Record<
  Recommendation,
  { icon: string; label: string; cls: string }
> = {
  READ:  { icon: "✓", label: "READ",  cls: "ap-chip--read"  },
  MAYBE: { icon: "ⓘ", label: "MAYBE", cls: "ap-chip--maybe" },
  SKIP:  { icon: "✕", label: "SKIP",  cls: "ap-chip--skip"  },
};

interface ChipProps {
  result: AnalyzeResult;
  onExpand: () => void;
  onClose: () => void;
  fading?: boolean;
}

export function Chip({ result, onExpand, onClose, fading = false }: ChipProps) {
  const meta = VERDICT_META[result.recommendation];
  return (
    <div
      class={`ap-chip ${meta.cls}${fading ? " ap-chip--fading" : ""}`}
      role="status"
      aria-label={`${meta.label} · score ${result.signal_score} — click to expand`}
    >
      <button
        class="ap-chip__body"
        onClick={onExpand}
        aria-expanded="false"
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">{meta.icon}</span>
        <span>{meta.label}</span>
        <span class="ap-card__score">· {result.signal_score}</span>
      </button>
      <button
        class="ap-chip__close"
        onClick={onClose}
        aria-label="Dismiss analysis"
      >
        ✕
      </button>
    </div>
  );
}

export function ErrorChip({
  error,
  onRetry,
  onClose,
}: {
  error: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const short = error.length > 55 ? error.slice(0, 55) + "…" : error;
  return (
    <div class="ap-chip ap-chip--error" role="alert">
      <span aria-hidden="true">⚠️</span>
      <span>{short}</span>
      <button class="ap-chip__action" onClick={onRetry}>
        Retry
      </button>
      <button class="ap-chip__close" onClick={onClose} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

// Colour for signal bars.
export function barColor(key: string, value: number): string {
  const isPenalty = key === "engagement_bait" || key === "promotional" || key === "ai_style";
  if (isPenalty) {
    if (value >= 60) return "#dc2626";
    if (value >= 35) return "#d97706";
    return "#9ca3af";
  }
  if (value >= 70) return "#16a34a";
  if (value >= 40) return "#d97706";
  return "#dc2626";
}

export const SIGNAL_META: Array<{
  key: keyof AnalyzeResult;
  label: string;
  weight: number;
  isPenalty: boolean;
}> = [
  { key: "relevance",          label: "Relevance",           weight: 0.15, isPenalty: false },
  { key: "specificity",        label: "Specificity",         weight: 0.25, isPenalty: false },
  { key: "originality",        label: "Originality",         weight: 0.20, isPenalty: false },
  { key: "practical_value",    label: "Practical value",     weight: 0.25, isPenalty: false },
  { key: "personal_experience",label: "Personal experience", weight: 0.15, isPenalty: false },
  { key: "engagement_bait",    label: "Engagement bait",     weight: 0.20, isPenalty: true  },
  { key: "promotional",        label: "Promotional",         weight: 0.08, isPenalty: true  },
  { key: "ai_style",           label: "AI-style writing",    weight: 0.12, isPenalty: true  },
];

export function topSignals(result: AnalyzeResult, n = 3) {
  return [...SIGNAL_META]
    .sort((a, b) => {
      const aScore = result[a.key] as number;
      const bScore = result[b.key] as number;
      const aDecisive = a.weight * Math.abs(aScore - 50);
      const bDecisive = b.weight * Math.abs(bScore - 50);
      return bDecisive - aDecisive;
    })
    .slice(0, n);
}

export { VERDICT_META };
export type { SignalLevel };
