from fastapi import Depends, FastAPI

from app.jev import score_post
from app.llm import HttpJsonLLMClient, LLMClient
from app.models import AnalyzeRequest, AnalyzeResponse

app = FastAPI(title="LinkedIn Signal API")

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
    extraction = llm_client.extract(request.postText, request.profile)
    return score_post(extraction.signals, extraction.notes)
