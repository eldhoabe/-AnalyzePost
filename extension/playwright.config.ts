import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    // Some sandboxes provide a pre-installed Chromium at a fixed path
    // instead of Playwright's own managed browser download. CI installs
    // its own via `playwright install` and leaves this unset.
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },
});
