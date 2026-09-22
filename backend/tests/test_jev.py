from app.jev import clamp_score_to_level, score_post
from app.models import Signals, SignalLevel
from tests.fixtures import POST_A_SIGNALS as POST_A
from tests.fixtures import POST_B_SIGNALS as POST_B


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


def test_clamp_score_to_level_pulls_low_score_up_into_high_band():
    # Regression case: a JevDecisionsClient override to HIGH shouldn't leave
    # a signal_score that reads as low/contradictory (spec section 14's
    # underlying invariant applies to the response as a whole, not just the
    # recommendation field).
    assert clamp_score_to_level(0, SignalLevel.HIGH) == 70


def test_clamp_score_to_level_pulls_high_score_down_into_low_band():
    assert clamp_score_to_level(100, SignalLevel.LOW) == 39


def test_clamp_score_to_level_pulls_extreme_scores_into_maybe_band():
    assert clamp_score_to_level(0, SignalLevel.MAYBE) == 40
    assert clamp_score_to_level(100, SignalLevel.MAYBE) == 69


def test_clamp_score_to_level_leaves_already_consistent_score_unchanged():
    assert clamp_score_to_level(85, SignalLevel.HIGH) == 85
    assert clamp_score_to_level(10, SignalLevel.LOW) == 10
    assert clamp_score_to_level(55, SignalLevel.MAYBE) == 55
