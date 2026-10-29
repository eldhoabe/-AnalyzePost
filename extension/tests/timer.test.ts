import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerController } from "../src/timer";

describe("TimerController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls onComplete after the full duration", () => {
    const cb = vi.fn();
    const t = new TimerController(1000, cb);
    t.start();
    vi.advanceTimersByTime(999);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("does not call onComplete before start()", () => {
    const cb = vi.fn();
    new TimerController(1000, cb);
    vi.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("start() is idempotent", () => {
    const cb = vi.fn();
    const t = new TimerController(1000, cb);
    t.start();
    t.start();
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledOnce();
  });

  describe("pause / resume", () => {
    it("pause prevents the callback from firing", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.start();
      vi.advanceTimersByTime(400);
      t.pause();
      vi.advanceTimersByTime(700);
      expect(cb).not.toHaveBeenCalled();
    });

    it("resumes from the remaining time after a pause", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.start();
      vi.advanceTimersByTime(400); // 600 remaining
      t.pause();
      t.resume();
      vi.advanceTimersByTime(599);
      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("multiple pause/resume cycles accumulate correctly", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.start();
      vi.advanceTimersByTime(200); // 800 remaining
      t.pause();
      vi.advanceTimersByTime(999); // time passes while paused (ignored)
      t.resume();
      vi.advanceTimersByTime(300); // 500 remaining
      t.pause();
      vi.advanceTimersByTime(999);
      t.resume();
      vi.advanceTimersByTime(499);
      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("pause while already paused is a no-op", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.start();
      vi.advanceTimersByTime(300);
      t.pause();
      t.pause(); // second pause, no-op
      t.resume();
      vi.advanceTimersByTime(700);
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  describe("grace period", () => {
    it("waits for grace before counting down after resume(grace)", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.start();
      vi.advanceTimersByTime(400); // 600 remaining
      t.pause();
      t.resume(500); // 500ms grace
      vi.advanceTimersByTime(499); // still in grace
      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1); // grace ends
      vi.advanceTimersByTime(599);
      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("pause during grace cancels the grace and keeps remaining time", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.start();
      vi.advanceTimersByTime(400); // 600 remaining
      t.pause();
      t.resume(500);
      vi.advanceTimersByTime(200); // mid-grace
      t.pause(); // cancel the grace
      vi.advanceTimersByTime(5000);
      expect(cb).not.toHaveBeenCalled(); // still paused
      t.resume();
      vi.advanceTimersByTime(600);
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  describe("cancel", () => {
    it("stops the timer permanently", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.start();
      vi.advanceTimersByTime(500);
      t.cancel();
      vi.advanceTimersByTime(2000);
      expect(cb).not.toHaveBeenCalled();
    });

    it("cancel during grace period stops everything", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.start();
      vi.advanceTimersByTime(400);
      t.pause();
      t.resume(500);
      vi.advanceTimersByTime(200);
      t.cancel();
      vi.advanceTimersByTime(5000);
      expect(cb).not.toHaveBeenCalled();
    });

    it("cancel before start is safe", () => {
      const cb = vi.fn();
      const t = new TimerController(1000, cb);
      t.cancel();
      t.start(); // should be a no-op now
      vi.advanceTimersByTime(2000);
      expect(cb).not.toHaveBeenCalled();
    });

    it("marks cancelled flag", () => {
      const t = new TimerController(1000, vi.fn());
      expect(t.cancelled).toBe(false);
      t.cancel();
      expect(t.cancelled).toBe(true);
    });
  });

  describe("remainingMs / totalDuration", () => {
    it("remainingMs equals total before start", () => {
      const t = new TimerController(2000, vi.fn());
      expect(t.remainingMs).toBe(2000);
      expect(t.totalDuration).toBe(2000);
    });

    it("remainingMs decreases while running", () => {
      const t = new TimerController(2000, vi.fn());
      t.start();
      vi.advanceTimersByTime(1000);
      // approximately 1000 remaining (fake timers may report exactly)
      expect(t.remainingMs).toBeLessThanOrEqual(1000);
    });

    it("remainingMs is stable while paused", () => {
      const t = new TimerController(2000, vi.fn());
      t.start();
      vi.advanceTimersByTime(800);
      t.pause();
      const snap = t.remainingMs;
      vi.advanceTimersByTime(5000);
      expect(t.remainingMs).toBe(snap);
    });
  });

  describe("verdict-aware dwell", () => {
    it("DWELL_MS READ < DWELL_MS MAYBE for asymmetric urgency", async () => {
      const { DWELL_MS } = await import("../src/timer");
      expect(DWELL_MS.MAYBE).toBeGreaterThan(DWELL_MS.READ);
      expect(DWELL_MS.MAYBE).toBeGreaterThan(DWELL_MS.SKIP);
    });
  });
});
