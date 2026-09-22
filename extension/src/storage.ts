// Thin wrappers around chrome.storage so each storage key and shape lives
// in one place, shared by the options page, background.ts, and popup.ts.

import { browserAPI } from "./browser-compat";
import type { AnalyzeOutcome, Profile } from "./types";
import { DEFAULT_PROFILE } from "./types";

const PROFILE_KEY = "profile";
const LAST_OUTCOME_KEY = "lastOutcome";

export function loadProfile(): Promise<Profile> {
  return new Promise((resolve) => {
    browserAPI.storage.sync.get(PROFILE_KEY, (result) => {
      resolve((result[PROFILE_KEY] as Profile | undefined) ?? DEFAULT_PROFILE);
    });
  });
}

export function saveProfile(profile: Profile): Promise<void> {
  return new Promise((resolve) => {
    browserAPI.storage.sync.set({ [PROFILE_KEY]: profile }, () => resolve());
  });
}

// storage.session is in-memory (never written to disk) and survives an
// MV3 service worker being killed and respawned for inactivity, unlike a
// plain module-level variable in background.ts would.
export function loadLastOutcome(): Promise<AnalyzeOutcome | null> {
  return new Promise((resolve) => {
    browserAPI.storage.session.get(LAST_OUTCOME_KEY, (result) => {
      resolve((result[LAST_OUTCOME_KEY] as AnalyzeOutcome | undefined) ?? null);
    });
  });
}

export function saveLastOutcome(outcome: AnalyzeOutcome): Promise<void> {
  return new Promise((resolve) => {
    browserAPI.storage.session.set({ [LAST_OUTCOME_KEY]: outcome }, () => resolve());
  });
}
