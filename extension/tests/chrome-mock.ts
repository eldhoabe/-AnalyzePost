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

// Fuller mock for background.ts's tests: storage (sync + session + local),
// tabs, scripting, action, commands, all as vi.fn() spies.
export interface BackgroundChromeMock {
  sync: StorageArea;
  session: StorageArea;
  local: StorageArea;
  tabsQuery: ReturnType<typeof vi.fn>;
  executeScript: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  setBadgeText: ReturnType<typeof vi.fn>;
  setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
}

export function installBackgroundChromeMock(): BackgroundChromeMock {
  const sync = makeStorageArea();
  const session = makeStorageArea();
  const local = makeStorageArea();
  const tabsQuery = vi.fn();
  const executeScript = vi.fn();
  const sendMessage = vi.fn();
  const setBadgeText = vi.fn();
  const setBadgeBackgroundColor = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    storage: { sync, session, local },
    tabs: { query: tabsQuery, sendMessage },
    scripting: { executeScript },
    action: { setBadgeText, setBadgeBackgroundColor },
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
      lastError: undefined,
    },
    contextMenus: {
      create: vi.fn(),
      removeAll: vi.fn((callback?: () => void) => callback?.()),
      onClicked: { addListener: vi.fn() },
    },
    commands: {
      onCommand: { addListener: vi.fn() },
    },
  };

  return { sync, session, local, tabsQuery, executeScript, sendMessage, setBadgeText, setBadgeBackgroundColor };
}
