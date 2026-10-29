import { describe, expect, it } from "vitest";
import { estimateReadingMinutes } from "../src/readingTime";

describe("estimateReadingMinutes", () => {
  it("computes minutes at 200 words per minute, rounded up", () => {
    const text = Array(250).fill("word").join(" "); // 250 / 200 = 1.25 -> 2

    expect(estimateReadingMinutes(text)).toBe(2);
  });

  it("treats exactly 200 words as 1 minute", () => {
    const text = Array(200).fill("word").join(" ");

    expect(estimateReadingMinutes(text)).toBe(1);
  });

  it("returns a minimum of 1 minute for very short text", () => {
    expect(estimateReadingMinutes("just a few words")).toBe(1);
  });

  it("returns a minimum of 1 minute for empty text, rather than 0 or NaN", () => {
    expect(estimateReadingMinutes("")).toBe(1);
  });

  it("collapses extra whitespace rather than over-counting words", () => {
    expect(estimateReadingMinutes("  one   two \n\n three  ")).toBe(1);
  });
});
