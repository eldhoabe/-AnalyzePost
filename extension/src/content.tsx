// Content script: Shadow DOM chip + card anchored to the selected text.
// Lifecycle: loading → chip → card (compact) → card (full) → chip → [fade] → gone
// All API calls are delegated to the background service worker.

import { render } from "preact";
import type { ComponentChildren } from "preact";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "preact/hooks";
import { computePosition, flip, shift } from "@floating-ui/dom";
import type { Placement } from "@floating-ui/dom";
import { applyHighlight, clearAllHighlights, injectHighlightRules } from "./highlight";
import { Chip, ErrorChip } from "./components/Chip";
import { Card } from "./components/Card";
import { SHADOW_STYLES } from "./components/styles";
import { loadSettings } from "./storage";
import {
  AUTO_OPEN_DELAY_MS,
  CHIP_IDLE_MS,
  DWELL_MS,
  FADE_DURATION_MS,
  RESUME_GRACE_MS,
  TimerController,
} from "./timer";
import type {
  AnalyzeOutcome,
  AnalyzeTriggerMessage,
  AutoHideMs,
  FetchAnalysisMessage,
  Recommendation,
  Settings,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

// ── State machine ──────────────────────────────────────────────────────────

/**
 * Lifecycle phases:
 *   idle         nothing shown
 *   loading      "Analyzing…" pill
 *   chip         verdict chip only (between loading and card-open, and after collapse)
 *   card         compact or full card shown
 *   fading       chip fading out (chip idle timer expired)
 *   error        error chip (never auto-hides)
 */
type Phase = "idle" | "loading" | "chip" | "card" | "fading" | "error";
type CardMode = "compact" | "full";

interface State {
  phase: Phase;
  cardMode: CardMode;
  isPinned: boolean;
  autoHideCancelled: boolean; // true when user engaged or pinned; skips the dwell timer
  text: string;
  requestId: number;
  range: Range | null;
  outcome: AnalyzeOutcome | null;
  errorMsg: string;
  isWholePost: boolean;
  settings: Settings;
}

type Action =
  | { type: "TRIGGER"; text: string; range: Range | null; isWholePost: boolean }
  | { type: "RESULT"; requestId: number; outcome: AnalyzeOutcome }
  | { type: "AUTO_OPEN_CARD" }     // 600 ms auto-open timer fired
  | { type: "OPEN_CARD_USER" }     // user clicked chip
  | { type: "EXPAND_TO_FULL" }     // user hovered / focused compact card
  | { type: "COLLAPSE_TO_CHIP" }   // dwell timer / scroll / user collapsed
  | { type: "ENGAGE" }             // user clicked a card action → cancel auto-hide
  | { type: "PIN_TOGGLE" }         // pin icon clicked
  | { type: "START_FADE" }         // chip idle timer fired
  | { type: "CLOSE" }
  | { type: "RETRY" }
  | { type: "SETTINGS"; settings: Settings };

const INIT: State = {
  phase: "idle",
  cardMode: "compact",
  isPinned: false,
  autoHideCancelled: false,
  text: "",
  requestId: 0,
  range: null,
  outcome: null,
  errorMsg: "",
  isWholePost: false,
  settings: DEFAULT_SETTINGS,
};

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "TRIGGER":
      return {
        ...state,
        phase: "loading",
        text: action.text,
        range: action.range,
        isWholePost: action.isWholePost,
        requestId: state.requestId + 1,
        cardMode: "compact",
        isPinned: false,
        autoHideCancelled: false,
        outcome: null,
        errorMsg: "",
      };

    case "RESULT": {
      if (action.requestId !== state.requestId) return state;
      if (action.outcome.status === "error") {
        return { ...state, phase: "error", errorMsg: action.outcome.error };
      }
      return { ...state, phase: "chip", outcome: action.outcome, autoHideCancelled: false };
    }

    case "AUTO_OPEN_CARD": {
      if (state.phase !== "chip") return state;
      const mode: CardMode =
        state.settings.displayMode === "auto-stay" ? "full" : "compact";
      const cancelled = mode === "full"; // full-mode auto-open skips auto-hide
      return { ...state, phase: "card", cardMode: mode, autoHideCancelled: cancelled };
    }

    case "OPEN_CARD_USER":
      if (state.phase !== "chip") return state;
      return { ...state, phase: "card", cardMode: "full", autoHideCancelled: true };

    case "EXPAND_TO_FULL":
      if (state.phase !== "card" || state.cardMode === "full") return state;
      return { ...state, cardMode: "full" };

    case "COLLAPSE_TO_CHIP":
      if (state.phase !== "card") return state;
      return { ...state, phase: "chip", cardMode: "compact", isPinned: false };

    case "ENGAGE":
      return { ...state, autoHideCancelled: true };

    case "PIN_TOGGLE":
      return {
        ...state,
        isPinned: !state.isPinned,
        autoHideCancelled: !state.isPinned ? true : state.autoHideCancelled,
      };

    case "START_FADE":
      if (state.phase !== "chip") return state;
      return { ...state, phase: "fading" };

    case "CLOSE":
      return { ...INIT, settings: state.settings };

    case "RETRY":
      if (state.phase !== "error") return state;
      return {
        ...state,
        phase: "loading",
        requestId: state.requestId + 1,
        isPinned: false,
        autoHideCancelled: false,
        errorMsg: "",
      };

    case "SETTINGS":
      return { ...state, settings: action.settings };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveDwellMs(settings: Settings, rec: Recommendation): number | null {
  const raw: AutoHideMs = settings.autoHideMs;
  if (raw === "off") return null;
  if (raw === "verdict-aware") return DWELL_MS[rec];
  return typeof raw === "number" ? raw : null;
}

function shouldAutoOpen(settings: Settings): boolean {
  return settings.displayMode === "auto-compact" || settings.displayMode === "auto-stay";
}

// ── Shadow DOM ─────────────────────────────────────────────────────────────

const ROOT_ID = "__ap-root__";
let shadowHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let globalDispatch: ((a: Action) => void) | null = null;

function ensureMount() {
  if (shadowHost) return;
  shadowHost = document.createElement("div");
  shadowHost.id = ROOT_ID;
  shadowHost.setAttribute(
    "style",
    "position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0;pointer-events:none;",
  );
  document.documentElement.appendChild(shadowHost);
  shadowRoot = shadowHost.attachShadow({ mode: "open" });
  render(<App />, shadowRoot);
}

// ── Floating position hook ─────────────────────────────────────────────────

function useFloating(
  range: Range | null,
  ref: { readonly current: HTMLElement | null },
  placement: Placement = "bottom-end",
) {
  const [style, setStyle] = useState({ left: "0px", top: "0px" });
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const update = useCallback(() => {
    const r = rangeRef.current;
    const el = ref.current;
    if (!r || !el) return;
    const rects = r.getClientRects();
    const anchor = rects[rects.length - 1] ?? r.getBoundingClientRect();
    void computePosition({ getBoundingClientRect: () => anchor } as Element, el, {
      placement,
      strategy: "fixed",
      middleware: [flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => setStyle({ left: `${x}px`, top: `${y}px` }));
  }, [placement]);

  useEffect(() => {
    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, [update, range]);

  return style;
}

// ── FloatingContainer ─────────────────────────────────────────────────────

function FloatingContainer({
  range,
  placement = "bottom-end",
  children,
}: {
  range: Range | null;
  placement?: Placement;
  children: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useFloating(range, ref, placement);
  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        pointerEvents: "all",
        zIndex: "2147483647",
      }}
    >
      {children}
    </div>
  );
}

// ── LoadingPill ────────────────────────────────────────────────────────────

function LoadingPill({ range }: { range: Range | null }) {
  return (
    <FloatingContainer range={range}>
      <div class="ap-pill" role="status" aria-label="Analyzing selection">
        <span class="ap-spinner" aria-hidden="true" />
        Analyzing…
      </div>
    </FloatingContainer>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  const [state, dispatch] = useReducer(reduce, INIT);

  // Timer state separate from reducer (UI-only; doesn't affect phase logic).
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  const dwellTimerRef = useRef<TimerController | null>(null);
  const chipIdleTimerRef = useRef<TimerController | null>(null);

  // Expose dispatch for the onMessage handler outside the React tree.
  useEffect(() => {
    globalDispatch = dispatch;
    return () => { globalDispatch = null; };
  }, [dispatch]);

  // Load settings on mount.
  useEffect(() => {
    void loadSettings().then((s) => dispatch({ type: "SETTINGS", settings: s }));
  }, []);

  // Send FETCH_ANALYSIS to background whenever we enter 'loading'.
  useEffect(() => {
    if (state.phase !== "loading") return;
    const reqId = state.requestId;
    const text = state.text;

    if (text.length < 50) {
      dispatch({
        type: "RESULT",
        requestId: reqId,
        outcome: { status: "error", error: "Selection too short — select at least 50 characters." },
      });
      return;
    }

    const msg: FetchAnalysisMessage = { type: "FETCH_ANALYSIS", text, requestId: reqId };
    chrome.runtime.sendMessage(msg, (response: AnalyzeOutcome | undefined) => {
      const runtimeErr = chrome.runtime.lastError;
      if (runtimeErr || !response) {
        dispatch({
          type: "RESULT",
          requestId: reqId,
          outcome: { status: "error", error: runtimeErr?.message ?? "No response from extension." },
        });
        return;
      }
      dispatch({ type: "RESULT", requestId: reqId, outcome: response });
    });
  }, [state.phase, state.requestId]);

  // Auto-open timer: chip → card (compact) after AUTO_OPEN_DELAY_MS.
  useEffect(() => {
    if (state.phase !== "chip" || !shouldAutoOpen(state.settings)) return;
    const id = window.setTimeout(
      () => dispatch({ type: "AUTO_OPEN_CARD" }),
      AUTO_OPEN_DELAY_MS,
    );
    return () => window.clearTimeout(id);
  }, [state.phase, state.requestId, state.settings.displayMode]);

  // Chip idle timer: chip → fading → gone after CHIP_IDLE_MS.
  useEffect(() => {
    if (state.phase !== "chip" || state.settings.keepChip) return;
    chipIdleTimerRef.current?.cancel();
    const t = new TimerController(CHIP_IDLE_MS, () => dispatch({ type: "START_FADE" }));
    chipIdleTimerRef.current = t;
    t.start();
    return () => { t.cancel(); chipIdleTimerRef.current = null; };
  }, [state.phase, state.requestId, state.settings.keepChip]);

  // Fade-out → close after animation.
  useEffect(() => {
    if (state.phase !== "fading") return;
    const id = window.setTimeout(() => dispatch({ type: "CLOSE" }), FADE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [state.phase]);

  // Dwell timer: card → chip after verdict-aware (or custom) duration.
  useEffect(() => {
    dwellTimerRef.current?.cancel();
    dwellTimerRef.current = null;
    setIsTimerPaused(false);

    if (state.phase !== "card" || state.autoHideCancelled || state.isPinned) return;
    const rec = state.outcome?.status === "ok" ? state.outcome.result.recommendation : null;
    if (!rec) return;
    const ms = resolveDwellMs(state.settings, rec);
    if (ms === null) return; // "off"

    const t = new TimerController(ms, () => dispatch({ type: "COLLAPSE_TO_CHIP" }));
    dwellTimerRef.current = t;
    t.start();
    return () => { t.cancel(); dwellTimerRef.current = null; };
  }, [state.phase, state.requestId, state.autoHideCancelled, state.isPinned, state.settings.autoHideMs]);

  // Visibility change: pause/resume dwell timer when tab is hidden/shown.
  useEffect(() => {
    if (state.phase !== "card") return;
    const handler = () => {
      if (document.hidden) {
        dwellTimerRef.current?.pause();
      } else {
        dwellTimerRef.current?.resume();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [state.phase]);

  // Hover / focus: pause dwell timer while pointer or focus is inside card.
  const handleCardPointerEnter = useCallback(() => {
    setIsTimerPaused(true);
    dwellTimerRef.current?.pause();
    chipIdleTimerRef.current?.pause();
  }, []);

  const handleCardPointerLeave = useCallback(() => {
    setIsTimerPaused(false);
    dwellTimerRef.current?.resume(RESUME_GRACE_MS);
    chipIdleTimerRef.current?.resume(RESUME_GRACE_MS);
  }, []);

  // Focus inside card: fully disable auto-hide per WCAG "enough time".
  const handleCardFocusIn = useCallback(() => {
    setIsTimerPaused(true);
    dwellTimerRef.current?.pause();
  }, []);

  const handleCardFocusOut = useCallback((e: FocusEvent) => {
    // Only resume if focus left the card entirely.
    const next = e.relatedTarget as Node | null;
    if (shadowHost && next && shadowHost.contains(next)) return;
    setIsTimerPaused(false);
    dwellTimerRef.current?.resume(RESUME_GRACE_MS);
  }, []);

  // Manage highlights.
  useEffect(() => {
    if (state.phase === "idle") { clearAllHighlights(); return; }
    if (!state.range) return;
    if (state.phase === "loading") {
      applyHighlight(state.range, "shimmer");
    } else if (
      (state.phase === "chip" || state.phase === "card" || state.phase === "fading") &&
      state.outcome?.status === "ok"
    ) {
      const lvl = state.outcome.result.signal_level;
      applyHighlight(state.range, lvl === "HIGH" ? "read" : lvl === "MAYBE" ? "maybe" : "skip");
    } else if (state.phase === "error") {
      clearAllHighlights();
    }
  }, [state.phase, state.range, state.outcome]);

  // Esc key.
  useEffect(() => {
    if (state.phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dispatch({ type: state.phase === "card" ? "COLLAPSE_TO_CHIP" : "CLOSE" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.phase]);

  // Click outside the card collapses it.
  useEffect(() => {
    if (state.phase !== "card") return;
    let handler: ((e: MouseEvent) => void) | null = null;
    const timer = window.setTimeout(() => {
      handler = (e: MouseEvent) => {
        if (shadowHost && !e.composedPath().includes(shadowHost)) {
          dispatch({ type: "COLLAPSE_TO_CHIP" });
        }
      };
      document.addEventListener("click", handler);
    }, 120);
    return () => {
      window.clearTimeout(timer);
      if (handler) document.removeEventListener("click", handler);
    };
  }, [state.phase]);

  // Scroll far away: collapse card → chip.
  useEffect(() => {
    if (state.phase === "idle" || !state.range) return;
    const range = state.range;
    const onScroll = () => {
      const rect = range.getBoundingClientRect();
      if (rect.bottom < -400 || rect.top > window.innerHeight + 400) {
        dispatch({ type: "COLLAPSE_TO_CHIP" });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [state.phase, state.range]);

  // aria-live announcer: announce verdict when chip appears.
  const ariaMsg =
    state.phase !== "idle" &&
    state.phase !== "loading" &&
    state.outcome?.status === "ok"
      ? `Verdict: ${state.outcome.result.recommendation.toLowerCase()}, score ${state.outcome.result.signal_score}`
      : "";

  if (state.phase === "idle") return null;

  const onClose = () => dispatch({ type: "CLOSE" });
  const onEngage = () => dispatch({ type: "ENGAGE" });
  const onPinToggle = () => dispatch({ type: "PIN_TOGGLE" });
  const onReanalyze = () => dispatch({ type: "RETRY" });
  const onCollapse = () => dispatch({ type: "COLLAPSE_TO_CHIP" });

  const dwellMs =
    state.outcome?.status === "ok"
      ? (resolveDwellMs(state.settings, state.outcome.result.recommendation) ?? 0)
      : 0;

  return (
    <>
      <style>{SHADOW_STYLES}</style>

      {/* Screen-reader announcement, polite so it doesn't interrupt. */}
      <div aria-live="polite" aria-atomic="true" class="ap-sr-only">
        {ariaMsg}
      </div>

      {state.phase === "loading" && <LoadingPill range={state.range} />}

      {state.phase === "chip" && state.outcome?.status === "ok" && (
        <FloatingContainer range={state.range}>
          <Chip
            result={state.outcome.result}
            onExpand={() => dispatch({ type: "OPEN_CARD_USER" })}
            onClose={onClose}
          />
        </FloatingContainer>
      )}

      {state.phase === "fading" && state.outcome?.status === "ok" && (
        <FloatingContainer range={state.range}>
          <Chip
            result={state.outcome.result}
            onExpand={() => dispatch({ type: "OPEN_CARD_USER" })}
            onClose={onClose}
            fading
          />
        </FloatingContainer>
      )}

      {state.phase === "card" && state.outcome?.status === "ok" && (
        <FloatingContainer range={state.range} placement="bottom-start">
          <Card
            result={state.outcome.result}
            readingMinutes={state.outcome.readingMinutes}
            isWholePost={state.isWholePost}
            compact={state.cardMode === "compact"}
            isPinned={state.isPinned}
            showCountdown={!state.autoHideCancelled && !state.isPinned}
            isCountdownPaused={isTimerPaused}
            dwellMs={dwellMs}
            onClose={onClose}
            onCollapse={onCollapse}
            onReanalyze={onReanalyze}
            onEngage={onEngage}
            onPinToggle={onPinToggle}
            onPointerEnter={handleCardPointerEnter}
            onPointerLeave={handleCardPointerLeave}
            onFocusIn={handleCardFocusIn}
            onFocusOut={handleCardFocusOut}
            onExpandToFull={() => dispatch({ type: "EXPAND_TO_FULL" })}
          />
        </FloatingContainer>
      )}

      {state.phase === "error" && (
        <FloatingContainer range={state.range}>
          <ErrorChip
            error={state.errorMsg}
            onRetry={() => dispatch({ type: "RETRY" })}
            onClose={onClose}
          />
        </FloatingContainer>
      )}
    </>
  );
}

// ── Incoming message + init ────────────────────────────────────────────────

function resolveText(rawText: string): {
  text: string;
  range: Range | null;
  isWholePost: boolean;
} {
  let text = rawText.trim();
  let range: Range | null = null;
  let isWholePost = false;

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && text) {
    try { range = sel.getRangeAt(0).cloneRange(); } catch { range = null; }
  }

  if (!text) {
    const container = document.querySelector<HTMLElement>(
      'article, [role="article"], main, [role="main"]',
    );
    if (container) {
      text = (container.textContent ?? "").replace(/\s+/g, " ").trim();
      isWholePost = true;
      if (text) {
        const r = document.createRange();
        r.selectNodeContents(container);
        range = r;
      }
    }
  }

  const MAX = 12_000;
  if (text.length > MAX) { text = text.slice(0, MAX); isWholePost = true; }

  return { text, range, isWholePost };
}

if (!document.getElementById(ROOT_ID)) {
  injectHighlightRules();
  ensureMount();

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const msg = message as AnalyzeTriggerMessage;
    if (msg?.type !== "ANALYZE_TRIGGERED") return false;
    const { text, range, isWholePost } = resolveText(msg.text);
    globalDispatch?.({ type: "TRIGGER", text, range, isWholePost });
    sendResponse({ ok: true });
    return false;
  });

  let lastHref = location.href;
  new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      globalDispatch?.({ type: "CLOSE" });
    }
  }).observe(document, { subtree: true, childList: true });
}
