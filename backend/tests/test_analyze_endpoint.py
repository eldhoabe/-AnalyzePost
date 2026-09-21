from fastapi.testclient import TestClient

from app.llm import FakeLLMClient
from app.main import app, get_llm_client
from tests.fixtures import (
    POST_A_EXTRACTION,
    POST_A_TEXT,
    POST_B_EXTRACTION,
    POST_B_TEXT,
    PROFILE,
)

client = TestClient(app)


def _use_fake_llm(extraction) -> FakeLLMClient:
    fake = FakeLLMClient(response=extraction)
    app.dependency_overrides[get_llm_client] = lambda: fake
    return fake


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_analyze_post_a_returns_read():
    _use_fake_llm(POST_A_EXTRACTION)

    response = client.post(
        "/analyze",
        json={"postText": POST_A_TEXT, "profile": PROFILE.model_dump()},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"] == "READ"
    assert body["signal_level"] == "HIGH"
    assert len(body["reasons"]) == 3


def test_analyze_post_b_returns_skip():
    _use_fake_llm(POST_B_EXTRACTION)

    response = client.post(
        "/analyze",
        json={"postText": POST_B_TEXT, "profile": PROFILE.model_dump()},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"] == "SKIP"
    assert body["signal_level"] == "LOW"


def test_analyze_passes_post_text_and_profile_to_llm_client():
    fake = _use_fake_llm(POST_A_EXTRACTION)

    client.post(
        "/analyze",
        json={"postText": POST_A_TEXT, "profile": PROFILE.model_dump()},
    )

    assert fake.call_count == 1
    called_text, called_profile = fake.calls[0]
    assert called_text == POST_A_TEXT
    assert called_profile.role == PROFILE.role


def test_analyze_rejects_missing_profile():
    response = client.post("/analyze", json={"postText": "some text"})

    assert response.status_code == 422
