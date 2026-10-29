import { beforeEach, describe, expect, it } from "vitest";
import { getSelectedText } from "../src/selection";

beforeEach(() => {
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});

describe("getSelectedText", () => {
  it("returns the trimmed text of the current selection", () => {
    document.body.innerHTML = "<p id='text'>  Hello world  </p>";
    const el = document.getElementById("text")!;

    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(getSelectedText()).toBe("Hello world");
  });

  it("returns an empty string when nothing is selected", () => {
    expect(getSelectedText()).toBe("");
  });

  it("returns an empty string for a collapsed (zero-length) selection", () => {
    document.body.innerHTML = "<p id='text'>Hello world</p>";
    const el = document.getElementById("text")!;

    const range = document.createRange();
    range.setStart(el.firstChild!, 0);
    range.setEnd(el.firstChild!, 0);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(getSelectedText()).toBe("");
  });
});
