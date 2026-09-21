// Thin wrapper around chrome.storage.sync so the storage key and shape
// live in one place, shared by the options page and (later) background.ts.

import type { Profile } from "./types";
import { DEFAULT_PROFILE } from "./types";

const STORAGE_KEY = "profile";

export function loadProfile(): Promise<Profile> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      resolve((result[STORAGE_KEY] as Profile | undefined) ?? DEFAULT_PROFILE);
    });
  });
}

export function saveProfile(profile: Profile): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: profile }, () => resolve());
  });
}
