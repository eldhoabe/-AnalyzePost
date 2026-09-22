# LinkedIn "Should I Read This?" — Product & MVP Plan

## 1. Product Idea

**Working name:** LinkedIn Signal

**One-line description:**

> A Chrome extension that tells you whether a LinkedIn post is worth your time — based on relevance, specificity, originality, practical value, and engagement-bait signals.

The product should **not** claim to reliably determine whether a post was written by AI.

The real problem is:

> "I don't want to spend 30 seconds reading another generic LinkedIn post."

The extension answers:

> **Should I read this?**

---

# 2. Why This Problem Is Real

LinkedIn feeds contain a large amount of repetitive content:

- Generic career advice
- "5 lessons I learned..." posts
- AI-generated motivational posts
- Engagement bait
- Generic leadership advice
- Promotional content disguised as personal stories
- Recycled technical advice
- Posts with lots of words but little concrete information

There are already Chrome extensions attempting to identify AI-generated or "AI slop" LinkedIn content.

Therefore, building another:

> "This post is 87% AI-generated"

is not sufficiently differentiated.

Instead, the product should focus on **information quality and personal relevance**.

---

# 3. Target User

## Primary user

Knowledge workers who consume LinkedIn regularly but feel the feed contains too much noise.

Examples:

- Software engineers
- Technical leads
- Engineering managers
- Product managers
- Founders
- Recruiters
- Consultants
- Sales professionals

## Example personalized profile

For a software technical lead:

```text
Role:
Technical Lead / Senior Software Engineer

Interests:
.NET
C#
React
AWS
System Design
Microservices
AI Engineering
LLM Applications
Databricks
Software Architecture
Engineering Leadership
```

The same LinkedIn post can therefore receive different relevance scores for different users.

---

# 4. Core User Experience

## Step 1 — User sees a LinkedIn post

Example:

> "Leadership isn't about being the smartest person in the room.
>
> Here are 7 lessons every leader should know..."

## Step 2 — User clicks

```text
Analyze this post
```

## Step 3 — Extension analyzes the visible post

The system evaluates:

- Relevance
- Specificity
- Originality
- Practical value
- Personal experience
- Engagement bait
- Promotional content
- Generic/AI-style language
- Technical depth
- User-specific relevance

## Step 4 — Show result

```text
🟡 MAYBE

Signal: 58/100

Why?

✓ Contains some actionable advice
✓ Relevant to leadership

⚠ Mostly generic
⚠ No concrete experience
⚠ Several common LinkedIn phrases

Recommendation:
Read if you are interested in leadership.
Otherwise, skip.
```

---

# 5. Better Than "AI Generated"

Do NOT make the primary UI:

```text
AI GENERATED: 93%
```

AI detection is inherently probabilistic and can produce false positives.

Instead:

```text
🟢 HIGH SIGNAL
```

or

```text
🟡 MAYBE
```

or

```text
🔴 LOW SIGNAL
```

Optionally show:

```text
AI-style language: HIGH
```

but make it only one signal among several.

---

# 6. Signal Dimensions

The decision engine should evaluate the post using several independent dimensions.

## 6.1 Relevance

Does the post match the user's interests?

Example:

```text
User:
.NET + AWS + AI

Post:
"How we reduced AWS Lambda cold starts by 42%"

Result:
HIGH relevance
```

---

## 6.2 Specificity

Does the post contain concrete information?

Low specificity:

> "Great leaders communicate clearly."

High specificity:

> "We reduced our incident response time from 45 minutes to 12 minutes by introducing a dedicated incident commander rotation."

---

## 6.3 Originality

Does the author appear to provide a specific experience, observation, experiment, or insight?

Higher signal:

- Specific numbers
- Specific incident
- Specific architecture
- Specific failure
- Specific experiment
- Specific lesson

Lower signal:

- Generic statements
- Common advice
- Recycled frameworks

---

## 6.4 Practical Value

Can the reader actually learn or apply something?

Examples:

```text
HIGH:
"Here is how we implemented distributed tracing using OpenTelemetry."

LOW:
"Technology is changing faster than ever."
```

---

## 6.5 Personal Experience

Look for evidence that the author actually experienced the situation.

Examples:

```text
HIGH:
"We migrated our .NET Framework application to .NET 8."

LOW:
"Companies should modernize legacy applications."
```

---

## 6.6 Engagement Bait

Detect patterns such as:

```text
Agree?

Comment YES.

Follow me for more.

What do you think?

Save this post.

Share this with your network.
```

These should reduce signal but should not automatically make a post bad.

---

## 6.7 Promotional Content

Identify:

- Product promotion
- Service promotion
- Course promotion
- Recruiting promotion
- Lead generation

Promotion isn't inherently bad.

Instead:

```text
Promotional: HIGH
```

and let the user decide.

---

## 6.8 Generic / AI-Style Language

Possible signals:

- Excessive emoji structure
- Repeated LinkedIn clichés
- Generic motivational phrasing
- Very predictable list structure
- Excessive use of "Here's what I learned"
- Repetitive sentence patterns

This should be treated as a **style signal**, not proof of AI authorship.

---

# 7. Decision Output

JEV should ultimately make a bounded decision.

Example:

```json
{
  "recommendation": "READ",
  "signal_level": "HIGH",
  "relevance": 91,
  "specificity": 88,
  "originality": 82,
  "practical_value": 90,
  "personal_experience": 86,
  "engagement_bait": 12,
  "promotional": 5,
  "ai_style": 18,
  "reasons": [
    "Specific production incident",
    "Contains measurable results",
    "Highly relevant to your AWS and architecture interests"
  ]
}
```

Another example:

```json
{
  "recommendation": "SKIP",
  "signal_level": "LOW",
  "relevance": 32,
  "specificity": 21,
  "originality": 18,
  "practical_value": 24,
  "personal_experience": 14,
  "engagement_bait": 88,
  "promotional": 35,
  "ai_style": 81,
  "reasons": [
    "Mostly generic advice",
    "No concrete experience",
    "Heavy engagement-bait language"
  ]
}
```

---

# 8. Why JEV Fits

JEV should be used as the **decision engine**, not necessarily as the entire AI system.

The pipeline:

```text
LinkedIn Post
     ↓
Chrome Extension
     ↓
Extract visible text
     ↓
Backend API
     ↓
LLM / structured analysis
     ↓
JEV decision engine
     ↓
READ / MAYBE / SKIP
     ↓
Chrome Extension
     ↓
User sees result
```

JEV's role:

```text
Raw signals
     ↓
Decision rules / bounded reasoning
     ↓
Final recommendation
```

This makes the product easier to evolve than putting one giant prompt in the extension.

> **Implementation note:** "JEV" here is literally [TypeSafe AI's Jev model](https://typesafe.ai/blog/introducing-system-one-models-and-jev) —
> a "System One" structured-decision model reachable through OpenRouter's alpha Decisions API
> (`POST https://openrouter.ai/api/alpha/decisions`, model `typesafe/jev-1.13`). It collapses the
> "LLM / structured analysis" and "JEV decision engine" boxes above into one typed request: raw post
> text + reader profile go in as `state`, the 8 signal dimensions and the READ/MAYBE/SKIP choice come
> back as typed answers (not generated prose), so it can't hallucinate the recommendation. This *is*
> "Raw signals → decision rules / bounded reasoning → final recommendation" — just with the real Jev
> model doing the bounded reasoning instead of hand-written weights.
>
> `backend/app/jev.py`'s hand-written threshold math (`score_post`) still runs on every request as a
> deterministic fallback and audit layer: it's what produces `signal_score` and the human-readable
> `reasons` (Jev returns typed answers, not prose, so there's nothing else to build reasons text from),
> and it's still the sole decision-maker for any `LLMClient` that doesn't supply its own recommendation
> (e.g. a plain chat-completions model via `HttpJsonLLMClient`). See `backend/app/llm.py`'s
> `JevDecisionsClient` for the integration, and the README's Backend section for the required
> `JEV_API_URL` / `JEV_API_KEY` / `JEV_MODEL` environment variables.

---

# 9. 2-Day MVP

## Day 1 — Functional Prototype

### Morning

Create Chrome Manifest V3 extension.

Structure:

```text
linkedin-signal/
│
├── manifest.json
├── content.js
├── background.js
├── popup.html
├── popup.js
├── styles.css
└── icons/
```

### Content script

Find the LinkedIn post currently visible on the page.

Extract:

```text
Author
Post text
Post URL
Visible metadata
```

Do not attempt to crawl the entire LinkedIn feed initially.

---

## Day 1 Afternoon

Create a small Python backend.

Responsibilities:

```text
POST /analyze
```

Input:

```json
{
  "postText": "...",
  "profile": {
    "role": "Technical Lead",
    "interests": [
      ".NET",
      "AWS",
      "AI",
      "Architecture"
    ]
  }
}
```

Backend:

```text
Post
 ↓
LLM analysis
 ↓
JEV
 ↓
Structured result
```

Keep API keys on the backend.

Do NOT put API keys inside the Chrome extension.

---

# 10. Day 2 — UX

Add a button:

```text
[ Should I Read This? ]
```

Result:

```text
┌──────────────────────────┐
│ 🟢 HIGH SIGNAL           │
│                          │
│ Signal: 87               │
│                          │
│ Why?                     │
│                          │
│ • Real production story │
│ • Specific metrics      │
│ • Relevant to AWS       │
│ • Practical solution    │
│                          │
│ [Details]                │
└──────────────────────────┘
```

For low-signal posts:

```text
┌──────────────────────────┐
│ 🔴 LOW SIGNAL            │
│                          │
│ Signal: 24               │
│                          │
│ • Generic advice         │
│ • No concrete example    │
│ • Engagement bait        │
│                          │
│ Recommendation: SKIP     │
└──────────────────────────┘
```

---

# 11. Do NOT Build These in MVP

Avoid:

- Automatic analysis of every post
- Full LinkedIn feed replacement
- Social graph analysis
- Author reputation scoring
- Definitive AI/human detection
- Chrome sync
- User accounts
- Payments
- Analytics dashboard
- Mobile app
- Complex vector database
- Fine-tuning a model
- Training your own classifier

These increase complexity without proving the core problem.

---

# 12. Privacy Strategy

This can become a major differentiator.

Initial product should process only:

```text
User-selected LinkedIn post
```

Do not store LinkedIn posts by default.

Prefer:

```text
LinkedIn
   ↓
Extension
   ↓
Backend
   ↓
Analysis
   ↓
Result
   ↓
Discard post content
```

Optional setting:

```text
☐ Save analyzed posts
```

Default:

```text
OFF
```

---

# 13. Personalization

This is potentially the strongest differentiator.

First-run setup:

```text
What do you want LinkedIn to help you with?

☐ Software Engineering
☐ AI / LLM
☐ Cloud
☐ Architecture
☐ Leadership
☐ Startups
☐ Career
☐ Product
```

Then:

```text
Your role:
[Technical Lead]

Your interests:
[.NET] [AWS] [React] [AI] [Architecture]
```

The same post can then receive a personalized recommendation.

---

# 14. Example

### Post A

> "We migrated 12 .NET Framework services to .NET 8.
>
> The biggest problem wasn't the code migration. It was a hidden dependency in an old authentication library.
>
> Here's how we discovered it..."

Result:

```text
🟢 HIGH SIGNAL — 94

Relevant: HIGH
Specificity: HIGH
Personal experience: HIGH
Practical value: HIGH
Engagement bait: LOW

Why:
Real migration experience with a concrete technical problem.
```

---

### Post B

> "AI is changing everything.
>
> Here are 5 things every developer needs to know in 2026..."

Result:

```text
🔴 LOW SIGNAL — 29

Relevant: HIGH
Specificity: LOW
Originality: LOW
Practical value: LOW
Engagement bait: MEDIUM

Why:
Topic is relevant, but the post contains mostly generic statements.
```

This is important:

**A post can be relevant but still be low signal.**

That is the product's core value.

---

# 15. Chrome Extension UX

## Version 1

Use a manual action:

```text
Analyze this post
```

Possible trigger:

```text
Right-click → Should I Read This?
```

or a small button added to the post.

Manual analysis is preferable for the MVP because LinkedIn's DOM can change.

---

## Version 2

Automatically add a signal badge:

```text
🟢 91
🟡 63
🔴 28
```

Only analyze posts as they become visible.

Use caching so the same post isn't repeatedly analyzed.

---

# 16. Possible Architecture

```text
                 LinkedIn
                    │
                    ▼
           Chrome Extension
                    │
                    │ HTTPS
                    ▼
            Python API
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
       LLM Analysis          JEV
          │                   │
          └─────────┬─────────┘
                    ▼
             Signal Result
                    │
                    ▼
           Chrome Extension
                    │
                    ▼
            LinkedIn UI
```

---

# 17. Suggested Tech Stack

## Frontend

```text
Chrome Extension
Manifest V3
JavaScript / TypeScript
HTML
CSS
```

React is optional.

For a 2-day MVP, plain TypeScript is faster.

## Backend

```text
Python
FastAPI
```


## Decision engine

```text
JEV
```

## LLM

Use whichever model/API gives the lowest cost and sufficient structured-output quality.

The MVP does not need model training.

## Storage

Initially:

```text
No database
```

Later:

```text
SQLite / PostgreSQL
```

---

# 18. Cost Target

The first prototype should aim for:

```text
Chrome Extension: Free
Backend: Very low cost
LLM: Pay per analysis
JEV: Based on available API pricing
Database: $0 initially
```

Do not build infrastructure before validating usage.

---

# 19. Validation Before Building Too Much

The first goal is NOT:

> "Can we detect AI?"

The first goal is:

> "Will people actually use this before reading LinkedIn posts?"

Build a prototype and give it to 5–10 people.

Measure:

```text
Posts analyzed
Recommendations accepted
Recommendations ignored
User clicked "Why?"
User disagreed with result
User analyzed another post
```

Most important metric:

## Repeat analysis rate

If someone analyzes one post and never uses it again, the product may not have enough value.

If they repeatedly click it while browsing LinkedIn, there is a real usage signal.

---

# 20. MVP Success Criteria

After the first test:

```text
10 users
↓
Each uses LinkedIn normally
↓
Extension installed
↓
Analyze posts
```

Look for:

```text
Do users analyze multiple posts?
Do they understand the result immediately?
Do they click "Why?"
Do they disagree frequently?
Do they say "this saved me time?"
```

A useful qualitative question:

> "If this extension disappeared tomorrow, would you notice?"

---

# 21. Product Positioning

Avoid:

> AI Detector for LinkedIn

Better:

> **Know if a LinkedIn post is worth your time.**

Alternative:

> **Cut through LinkedIn noise.**

Alternative:

> **See the signal before you read the post.**

---

# 22. Possible Product Names

### Strong candidates

- LinkedIn Signal
- SignalFeed
- ReadSignal
- SignalCheck
- WorthRead
- PostSignal
- FeedSignal
- ShouldIRead
- SignalLens

The name can be decided after the prototype works.

---

# 23. Future Features

After validating the core workflow:

## Smart Feed

Automatically show:

```text
🟢 High signal
🟡 Maybe
🔴 Low signal
```

---

## Personal Learning

User can click:

```text
👍 Useful
👎 Not useful
```

The system learns their preferences.

---

## Hide Low Signal

Optional:

```text
☑ Hide posts below 30 signal
```

---

## Topic Filtering

```text
Show me more:
AI
.NET
AWS
Architecture

Show me less:
Motivation
Recruitment
Generic leadership
Crypto
```

---

## Author Signal

Potentially show:

```text
This author frequently posts:
• Concrete technical experiences
• Architecture case studies
• Practical tutorials
```

Avoid turning this into a reputation/ranking system without strong evidence.

---

# 24. Biggest Technical Risks

## Risk 1 — LinkedIn DOM changes

Mitigation:

Start with manual post selection.

---

## Risk 2 — AI detection false positives

Mitigation:

Never make AI detection the primary decision.

Use:

```text
AI-style signals
```

instead of:

```text
AI-generated: TRUE
```

---

## Risk 3 — Users disagree with recommendations

Mitigation:

Show the reasons.

Example:

```text
SKIP because:
- Generic
- No specific experience
- Mostly motivational
```

Users can then judge the recommendation.

---

## Risk 4 — API cost

Mitigation:

- Analyze only on click
- Cache results by post hash
- Use smaller models for first-pass analysis
- Use deeper analysis only when needed

---

# 25. Recommended MVP Scope

Build exactly this first:

```text
Chrome Extension
        ↓
Select LinkedIn post
        ↓
Click "Should I Read This?"
        ↓
Send text to backend
        ↓
Analyze
        ↓
JEV decision
        ↓
Return:
    Signal level
    Recommendation
    3 reasons
        ↓
Display result
```

Nothing more.

---

# 26. Final Product Thesis

The product is not really an AI detector.

It is a **time-saving decision layer for LinkedIn**.

The key question is:

> "Is this post worth the next 30 seconds of my attention?"

That is a clearer user problem, allows personalization, and avoids depending entirely on unreliable AI-authorship detection.

## First milestone

Build the extension so that a user can analyze one LinkedIn post in **under 2 clicks** and get a useful READ / MAYBE / SKIP result in a few seconds.

If that interaction feels valuable, build the automatic feed experience afterward.
