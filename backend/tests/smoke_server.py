"""Runs the real backend with a deterministic, scripted LLM client instead
of a real LLM call.

This is what makes the cross-stack smoke test possible: the extension
needs to hit a real, independently-running HTTP server (its background
service worker does a real fetch() from inside a real Chromium process,
not something we can patch in-process), but the smoke test still needs
reproducible results without a real LLM API key. This script boots the
exact same FastAPI `app` used in production, with only the LLM client
dependency swapped for one that returns canned signals keyed by exact
post text -- everything else (schemas, JEV, caching, the HTTP route
itself) is the real thing.

Usage (from backend/): python -m tests.smoke_server
"""

import uvicorn

from app.llm import LLMClient, SignalExtraction
from app.main import app, get_llm_client
from app.models import Profile
from tests.fixtures import (
    POST_A_EXTRACTION,
    POST_A_TEXT,
    POST_B_EXTRACTION,
    POST_B_TEXT,
)


class ScriptedLLMClient:
    """Deterministic LLMClient keyed by exact post text."""

    def __init__(self, script: dict[str, SignalExtraction]):
        self._script = script

    def extract(self, post_text: str, profile: Profile) -> SignalExtraction:
        try:
            return self._script[post_text]
        except KeyError as exc:
            raise RuntimeError(
                f"smoke_server has no scripted response for this post text: {post_text!r}"
            ) from exc


def build_app() -> None:
    scripted: LLMClient = ScriptedLLMClient(
        {
            POST_A_TEXT: POST_A_EXTRACTION,
            POST_B_TEXT: POST_B_EXTRACTION,
        }
    )
    app.dependency_overrides[get_llm_client] = lambda: scripted


def main() -> None:
    build_app()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")


if __name__ == "__main__":
    main()
