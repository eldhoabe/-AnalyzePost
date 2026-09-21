import { beforeEach, describe, expect, it } from "vitest";
import { init } from "../src/options";
import { installChromeStorageMock } from "./chrome-mock";

function renderForm() {
  document.body.innerHTML = `
    <form id="profile-form">
      <input id="role" />
      <input id="interests" />
      <button type="submit">Save</button>
      <span id="status"></span>
    </form>
  `;
}

describe("options page", () => {
  beforeEach(() => {
    renderForm();
  });

  it("saves role + interests to chrome.storage.sync on submit", async () => {
    const sync = installChromeStorageMock();
    await init();

    const roleInput = document.querySelector<HTMLInputElement>("#role")!;
    const interestsInput = document.querySelector<HTMLInputElement>("#interests")!;
    const form = document.querySelector<HTMLFormElement>("#profile-form")!;

    roleInput.value = "Technical Lead";
    interestsInput.value = ".NET, AWS,  AI ,Architecture";
    form.dispatchEvent(new Event("submit", { cancelable: true }));

    // storage.set's callback runs synchronously in the mock, but the
    // submit handler is async -- flush a microtask turn.
    await Promise.resolve();
    await Promise.resolve();

    expect(sync.store.profile).toEqual({
      role: "Technical Lead",
      interests: [".NET", "AWS", "AI", "Architecture"],
    });

    const status = document.querySelector<HTMLElement>("#status")!;
    expect(status.textContent).toBe("Saved.");
  });

  it("loads a previously saved profile back into the form on open", async () => {
    const sync = installChromeStorageMock();
    sync.store.profile = {
      role: "Engineering Manager",
      interests: ["Leadership", "AI"],
    };

    await init();

    const roleInput = document.querySelector<HTMLInputElement>("#role")!;
    const interestsInput = document.querySelector<HTMLInputElement>("#interests")!;

    expect(roleInput.value).toBe("Engineering Manager");
    expect(interestsInput.value).toBe("Leadership, AI");
  });

  it("defaults to an empty profile when nothing was saved yet", async () => {
    installChromeStorageMock();

    await init();

    const roleInput = document.querySelector<HTMLInputElement>("#role")!;
    const interestsInput = document.querySelector<HTMLInputElement>("#interests")!;

    expect(roleInput.value).toBe("");
    expect(interestsInput.value).toBe("");
  });
});
