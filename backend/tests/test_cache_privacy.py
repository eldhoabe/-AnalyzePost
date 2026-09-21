from fastapi.testclient import TestClient

from app.cache import hash_key
from app.llm import FakeLLMClient
from app.main import app, get_llm_client, post_store
from tests.fixtures import POST_A_EXTRACTION, POST_A_TEXT, PROFILE

client = TestClient(app)


def _use_fake_llm() -> FakeLLMClient:
    fake = FakeLLMClient(response=POST_A_EXTRACTION)
    app.dependency_overrides[get_llm_client] = lambda: fake
    return fake


def teardown_function() -> None:
    app.dependency_overrides.clear()


def _analyze(save_post: bool = False):
    return client.post(
        "/analyze",
        json={
            "postText": POST_A_TEXT,
            "profile": PROFILE.model_dump(),
            "save_post": save_post,
        },
    )


def test_repeated_identical_request_hits_llm_once():
    fake = _use_fake_llm()

    first = _analyze()
    second = _analyze()

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert fake.call_count == 1


def test_post_text_not_persisted_by_default():
    _use_fake_llm()

    _analyze(save_post=False)

    assert len(post_store) == 0


def test_post_text_persisted_only_when_opted_in():
    _use_fake_llm()

    _analyze(save_post=True)

    assert len(post_store) == 1
    key = hash_key(POST_A_TEXT, PROFILE)
    assert post_store.get(key) == POST_A_TEXT
