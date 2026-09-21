import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { extractPost } from "../src/content";

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
