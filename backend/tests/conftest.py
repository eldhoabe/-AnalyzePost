import pytest

from app.main import analysis_cache, post_store


@pytest.fixture(autouse=True)
def _reset_backend_state():
    """Isolate tests from each other's cache/post-store side effects."""
    analysis_cache.clear()
    post_store.clear()
    yield
    analysis_cache.clear()
    post_store.clear()
