"""Shared test fixtures: the Post A / Post B worked examples from spec section 14.

Post A is a concrete, specific migration story -> should score HIGH/READ.
Post B is topically relevant but generic -> should score LOW/SKIP, despite
being just as relevant as Post A. That contrast is the product's core
thesis and is reused across the JEV, endpoint, cache, and cross-stack
smoke tests.
"""

from app.llm import SignalExtraction
from app.models import Profile, Signals

POST_A_TEXT = (
    "We migrated 12 .NET Framework services to .NET 8.\n\n"
    "The biggest problem wasn't the code migration. It was a hidden "
    "dependency in an old authentication library.\n\n"
    "Here's how we discovered it..."
)

POST_B_TEXT = (
    "AI is changing everything.\n\n"
    "Here are 5 things every developer needs to know in 2026..."
)

PROFILE = Profile(
    role="Technical Lead",
    interests=[".NET", "AWS", "React", "AI", "Architecture"],
)

# Signal values consistent with the qualitative HIGH/MEDIUM/LOW labels the
# spec gives for these two posts (section 14 only gives labels, not raw
# numbers).
POST_A_SIGNALS = Signals(
    relevance=92,
    specificity=90,
    originality=85,
    practical_value=92,
    personal_experience=88,
    engagement_bait=8,
    promotional=5,
    ai_style=10,
)

POST_B_SIGNALS = Signals(
    relevance=90,
    specificity=20,
    originality=20,
    practical_value=20,
    personal_experience=15,
    engagement_bait=55,
    promotional=15,
    ai_style=70,
)

POST_A_NOTES = {
    "specificity": "Names a hidden auth-library dependency found during migration",
    "personal_experience": "First-hand account of migrating 12 services to .NET 8",
}

POST_B_NOTES = {
    "specificity": "No concrete example or metric given",
    "originality": "Generic listicle framing common across LinkedIn",
}

POST_A_EXTRACTION = SignalExtraction(signals=POST_A_SIGNALS, notes=POST_A_NOTES)
POST_B_EXTRACTION = SignalExtraction(signals=POST_B_SIGNALS, notes=POST_B_NOTES)
