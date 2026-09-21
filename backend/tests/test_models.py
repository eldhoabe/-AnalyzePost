import pytest
from pydantic import ValidationError

from app.models import AnalyzeRequest, AnalyzeResponse

# Worked examples from the product spec, section 7.

READ_EXAMPLE = {
    "recommendation": "READ",
    "signal_level": "HIGH",
    "relevance": 91,
    "specificity": 88,
    "originality": 82,
    "practical_value": 90,
    "personal_experience": 86,
    "engagement_bait": 12,
    "promotional": 5,
    "ai_style": 18,
    "reasons": [
        "Specific production incident",
        "Contains measurable results",
        "Highly relevant to your AWS and architecture interests",
    ],
}

SKIP_EXAMPLE = {
    "recommendation": "SKIP",
    "signal_level": "LOW",
    "relevance": 32,
    "specificity": 21,
    "originality": 18,
    "practical_value": 24,
    "personal_experience": 14,
    "engagement_bait": 88,
    "promotional": 35,
    "ai_style": 81,
    "reasons": [
        "Mostly generic advice",
        "No concrete experience",
        "Heavy engagement-bait language",
    ],
}


def test_parses_read_example():
    response = AnalyzeResponse.model_validate(READ_EXAMPLE)

    assert response.recommendation == "READ"
    assert response.signal_level == "HIGH"
    assert response.relevance == 91
    assert len(response.reasons) == 3


def test_parses_skip_example():
    response = AnalyzeResponse.model_validate(SKIP_EXAMPLE)

    assert response.recommendation == "SKIP"
    assert response.signal_level == "LOW"


def test_rejects_invalid_recommendation():
    bad = {**READ_EXAMPLE, "recommendation": "MAYBE_NOT"}

    with pytest.raises(ValidationError):
        AnalyzeResponse.model_validate(bad)


def test_rejects_out_of_range_score():
    bad = {**READ_EXAMPLE, "relevance": 150}

    with pytest.raises(ValidationError):
        AnalyzeResponse.model_validate(bad)


def test_rejects_negative_score():
    bad = {**READ_EXAMPLE, "specificity": -1}

    with pytest.raises(ValidationError):
        AnalyzeResponse.model_validate(bad)


def test_parses_analyze_request():
    request = AnalyzeRequest.model_validate(
        {
            "postText": "We migrated 12 .NET Framework services to .NET 8.",
            "profile": {
                "role": "Technical Lead",
                "interests": [".NET", "AWS", "AI", "Architecture"],
            },
        }
    )

    assert request.profile.role == "Technical Lead"
    assert request.save_post is False
