from app.jev import score_post
from app.models import Signals

# Signal values consistent with the qualitative labels given for Post A /
# Post B in product spec section 14 (the spec only gives qualitative
# HIGH/MEDIUM/LOW labels there, not raw numbers).

POST_A = Signals(
    relevance=92,
    specificity=90,
    originality=85,
    practical_value=92,
    personal_experience=88,
    engagement_bait=8,
    promotional=5,
    ai_style=10,
)

POST_B = Signals(
    relevance=90,
    specificity=20,
    originality=20,
    practical_value=20,
    personal_experience=15,
    engagement_bait=55,
    promotional=15,
    ai_style=70,
)


def test_post_a_concrete_experience_is_read_high():
    result = score_post(POST_A)

    assert result.recommendation == "READ"
    assert result.signal_level == "HIGH"
    assert len(result.reasons) == 3


def test_post_b_relevant_but_generic_is_skip_low():
    """Regression test for the product's core thesis (spec section 14):
    a post can be highly relevant and still be low signal.
    """
    assert POST_B.relevance >= 70, "fixture must be high-relevance to test the invariant"

    result = score_post(POST_B)

    assert result.recommendation == "SKIP"
    assert result.signal_level == "LOW"
    assert len(result.reasons) == 3


def test_all_zero_signals_is_skip():
    signals = Signals(
        relevance=0,
        specificity=0,
        originality=0,
        practical_value=0,
        personal_experience=0,
        engagement_bait=0,
        promotional=0,
        ai_style=0,
    )

    result = score_post(signals)

    assert result.recommendation == "SKIP"
    assert result.signal_level == "LOW"
    assert result.signal_score == 0


def test_maxed_positive_signals_with_no_penalties_is_read():
    signals = Signals(
        relevance=100,
        specificity=100,
        originality=100,
        practical_value=100,
        personal_experience=100,
        engagement_bait=0,
        promotional=0,
        ai_style=0,
    )

    result = score_post(signals)

    assert result.recommendation == "READ"
    assert result.signal_level == "HIGH"
    assert result.signal_score == 100


def test_llm_supplied_notes_are_used_verbatim_when_decisive():
    result = score_post(POST_A, notes={"specificity": "Cites a 42% reduction in cold starts"})

    assert "Cites a 42% reduction in cold starts" in result.reasons
