// Centralised timer controller for the auto-hide sequence.
// All timers in the card lifecycle run through this so pause/resume/cancel
// is always in one place and no stray setTimeout handles escape after teardown.

import type { Recommendation } from "./types";

// ── Timing constants (easy to find and adjust) ─────────────────────────────

/** Delay between verdict chip appearing and card auto-opening. */
export const AUTO_OPEN_DELAY_MS = 600;

/** How long the card stays open before auto-collapsing, by verdict. */
export const DWELL_MS: Record<Recommendation, number> = {
  READ:  6_000,
  MAYBE: 9_000,
  SKIP:  6_000,
};

/** Grace period after hover/focus leaves before the dwell timer resumes. */
export const RESUME_GRACE_MS = 1_500;

/** Idle time before the verdict chip fades out (when keepChip is false). */
export const CHIP_IDLE_MS = 30_000;

/** Duration of the chip fade-out CSS transition (keep in sync with CSS). */
export const FADE_DURATION_MS = 600;

// ── TimerController ────────────────────────────────────────────────────────

export class TimerController {
  private readonly totalMs: number;
  private remaining: number;
  private startedAt: number | null = null;
  private mainId: ReturnType<typeof window.setTimeout> | null = null;
  private graceId: ReturnType<typeof window.setTimeout> | null = null;
  private _cancelled = false;
  private readonly onComplete: () => void;

  constructor(totalMs: number, onComplete: () => void) {
    this.totalMs = totalMs;
    this.remaining = totalMs;
    this.onComplete = onComplete;
  }

  start(): void {
    if (this._cancelled || this.startedAt !== null || this.mainId !== null) return;
    this._arm();
  }

  pause(): void {
    if (this._cancelled) return;
    // Cancel any pending grace period.
    if (this.graceId !== null) {
      clearTimeout(this.graceId);
      this.graceId = null;
    }
    if (this.startedAt === null) return; // already paused
    const elapsed = Date.now() - this.startedAt;
    this.remaining = Math.max(0, this.remaining - elapsed);
    if (this.mainId !== null) {
      clearTimeout(this.mainId);
      this.mainId = null;
    }
    this.startedAt = null;
  }

  resume(graceMs = 0): void {
    if (this._cancelled || this.startedAt !== null || this.graceId !== null) return;
    if (graceMs <= 0) {
      this._arm();
    } else {
      this.graceId = setTimeout(() => {
        this.graceId = null;
        if (!this._cancelled && this.startedAt === null) {
          this._arm();
        }
      }, graceMs);
    }
  }

  cancel(): void {
    if (this._cancelled) return;
    this._cancelled = true;
    if (this.graceId !== null) { clearTimeout(this.graceId); this.graceId = null; }
    if (this.mainId !== null)  { clearTimeout(this.mainId);  this.mainId = null;  }
    this.startedAt = null;
  }

  get cancelled(): boolean { return this._cancelled; }

  /** Remaining milliseconds (accounts for time already elapsed while running). */
  get remainingMs(): number {
    if (this.startedAt === null) return this.remaining;
    return Math.max(0, this.remaining - (Date.now() - this.startedAt));
  }

  /** 0–1 progress (0 = just started, 1 = complete). */
  get progress(): number {
    return 1 - this.remainingMs / this.totalMs;
  }

  get totalDuration(): number { return this.totalMs; }

  private _arm(): void {
    this.startedAt = Date.now();
    this.mainId = setTimeout(() => {
      this.mainId = null;
      this.startedAt = null;
      if (!this._cancelled) this.onComplete();
    }, this.remaining);
  }
}
