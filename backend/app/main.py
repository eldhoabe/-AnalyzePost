from fastapi import Depends, FastAPI

from app.cache import AnalysisCache, PostStore, hash_key
from app.jev import LEVEL_FOR_RECOMMENDATION, clamp_score_to_level, score_post
from app.llm import JevDecisionsClient, LLMClient
from app.models import AnalyzeRequest, AnalyzeResponse

app = FastAPI(title="LinkedIn Signal API")

analysis_cache = AnalysisCache()
post_store = PostStore()

_default_llm_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """FastAPI dependency, overridden in tests with a FakeLLMClient."""
    global _default_llm_client
    if _default_llm_client is None:
        _default_llm_client = JevDecisionsClient()
    return _default_llm_client


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    request: AnalyzeRequest,
    llm_client: LLMClient = Depends(get_llm_client),
) -> AnalyzeResponse:
    key = hash_key(request.postText, request.profile)

    result = analysis_cache.get(key)
    if result is None:
        extraction = llm_client.extract(request.postText, request.profile)
        result = score_post(extraction.signals, extraction.notes)
        # JevDecisionsClient decides the recommendation itself (it's asked
        # directly, not just for the 8 signals) -- when it does, that
        # verdict wins over score_post()'s own threshold math. Reasons still
        # come from score_post(), since Jev returns typed answers, not
        # prose. signal_score also starts from score_post(), but gets
        # clamped into the band the overridden level implies so the two
        # numbers in the response never visibly disagree (e.g. score=0 next
        # to level="MAYBE"). Other clients (FakeLLMClient, HttpJsonLLMClient)
        # leave recommendation unset, so score_post()'s decision stands as-is.
        if extraction.recommendation is not None:
            result.recommendation = extraction.recommendation
            result.signal_level = LEVEL_FOR_RECOMMENDATION[extraction.recommendation]
            result.signal_score = clamp_score_to_level(result.signal_score, result.signal_level)
        analysis_cache.set(key, result)

    # Privacy default (spec section 12): raw post text is discarded unless
    # the caller explicitly opts in. The cache above never sees it either
    # way -- it only ever holds the hash key and the derived scores.
    if request.save_post:
        post_store.save(key, request.postText)

    return result
