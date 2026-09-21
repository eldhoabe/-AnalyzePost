"""In-memory analysis cache + an opt-in-only raw post store.

Neither is a database (spec section 17: "Initially: No database") -- both
live only in process memory and are gone on restart. This is also the
privacy boundary (spec section 12): the cache is keyed by a one-way hash
and stores only the already-abstracted signal scores, never the raw post
text. Raw text is only ever kept in ``PostStore``, and only when the
caller explicitly opts in.
"""

from __future__ import annotations

import hashlib
import json

from app.models import AnalyzeResponse, Profile


def hash_key(post_text: str, profile: Profile) -> str:
    payload = json.dumps(
        {"postText": post_text, "profile": profile.model_dump()},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class AnalysisCache:
    """Caches analysis results by a hash of (post text, profile)."""

    def __init__(self) -> None:
        self._results: dict[str, AnalyzeResponse] = {}

    def get(self, key: str) -> AnalyzeResponse | None:
        return self._results.get(key)

    def set(self, key: str, response: AnalyzeResponse) -> None:
        self._results[key] = response

    def clear(self) -> None:
        self._results.clear()

    def __len__(self) -> int:
        return len(self._results)


class PostStore:
    """Opt-in only. Stays empty unless a caller explicitly saves a post."""

    def __init__(self) -> None:
        self._posts: dict[str, str] = {}

    def save(self, key: str, post_text: str) -> None:
        self._posts[key] = post_text

    def get(self, key: str) -> str | None:
        return self._posts.get(key)

    def clear(self) -> None:
        self._posts.clear()

    def __len__(self) -> int:
        return len(self._posts)
