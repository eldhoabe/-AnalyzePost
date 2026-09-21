// Minimal in-memory fake of the chrome.storage.sync surface this
// extension actually uses, so options/popup/background logic is
// unit-testable without a real browser.

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
