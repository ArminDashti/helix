"""Chat completion client for the configured LLM provider."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

import socket

from .config_loader import (
    DEFAULT_LLM_MODEL,
    get_agent_model,
    get_llm_base_url,
    get_llm_timeout_seconds,
    get_openrouter_settings,
    get_openrouter_token,
    get_provider,
)

_OPENROUTER_AUTO_MODEL = DEFAULT_LLM_MODEL
_OPENAI_COMPAT_AUTO_MODEL = DEFAULT_LLM_MODEL


def require_llm() -> tuple[str, str, str]:
    """Return (provider, token, base_url) or raise if the selected LLM cannot be used."""
    provider = get_provider()
    token = get_openrouter_token()
    if not token:
        raise ValueError("API key is not set")
    base_url = get_llm_base_url()
    if not base_url:
        raise ValueError("Base URL is not set")
    return provider, token, base_url


def complete_chat(agent_id: str, user_message: str, system_prompt: str) -> str:
    provider, token, base_url = require_llm()
    message = _chat_completions_request(
        agent_id=agent_id,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        token=token,
        base_url=base_url,
        provider=provider,
    )
    text = message.get("content") if isinstance(message, dict) else ""
    if isinstance(text, list):
        text = json.dumps(text)
    text = text if isinstance(text, str) else ("" if text is None else str(text))
    if not text.strip() and not message.get("tool_calls"):
        raise ValueError("LLM returned an empty message")
    return text


def complete_chat_messages(
    agent_id: str,
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Multi-turn OpenAI-compatible chat; returns the assistant message dict.

    Message may include ``content`` and/or ``tool_calls`` (Cursor-style tool loop).
    """
    provider, token, base_url = require_llm()
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty list")
    return _chat_completions_request(
        agent_id=agent_id,
        messages=messages,
        token=token,
        base_url=base_url,
        provider=provider,
        tools=tools,
    )


def complete_test_chat(
    user_message: str,
    *,
    model: str | None = None,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    """Direct chat completion for Settings tester — returns reply + meta.

    Uses the currently configured provider/token/base_url but allows an
    explicit model override. Raises ValueError on misconfiguration or LLM error.
    """
    import time as _time

    provider, token, base_url = require_llm()
    settings = get_openrouter_settings()
    chosen_model = (model or "").strip()
    if not chosen_model or chosen_model.lower() == "auto":
        if provider == "openrouter":
            chosen_model = _OPENROUTER_AUTO_MODEL
        else:
            default = str(settings.get("default_model") or "").strip()
            chosen_model = (
                default
                if default and default != "auto"
                else _OPENAI_COMPAT_AUTO_MODEL
            )
    sys_prompt = system_prompt if system_prompt is not None else "You are a helpful assistant."
    started = _time.time()
    # Reuse low-level path but with explicit model via agent_id hack:
    # call helper with a synthetic agent_id and then override model in body.
    # Simpler: build request directly with chosen_model.
    url = f"{base_url}/chat/completions"
    request_body: dict[str, Any] = {
        "model": chosen_model,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.2,
    }
    workspace = str(settings.get("workspace") or "").strip()
    if workspace:
        request_body["workspace"] = workspace
        mode = str(settings.get("mode") or "").strip() or "ask"
        request_body["mode"] = mode
    body = json.dumps(request_body).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if provider == "openrouter":
        app_name = str(settings.get("app_name") or "Helix")
        headers["HTTP-Referer"] = "https://helix.local"
        headers["X-Title"] = app_name
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    timeout_s = get_llm_timeout_seconds()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise ValueError(f"LLM request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"LLM request failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc
    except socket.timeout as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc
    elapsed = round(_time.time() - started, 3)
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        raise ValueError("LLM returned no choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    content = (message or {}).get("content") if isinstance(message, dict) else ""
    text = content if isinstance(content, str) else json.dumps(content)
    if not str(text).strip():
        raise ValueError("LLM returned an empty message")
    usage = payload.get("usage") if isinstance(payload, dict) else None
    return {
        "reply": str(text),
        "model": chosen_model,
        "provider": provider,
        "base_url": base_url,
        "elapsed_s": elapsed,
        "usage": usage if isinstance(usage, dict) else None,
        "raw": payload,
    }


def _resolve_model(agent_id: str, provider: str, settings: dict[str, Any]) -> str:
    model = get_agent_model(agent_id)
    if not model or model == "auto":
        if provider == "openrouter":
            return _OPENROUTER_AUTO_MODEL
        default = str(settings.get("default_model") or "").strip()
        return (
            default
            if default and default != "auto"
            else _OPENAI_COMPAT_AUTO_MODEL
        )
    return model


def _chat_completions_request(
    *,
    agent_id: str,
    messages: list[dict[str, Any]],
    token: str,
    base_url: str,
    provider: str,
    tools: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    url = f"{base_url}/chat/completions"
    settings = get_openrouter_settings()
    model = _resolve_model(agent_id, provider, settings)

    request_body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }
    if tools:
        request_body["tools"] = tools
        request_body["tool_choice"] = "auto"
    # Cursor OpenAI-compatible proxies (e.g. cursor-headless-cli-to-api) require
    # workspace on POST /v1/chat/completions. Real OpenAI/OpenRouter ignore extras.
    workspace = str(settings.get("workspace") or "").strip()
    if workspace:
        request_body["workspace"] = workspace
        mode = str(settings.get("mode") or "").strip() or "ask"
        request_body["mode"] = mode
    body = json.dumps(request_body).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if provider == "openrouter":
        app_name = str(settings.get("app_name") or "Helix")
        headers["HTTP-Referer"] = "https://helix.local"
        headers["X-Title"] = app_name
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers=headers,
    )
    timeout_s = get_llm_timeout_seconds()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        raise ValueError(f"LLM request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"LLM request failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc
    except socket.timeout as exc:
        raise ValueError(
            f"LLM request timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc

    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        raise ValueError("LLM returned no choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else {}
    if not isinstance(message, dict):
        raise ValueError("LLM returned an empty message")
    content = message.get("content")
    tool_calls = message.get("tool_calls")
    has_tools = isinstance(tool_calls, list) and bool(tool_calls)
    text = content if isinstance(content, str) else (
        "" if content is None else json.dumps(content)
    )
    if not str(text).strip() and not has_tools:
        raise ValueError("LLM returned an empty message")
    return message


def parse_json_object(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return {"text": text}
    try:
        data = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return {"text": text}
    return data if isinstance(data, dict) else {"text": text}
