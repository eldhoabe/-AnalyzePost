import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleExtractCurrentPost } from "../src/background";
import type { ExtractedPost } from "../src/types";

const LINKEDIN_TAB = { id: 1, url: "https://www.linkedin.com/feed/", lastAccessed: 100 };
const POST: ExtractedPost = { author: "Jane Doe", text: "some post text", url: "https://x" };

function installChromeTabsMock(sendMessageImpl: (tabId: number, message: unknown) => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    tabs: {
      query: vi.fn(async (queryInfo: { active?: boolean; url?: string }) => {
        if (queryInfo.active) return [LINKEDIN_TAB];
        return [LINKEDIN_TAB];
      }),
      sendMessage: vi.fn(sendMessageImpl),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

describe("handleExtractCurrentPost", () => {
  it("rewords Chrome's 'Receiving end does not exist' into actionable guidance", async () => {
    installChromeTabsMock(() => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    });

    const response = await handleExtractCurrentPost();

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toContain("Reload the tab and try again");
      expect(response.error).not.toContain("Receiving end does not exist");
    }
  });

  it("passes through other content-script errors unchanged", async () => {
    installChromeTabsMock(() => {
      throw new Error("Something else entirely went wrong");
    });

    const response = await handleExtractCurrentPost();

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toBe("Something else entirely went wrong");
    }
  });

  it("reports 'Couldn't find a LinkedIn post' when the content script finds nothing", async () => {
    installChromeTabsMock(async () => null);

    const response = await handleExtractCurrentPost();

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toContain("Couldn't find a LinkedIn post");
    }
  });

  it("returns the extracted post when the content script succeeds", async () => {
    installChromeTabsMock(async () => POST);

    const response = await handleExtractCurrentPost();

    expect(response).toEqual({ ok: true, post: POST });
  });

  it("never calls fetch -- the backend call is popup.ts's job, not the service worker's", async () => {
    installChromeTabsMock(async () => POST);

    await handleExtractCurrentPost();

    expect(fetch).not.toHaveBeenCalled();
  });
});
