import { afterEach, describe, expect, it } from "vitest";
import { browserAPI } from "../src/browser-compat";

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).browser;
});

describe("browserAPI", () => {
  it("resolves to chrome when no browser global is present", () => {
    const chromeStub = { runtime: { id: "chrome-stub" } } as unknown as typeof chrome;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = chromeStub;

    expect(browserAPI.runtime).toBe(chromeStub.runtime);
  });

  it("prefers browser over chrome when both are present", () => {
    const chromeStub = { runtime: { id: "chrome-stub" } } as unknown as typeof chrome;
    const browserStub = { runtime: { id: "browser-stub" } } as unknown as typeof chrome;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = chromeStub;
    globalThis.browser = browserStub;

    expect(browserAPI.runtime).toBe(browserStub.runtime);
  });

  it("re-resolves on every access rather than freezing a reference from first use", () => {
    const firstChrome = { runtime: { id: "first" } } as unknown as typeof chrome;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = firstChrome;
    expect(browserAPI.runtime).toBe(firstChrome.runtime);

    const secondChrome = { runtime: { id: "second" } } as unknown as typeof chrome;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = secondChrome;
    expect(browserAPI.runtime).toBe(secondChrome.runtime);
  });

  it("throws a clear error when neither global is present", () => {
    expect(() => browserAPI.runtime).toThrow(/Neither `browser` nor `chrome`/);
  });
});
