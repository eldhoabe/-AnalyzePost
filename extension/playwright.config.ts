import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.ts/,
  // The cross-stack smoke suite needs a real backend running on :8000
  // (see scripts/smoke-test.sh) and has its own config/command
  // (`npm run test:smoke`); it must not run as part of the plain
  // `npm run test:e2e` used by CI, which has no backend up.
  testIgnore: "**/smoke/**",
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
