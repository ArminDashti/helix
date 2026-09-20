"""Chat completion client for the configured LLM provider."""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .config_loader import (
    DEFAULT_LLM_MODEL,
    PROVIDER_CURSOR_HEADLESS_CLI,
    get_agent_model,
    get_llm_base_url,
    get_llm_timeout_seconds,
    get_openrouter_settings,
    get_openrouter_token,
    get_provider,
)

_OPENROUTER_AUTO_MODEL = DEFAULT_LLM_MODEL
_OPENAI_COMPAT_AUTO_MODEL = DEFAULT_LLM_MODEL
_CURSOR_MODEL_LINE_RE = re.compile(r"^([^\s-]+(?:-[^\s-]+)*)\s+-\s+(.+)$")
_HOST_DRIVE_RE = re.compile(r"^[A-Za-z]:[\\/]")


def is_usable_workspace(workspace: str) -> bool:
    """True if path exists here, or looks like a host absolute path (Docker API case)."""
    if Path(workspace).is_dir():
        return True
    # Helix API in Linux container cannot Stat Windows host folders; Settings store host paths.
    if _HOST_DRIVE_RE.match(workspace) or workspace.startswith(("\\\\", "//")):
        return True
    return Path(workspace).is_absolute()


def map_host_workspace(workspace: str) -> str:
    """Rewrite host-root path to container mount when configured (Docker).

    Settings keep host paths (e.g. C:/Users/armin/proj). At run time, with
    HOST_WORKSPACE_ROOT=C:/Users and HOST_WORKSPACE_MOUNT=/host, that becomes
    /host/armin/proj. If the original path already exists here, leave it.
    """
    root = (os.environ.get("HOST_WORKSPACE_ROOT") or "").strip()
    mount = (os.environ.get("HOST_WORKSPACE_MOUNT") or "").strip()
    if not root or not mount or not workspace:
        return workspace
    root_n = root.replace("\\", "/").rstrip("/").lower()
    path_n = workspace.replace("\\", "/")
    path_lower = path_n.lower()
    if path_lower == root_n:
        mapped = mount
    elif path_lower.startswith(root_n + "/"):
        mapped = mount.rstrip("/") + path_n[len(root_n) :]
    else:
        return workspace
    if Path(workspace).is_dir():
        return workspace
    return mapped


def _cursor_cli_env() -> dict[str, str]:
    """Env for cursor-agent subprocess (prefer IDE auth.json over CURSOR_API_KEY)."""
    env = os.environ.copy()
    token = (os.environ.get("CURSOR_AUTH_TOKEN") or "").strip()
    if not token:
        auth_file = (os.environ.get("CURSOR_AUTH_FILE") or "").strip()
        if auth_file:
            try:
                data = json.loads(Path(auth_file).read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError, TypeError, ValueError):
                data = None
            if isinstance(data, dict):
                token = str(data.get("accessToken") or "").strip()
    if token:
        env["CURSOR_AUTH_TOKEN"] = token
    return env


def _find_cursor_agent_argv() -> list[str]:
    """Resolve Cursor headless CLI argv (prefer LocalAppData install over PATH)."""
    env = (os.environ.get("CURSOR_AGENT_BIN") or os.environ.get("HELIX_CURSOR_AGENT") or "").strip()
    if env:
        return [env]

    local_app = os.environ.get("LOCALAPPDATA") or ""
    versions = Path(local_app) / "cursor-agent" / "versions"
    if versions.is_dir():
        for folder in sorted(
            (p for p in versions.iterdir() if p.is_dir()),
            key=lambda p: p.name,
            reverse=True,
        ):
            node = folder / "node.exe"
            index = folder / "index.js"
            if node.is_file() and index.is_file():
                return [str(node), str(index)]
            for name in ("cursor-agent.cmd", "agent.cmd"):
                candidate = folder / name
                if candidate.is_file():
                    return [str(candidate)]

    wrapper = Path(local_app) / "cursor-agent" / "agent.cmd"
    if wrapper.is_file():
        return [str(wrapper)]

    home_bin = Path.home() / ".local" / "bin" / "agent"
    if home_bin.is_file():
        return [str(home_bin)]

    cursor_agent = shutil.which("cursor-agent")
    if cursor_agent:
        return [cursor_agent]

    agent = shutil.which("agent")
    if agent and "grok" not in agent.lower():
        return [agent]
    return []


def list_cursor_cli_models() -> list[dict[str, str]]:
    """Parse `agent models` into [{id, name}, ...]."""
    argv = _find_cursor_agent_argv()
    if not argv:
        raise ValueError(
            "Cursor agent CLI not found — install Cursor CLI or set CURSOR_AGENT_BIN"
        )
    try:
        completed = subprocess.run(
            [*argv, "models"],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
            env=_cursor_cli_env(),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError(f"Cursor agent models failed: {exc}") from exc
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()[:300]
        raise ValueError(f"Cursor agent models failed: {detail or completed.returncode}")
    models: list[dict[str, str]] = []
    for line in (completed.stdout or "").splitlines():
        text = line.strip()
        if not text or text.lower().startswith(("available", "tip:")):
            continue
        match = _CURSOR_MODEL_LINE_RE.match(text)
        if not match:
            continue
        model_id, name = match.group(1), match.group(2).strip()
        models.append({"id": model_id, "name": name})
    if not models:
        raise ValueError("Cursor agent returned no models")
    return models


def require_llm() -> tuple[str, str, str]:
    """Return (provider, token, base_url) or raise if the selected LLM cannot be used."""
    provider = get_provider()
    if provider == PROVIDER_CURSOR_HEADLESS_CLI:
        settings = get_openrouter_settings()
        workspace = str(settings.get("workspace") or "").strip()
        if not workspace:
            raise ValueError("Workspace path is not set")
        if not is_usable_workspace(workspace):
            raise ValueError(
                f"Workspace must be an absolute host machine folder: {workspace}"
            )
        if not _find_cursor_agent_argv():
            raise ValueError(
                "Cursor agent CLI not found — install Cursor CLI or set CURSOR_AGENT_BIN"
            )
        return provider, "", ""
    token = get_openrouter_token()
    if not token:
        raise ValueError("API key is not set")
    base_url = get_llm_base_url()
    if not base_url:
        raise ValueError("Base URL is not set")
    return provider, token, base_url


def complete_chat(agent_id: str, user_message: str, system_prompt: str) -> str:
    provider, token, base_url = require_llm()
    if provider == PROVIDER_CURSOR_HEADLESS_CLI:
        message = _cursor_cli_message(
            agent_id=agent_id,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
    else:
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
    if provider == PROVIDER_CURSOR_HEADLESS_CLI:
        return _cursor_cli_message(agent_id=agent_id, messages=messages, tools=tools)
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
    if provider == PROVIDER_CURSOR_HEADLESS_CLI:
        message = _cursor_cli_message(
            agent_id="orchester",
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_message},
            ],
            model_override=chosen_model,
        )
        text = str(message.get("content") or "")
        if not text.strip():
            raise ValueError("LLM returned an empty message")
        return {
            "reply": text,
            "model": chosen_model,
            "provider": provider,
            "base_url": "",
            "elapsed_s": round(_time.time() - started, 3),
            "usage": None,
            "raw": message,
        }

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
        # Headless / proxy must stay Agent (ask/plan are non-executing).
        mode = str(settings.get("mode") or "").strip() or "agent"
        if mode in ("ask", "plan"):
            mode = "agent"
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


def _flatten_messages(messages: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role") or "user").upper()
        content = msg.get("content")
        if isinstance(content, list):
            content = json.dumps(content)
        text = "" if content is None else str(content)
        if msg.get("tool_calls"):
            text = (text + "\n" if text else "") + json.dumps(
                {"tool_calls": msg.get("tool_calls")}, ensure_ascii=False
            )
        if role == "TOOL":
            tool_call_id = msg.get("tool_call_id") or ""
            parts.append(f"TOOL_RESULT({tool_call_id}):\n{text}")
        else:
            parts.append(f"{role}:\n{text}")
    return "\n\n".join(parts).strip()


def _parse_cli_assistant_message(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        raise ValueError("LLM returned an empty message")
    # Prefer fenced or bare JSON that looks like an OpenAI assistant message / tool_calls.
    candidate = text
    if candidate.startswith("```"):
        candidate = candidate.strip("`")
        if candidate.lower().startswith("json"):
            candidate = candidate[4:]
        candidate = candidate.strip()
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start >= 0 and end > start:
        try:
            data = json.loads(candidate[start : end + 1])
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict):
            if isinstance(data.get("tool_calls"), list) and data["tool_calls"]:
                return {
                    "role": "assistant",
                    "content": data.get("content") if data.get("content") is not None else None,
                    "tool_calls": data["tool_calls"],
                }
            if isinstance(data.get("message"), dict):
                msg = data["message"]
                if isinstance(msg.get("tool_calls"), list) and msg["tool_calls"]:
                    return msg
            # Bare Helix submit_result JSON — leave as content for pipeline fallback.
            if data.get("text_report") or data.get("content"):
                content = data.get("content")
                if content is None and data.get("text_report"):
                    content = json.dumps(data, ensure_ascii=False)
                if content is not None:
                    return {"role": "assistant", "content": str(content)}
    return {"role": "assistant", "content": text}


def _cursor_cli_message(
    *,
    agent_id: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    model_override: str | None = None,
) -> dict[str, Any]:
    settings = get_openrouter_settings()
    workspace = str(settings.get("workspace") or "").strip()
    if not workspace:
        raise ValueError("Workspace path is not set")
    fs_workspace = map_host_workspace(workspace)
    if not Path(fs_workspace).is_dir():
        raise ValueError(
            f"Workspace is not reachable in this process: {workspace}"
            + (f" (mapped {fs_workspace})" if fs_workspace != workspace else "")
            + " — mount HOST_WORKSPACE_ROOT or set a host folder under that root"
        )
    argv = _find_cursor_agent_argv()
    if not argv:
        raise ValueError(
            "Cursor agent CLI not found — install Cursor CLI or set CURSOR_AGENT_BIN"
        )
    model = (model_override or "").strip() or _resolve_model(
        agent_id, PROVIDER_CURSOR_HEADLESS_CLI, settings
    )
    prompt = _flatten_messages(messages)
    if tools:
        prompt += (
            "\n\nAVAILABLE_TOOLS_JSON:\n"
            + json.dumps(tools, ensure_ascii=False)
            + "\n\nWhen you need a Helix tool, reply with ONLY JSON shaped like:\n"
            '{"tool_calls":[{"id":"call_1","type":"function","function":{"name":"NAME","arguments":"{}"}}]}\n'
            "Otherwise reply with the final answer text (or a submit_result JSON object)."
        )
    # Agent mode only: omit --mode (CLI default). Never pass ask/plan.
    cmd = [
        *argv,
        "-p",
        "--trust",
        "--workspace",
        fs_workspace,
        "--output-format",
        "text",
    ]
    if model and model != "auto":
        cmd.extend(["--model", model])
    cmd.append(prompt)
    timeout_s = get_llm_timeout_seconds()
    try:
        completed = subprocess.run(
            cmd,
            cwd=fs_workspace,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
            env=_cursor_cli_env(),
        )
    except subprocess.TimeoutExpired as exc:
        raise ValueError(
            f"Cursor agent timed out after {timeout_s}s — increase openrouter.timeout_seconds in helix.config.yaml"
        ) from exc
    except OSError as exc:
        raise ValueError(f"Cursor agent failed to start: {exc}") from exc
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()[:500]
        raise ValueError(f"Cursor agent failed ({completed.returncode}): {detail}")
    return _parse_cli_assistant_message(completed.stdout or "")


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
        # Headless / proxy must stay Agent (ask/plan are non-executing).
        mode = str(settings.get("mode") or "").strip() or "agent"
        if mode in ("ask", "plan"):
            mode = "agent"
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
