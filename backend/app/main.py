from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.cache import AnalysisCache, PostStore, hash_key
from app.jev import LEVEL_FOR_RECOMMENDATION, clamp_score_to_level, score_post
from app.llm import JevDecisionsClient, LLMClient
from app.models import AnalyzeRequest, AnalyzeResponse

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="LinkedIn Signal API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Restrict to the Chrome extension origin and localhost for local debugging.
# Replace <YOUR_EXTENSION_ID> with the production extension's ID once published.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://<YOUR_EXTENSION_ID>",
        "http://localhost:3000",
    ],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── State ──────────────────────────────────────────────────────────────────────
analysis_cache = AnalysisCache()
post_store = PostStore()

_default_llm_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """FastAPI dependency, overridden in tests with a FakeLLMClient."""
    global _default_llm_client
    if _default_llm_client is None:
        _default_llm_client = JevDecisionsClient()
    return _default_llm_client


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("20/minute")
def analyze(
    request: Request,
    body: AnalyzeRequest,
    llm_client: LLMClient = Depends(get_llm_client),
) -> AnalyzeResponse:
    key = hash_key(body.postText, body.profile)

    result = analysis_cache.get(key)
    if result is None:
        extraction = llm_client.extract(body.postText, body.profile)
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
    if body.save_post:
        post_store.save(key, body.postText)

    return result
