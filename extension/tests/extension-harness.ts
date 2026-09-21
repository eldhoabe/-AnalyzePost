import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext } from "@playwright/test";

const extensionPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

export async function launchExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10_000 });
  }
  return new URL(serviceWorker.url()).host;
}
