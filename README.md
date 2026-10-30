# Should I Read This?
 
**Know in one second whether a piece of text is worth your time.**
 
Select any text, on any site, and get a small **READ / MAYBE / SKIP** verdict right next to it, with three reasons and an estimated reading time, tuned to your role and interests. No tab-switching, no pasting into a chatbot, no reading the whole thing to find out it wasn't worth it.
 
---
 
## Why this is needed
 
Almost everything we read online is optimised to get *clicked*, not to be *useful*. The cost isn't the one bad post; it's the hundreds of small decisions a day about what deserves attention:
 
- Feeds are full of posts that are **on-topic but empty**: confident tone, no specifics, nothing you can act on.
- Articles bury the one useful paragraph under 1,500 words of padding, or are really a sales pitch.
- Reviews are a coin flip: some are detailed and honest, many are one-line praise, templated, or written to be seen.
- Reading it all just to judge it defeats the point of judging it.
Should I Read This? gives you a fast, consistent second opinion, so you spend attention where it pays off.
 
## Where you'd use it
 
| You're looking at | You select | It looks for | You get |
|---|---|---|---|
| **A LinkedIn post** | The post text | Specific details vs. vague claims, original experience vs. recycled advice, practical takeaways vs. engagement bait ("agree?", "repost ♻️") | A verdict before you scroll past or fall into the comments |
| **An article or blog post** | The intro, or the whole piece | Does it deliver concrete, usable information, or is it generic, padded, or promotional? Is it relevant to *your* work? | READ / SKIP plus a reading-time estimate, so you can decide whether it's a 2-minute skim or a pass |
| **Product reviews** (shop pages, app stores, forums) | One review, or a block of them | Concrete usage details (how long, what for, what broke), a balanced view, signs of a template or pure promotion | Which reviews carry real information, so you can read those first |
| **Google reviews** (Maps, local businesses) | A review or a few | Specific experience (what was ordered, what happened, when) vs. generic praise or complaints with no detail | A quick read on which reviews are worth trusting your decision to |
| **Anything else** (newsletters, threads, announcements, emails) | Any text | The same signals, scored the same way | The same bounded verdict |
 
*Illustrative verdicts, not benchmarks:* a detailed "bought this 8 months ago, the hinge failed after the first winter, support replaced it in 3 days" review scores high on specificity and practical value; "Great product!! Highly recommend!!!" scores low on everything and gets SKIP.
 
## The core idea
 
**A post can be highly relevant and still be low signal.** Being on-topic is not the same as being worth your time. Should I Read This? scores relevance *separately* from specificity, originality, practical value, and engagement-bait / promotional signals, and then combines them into one bounded recommendation. That distinction is the whole point, and it is verified end to end by the [cross-stack smoke test](#cross-stack-smoke-test).

## Architecture

```
              Any web page
                    │
                    │  user selects text
                    ▼
         Right-click menu   OR   Popup button
      ("Should I Read This?")  (grabs selection /
                    │            paste fallback)
                    └─────────┬─────────┘
                              ▼
              Background service worker
                              │
                              │ HTTPS  POST /analyze
                              ▼
                       FastAPI backend
                              │
                  ┌───────────┴───────────┐
                  │                       │
                  ▼                       ▼
          Jev signal + choice      JEV decision engine
             extraction           (deterministic scoring,
        (typesafe/jev-1.13,        reasons, fallback path)
         or a plain chat LLM)
                  │                       │
                  └───────────┬───────────┘
                              ▼
                       Signal result
                              │
                              ▼
                  chrome.storage.session
              (badges the toolbar icon,
               shown next time the popup opens)
```

## Why text selection, not scraping

The original MVP had the extension read LinkedIn's feed DOM directly (a persistent content script with LinkedIn-specific CSS selectors). In practice this was unreliable — not just "selectors go stale," but LinkedIn's feed re-renders/reconciles its DOM live, so even correct selectors could transiently find nothing. Rather than keep hardening that, extraction was replaced with browser text selection: the user selects text and either right-clicks ("Should I Read This?", `chrome.contextMenus`, works on any site) or clicks the toolbar button (grabs the current selection via `chrome.scripting.executeScript`, on-demand, no persistent injection). Nothing to scrape, nothing site-specific, nothing to break when a site's markup changes. A paste box is the fallback whenever there's no active selection to grab.

## Repo layout

```
backend/            FastAPI app, JEV decision engine, Jev API + generic LLM clients, tests
extension/           Manifest V3 extension (TypeScript, esbuild)
  src/               background worker, popup, options page, selection grabber, storage,
                     browser-compat (Safari/Firefox portability shim), reading-time estimate
  tests/             vitest unit tests (jsdom) + Playwright specs
  tests/smoke/        cross-stack Playwright spec (needs the real backend running)
scripts/
  smoke-test.sh      one-command cross-stack smoke test
docs/
  PRODUCT_PLAN.md    original product spec ("spec section N" throughout code/commits refers here)
```

## Prerequisites

- Python 3.11+
- Node.js 20+ (developed against Node 22)
- Chrome, for loading the unpacked extension

## Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

Run tests:

```bash
cd backend
python3 -m pytest
```

(Use `python3 -m pytest` rather than a bare `pytest` — on some machines a `pytest` binary earlier on `PATH` resolves to a different Python installation than the one `pip install` just targeted, and you'll get a confusing `ModuleNotFoundError: fastapi` instead of your tests running.)

By default `/analyze` calls `JevDecisionsClient` (`app/llm.py`), which calls the real **Jev** model from [TypeSafe AI](https://typesafe.ai) through OpenRouter's alpha Decisions API (`POST https://openrouter.ai/api/alpha/decisions`) — a structured "System One" decision model, not a chat model: one request scores all 8 signal dimensions *and* picks READ/MAYBE/SKIP directly, as typed answers rather than generated prose. This is what `app/jev.py`'s "JEV decision engine" (spec section 8, "Why JEV Fits") was describing all along. Configure it via environment variables — **never commit a real key**:

```bash
export JEV_API_URL=https://openrouter.ai/api/alpha/decisions   # default, rarely needs overriding
export JEV_API_KEY=sk-or-v1-...                                 # your OpenRouter key
export JEV_MODEL=typesafe/jev-1.13                              # default
```

The API key lives only on the backend; the extension never sees it (`manifest.json`'s `host_permissions` only grants it access to call the backend, not any LLM provider directly).

When Jev supplies a recommendation directly, it overrides `app/jev.py`'s own threshold-derived one (`main.py`'s `/analyze` handler) — `signal_score` and `reasons` still come from `app/jev.py`'s deterministic math over the returned signals (Jev doesn't generate prose), clamped to stay consistent with whichever recommendation won.

A generic OpenAI-chat-completions-shaped client (`HttpJsonLLMClient`, configured via `LLM_API_URL`/`LLM_API_KEY`/`LLM_MODEL`) still exists in `app/llm.py` as an alternate path — swap it in via `get_llm_client` if you want a plain chat LLM doing extraction instead, with `app/jev.py`'s thresholds deciding the recommendation on their own.

No database — the analysis cache and the (opt-in-only) raw-post store are both in-memory and reset on restart (see `app/cache.py`).

## Extension

> **Beta testers:** see [docs/INSTALL.md](docs/INSTALL.md) for the tester install guide.

**Stable extension ID:** `nphfjeopioiieifdandhaalinoegikhf`
_(Set this as `CHROME_EXTENSION_ID` in the Render backend env vars so CORS allows the extension to call the API.)_

```bash
cd extension
npm install
npm run build        # -> extension/dist/ (dev, points at localhost:8000)
API_BASE_URL=https://analyzepost.onrender.com npm run build  # release build
```

Load it in Chrome:

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `extension/dist`.
3. Open the extension's **Details → Extension options** to set your role + interests (spec section 13). This is stored locally via `chrome.storage.sync` and is never sent anywhere except alongside text you explicitly analyze.

Unit tests (vitest + jsdom — selection-grabbing, reading-time estimate, the browser-compat shim, background.ts's two entry points with mocked chrome APIs, options-page storage round-trip):

```bash
npm test
```

Real-browser popup tests (Playwright, loads the actual built extension into Chromium):

```bash
npm run test:e2e
```

Type check:

```bash
npm run typecheck
```

If your sandbox provides a pre-installed Chromium at a fixed path instead of Playwright's managed download, point Playwright at it:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

Otherwise, install Playwright's own browser once: `npx playwright install chromium`.

### Safari: portability prep only, not built

`extension/src/browser-compat.ts` exports a `browserAPI` that resolves to a native `browser` global when present (Safari and Firefox both expose one) and falls back to `chrome` otherwise, used everywhere instead of bare `chrome.*` calls. That's genuinely verified — `npm run typecheck` and every test above pass with it in place, since `browserAPI` resolves to `chrome` in every environment this repo can test (there's a dedicated proxy-resolution test in `tests/browser-compat.test.ts`). What it does **not** do is produce or test an actual Safari extension: that needs Apple's `xcrun safari-web-extension-converter` run on a Mac with Xcode, converting this unpacked extension into a Safari App Extension Xcode project, which then needs its own build/sign/run cycle and a check of Safari's own support level for `contextMenus` and `storage.session` by version. None of that has been attempted — this environment has no macOS/Xcode access. Treat Safari support as unstarted, not "should just work."

## Cross-stack smoke test

This is the one that matters most: it runs the product spec's own worked examples (section 14 — Post A, a concrete migration story; Post B, a generic "AI is changing everything" post) through the **real** pipeline end to end — real backend, real `/analyze` route, real JEV engine, real background worker, real popup. Only the LLM call itself is replaced with a deterministic script (`backend/tests/smoke_server.py`), so it needs no API key and gives reproducible results.

```bash
bash scripts/smoke-test.sh
```

This starts the scripted backend on `:8000`, waits for it to be healthy, builds the extension, and runs `extension/tests/smoke/backend-smoke.spec.ts`, which asserts:

- Post A → 🟢 `HIGH` signal, `READ`
- Post B → 🔴 `LOW` signal, `SKIP` — **despite being just as relevant as Post A**

It drives this through the popup's **paste** path specifically, not the text-selection-grab path — Playwright can only open an MV3 popup by navigating straight to its URL, which doesn't trigger the genuine user gesture the `activeTab` permission needs, so `chrome.scripting.executeScript` against another tab is denied in this harness (confirmed directly: Chrome's own `"Cannot access contents of the page..."` error, not a product bug — real toolbar clicks grant `activeTab` correctly). Combined with Playwright being unable to drive native OS context menus at all, **neither** real entry point is end-to-end Playwright-testable; both are covered at the unit level (`extension/tests/background.test.ts`, mocking the chrome APIs directly) plus the manual checklist below.

## Manual verification checklist

Automated coverage stops at the two points above (an unmockable `activeTab` gesture, a native context menu) — everything else about the actual browsing experience is covered by the checklist. Test on **at least two different sites** (e.g. a real LinkedIn post and an unrelated article) to confirm this genuinely isn't LinkedIn-specific anymore:

1. `cd backend && uvicorn app.main:app --reload` (with a real `JEV_API_KEY` exported).
2. `cd extension && npm run build`, then load `extension/dist` unpacked in Chrome (see above).
3. **Right-click flow:** on any page, select some text, right-click, choose **"Should I Read This?"**. Within a few seconds, confirm the toolbar icon gets a colored badge with a number on it.
4. Click the toolbar icon to open the popup. Confirm it opens directly to that result (not the idle button), with a plausible score/reasons/reading time, and the badge clears.
5. Select *different* text elsewhere and repeat the right-click flow — confirm the popup shows the *new* result, not the stale one.
6. **Popup-button flow:** with text still selected on a page, click the toolbar icon *without* right-clicking first, then click **"Should I Read This?"** inside the popup. Confirm it picks up the current selection and produces a result the same way.
7. Click the toolbar icon on a page/tab with **nothing selected**. Confirm the popup shows a paste box instead of erroring; paste some text in and click **"Analyze pasted text"** — confirm it produces a real result.
8. Try a post that's topically relevant to your profile but generic/low-effort — confirm it can still come back `SKIP`/`LOW` (the core thesis: relevant ≠ high signal).
9. If the extension ever shows a blank/broken popup instead of one of the above, that's a real bug — file it; a paste-fallback or an explicit error state should be the worst case, never a silent failure.

## Releasing

To cut a new beta release:

1. **Bump the version** in `extension/package.json` (e.g. `"version": "0.2.0"`). This is the single source of truth — the build syncs it into `manifest.json` automatically.
2. **Commit and push** to `main`.
3. **Tag and push:**
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. The `release` workflow triggers automatically. It builds with the `API_BASE_URL` repository variable, runs the secret-grep check, zips `dist/`, and creates a GitHub Release with `should-i-read-this-v0.2.0.zip` and a `.sha256` checksum attached.
5. Share the Releases page link with testers. They follow [docs/INSTALL.md](docs/INSTALL.md).

**Dry run (no release created):** use the **Actions → release → Run workflow** button with "Dry run" checked. The zip is uploaded as a workflow artifact instead.

> **Before your first release:** set the repository variable `API_BASE_URL` to `https://analyzepost.onrender.com` in **GitHub → Settings → Secrets and variables → Actions → Variables**.

## Out of scope for this MVP

Per spec section 11 — do not add without a deliberate decision to expand scope:

- Automatic analysis of every post in the feed
- Social graph or author-reputation scoring
- Definitive AI/human detection
- User accounts, Chrome sync, or payments
- An analytics dashboard or mobile app
- A vector database or a fine-tuned/custom-trained model
