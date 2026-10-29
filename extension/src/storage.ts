// Thin wrappers around chrome.storage so each storage key and shape lives in
// one place, shared by options, background, popup, and the content script.

import { browserAPI } from "./browser-compat";
import type { AnalysisRecord, AnalyzeOutcome, DisplayMode, Profile, Settings } from "./types";
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from "./types";

const PROFILE_KEY = "profile";
const LAST_OUTCOME_KEY = "lastOutcome";
const SETTINGS_KEY = "settings";
const HISTORY_KEY = "history";
const MAX_HISTORY = 20;

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

// storage.session is in-memory (never written to disk) and survives an MV3
// service worker being killed and respawned for inactivity.
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

export function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(SETTINGS_KEY, (result) => {
      resolve(migrateSettings(result[SETTINGS_KEY]));
    });
  });
}

/** Migrate stored settings from any prior schema to the current one. */
function migrateSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;
  const r = raw as Record<string, unknown>;

  // Old format had { autoOpenCard: boolean } — map to new displayMode.
  if ("autoOpenCard" in r && !("displayMode" in r)) {
    return {
      ...DEFAULT_SETTINGS,
      displayMode: (r.autoOpenCard ? "auto-stay" : "click-to-open") as DisplayMode,
      disabledSites: Array.isArray(r.disabledSites) ? (r.disabledSites as string[]) : [],
    };
  }

  return {
    displayMode: (r.displayMode as DisplayMode | undefined) ?? DEFAULT_SETTINGS.displayMode,
    autoHideMs: r.autoHideMs !== undefined ? (r.autoHideMs as Settings["autoHideMs"]) : DEFAULT_SETTINGS.autoHideMs,
    keepChip: typeof r.keepChip === "boolean" ? r.keepChip : DEFAULT_SETTINGS.keepChip,
    disabledSites: Array.isArray(r.disabledSites) ? (r.disabledSites as string[]) : [],
  };
}

export function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    browserAPI.storage.local.set({ [SETTINGS_KEY]: settings }, () => resolve());
  });
}

export function loadHistory(): Promise<AnalysisRecord[]> {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(HISTORY_KEY, (result) => {
      resolve((result[HISTORY_KEY] as AnalysisRecord[] | undefined) ?? []);
    });
  });
}

export function addToHistory(record: AnalysisRecord): Promise<void> {
  return loadHistory().then(
    (history) =>
      new Promise((resolve) => {
        const next = [record, ...history].slice(0, MAX_HISTORY);
        browserAPI.storage.local.set({ [HISTORY_KEY]: next }, () => resolve());
      }),
  );
}
