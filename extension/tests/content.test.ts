import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractPost, extractPostWithRetry } from "../src/content";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/sample-post.html",
);
const samplePostHtml = readFileSync(fixturePath, "utf-8");

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("extractPost", () => {
  it("extracts author, text, and a constructed URL from a LinkedIn-shaped post", () => {
    document.body.innerHTML = samplePostHtml;

    const post = extractPost(document, null);

    expect(post).not.toBeNull();
    expect(post?.author).toBe("Jane Doe");
    expect(post?.text).toContain(
      "We migrated 12 .NET Framework services to .NET 8.",
    );
    expect(post?.url).toBe(
      "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/",
    );
  });

  it("prefers an explicit permalink over the data-urn fallback when present", () => {
    document.body.innerHTML = samplePostHtml;
    const container = document.querySelector("[data-urn]")!;
    const permalink = document.createElement("a");
    permalink.href = "https://www.linkedin.com/feed/update/urn:li:activity:999/";
    container.appendChild(permalink);

    const post = extractPost(document, null);

    expect(post?.url).toBe("https://www.linkedin.com/feed/update/urn:li:activity:999/");
  });

  it("returns null when no post container is found in the DOM", () => {
    document.body.innerHTML = "<div>Not a LinkedIn post</div>";

    const post = extractPost(document, null);

    expect(post).toBeNull();
  });

  it("returns null rather than throwing when the document is empty", () => {
    expect(() => extractPost(document, null)).not.toThrow();
    expect(extractPost(document, null)).toBeNull();
  });
});

describe("extractPostWithRetry", () => {
  // Regression test for a real LinkedIn observation: the feed's DOM
  // reconciles frequently enough that a post container can be briefly
  // absent (data-urn query going from several matches to zero and back)
  // with no scrolling in between. A single extractPost() read can lose
  // that race; the retry wrapper must not.
  it("succeeds if the post container only appears after a later retry", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = "<div>Not a post yet</div>";

      const resultPromise = extractPostWithRetry(document, null, 5, 200);

      // Simulate LinkedIn's feed reconciling the post into the DOM
      // partway through the retry window.
      await vi.advanceTimersByTimeAsync(200);
      document.body.innerHTML = samplePostHtml;
      await vi.advanceTimersByTimeAsync(200);

      const result = await resultPromise;
      expect(result?.author).toBe("Jane Doe");
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up and resolves null after exhausting all attempts", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = "<div>Never becomes a post</div>";

      const resultPromise = extractPostWithRetry(document, null, 3, 100);
      await vi.advanceTimersByTimeAsync(1000);

      expect(await resultPromise).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves immediately without waiting when the post is found on the first try", async () => {
    document.body.innerHTML = samplePostHtml;

    const result = await extractPostWithRetry(document, null, 5, 200);

    expect(result?.author).toBe("Jane Doe");
  });
});
