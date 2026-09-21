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

from app.models import Profile, Signals

SIGNAL_FIELDS = tuple(Signals.model_fields)


class LLMExtractionError(RuntimeError):
    """Raised when an LLM response can't be parsed into structured signals."""


@dataclass
class SignalExtraction:
    signals: Signals
    notes: dict[str, str] = field(default_factory=dict)


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
