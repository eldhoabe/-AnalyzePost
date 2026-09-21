"""LLM-backed structured signal extraction.

Turns raw post text + a reader profile into the 8 structured signal scores
(spec section 6) plus short evidence notes per dimension. The network call
is isolated behind the ``LLMClient`` protocol so the rest of the backend
(and its tests) never need a real API key.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.jev import GOOD_WHEN_HIGH, NEGATIVE_FALLBACK, POSITIVE_FALLBACK
from app.models import Profile, Recommendation, Signals

SIGNAL_FIELDS = tuple(Signals.model_fields)


class LLMExtractionError(RuntimeError):
    """Raised when an LLM response can't be parsed into structured signals."""


@dataclass
class SignalExtraction:
    signals: Signals
    notes: dict[str, str] = field(default_factory=dict)
    # Set only by clients (like JevDecisionsClient) that decide the
    # recommendation themselves rather than leaving it to app.jev's
    # threshold math. None means "let score_post() decide" -- the original,
    # still-default behavior for FakeLLMClient/HttpJsonLLMClient.
    recommendation: Recommendation | None = None


class LLMClient(Protocol):
    def extract(self, post_text: str, profile: Profile) -> SignalExtraction: ...


class FakeLLMClient:
    """Deterministic stand-in for tests and local development without API cost."""

    def __init__(self, response: SignalExtraction | None = None):
        self._response = response
        self.calls: list[tuple[str, Profile]] = []

    def extract(self, post_text: str, profile: Profile) -> SignalExtraction:
        self.calls.append((post_text, profile))
        if self._response is None:
            raise LLMExtractionError("FakeLLMClient has no canned response configured")
        return self._response

    @property
    def call_count(self) -> int:
        return len(self.calls)


PROMPT_TEMPLATE = """You are analyzing a LinkedIn post for a reader with this profile:
Role: {role}
Interests: {interests}

Post:
\"\"\"
{post_text}
\"\"\"

Score the post from 0-100 on each of these dimensions, and give a short
(<=12 word) evidence note for each: relevance, specificity, originality,
practical_value, personal_experience, engagement_bait, promotional,
ai_style.

Respond with ONLY a JSON object of this exact shape, no other text:
{{
  "scores": {{"relevance": int, "specificity": int, "originality": int,
              "practical_value": int, "personal_experience": int,
              "engagement_bait": int, "promotional": int, "ai_style": int}},
  "notes": {{"<dimension>": "<short evidence phrase>", ...}}
}}
"""


class HttpJsonLLMClient:
    """Calls an OpenAI-chat-completions-shaped HTTP endpoint.

    Works with any provider that speaks that shape, so the backend isn't
    locked to one vendor SDK (spec section 17: "whichever model/API gives
    the lowest cost"). Configured entirely via environment variables so
    keys live only on the server (spec section 9/16 — never in the
    extension).
    """

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 20.0,
    ):
        self.api_url = api_url or os.environ.get(
            "LLM_API_URL", "https://api.openai.com/v1/chat/completions"
        )
        self.api_key = api_key or os.environ.get("LLM_API_KEY")
        self.model = model or os.environ.get("LLM_MODEL", "gpt-4o-mini")
        self.timeout = timeout

    def extract(self, post_text: str, profile: Profile) -> SignalExtraction:
        prompt = PROMPT_TEMPLATE.format(
            role=profile.role,
            interests=", ".join(profile.interests),
            post_text=post_text,
        )
        response = httpx.post(
            self.api_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0,
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return parse_llm_response(content)


def parse_llm_response(content: str) -> SignalExtraction:
    """Parse a (supposedly) JSON LLM response into structured signals.

    Isolated from the HTTP call so the error path is unit-testable without
    a network round-trip.
    """
    try:
        data = json.loads(content)
        scores = data["scores"]
        signals = Signals(**{name: scores[name] for name in SIGNAL_FIELDS})
        raw_notes = data.get("notes") or {}
        notes = {k: v for k, v in raw_notes.items() if k in SIGNAL_FIELDS}
    except (json.JSONDecodeError, KeyError, TypeError, ValueError, AttributeError) as exc:
        raise LLMExtractionError(
            f"Could not parse LLM response as structured signals: {exc}"
        ) from exc

    return SignalExtraction(signals=signals, notes=notes)


# --- Jev (TypeSafe AI) Decisions API client -------------------------------
#
# Jev is a "System One" structured-decision model (https://typesafe.ai),
# reachable through OpenRouter's alpha Decisions endpoint rather than the
# usual chat-completions shape: POST {model, state, questions} -> typed
# answers (no free-text generation, so no JSON-parsing/hallucination risk
# the way a chat model's response needs parse_llm_response() above).
#
# One call replaces the whole extraction step: it both scores the 8
# dimensions (as "score" questions) and picks a recommendation directly (as
# a "choice" question), rather than leaving the recommendation to score_post
# ()'s threshold math. main.py uses that recommendation when present.

JEV_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
JEV_DEFAULT_MODEL = "typesafe/jev-1.13"

DIMENSION_INSTRUCTIONS = {
    "relevance": "How relevant is this post to the reader's stated role and interests?",
    "specificity": (
        "How concrete and specific is this post -- named systems, real numbers, "
        "specific details -- versus vague and generic?"
    ),
    "originality": (
        "Does this share a distinct experience or observation, or mostly recycle "
        "common advice?"
    ),
    "practical_value": "How much practical, applicable value would the reader get from this?",
    "personal_experience": "Is this grounded in the author's own firsthand experience?",
    "engagement_bait": (
        "Does this lean on engagement-bait phrasing, e.g. \"agree?\", \"thoughts?\", "
        "rage-bait hooks, or a deliberately vague opener?"
    ),
    "promotional": "Is this primarily promotional or advertising content?",
    "ai_style": "Does this read as generic AI-style phrasing rather than a genuine voice?",
}

RECOMMENDATION_CRITERIA = {
    "READ": (
        "High signal: specific, original, and practically useful given the reader's "
        "role and interests -- not just topically relevant."
    ),
    "MAYBE": (
        "Mixed signal: either relevant but generic/low-effort, or specific but of "
        "unclear relevance to this reader."
    ),
    "SKIP": (
        "Low signal: not relevant, generic, promotional, or leans on engagement bait "
        "-- regardless of topical relevance."
    ),
}


def _dimension_legend(dim: str) -> list[str]:
    """3-point score legend, low->high, reusing app.jev's own fallback text.

    For a positive dimension (e.g. specificity) a high score is good, so the
    legend runs [bad, mixed, good]. For a penalty dimension (e.g.
    engagement_bait) a high score is bad, so it's reversed: [absence of the
    problem, mixed, presence of the problem].
    """
    if dim in GOOD_WHEN_HIGH:
        return [NEGATIVE_FALLBACK[dim], "Mixed / in between", POSITIVE_FALLBACK[dim]]
    return [POSITIVE_FALLBACK[dim], "Mixed / in between", NEGATIVE_FALLBACK[dim]]


def build_jev_request(post_text: str, profile: Profile, model: str) -> dict:
    """Build the {model, state, questions} payload for POST /api/alpha/decisions."""
    questions = {
        dim: {
            "type": "score",
            "instructions": DIMENSION_INSTRUCTIONS[dim],
            "criteria": _dimension_legend(dim),
        }
        for dim in SIGNAL_FIELDS
    }
    questions["recommendation"] = {
        "type": "choice",
        "instructions": "Should the reader read this post, given their role and interests?",
        "criteria": RECOMMENDATION_CRITERIA,
    }
    return {
        "model": model,
        "state": {
            "post_text": post_text,
            "reader_role": profile.role,
            "reader_interests": profile.interests,
        },
        "questions": questions,
    }


def parse_jev_response(data: dict) -> SignalExtraction:
    """Parse a Decisions API response into structured signals + recommendation.

    Isolated from the HTTP call so the error path is unit-testable without a
    network round-trip, mirroring parse_llm_response() above.
    """
    try:
        answers = data["answers"]

        scores = {}
        for dim in SIGNAL_FIELDS:
            answer = answers[dim]
            legend_len = len(answer["legend"])
            # "score" is the probability-weighted legend index (e.g. 1.96 on
            # a 0-2 legend), not a 0-100 value -- rescale it.
            scaled = round(answer["score"] / (legend_len - 1) * 100)
            scores[dim] = max(0, min(100, scaled))
        signals = Signals(**scores)

        recommendation = Recommendation(answers["recommendation"]["choice"])
    except (KeyError, TypeError, ValueError, ZeroDivisionError) as exc:
        raise LLMExtractionError(
            f"Could not parse Jev Decisions response: {exc}"
        ) from exc

    return SignalExtraction(signals=signals, notes={}, recommendation=recommendation)


class JevDecisionsClient:
    """Calls the real Jev model (typesafe/jev-1.13) via OpenRouter's alpha
    Decisions API. This is the default production LLMClient (see
    app.main.get_llm_client) -- it replaces the generic chat-completions call
    HttpJsonLLMClient makes, in a single structured, typed request.
    """

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 20.0,
    ):
        self.api_url = api_url or os.environ.get("JEV_API_URL", JEV_DECISIONS_URL)
        # Falls back to LLM_API_KEY since this is typically the same
        # OpenRouter account/key as the (now-unused-by-default) chat client.
        self.api_key = api_key or os.environ.get("JEV_API_KEY") or os.environ.get(
            "LLM_API_KEY"
        )
        self.model = model or os.environ.get("JEV_MODEL", JEV_DEFAULT_MODEL)
        self.timeout = timeout

    def extract(self, post_text: str, profile: Profile) -> SignalExtraction:
        payload = build_jev_request(post_text, profile, self.model)
        response = httpx.post(
            self.api_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return parse_jev_response(response.json())
