// Options page (spec section 13): lets the user set the role + interests
// used to personalize relevance scoring.

import { loadProfile, saveProfile } from "./storage";

function parseInterests(raw: string): string[] {
  return raw
    .split(",")
    .map((interest) => interest.trim())
    .filter(Boolean);
}

export async function init(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>("#profile-form");
  const roleInput = document.querySelector<HTMLInputElement>("#role");
  const interestsInput = document.querySelector<HTMLInputElement>("#interests");
  const status = document.querySelector<HTMLElement>("#status");
  if (!form || !roleInput || !interestsInput) return;

  const profile = await loadProfile();
  roleInput.value = profile.role;
  interestsInput.value = profile.interests.join(", ");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile({
      role: roleInput.value.trim(),
      interests: parseInterests(interestsInput.value),
    });
    if (status) status.textContent = "Saved.";
  });
}

if (typeof document !== "undefined" && typeof chrome !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
}
