import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyzeResult } from "../src/types";
import { installBackgroundChromeMock, type BackgroundChromeMock } from "./chrome-mock";

const HIGH_SIGNAL_RESULT: AnalyzeResult = {
  recommendation: "READ",
  signal_level: "HIGH",
  signal_score: 91,
  relevance: 91,
  specificity: 88,
  originality: 82,
  practical_value: 90,
  personal_experience: 86,
  engagement_bait: 12,
  promotional: 5,
  ai_style: 18,
  reasons: ["Specific production incident", "Contains measurable results", "Highly relevant"],
};

function stubFetchOk(result: AnalyzeResult) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => result }),
  );
}

function stubFetchFailure(status: number) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
}

async function importBackground() {
  return import("../src/background");
}

let mock: BackgroundChromeMock;

beforeEach(() => {
  vi.resetModules();
  mock = installBackgroundChromeMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeAndRecord", () => {
  it("posts to the backend, computes reading time, persists the outcome, and badges HIGH green", async () => {
    stubFetchOk(HIGH_SIGNAL_RESULT);
    const { analyzeAndRecord } = await importBackground();
    const text = Array(250).fill("word").join(" "); // 250 words -> 2 min at 200wpm

    const outcome = await analyzeAndRecord(text);

    expect(outcome).toEqual({ status: "ok", result: HIGH_SIGNAL_RESULT, readingMinutes: 2 });
    expect(mock.session.store.lastOutcome).toEqual(outcome);
    expect(mock.setBadgeText).toHaveBeenCalledWith({ text: "91" });
    expect(mock.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#16a34a" });
  });

  it("records an error outcome and a red '!' badge when the backend call fails", async () => {
    stubFetchFailure(500);
    const { analyzeAndRecord } = await importBackground();

    const outcome = await analyzeAndRecord("some text");

    expect(outcome).toEqual({ status: "error", error: "Backend returned 500" });
    expect(mock.session.store.lastOutcome).toEqual(outcome);
    expect(mock.setBadgeText).toHaveBeenCalledWith({ text: "!" });
    expect(mock.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#b91c1c" });
  });
});

describe("handleAnalyzeSelection", () => {
  it("uses pasted text directly when provided, without touching the active tab", async () => {
    stubFetchOk(HIGH_SIGNAL_RESULT);
    const { handleAnalyzeSelection } = await importBackground();

    const outcome = await handleAnalyzeSelection("pasted text here");

    expect(outcome.status).toBe("ok");
    expect(mock.tabsQuery).not.toHaveBeenCalled();
  });

  it("grabs the active tab's selection via scripting.executeScript when nothing is pasted", async () => {
    mock.tabsQuery.mockResolvedValue([{ id: 42 }]);
    mock.executeScript.mockResolvedValue([{ result: "selected text on the page" }]);
    stubFetchOk(HIGH_SIGNAL_RESULT);
    const { handleAnalyzeSelection } = await importBackground();

    const outcome = await handleAnalyzeSelection();

    expect(mock.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 42 } }),
    );
    expect(outcome.status).toBe("ok");
  });

  it("returns {status: 'empty'} when there's no active tab and nothing was pasted", async () => {
    mock.tabsQuery.mockResolvedValue([]);
    const { handleAnalyzeSelection } = await importBackground();

    const outcome = await handleAnalyzeSelection();

    expect(outcome).toEqual({ status: "empty" });
  });

  it("returns {status: 'empty'} when the grabbed selection is blank", async () => {
    mock.tabsQuery.mockResolvedValue([{ id: 1 }]);
    mock.executeScript.mockResolvedValue([{ result: "" }]);
    const { handleAnalyzeSelection } = await importBackground();

    const outcome = await handleAnalyzeSelection();

    expect(outcome).toEqual({ status: "empty" });
  });

  it("returns {status: 'empty'} rather than an error when scripting.executeScript rejects (restricted page)", async () => {
    mock.tabsQuery.mockResolvedValue([{ id: 1 }]);
    mock.executeScript.mockRejectedValue(new Error("Cannot access chrome:// URLs"));
    const { handleAnalyzeSelection } = await importBackground();

    const outcome = await handleAnalyzeSelection();

    expect(outcome).toEqual({ status: "empty" });
  });

  it("{status: 'empty'} outcomes are never persisted or badged", async () => {
    mock.tabsQuery.mockResolvedValue([]);
    const { handleAnalyzeSelection } = await importBackground();

    await handleAnalyzeSelection();

    expect(mock.session.store.lastOutcome).toBeUndefined();
    expect(mock.setBadgeText).not.toHaveBeenCalled();
  });
});
