from fastapi.testclient import TestClient

from app.llm import FakeLLMClient, SignalExtraction
from app.main import app, get_llm_client
from app.models import Recommendation, Signals
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


def test_client_supplied_recommendation_overrides_threshold_math():
    """A client that decides the recommendation itself (JevDecisionsClient in
    production) wins over score_post()'s own threshold-derived recommendation.

    These signals sit in score_post()'s MAYBE band (see app/jev.py's
    HIGH_THRESHOLD/LOW_THRESHOLD) -- i.e. the thresholds alone would call
    this MAYBE -- but the extraction explicitly says READ, so the response
    must say READ/HIGH, not the thresholds' own answer.
    """
    borderline_signals = Signals(
        relevance=60,
        specificity=55,
        originality=55,
        practical_value=55,
        personal_experience=55,
        engagement_bait=20,
        promotional=20,
        ai_style=20,
    )
    extraction = SignalExtraction(
        signals=borderline_signals, notes={}, recommendation=Recommendation.READ
    )
    fake = FakeLLMClient(response=extraction)
    app.dependency_overrides[get_llm_client] = lambda: fake

    response = client.post(
        "/analyze",
        json={"postText": "borderline post", "profile": PROFILE.model_dump()},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"] == "READ"
    assert body["signal_level"] == "HIGH"
    # signal_score must be pulled up into the HIGH band too, not left at
    # whatever score_post()'s own (now-overridden) threshold math produced
    # (that math alone gives 48 for these signals -- see the docstring above).
    assert body["signal_score"] >= 70
