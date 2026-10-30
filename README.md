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

```bash
export JEV_API_URL=https://openrouter.ai/api/alpha/decisions   # default, rarely needs overriding
export JEV_API_KEY=sk-or-v1-...                                 # your OpenRouter key
export JEV_MODEL=typesafe/jev-1.13                              # default
```

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

- Post A → 🟢 `HIGH` signal, `READ`
- Post B → 🔴 `LOW` signal, `SKIP` — **despite being just as relevant as Post A**

It drives this through the popup's **paste** path specifically, not the text-selection-grab path — Playwright can only open an MV3 popup by navigating straight to its URL, which doesn't trigger the genuine user gesture the `activeTab` permission needs, so `chrome.scripting.executeScript` against another tab is denied in this harness (confirmed directly: Chrome's own `"Cannot access contents of the page..."` error, not a product bug — real toolbar clicks grant `activeTab` correctly). Combined with Playwright being unable to drive native OS context menus at all, **neither** real entry point is end-to-end Playwright-testable; both are covered at the unit level (`extension/tests/background.test.ts`, mocking the chrome APIs directly) plus the manual checklist below.


## Out of scope for this MVP


- Automatic analysis of every post in the feed
- Social graph or author-reputation scoring
- Definitive AI/human detection
- User accounts, Chrome sync, or payments
- An analytics dashboard or mobile app
- A vector database or a fine-tuned/custom-trained model
