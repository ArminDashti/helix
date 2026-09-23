"""Token accounting for LLM calls and for stored knowledge (RAG) documents.

Providers report ``usage`` on chat completions, so a run's real token cost is normally available
straight from the response. Connectors that do not report it (the Cursor headless CLI) fall back
to an estimate, so every run still publishes a comparable number.

The estimator is deliberately dependency-free: no tokenizer package is installed in the image and
a per-provider BPE download at request time is not acceptable. GPT-style BPE averages ~4 ASCII
characters per token; Persian (and other non-Latin) text tokenizes far less efficiently at ~2
characters per token. The estimate is labelled ``estimated`` so the UI can say so.
"""

from __future__ import annotations

import json
from typing import Any

_ASCII_CHARS_PER_TOKEN = 4
_NON_ASCII_CHARS_PER_TOKEN = 2


def estimate_tokens(text: Any) -> int:
    """Estimate BPE tokens for one string. Returns 0 for empty input."""
    if text is None:
        return 0
    raw = text if isinstance(text, str) else str(text)
    if not raw:
        return 0
    units = 0.0
    for char in raw:
        if char.isspace():
            # Whitespace usually merges into a neighbouring token rather than costing one.
            units += 0.25
        elif ord(char) < 128:
            units += 1.0 / _ASCII_CHARS_PER_TOKEN
        else:
            units += 1.0 / _NON_ASCII_CHARS_PER_TOKEN
    return max(1, int(units + 0.999))


def _int(value: Any) -> int:
    if isinstance(value, bool) or value is None:
        return 0
    if isinstance(value, (int, float)):
        return max(0, int(value))
    try:
        return max(0, int(float(str(value).strip())))
    except (TypeError, ValueError):
        return 0


def empty_usage() -> dict[str, Any]:
    return {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "calls": 0,
        "estimated": False,
    }


def _message_text(message: Any) -> str:
    if not isinstance(message, dict):
        return "" if message is None else str(message)
    content = message.get("content")
    if isinstance(content, list):
        text = json.dumps(content, ensure_ascii=False, default=str)
    elif content is None:
        text = ""
    else:
        text = str(content)
    if message.get("tool_calls"):
        text = (text + "\n" if text else "") + json.dumps(
            {"tool_calls": message["tool_calls"]}, ensure_ascii=False, default=str
        )
    return text


def _from_provider(usage: Any) -> dict[str, int] | None:
    """Normalise a provider ``usage`` block; None when it carries nothing usable."""
    if not isinstance(usage, dict):
        return None
    prompt = _int(usage.get("prompt_tokens"))
    completion = _int(usage.get("completion_tokens"))
    total = _int(usage.get("total_tokens")) or prompt + completion
    if not (prompt or completion or total):
        return None
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": total or prompt + completion,
    }


def _add(bucket: dict[str, Any], reported: dict[str, int], *, estimated: bool) -> None:
    bucket["prompt_tokens"] = _int(bucket.get("prompt_tokens")) + reported["prompt_tokens"]
    bucket["completion_tokens"] = (
        _int(bucket.get("completion_tokens")) + reported["completion_tokens"]
    )
    bucket["total_tokens"] = _int(bucket.get("total_tokens")) + reported["total_tokens"]
    bucket["calls"] = _int(bucket.get("calls")) + 1
    if estimated:
        bucket["estimated"] = True


def record_call(
    ctx: dict[str, Any],
    agent_id: str,
    *,
    messages: list[dict[str, Any]] | None = None,
    reply: Any = "",
    usage: Any = None,
) -> dict[str, Any]:
    """Fold one LLM call into the run's running total (``ctx['token_usage']``).

    Falls back to an estimate from the prompt messages plus the reply when the connector reports
    no usage block.
    """
    bucket = ctx.setdefault("token_usage", empty_usage())
    if not isinstance(bucket, dict):  # pragma: no cover - defensive against a corrupted ctx
        bucket = empty_usage()
        ctx["token_usage"] = bucket
    by_agent = bucket.setdefault("by_agent", {})
    if not isinstance(by_agent, dict):  # pragma: no cover
        by_agent = {}
        bucket["by_agent"] = by_agent
    agent = str(agent_id or "unknown")
    agent_bucket = by_agent.setdefault(agent, empty_usage())

    reported = _from_provider(usage)
    estimated = reported is None
    if reported is None:
        prompt_tokens = sum(estimate_tokens(_message_text(m)) for m in messages or [])
        completion_tokens = estimate_tokens(reply)
        reported = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }
    _add(bucket, reported, estimated=estimated)
    _add(agent_bucket, reported, estimated=estimated)
    return bucket


def snapshot(ctx: dict[str, Any] | None) -> dict[str, Any]:
    """A JSON-safe copy of the run's token totals, safe to publish on every SSE event."""
    out = empty_usage()
    bucket = (ctx or {}).get("token_usage")
    if not isinstance(bucket, dict):
        return out
    out["prompt_tokens"] = _int(bucket.get("prompt_tokens"))
    out["completion_tokens"] = _int(bucket.get("completion_tokens"))
    out["total_tokens"] = _int(bucket.get("total_tokens")) or (
        out["prompt_tokens"] + out["completion_tokens"]
    )
    out["calls"] = _int(bucket.get("calls"))
    out["estimated"] = bool(bucket.get("estimated"))
    by_agent = bucket.get("by_agent")
    if isinstance(by_agent, dict) and by_agent:
        out["by_agent"] = {
            str(agent): {
                "prompt_tokens": _int(values.get("prompt_tokens")),
                "completion_tokens": _int(values.get("completion_tokens")),
                "total_tokens": _int(values.get("total_tokens")),
                "calls": _int(values.get("calls")),
            }
            for agent, values in by_agent.items()
            if isinstance(values, dict)
        }
    return out
