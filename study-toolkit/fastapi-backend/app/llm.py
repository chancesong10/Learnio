import json
from functools import lru_cache

from google import genai
from google.genai import types

from .config import GEMINI_MODEL, require_env


class LLMResponseError(RuntimeError):
    """Gemini blocked the request or returned no usable answer."""


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    return genai.Client(
        api_key=require_env("GEMINI_API_KEY"),
        # The free tier has low per-minute limits, so back off and retry on 429s
        http_options=types.HttpOptions(
            retry_options=types.HttpRetryOptions(attempts=5, initial_delay=5, max_delay=60)
        ),
    )


def pdf_part(pdf_bytes: bytes) -> types.Part:
    """Pass a whole PDF to Gemini (text, scans and figures)."""
    return types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")


async def generate_json(contents: list, schema: dict) -> dict:
    """Ask Gemini for a response that matches a JSON schema and return it parsed.

    contents is a list of prompt strings and Parts (e.g. from pdf_part).
    """
    response = await get_gemini_client().aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=schema,
        ),
    )

    if not response.text:
        reason = response.candidates[0].finish_reason if response.candidates else response.prompt_feedback
        raise LLMResponseError(f"Gemini returned no answer ({reason})")
    return json.loads(response.text)
