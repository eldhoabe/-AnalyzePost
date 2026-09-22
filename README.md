# LinkedIn Signal

**Should I read this?**

A Chrome extension + small backend that scores a LinkedIn post on relevance, specificity, originality, practical value, and engagement-bait/promotional signals, and returns a bounded **READ / MAYBE / SKIP** recommendation with reasons, personalized to your role and interests.

It is deliberately **not** an AI-detector: AI-style phrasing is one minor signal among several, never the headline. The core claim, proven by the [cross-stack smoke test](#cross-stack-smoke-test): **a post can be highly relevant and still be low signal** — that distinction is the whole point.

Full product spec: [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md). Everything below implements its section 25 MVP scope:

```
Chrome Extension → select post → click "Should I Read This?"
  → send text to backend → LLM signal extraction → JEV decision engine
  → { signal_level, recommendation, 3 reasons } → display result
```

## Architecture

```
                 LinkedIn
                    │
                    ▼
           Chrome Extension
        (content script + popup)
                    │
                    │ chrome.runtime messaging
                    ▼
          Background service worker
                    │
                    │ HTTPS  POST /analyze
                    ▼
              FastAPI backend
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
     LLM extraction      JEV decision engine
   (structured signals)  (bounded scoring rules)
          │                   │
          └─────────┬─────────┘
                    ▼
             Signal result
                    │
                    ▼
           Chrome Extension popup
```

## Repo layout

```
backend/            FastAPI app, JEV decision engine, LLM client, tests
extension/           Manifest V3 Chrome extension (TypeScript, esbuild)
  src/               content script, background worker, popup, options page
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

```bash
cd extension
npm install
npm run build        # -> extension/dist/
```

Load it in Chrome:

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `extension/dist`.
3. Open the extension's **Details → Extension options** to set your role + interests (spec section 13). This is stored locally via `chrome.storage.sync` and is never sent anywhere except alongside a post you explicitly analyze.

Unit tests (vitest + jsdom — content-script DOM extraction, options-page storage round-trip):

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

## Cross-stack smoke test

This is the one that matters most: it runs the product spec's own worked examples (section 14 — Post A, a concrete migration story; Post B, a generic "AI is changing everything" post) through the **real** pipeline end to end — real backend, real `/analyze` route, real JEV engine, real content script, real background worker, real popup. Only the LLM call itself is replaced with a deterministic script (`backend/tests/smoke_server.py`), so it needs no API key and gives reproducible results.

```bash
bash scripts/smoke-test.sh
```

This starts the scripted backend on `:8000`, waits for it to be healthy, builds the extension, and runs `extension/tests/smoke/backend-smoke.spec.ts`, which asserts:

- Post A → 🟢 `HIGH` signal, `READ`
- Post B → 🔴 `LOW` signal, `SKIP` — **despite being just as relevant as Post A**

## Manual verification checklist (real LinkedIn)

This sandbox this project was built in has no authenticated LinkedIn session, so the one thing that can't be automated is confirming extraction against LinkedIn's real, live DOM. Do this once after any change to `extension/src/content.ts`:

1. `cd backend && uvicorn app.main:app --reload` (with a real `LLM_API_KEY` exported).
2. `cd extension && npm run build`, then load `extension/dist` unpacked in Chrome (see above).
3. Open `https://www.linkedin.com/feed/` in a normal, logged-in tab.
4. Click into (select) a specific post with a decent amount of text.
5. Click the LinkedIn Signal toolbar icon to open the popup.
6. Click **"Should I Read This?"**.
7. Confirm, within a few seconds:
   - A result card appears (🟢/🟡/🔴), not the error state.
   - The signal score and 3 reasons look plausible for the post you selected.
   - The recommendation matches your own judgment closely enough to trust ("if I skip this, would I regret it?").
8. Click **"Analyze another post"**, pick a different post, and repeat — confirm the extension correctly picks up the *new* post rather than reusing the first result.
9. Try a post that's topically relevant to your profile but generic/low-effort — confirm it can still come back `SKIP`/`LOW` (the core thesis: relevant ≠ high signal).

If the popup shows "Couldn't find a LinkedIn post on this tab," LinkedIn's DOM likely changed — see spec section 24, risk 1, and update the selectors in `extension/src/content.ts`.

## Out of scope for this MVP

Per spec section 11 — do not add without a deliberate decision to expand scope:

- Automatic analysis of every post in the feed
- Social graph or author-reputation scoring
- Definitive AI/human detection
- User accounts, Chrome sync, or payments
- An analytics dashboard or mobile app
- A vector database or a fine-tuned/custom-trained model
