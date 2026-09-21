from enum import Enum

from pydantic import BaseModel, Field


class Recommendation(str, Enum):
    READ = "READ"
    MAYBE = "MAYBE"
    SKIP = "SKIP"


class SignalLevel(str, Enum):
    HIGH = "HIGH"
    MAYBE = "MAYBE"
    LOW = "LOW"


class Profile(BaseModel):
    role: str
    interests: list[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    postText: str
    profile: Profile
    save_post: bool = False


Score = Field(ge=0, le=100)


class Signals(BaseModel):
    """The 8 structured dimensions scored per post (spec section 6)."""

    relevance: int = Score
    specificity: int = Score
    originality: int = Score
    practical_value: int = Score
    personal_experience: int = Score
    engagement_bait: int = Score
    promotional: int = Score
    ai_style: int = Score


class AnalyzeResponse(Signals):
    recommendation: Recommendation
    signal_level: SignalLevel
    signal_score: int = Field(ge=0, le=100)
    reasons: list[str] = Field(min_length=1, max_length=3)
