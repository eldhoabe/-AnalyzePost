declare global {
  // eslint-disable-next-line no-var
  var browser: typeof chrome | undefined;
}

function currentImpl(): typeof chrome {
  const impl = globalThis.browser ?? globalThis.chrome;
  if (!impl) {
    throw new Error("Neither `browser` nor `chrome` is available in this environment.");
  }
  return impl;
}

// Safari/Firefox expose a native `browser` global with mostly
// Promise-native APIs; Chrome only exposes `chrome`. Using `browserAPI`
// everywhere instead of bare `chrome.*` means a future Safari conversion
// (via Apple's safari-web-extension-converter, which needs Xcode on
// macOS -- not available in this environment, so unverified here) won't
// need every call site rewritten. Proven only to not regress Chrome:
// globalThis.browser is never set in Chrome or in this repo's test
// environments, so browserAPI always resolves to `chrome` today.
//
// A Proxy, not a plain `const = ... ?? ...`: this module is imported at
// the top of background.ts/popup.ts/storage.ts, and a plain constant
// would freeze its target at module-import time, before a test's chrome
// mock (installed inside a test/beforeEach, per tests/chrome-mock.ts) is
// ever set up -- a frozen snapshot would miss it entirely. Proxying
// property access re-resolves against whatever globalThis.chrome/browser
// currently is on every single use, matching how a bare `chrome.x`
// reference already behaved in this codebase.
export const browserAPI: typeof chrome = new Proxy({} as typeof chrome, {
  get(_target, prop) {
    return Reflect.get(currentImpl(), prop);
  },
});
