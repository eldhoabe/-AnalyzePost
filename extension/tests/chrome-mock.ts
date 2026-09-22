// Minimal in-memory fake of the chrome.storage.sync surface this
// extension actually uses, so options/popup/background logic is
// unit-testable without a real browser.

import { vi } from "vitest";

type StorageArea = {
  store: Record<string, unknown>;
  get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void): void;
  set(items: Record<string, unknown>, callback?: () => void): void;
};

function makeStorageArea(): StorageArea {
  const store: Record<string, unknown> = {};
  return {
    store,
    get(keys, callback) {
      const keyList = keys == null ? Object.keys(store) : Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key in store) result[key] = store[key];
      }
      callback(result);
    },
    set(items, callback) {
      Object.assign(store, items);
      callback?.();
    },
  };
}

export function installChromeStorageMock(): StorageArea {
  const sync = makeStorageArea();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = { storage: { sync } };
  return sync;
}

// Fuller mock for background.ts's tests: storage (sync + session), tabs,
// scripting, and action as vi.fn() spies so tests can assert on calls.
export interface BackgroundChromeMock {
  sync: StorageArea;
  session: StorageArea;
  tabsQuery: ReturnType<typeof vi.fn>;
  executeScript: ReturnType<typeof vi.fn>;
  setBadgeText: ReturnType<typeof vi.fn>;
  setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
}

export function installBackgroundChromeMock(): BackgroundChromeMock {
  const sync = makeStorageArea();
  const session = makeStorageArea();
  const tabsQuery = vi.fn();
  const executeScript = vi.fn();
  const setBadgeText = vi.fn();
  const setBadgeBackgroundColor = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    storage: { sync, session },
    tabs: { query: tabsQuery },
    scripting: { executeScript },
    action: { setBadgeText, setBadgeBackgroundColor },
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
    },
    contextMenus: {
      create: vi.fn(),
      removeAll: vi.fn((callback?: () => void) => callback?.()),
      onClicked: { addListener: vi.fn() },
    },
  };

  return { sync, session, tabsQuery, executeScript, setBadgeText, setBadgeBackgroundColor };
}
