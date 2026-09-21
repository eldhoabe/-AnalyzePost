"""JEV — the bounded decision engine.

Takes the 8 structured signal scores produced by the LLM analysis step and
turns them into a final recommendation. No I/O, no LLM calls: pure rules
over numbers, so it is fast, cheap, and fully unit-testable.

Key invariant (product spec section 14): a post can be highly *relevant*
and still be *low signal*. Relevance alone must never be sufficient for a
READ recommendation — it is one of five positive dimensions, weighed
against three penalty dimensions (engagement bait, promotional intent,
generic/AI-style phrasing).
"""

from app.models import AnalyzeResponse, Recommendation, Signals, SignalLevel

POSITIVE_WEIGHTS = {
    "relevance": 0.15,
    "specificity": 0.25,
    "originality": 0.20,
    "practical_value": 0.25,
    "personal_experience": 0.15,
}

PENALTY_WEIGHTS = {
    "engagement_bait": 0.5,
    "promotional": 0.2,
    "ai_style": 0.3,
}

DIMENSION_WEIGHTS = {**POSITIVE_WEIGHTS, **PENALTY_WEIGHTS}

# How much the penalty composite drags the positive composite down.
PENALTY_INFLUENCE = 0.4

HIGH_THRESHOLD = 70
LOW_THRESHOLD = 40

NEUTRAL = 50

POSITIVE_FALLBACK = {
    "relevance": "Highly relevant to your interests",
    "specificity": "Backed by concrete, specific details",
    "originality": "Shares a distinct experience or observation",
    "practical_value": "Offers something practical you can apply",
    "personal_experience": "Grounded in firsthand experience",
    "engagement_bait": "Free of engagement-bait phrasing",
    "promotional": "Not promotional",
    "ai_style": "Reads as genuine, not generic AI-style phrasing",
}

NEGATIVE_FALLBACK = {
    "relevance": "Not very relevant to your interests",
    "specificity": "Mostly generic, lacking concrete detail",
    "originality": "Recycled advice rather than a specific experience",
    "practical_value": "Little practical takeaway",
    "personal_experience": "No evidence of firsthand experience",
    "engagement_bait": "Leans on engagement-bait phrasing",
    "promotional": "Reads as promotional content",
    "ai_style": "Generic, AI-style phrasing",
}

# For these dimensions, a high score is good. For the rest (penalties), a
# low score is good.
GOOD_WHEN_HIGH = frozenset(POSITIVE_WEIGHTS)


def score_post(signals: Signals, notes: dict[str, str] | None = None) -> AnalyzeResponse:
    """Score a post's signals into a bounded recommendation.

    ``notes`` are optional short, human-readable evidence phrases supplied
    by the LLM extraction step for one or more dimensions (e.g. "Real
    production migration story with concrete numbers"). Where present they
    are used verbatim as reasons; dimensions without a note fall back to a
    generic template so the engine degrades gracefully with any LLM output.
    """
    notes = notes or {}

    positive_component = sum(
        weight * getattr(signals, dim) for dim, weight in POSITIVE_WEIGHTS.items()
    )
    penalty_component = sum(
        weight * getattr(signals, dim) for dim, weight in PENALTY_WEIGHTS.items()
    )

    signal_score = round(positive_component - PENALTY_INFLUENCE * penalty_component)
    signal_score = max(0, min(100, signal_score))

    if signal_score >= HIGH_THRESHOLD:
        signal_level = SignalLevel.HIGH
        recommendation = Recommendation.READ
    elif signal_score < LOW_THRESHOLD:
        signal_level = SignalLevel.LOW
        recommendation = Recommendation.SKIP
    else:
        signal_level = SignalLevel.MAYBE
        recommendation = Recommendation.MAYBE

    return AnalyzeResponse(
        recommendation=recommendation,
        signal_level=signal_level,
        signal_score=signal_score,
        reasons=_top_reasons(signals, notes),
        **signals.model_dump(),
    )


def _top_reasons(signals: Signals, notes: dict[str, str]) -> list[str]:
    ranked = sorted(
        (_reason_candidate(dim, getattr(signals, dim), notes) for dim in DIMENSION_WEIGHTS),
        key=lambda candidate: candidate[1],
        reverse=True,
    )

    reasons: list[str] = []
    for text, _decisiveness in ranked:
        if text not in reasons:
            reasons.append(text)
        if len(reasons) == 3:
            break
    return reasons


def _reason_candidate(dim: str, score: int, notes: dict[str, str]) -> tuple[str, float]:
    weight = DIMENSION_WEIGHTS[dim]
    is_good = score >= NEUTRAL if dim in GOOD_WHEN_HIGH else score < NEUTRAL

    if dim in GOOD_WHEN_HIGH:
        # Positive dimensions are interesting whichever way they lean: a
        # high score is worth praising, a low one is worth flagging.
        decisiveness = weight * abs(score - NEUTRAL)
    else:
        # Penalty dimensions are only worth calling out when they are bad.
        # A low bait/promotional/AI-style score is the absence of a
        # problem, not an interesting reason to READ, so it must never
        # crowd out the positive dimensions that actually earned a READ.
        decisiveness = weight * max(0, score - NEUTRAL)

    fallback = POSITIVE_FALLBACK[dim] if is_good else NEGATIVE_FALLBACK[dim]
    return notes.get(dim, fallback), decisiveness
