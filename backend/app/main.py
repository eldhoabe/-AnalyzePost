from fastapi import Depends, FastAPI

from app.cache import AnalysisCache, PostStore, hash_key
from app.jev import score_post
from app.llm import HttpJsonLLMClient, LLMClient
from app.models import AnalyzeRequest, AnalyzeResponse

app = FastAPI(title="LinkedIn Signal API")

analysis_cache = AnalysisCache()
post_store = PostStore()

_default_llm_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """FastAPI dependency, overridden in tests with a FakeLLMClient."""
    global _default_llm_client
    if _default_llm_client is None:
        _default_llm_client = HttpJsonLLMClient()
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
        analysis_cache.set(key, result)

    # Privacy default (spec section 12): raw post text is discarded unless
    # the caller explicitly opts in. The cache above never sees it either
    # way -- it only ever holds the hash key and the derived scores.
    if request.save_post:
        post_store.save(key, request.postText)

    return result
