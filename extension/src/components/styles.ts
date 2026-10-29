// All CSS injected into the Shadow DOM root. Kept here so the build can
// tree-shake it if the content script is not bundled.

export const SHADOW_STYLES = `
/* ── Reset ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Tokens ─────────────────────────────────────────────── */
:host {
  --ap-read:   #16a34a;
  --ap-maybe:  #d97706;
  --ap-skip:   #dc2626;
  --ap-read-bg:   #f0fdf4;
  --ap-maybe-bg:  #fffbeb;
  --ap-skip-bg:   #fef2f2;
  --ap-read-border:   #bbf7d0;
  --ap-maybe-border:  #fde68a;
  --ap-skip-border:   #fecaca;
  --ap-shadow: 0 4px 16px rgba(0,0,0,.14), 0 1px 4px rgba(0,0,0,.08);
  --ap-radius-pill: 999px;
  --ap-radius-card: 12px;
  --ap-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --ap-text: #111827;
  --ap-muted: #6b7280;
  --ap-bg: #ffffff;
  --ap-border: #e5e7eb;
  --ap-bar-bg: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  :host {
    --ap-text:   #f9fafb;
    --ap-muted:  #9ca3af;
    --ap-bg:     #1f2937;
    --ap-border: #374151;
    --ap-bar-bg: #374151;
    --ap-read-bg:   #052e16;
    --ap-maybe-bg:  #451a03;
    --ap-skip-bg:   #450a0a;
    --ap-read-border:   #14532d;
    --ap-maybe-border:  #78350f;
    --ap-skip-border:   #7f1d1d;
    --ap-shadow: 0 4px 20px rgba(0,0,0,.5);
  }
}

/* ── Enter animation ─────────────────────────────────────── */
@keyframes ap-enter {
  from { opacity: 0; transform: scale(.95) translateY(-4px); }
  to   { opacity: 1; transform: scale(1)   translateY(0);    }
}
@media (prefers-reduced-motion: reduce) {
  .ap-pill, .ap-chip, .ap-card { animation: none !important; }
}

/* ── Pill (loading) ──────────────────────────────────────── */
.ap-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--ap-radius-pill);
  background: var(--ap-bg);
  border: 1px solid var(--ap-border);
  box-shadow: var(--ap-shadow);
  font-family: var(--ap-font);
  font-size: 13px;
  font-weight: 500;
  color: var(--ap-muted);
  white-space: nowrap;
  pointer-events: all;
  animation: ap-enter 150ms cubic-bezier(.16,1,.3,1) both;
  user-select: none;
}

/* Spinner dot */
.ap-spinner {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: .5;
  animation: ap-pulse 1s ease-in-out infinite;
}
@keyframes ap-pulse {
  0%, 100% { opacity: .3; }
  50%       { opacity: .9; }
}

/* ── Chip (verdict / error) ──────────────────────────────── */
.ap-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--ap-radius-pill);
  background: var(--ap-bg);
  border: 1px solid var(--ap-border);
  box-shadow: var(--ap-shadow);
  font-family: var(--ap-font);
  font-size: 13px;
  font-weight: 600;
  color: var(--ap-text);
  white-space: nowrap;
  pointer-events: all;
  animation: ap-enter 150ms cubic-bezier(.16,1,.3,1) both;
  user-select: none;
}

.ap-chip__body {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font: inherit;
  color: inherit;
  padding: 0;
  line-height: 1;
}
.ap-chip__body:focus-visible { outline: 2px solid currentColor; border-radius: 4px; }

.ap-chip--read  { color: var(--ap-read);  background: var(--ap-read-bg);  border-color: var(--ap-read-border);  }
.ap-chip--maybe { color: var(--ap-maybe); background: var(--ap-maybe-bg); border-color: var(--ap-maybe-border); }
.ap-chip--skip  { color: var(--ap-skip);  background: var(--ap-skip-bg);  border-color: var(--ap-skip-border);  }
.ap-chip--error { color: var(--ap-skip);  background: var(--ap-skip-bg);  border-color: var(--ap-skip-border);  font-weight: 500; }

/* Circle icon inside chip — matches card header icon style */
.ap-chip__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}
.ap-chip--read  .ap-chip__icon { background: var(--ap-read);  color: #fff; }
.ap-chip--maybe .ap-chip__icon { background: var(--ap-maybe); color: #fff; }
.ap-chip--skip  .ap-chip__icon { background: var(--ap-skip);  color: #fff; }

.ap-chip__action {
  background: none;
  border: none;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
  padding: 0 2px;
  text-decoration: underline;
}
.ap-chip__action:focus-visible { outline: 2px solid currentColor; border-radius: 2px; }

.ap-chip__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: none;
  border: none;
  cursor: pointer;
  opacity: .5;
  font-size: 11px;
  color: inherit;
  padding: 0;
  line-height: 1;
}
.ap-chip__close:hover { opacity: 1; }
.ap-chip__close:focus-visible { outline: 2px solid currentColor; opacity: 1; }

/* Chip fading out (chip-idle timeout) */
@keyframes ap-chip-fade {
  from { opacity: 1; }
  to   { opacity: 0; pointer-events: none; }
}
.ap-chip--fading {
  animation: ap-chip-fade 600ms ease forwards;
}

/* ── Card ────────────────────────────────────────────────── */
.ap-card {
  width: 328px;
  border-radius: var(--ap-radius-card);
  background: var(--ap-bg);
  border: 1px solid var(--ap-border);
  box-shadow: var(--ap-shadow);
  font-family: var(--ap-font);
  font-size: 14px;
  color: var(--ap-text);
  overflow: hidden;
  pointer-events: all;
  animation: ap-enter 150ms cubic-bezier(.16,1,.3,1) both;
}

/* Header */
.ap-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--ap-border);
}
.ap-card__head--read  { background: var(--ap-read-bg);  }
.ap-card__head--maybe { background: var(--ap-maybe-bg); }
.ap-card__head--skip  { background: var(--ap-skip-bg);  }

.ap-card__verdict {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.ap-card__icon {
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}
.ap-card__head--read  .ap-card__icon { background: var(--ap-read);  color: #fff; }
.ap-card__head--maybe .ap-card__icon { background: var(--ap-maybe); color: #fff; }
.ap-card__head--skip  .ap-card__icon { background: var(--ap-skip);  color: #fff; }
.ap-card__label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -.01em;
}
.ap-card__label--read  { color: var(--ap-read);  }
.ap-card__label--maybe { color: var(--ap-maybe); }
.ap-card__label--skip  { color: var(--ap-skip);  }

.ap-card__score {
  font-size: 13px;
  font-weight: 600;
  color: var(--ap-muted);
}
.ap-card__summary {
  font-size: 12px;
  color: var(--ap-muted);
  font-style: italic;
}
.ap-card__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ap-muted);
  font-size: 14px;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
}
.ap-card__close-btn:hover { color: var(--ap-text); background: var(--ap-border); }
.ap-card__close-btn:focus-visible { outline: 2px solid var(--ap-text); }

/* Body */
.ap-card__body { padding: 12px 14px; }

.ap-card__whole-post {
  font-size: 12px;
  color: var(--ap-muted);
  font-style: italic;
  margin-bottom: 10px;
}

/* Signal bars */
.ap-signals { display: flex; flex-direction: column; gap: 6px; }

.ap-signal-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ap-signal-row__label {
  width: 130px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ap-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ap-signal-row__bar-wrap {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--ap-bar-bg);
  overflow: hidden;
}
.ap-signal-row__bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width .3s ease;
}
.ap-signal-row__val {
  width: 26px;
  text-align: right;
  font-size: 11px;
  font-weight: 600;
  color: var(--ap-muted);
  flex-shrink: 0;
}

/* Disclosure toggle */
.ap-disclosure {
  background: none;
  border: none;
  font: inherit;
  font-size: 12px;
  color: var(--ap-muted);
  cursor: pointer;
  padding: 6px 0 0;
  text-decoration: underline;
}
.ap-disclosure:focus-visible { outline: 2px solid var(--ap-text); border-radius: 2px; }

/* Reasons */
.ap-reasons {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ap-reasons li {
  font-size: 12px;
  color: var(--ap-muted);
  padding-left: 14px;
  position: relative;
}
.ap-reasons li::before {
  content: '·';
  position: absolute;
  left: 4px;
  font-weight: 700;
}

/* Footer */
.ap-card__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--ap-border);
  flex-wrap: wrap;
}
.ap-card__reading-time {
  flex: 1;
  font-size: 12px;
  color: var(--ap-muted);
}
.ap-card__action {
  background: none;
  border: 1px solid var(--ap-border);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--ap-text);
  cursor: pointer;
  padding: 4px 10px;
  white-space: nowrap;
}
.ap-card__action:hover { background: var(--ap-border); }
.ap-card__action:focus-visible { outline: 2px solid var(--ap-text); }
.ap-card__action--primary {
  background: var(--ap-text);
  color: var(--ap-bg);
  border-color: transparent;
}
.ap-card__action--primary:hover { opacity: .85; }

/* ── Compact card variant ────────────────────────────────── */
.ap-card--compact {
  width: 268px;
}

/* Subtitle shown only in compact card: "Mixed signal · N min read" */
.ap-card__subtitle {
  padding: 4px 14px 8px;
  font-size: 12px;
  color: var(--ap-muted);
  border-bottom: 1px solid var(--ap-border);
}

/* ── Pin button active state ─────────────────────────────── */
.ap-card__close-btn--active {
  color: var(--ap-text);
  background: var(--ap-border);
}

/* ── Countdown ring ──────────────────────────────────────── */
@keyframes ap-countdown {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: 50.27; }
}

.ap-countdown {
  flex-shrink: 0;
  overflow: visible;
}

.ap-countdown__track {
  fill: none;
  stroke: var(--ap-bar-bg);
  stroke-width: 2;
}

.ap-countdown__ring {
  fill: none;
  stroke: var(--ap-muted);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 50.27;
  stroke-dashoffset: 0;
  transform-origin: 10px 10px;
  transform: rotate(-90deg);
  animation: ap-countdown var(--ap-dwell-ms, 6000ms) linear forwards;
  animation-play-state: var(--ap-play, running);
}

/* "hides soon" text — hidden by default; shown instead of ring when motion is reduced */
.ap-hides-soon {
  font-size: 11px;
  color: var(--ap-muted);
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .ap-countdown { display: none; }
  .ap-hides-soon { display: block; }
  .ap-countdown__ring { animation: none; }
}

/* ── Screen-reader utility ───────────────────────────────── */
.ap-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
`;
