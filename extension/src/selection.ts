// Injected on demand via chrome.scripting.executeScript -- never listed
// in manifest.json, and must stay a fully self-contained function (no
// closures over outer imports/module-level vars): executeScript
// re-serializes the function's own source and evaluates it in the target
// page, so only globals (window, document, ...) are available to it.
export function getSelectedText(): string {
  return window.getSelection()?.toString().trim() ?? "";
}
