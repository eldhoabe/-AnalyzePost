import pytest

from app.llm import LLMExtractionError, build_jev_request, parse_jev_response
from app.models import Profile, Recommendation

SIGNAL_FIELDS = (
    "relevance",
    "specificity",
    "originality",
    "practical_value",
    "personal_experience",
    "engagement_bait",
    "promotional",
    "ai_style",
)


def _profile() -> Profile:
    return Profile(role="Backend engineer", interests=["microservices"])


def _decisions_response(recommendation: str = "READ") -> dict:
    """A Decisions API response shaped like the real one (see the wire
    format captured from a live call against POST /api/alpha/decisions).
    """
    answers = {
        dim: {"type": "score", "score": 1.5, "legend": ["a", "b", "c"]}
        for dim in SIGNAL_FIELDS
    }
    answers["recommendation"] = {
        "type": "choice",
        "choice": recommendation,
        "probabilities": {"READ": 1, "MAYBE": 0, "SKIP": 0},
        "confidence": 1,
    }
    return {"model": "typesafe/jev-1.13-20260917", "answers": answers}


def test_build_jev_request_has_score_question_per_signal_dimension():
    payload = build_jev_request("some post text", _profile(), "typesafe/jev-1.13")

    for dim in SIGNAL_FIELDS:
        assert payload["questions"][dim]["type"] == "score"
        assert len(payload["questions"][dim]["criteria"]) == 3

    assert payload["state"]["post_text"] == "some post text"
    assert payload["state"]["reader_role"] == "Backend engineer"
    assert payload["model"] == "typesafe/jev-1.13"


def test_build_jev_request_has_choice_question_for_recommendation():
    payload = build_jev_request("some post text", _profile(), "typesafe/jev-1.13")

    question = payload["questions"]["recommendation"]
    assert question["type"] == "choice"
    assert set(question["criteria"]) == {"READ", "MAYBE", "SKIP"}


def test_parse_jev_response_rescales_score_to_0_100():
    result = parse_jev_response(_decisions_response())

    # score=1.5 on a 3-point (0,1,2) legend -> 1.5/2*100 = 75
    assert result.signals.relevance == 75
    assert result.signals.ai_style == 75


def test_parse_jev_response_reads_recommendation_directly():
    result = parse_jev_response(_decisions_response(recommendation="SKIP"))

    assert result.recommendation == Recommendation.SKIP


def test_parse_jev_response_notes_are_always_empty():
    """Jev returns typed answers, never prose -- notes stay empty so
    score_post()'s reason-text fallback templates take over.
    """
    result = parse_jev_response(_decisions_response())

    assert result.notes == {}


def test_parse_jev_response_rejects_missing_answers_key():
    with pytest.raises(LLMExtractionError):
        parse_jev_response({"model": "typesafe/jev-1.13"})


def test_parse_jev_response_rejects_missing_dimension():
    data = _decisions_response()
    del data["answers"]["relevance"]

    with pytest.raises(LLMExtractionError):
        parse_jev_response(data)


def test_parse_jev_response_rejects_invalid_recommendation_choice():
    data = _decisions_response()
    data["answers"]["recommendation"]["choice"] = "NOT_A_REAL_CHOICE"

    with pytest.raises(LLMExtractionError):
        parse_jev_response(data)
