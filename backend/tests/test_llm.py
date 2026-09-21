import pytest

from app.llm import (
    FakeLLMClient,
    LLMExtractionError,
    SignalExtraction,
    parse_llm_response,
)
from app.models import Profile, Signals


def _profile() -> Profile:
    return Profile(role="Technical Lead", interests=["AWS", ".NET"])


def test_fake_llm_client_returns_canned_response():
    canned = SignalExtraction(
        signals=Signals(
            relevance=90,
            specificity=85,
            originality=80,
            practical_value=88,
            personal_experience=82,
            engagement_bait=10,
            promotional=5,
            ai_style=15,
        ),
        notes={"specificity": "Cites exact incident timeline"},
    )
    client = FakeLLMClient(response=canned)

    result = client.extract("some post text", _profile())

    assert result is canned
    assert client.call_count == 1


def test_fake_llm_client_without_canned_response_raises():
    client = FakeLLMClient()

    with pytest.raises(LLMExtractionError):
        client.extract("some post text", _profile())


def test_parse_llm_response_round_trips_valid_json():
    content = """{
        "scores": {"relevance": 90, "specificity": 85, "originality": 80,
                    "practical_value": 88, "personal_experience": 82,
                    "engagement_bait": 10, "promotional": 5, "ai_style": 15},
        "notes": {"specificity": "Cites exact incident timeline", "unknown_field": "ignored"}
    }"""

    result = parse_llm_response(content)

    assert result.signals.relevance == 90
    assert result.signals.ai_style == 15
    assert result.notes == {"specificity": "Cites exact incident timeline"}


def test_parse_llm_response_rejects_non_json():
    with pytest.raises(LLMExtractionError):
        parse_llm_response("not json at all, sorry")


def test_parse_llm_response_rejects_missing_scores_key():
    with pytest.raises(LLMExtractionError):
        parse_llm_response('{"notes": {}}')


def test_parse_llm_response_rejects_incomplete_scores():
    with pytest.raises(LLMExtractionError):
        parse_llm_response('{"scores": {"relevance": 90}}')


def test_parse_llm_response_rejects_out_of_range_score():
    content = """{
        "scores": {"relevance": 900, "specificity": 85, "originality": 80,
                    "practical_value": 88, "personal_experience": 82,
                    "engagement_bait": 10, "promotional": 5, "ai_style": 15}
    }"""

    with pytest.raises(LLMExtractionError):
        parse_llm_response(content)
