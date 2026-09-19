"""Single-agent Orchester tool loop — Cursor-style until submit_result."""

from __future__ import annotations

import json
import time as _agent_time
import uuid
from typing import Any, Iterator

from . import logs_store
from . import markdown_store as store
from .chart_payload import build_echarts_option, build_grid
from .config_loader import get_provider
from .demo import VALID_CHART_TYPES, _normalize_report_type
from .jalali_dates import calendar_hint_for_prompt
from .llm_client import complete_chat_messages, require_llm
from .pipeline_graph import (
    agent_display_name,
    get_pipeline_graph_for_mode,
)
from .sql_execute import _sql_error_message, execute_select
from .user_intent import resolve_user_intent
from .web_search import search_web

DATA_GATHERER_MAX_ROWS = 500
MAX_STEP_LOG_ENTRIES = 30
FAILURE_STEP_SNAPSHOT = 20
MAX_TOOL_TURNS = 16

ORCHESTER_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "execute_select",
            "description": (
                "Run one cheap SELECT (or CTE+SELECT) against the allowlisted warehouse. "
                "Always include TOP/FETCH. Prefer catalog.schema.table names from the prompt."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "Single SELECT (or WITH … SELECT) statement",
                    },
                },
                "required": ["sql"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": (
                "Search the public web for facts outside the warehouse "
                "(benchmarks, news, industry rates). Pass 1–3 short queries."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "queries": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "1–3 search queries",
                    },
                    "objective": {
                        "type": "string",
                        "description": "Why these queries matter for the user prompt",
                    },
                },
                "required": ["queries"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_result",
            "description": (
                "Finish the run. Provide text_report from executed SQL preview numbers "
                "(do not invent figures). Server packages grid and chart from sql_fetch."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text_report": {
                        "type": "string",
                        "description": "User-facing report text",
                    },
                    "chart_type": {
                        "type": "string",
                        "description": "Optional chart type hint (bar, line, pie, …)",
                    },
                    "message": {
                        "type": "string",
                        "description": "Short status message for the UI",
                    },
                },
                "required": ["text_report"],
            },
        },
    },
]


def _append_step_log(
    ctx: dict[str, Any],
    *,
    agent_id: str,
    node_id: str = "",
    status: str,
    message: str,
) -> None:
    log = ctx.setdefault("step_log", [])
    log.append(
        {
            "agent_id": agent_id or "",
            "node_id": node_id or "",
            "status": status or "",
            "message": message or "",
            "at": _agent_time.time(),
        }
    )
    if len(log) > MAX_STEP_LOG_ENTRIES:
        ctx["step_log"] = log[-MAX_STEP_LOG_ENTRIES:]


def _step_event(
    ctx: dict[str, Any],
    *,
    agent_id: str,
    node_id: str = "",
    status: str,
    message: str,
    result: str | None = None,
) -> dict[str, Any]:
    _append_step_log(
        ctx,
        agent_id=agent_id,
        node_id=node_id,
        status=status,
        message=message,
    )
    started = ctx.get("pipeline_started")
    elapsed = None
    if isinstance(started, (int, float)):
        elapsed = round(_agent_time.time() - started, 2)
    payload: dict[str, Any] = {
        "event": "step",
        "agent_id": agent_id,
        "status": status,
        "message": message,
        "at": _agent_time.time(),
    }
    if elapsed is not None:
        payload["elapsed_s"] = elapsed
    if node_id:
        payload["node_id"] = node_id
    if result is not None:
        payload["result"] = result
    run_id = ctx.get("run_id")
    if run_id:
        payload["run_id"] = run_id
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
    if fetch and fetch.get("sql"):
        payload["sql"] = str(fetch.get("sql"))[:2000]
        payload["row_count"] = len(fetch.get("rows") or [])
    return payload


def _failure_duration_s(ctx: dict[str, Any]) -> float | None:
    started = ctx.get("pipeline_started")
    if not isinstance(started, (int, float)):
        return None
    return round(_agent_time.time() - started, 2)


def _failure_detail(message: str, ctx: dict[str, Any]) -> str:
    last_error = str(ctx.get("last_error") or "").strip()
    trimmed = (message or "").strip()
    if last_error and last_error != trimmed:
        return last_error
    return ""


def _failure_steps(ctx: dict[str, Any]) -> list[dict[str, str]]:
    step_log = ctx.get("step_log")
    if not isinstance(step_log, list):
        return []
    return step_log[-FAILURE_STEP_SNAPSHOT:]


def _ui_text(language: str, en: str, fa: str) -> str:
    return fa if language == "fa" else en


def _prompt_looks_persian(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06ff" for ch in (text or ""))


def _result_language(ctx: dict[str, Any]) -> str:
    if (ctx.get("language") or "en") == "fa":
        return "fa"
    if _prompt_looks_persian(str(ctx.get("prompt") or "")):
        return "fa"
    return "en"


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _sql_from_ctx(ctx: dict[str, Any]) -> str:
    fetch = ctx.get("sql_fetch")
    if isinstance(fetch, dict):
        return str(fetch.get("sql") or "")
    return ""


def _persist_failure(
    message: str,
    *,
    ctx: dict[str, Any],
    agent_id: str | None = None,
    kind: str | None = None,
    path: str = "",
    status_code: int | None = None,
) -> dict[str, Any]:
    return logs_store.append_error(
        kind=kind or logs_store.classify_error_kind(message),
        message=message,
        prompt=str(ctx.get("prompt") or ""),
        mode=str(ctx.get("mode") or ""),
        language=str(ctx.get("language") or "en"),
        agent_id=agent_id or "",
        node_id=agent_id or "",
        sql=_sql_from_ctx(ctx),
        path=path,
        status_code=status_code,
        run_id=str(ctx.get("run_id") or ""),
        detail=_failure_detail(message, ctx),
        duration_s=_failure_duration_s(ctx),
        steps=_failure_steps(ctx),
        report_type=str(ctx.get("report_type") or ""),
        chart_type=str(ctx.get("chart_type") or ""),
    )


def _error_event(
    message: str,
    *,
    ctx: dict[str, Any],
    agent_id: str | None = None,
    kind: str | None = None,
) -> str:
    item = _persist_failure(message, ctx=ctx, agent_id=agent_id, kind=kind)
    payload: dict[str, Any] = {"event": "error", "error": message}
    if kind:
        payload["kind"] = kind
    if agent_id:
        payload["agent_id"] = agent_id
    if item.get("run_id"):
        payload["run_id"] = item["run_id"]
    if item.get("id"):
        payload["log_id"] = item["id"]
    return _sse(payload)


def _resolve_intent_via_db(ctx: dict[str, Any]) -> dict[str, Any]:
    """Connect to DB (helix.config.yaml) and enrich ctx.prompt with DB intent."""
    raw_prompt = str(ctx.get("prompt") or "")
    actor = ctx.get("actor") or {}
    try:
        intent = resolve_user_intent(raw_prompt, actor=actor)
    except Exception as exc:  # noqa: BLE001
        intent = {
            "found": False,
            "resolved_prompt": raw_prompt,
            "original_prompt": raw_prompt,
            "source_table": None,
            "source_row": None,
            "error": str(exc),
            "checked_tables": [],
        }
    ctx["db_intent"] = intent
    ctx["original_prompt"] = raw_prompt
    if intent.get("found") and intent.get("resolved_prompt"):
        ctx["prompt"] = str(intent["resolved_prompt"])
        ctx["db_intent_source"] = intent.get("source_table")
    return intent


_DANGEROUS_SNIPPETS = (
    "ignore previous",
    "ignore all instructions",
    "ignore the rules",
    "jailbreak",
    "reveal the system prompt",
    "dump your prompt",
    "api key",
    "api_key",
    "openrouter token",
    "connection string",
    "drop table",
    "truncate table",
    "insert into",
    "delete from",
    "xp_cmdshell",
    "exec(",
    "execute(",
)


def _guardian_hard_block(prompt: str, actor: dict[str, Any]) -> str | None:
    text = prompt or ""
    lowered = text.lower()
    if any(snippet in lowered for snippet in _DANGEROUS_SNIPPETS):
        return "This prompt is not allowed."
    if actor.get("unknown"):
        return "Unknown user; warehouse analysis is blocked."
    admin_only = (
        "change password",
        "create user",
        "delete user",
        "disable security",
        "show token",
        "list api key",
    )
    if not actor.get("is_admin") and any(item in lowered for item in admin_only):
        return "This action needs an admin user."
    return None


def _effective_mode(mode: str) -> str:
    if mode in ("analysis", "research"):
        return "analytical_report"
    if mode == "both":
        return "analytical_report_chart"
    return mode or "auto"


def _report_length_hint(level: str, language: str) -> str:
    key = (level or "medium").strip().lower()
    if key not in ("low", "medium", "high"):
        key = "medium"
    if language == "fa":
        mapping = {
            "low": "طول گزارش: حدود ۱ تا ۲ خط.",
            "medium": "طول گزارش: حدود ۴ تا ۵ خط.",
            "high": "طول گزارش: حدود ۸ تا ۹ خط.",
        }
    else:
        mapping = {
            "low": "Report length: about 1–2 lines.",
            "medium": "Report length: about 4–5 lines.",
            "high": "Report length: about 8–9 lines.",
        }
    return mapping[key]


def _normalize_web_search_queries(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    queries: list[str] = []
    for item in raw:
        text = str(item or "").strip()
        if text and text not in queries:
            queries.append(text)
        if len(queries) >= 3:
            break
    return queries


def _normalize_chart_types(ctx: dict[str, Any]) -> list[str]:
    raw = ctx.get("chart_types")
    types: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            value = str(item or "").strip()
            if value in VALID_CHART_TYPES and value not in types:
                types.append(value)
            if len(types) >= 4:
                break
    if not types:
        single = ctx.get("chart_type") or "bar"
        if single not in VALID_CHART_TYPES:
            single = "bar"
        types = [single]
    return types


def _package_result(ctx: dict[str, Any]) -> dict[str, Any]:
    mode = _effective_mode(str(ctx.get("mode") or "auto"))
    language = ctx.get("language") or "en"
    chart_types = _normalize_chart_types(ctx)
    chart_type = chart_types[0]
    fetch = ctx.get("sql_fetch") if isinstance(ctx.get("sql_fetch"), dict) else None
    text_report = ctx.get("text_report")
    if not text_report:
        artifacts = ctx.get("artifacts") or {}
        for key in ("orchester", "result-builder", "publisher"):
            pub = artifacts.get(key) or {}
            text_report = pub.get("text")
            if text_report:
                break
    if not text_report and fetch:
        count = len(fetch.get("rows") or [])
        text_report = (
            f"Query returned {count} rows."
            if language != "fa"
            else f"پرس‌وجو {count} ردیف برگرداند."
        )
    echarts_option = None
    echarts_options: list[dict[str, Any]] = []
    grid = None
    if fetch:
        if mode in ("chart", "analytical_report_chart", "auto"):
            for ctype in chart_types:
                option = build_echarts_option(
                    fetch, chart_type=ctype, language=language
                )
                if option:
                    echarts_options.append({"chart_type": ctype, "option": option})
            if echarts_options:
                echarts_option = echarts_options[0]["option"]
                chart_type = echarts_options[0]["chart_type"]
        if mode in ("grid", "auto", "analytical_report_chart"):
            grid = build_grid(fetch, ctx.get("columns"))
        if mode == "analytical_report":
            grid = None
            echarts_option = None
            echarts_options = []
        if mode == "chart":
            text_report = None
        if mode == "grid":
            text_report = None
            echarts_option = None
            echarts_options = []
    if mode in ("analytical_report", "analytical_report_chart", "auto") and not text_report:
        raise ValueError("No report text was produced from the query results")
    if mode in ("chart", "analytical_report_chart", "auto") and not echarts_option and mode != "analytical_report":
        if mode in ("chart", "analytical_report_chart"):
            raise ValueError("No chart could be built from the query results")
    return {
        "mode": mode,
        "language": language,
        "report_type": ctx.get("report_type"),
        "chart_type": chart_type if echarts_option else None,
        "chart_types": [item["chart_type"] for item in echarts_options] or None,
        "text_report": text_report,
        "echarts_option": echarts_option,
        "echarts_options": echarts_options or None,
        "grid": grid,
        "used_demo": False,
    }


def _tool_contract_suffix(ctx: dict[str, Any]) -> str:
    language = _result_language(ctx)
    report_level = _normalize_report_type(ctx.get("report_type"))
    parts = [
        "",
        "## Tools",
        "",
        "You are the sole Helix agent. Use tools until the ask is done:",
        "- execute_select — warehouse SELECT; always TOP/FETCH; names from live catalog.",
        "- search_web — public facts only when the warehouse cannot answer.",
        "- submit_result — finish with text_report grounded in sql_fetch preview numbers.",
        "Do not invent figures. Call submit_result exactly once when finished.",
        _report_length_hint(report_level, language),
    ]
    if language == "fa":
        parts.append(
            "Write text_report (and user-visible message) in Persian (فارسی). "
            "Keep SQL identifiers unchanged."
        )
    else:
        parts.append(
            "Write text_report (and user-visible message) in English. "
            "Keep SQL identifiers unchanged."
        )
    return "\n".join(parts)


def _build_user_message(ctx: dict[str, Any]) -> str:
    language = ctx.get("language") or "en"
    parts = [
        f"User prompt:\n{ctx.get('prompt') or ''}",
        f"mode={ctx.get('mode') or ''}",
        f"language={language}",
        f"report_type={ctx.get('report_type') or ''}",
        f"chart_type={ctx.get('chart_type') or ''}",
        f"actor={json.dumps(ctx.get('actor') or {}, ensure_ascii=False)}",
    ]
    db_intent = ctx.get("db_intent") or {}
    if db_intent.get("found"):
        parts.append(
            f"DB intent resolved from {db_intent.get('source_table')}. "
            f"Use the prompt above (original was: {str(ctx.get('original_prompt') or '')[:200]})."
        )
    else:
        checked = ", ".join(db_intent.get("checked_tables") or []) or "catalog"
        parts.append(
            f"DB intent lookup found no match (checked: {checked}); use the prompt as-is."
        )
    calendar_hint = calendar_hint_for_prompt(str(ctx.get("prompt") or ""))
    if calendar_hint:
        parts.append(calendar_hint)
    return "\n\n".join(parts)


def _parse_tool_args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            data = json.loads(raw or "{}")
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}
    return {}


def _dispatch_tool(
    name: str,
    args: dict[str, Any],
    ctx: dict[str, Any],
) -> tuple[str, bool]:
    """Run one tool. Returns (result_json, done) where done means submit_result finished."""
    language = ctx.get("language") or "en"
    if name == "execute_select":
        sql_text = str(args.get("sql") or "").strip()
        if not sql_text:
            return json.dumps({"ok": False, "error": "sql is required"}), False
        try:
            fetch = execute_select(
                sql_text, row_cap=DATA_GATHERER_MAX_ROWS, actor=ctx.get("actor")
            )
        except Exception as exc:  # noqa: BLE001
            err = _sql_error_message(exc)
            ctx["last_error"] = err
            return json.dumps({"ok": False, "error": err}), False
        ctx["sql_fetch"] = fetch
        ctx.pop("last_error", None)
        rows = fetch.get("rows") or []
        return (
            json.dumps(
                {
                    "ok": True,
                    "sql": fetch.get("sql"),
                    "columns": fetch.get("columns"),
                    "row_count": len(rows),
                    "preview": rows[:20],
                },
                ensure_ascii=False,
                default=str,
            ),
            False,
        )

    if name == "search_web":
        queries = _normalize_web_search_queries(args.get("queries"))
        if not queries:
            return json.dumps({"ok": False, "error": "queries required (1–3)"}), False
        if ctx.get("_web_search_invoked"):
            return (
                json.dumps(
                    {
                        "ok": True,
                        "cached": True,
                        "web_search_brief": ctx.get("web_search_brief") or "",
                    },
                    ensure_ascii=False,
                ),
                False,
            )
        hits = search_web(queries)
        ctx["_web_search_invoked"] = True
        brief_lines = []
        for hit in hits:
            if hit.get("error"):
                brief_lines.append(f"- error ({hit.get('query')}): {hit.get('error')}")
                continue
            title = hit.get("title") or "result"
            url = hit.get("url") or ""
            snippet = hit.get("snippet") or ""
            if url:
                brief_lines.append(f"- [{title}]({url}): {snippet}")
            else:
                brief_lines.append(f"- {title}: {snippet}")
        objective = str(args.get("objective") or "").strip()
        brief = ""
        if objective:
            brief += f"Objective: {objective}\n"
        brief += "\n".join(brief_lines) if brief_lines else "No web results."
        ctx["web_search_brief"] = brief
        ctx.setdefault("artifacts", {})["web-search"] = {
            "queries": queries,
            "hit_count": len(hits),
            "text": brief,
        }
        return (
            json.dumps(
                {"ok": True, "web_search_brief": brief, "hit_count": len(hits)},
                ensure_ascii=False,
            ),
            False,
        )

    if name == "submit_result":
        text_report = str(args.get("text_report") or "").strip()
        if not text_report:
            return json.dumps({"ok": False, "error": "text_report is required"}), False
        chart_type = str(args.get("chart_type") or "").strip()
        if chart_type:
            ctx["chart_type"] = chart_type
        ctx["text_report"] = text_report
        message = str(args.get("message") or "").strip() or _ui_text(
            language, "Published result", "نتیجه منتشر شد"
        )
        try:
            ctx["final_payload"] = _package_result(ctx)
        except Exception as exc:  # noqa: BLE001
            err = _sql_error_message(exc)
            ctx["last_error"] = err
            return json.dumps({"ok": False, "error": err}), False
        ctx.setdefault("artifacts", {})["orchester"] = {
            "message": message,
            "text": text_report,
        }
        ctx["_submit_message"] = message
        return json.dumps({"ok": True, "message": message}), True

    return json.dumps({"ok": False, "error": f"Unknown tool: {name}"}), False


def _assistant_message_for_history(message: dict[str, Any]) -> dict[str, Any]:
    """Normalize assistant message for the next turn (drop null content when tools present)."""
    out: dict[str, Any] = {"role": "assistant"}
    content = message.get("content")
    tool_calls = message.get("tool_calls")
    if content is not None:
        out["content"] = content
    elif not tool_calls:
        out["content"] = ""
    if tool_calls:
        out["tool_calls"] = tool_calls
    return out


def _orchester_events(ctx: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield step events; set ctx['_orchester_outcome'] = (status, message)."""
    language = ctx.get("language") or "en"
    blocked = _guardian_hard_block(str(ctx.get("prompt") or ""), ctx.get("actor") or {})
    if blocked:
        ctx["last_error"] = blocked
        yield _step_event(
            ctx,
            agent_id="orchester",
            node_id="orchester",
            status="failed",
            message=blocked,
            result="fail",
        )
        ctx["_orchester_outcome"] = ("fail", blocked)
        return

    system = store.assemble_agent_prompt("orchester") + _tool_contract_suffix(ctx)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": _build_user_message(ctx)},
    ]

    for turn in range(1, MAX_TOOL_TURNS + 1):
        yield _step_event(
            ctx,
            agent_id="orchester",
            node_id="orchester",
            status="running",
            message=_ui_text(
                language,
                f"Orchester turn {turn}/{MAX_TOOL_TURNS}…",
                f"نوبت Orchester {turn}/{MAX_TOOL_TURNS}…",
            ),
        )
        try:
            assistant = complete_chat_messages(
                "orchester", messages, tools=ORCHESTER_TOOLS
            )
        except Exception as exc:  # noqa: BLE001
            err = _sql_error_message(exc)
            ctx["last_error"] = err
            yield _step_event(
                ctx,
                agent_id="orchester",
                node_id="orchester",
                status="failed",
                message=err,
            )
            ctx["_orchester_outcome"] = ("failed", err)
            return

        tool_calls = assistant.get("tool_calls")
        if not isinstance(tool_calls, list) or not tool_calls:
            content = str(assistant.get("content") or "").strip()
            # Allow bare submit via JSON in content as last resort
            if content.startswith("{") and "text_report" in content:
                try:
                    parsed = json.loads(content)
                except json.JSONDecodeError:
                    parsed = {}
                if isinstance(parsed, dict) and parsed.get("text_report"):
                    result_json, done = _dispatch_tool("submit_result", parsed, ctx)
                    yield _step_event(
                        ctx,
                        agent_id="orchester",
                        node_id="orchester",
                        status="done" if done else "failed",
                        message=str(parsed.get("message") or content[:200]),
                    )
                    if done:
                        ctx["_orchester_outcome"] = (
                            "done",
                            str(ctx.get("_submit_message") or "Published result"),
                        )
                        return
                    ctx["_orchester_outcome"] = (
                        "failed",
                        json.loads(result_json).get("error") or "submit_result failed",
                    )
                    return
            err = _ui_text(
                language,
                "Orchester returned no tool calls; call execute_select / search_web / submit_result",
                "Orchester بدون tool_calls برگشت؛ execute_select / search_web / submit_result را صدا بزنید",
            )
            ctx["last_error"] = err
            yield _step_event(
                ctx,
                agent_id="orchester",
                node_id="orchester",
                status="failed",
                message=err,
            )
            ctx["_orchester_outcome"] = ("failed", err)
            return

        messages.append(_assistant_message_for_history(assistant))
        finished = False
        for call in tool_calls:
            if not isinstance(call, dict):
                continue
            fn = call.get("function") if isinstance(call.get("function"), dict) else {}
            name = str(fn.get("name") or "").strip()
            args = _parse_tool_args(fn.get("arguments"))
            call_id = str(call.get("id") or name or "tool")
            yield _step_event(
                ctx,
                agent_id="orchester",
                node_id="orchester",
                status="running",
                message=_ui_text(
                    language,
                    f"Tool {name}…",
                    f"ابزار {name}…",
                ),
            )
            result_json, done = _dispatch_tool(name, args, ctx)
            try:
                parsed_result = json.loads(result_json)
                tool_ok = bool(isinstance(parsed_result, dict) and parsed_result.get("ok"))
            except json.JSONDecodeError:
                tool_ok = False
            yield _step_event(
                ctx,
                agent_id="orchester",
                node_id="orchester",
                status="done" if (done or tool_ok) else "failed",
                message=_ui_text(
                    language,
                    f"{name} → {result_json[:180]}",
                    f"{name} → {result_json[:180]}",
                ),
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": result_json,
                }
            )
            if done:
                finished = True
                break
        if finished:
            ctx["_orchester_outcome"] = (
                "done",
                str(ctx.get("_submit_message") or "Published result"),
            )
            return

    err = _ui_text(
        language,
        f"Orchester exceeded {MAX_TOOL_TURNS} tool turns without submit_result",
        f"Orchester بیش از {MAX_TOOL_TURNS} نوبت بدون submit_result اجرا شد",
    )
    ctx["last_error"] = err
    yield _step_event(
        ctx,
        agent_id="orchester",
        node_id="orchester",
        status="failed",
        message=err,
    )
    ctx["_orchester_outcome"] = ("failed", err)


def _run_orchester(ctx: dict[str, Any]) -> tuple[str, str]:
    """Non-streaming entry (tests); drains tool-loop events."""
    for _ in _orchester_events(ctx):
        pass
    outcome = ctx.get("_orchester_outcome")
    if isinstance(outcome, tuple) and len(outcome) == 2:
        return str(outcome[0]), str(outcome[1])
    return "failed", str(ctx.get("last_error") or "Orchester produced no outcome")


def pipeline_events(
    prompt: str,
    mode: str,
    *,
    language: str = "en",
    report_type: str | None = None,
    chart_type: str | None = None,
    chart_types: list[str] | None = None,
    columns: list[str] | None = None,
    actor: dict[str, Any] | None = None,
) -> Iterator[str]:
    ctx: dict[str, Any] = {
        "prompt": prompt,
        "mode": mode,
        "language": language,
        "report_type": report_type,
        "chart_type": chart_type,
        "chart_types": chart_types,
        "columns": columns,
        "actor": actor or {"username": "guest", "is_admin": False, "is_guest": True},
        "artifacts": {},
        "run_id": uuid.uuid4().hex,
        "pipeline_started": _agent_time.time(),
        "step_log": [],
    }
    try:
        require_llm()
    except ValueError as exc:
        yield _error_event(str(exc), ctx=ctx, kind="llm")
        return

    db_intent = _resolve_intent_via_db(ctx)
    if db_intent.get("found"):
        intent_msg = _ui_text(
            language,
            f"Resolved user intent from DB table {db_intent.get('source_table')}: {str(ctx.get('prompt') or '')[:100]}",
            f"نیت کاربر از جدول {db_intent.get('source_table')} بازیابی شد: {str(ctx.get('prompt') or '')[:100]}",
        )
    else:
        checked = ", ".join(db_intent.get("checked_tables") or []) or "catalog"
        detail = db_intent.get("error") or f"checked {checked}"
        intent_msg = _ui_text(
            language,
            f"DB intent lookup ({checked}): {detail[:120]} — using raw prompt",
            f"جست‌وجوی نیت در DB ({checked}): {detail[:120]} — استفاده از پرامپت خام",
        )
    yield _sse(
        _step_event(
            ctx,
            agent_id="db-intent",
            status="done",
            message=intent_msg,
        )
    )

    provider = get_provider()
    _ = get_pipeline_graph_for_mode(mode)

    effective_prompt = str(ctx.get("prompt") or prompt)
    user_message = _ui_text(
        language,
        f"Received prompt ({mode}/{language}) via {provider}: {effective_prompt[:120]}",
        f"درخواست دریافت شد ({mode}/{language}) از {provider}: {effective_prompt[:120]}",
    )
    yield _sse(
        _step_event(
            ctx,
            agent_id="user",
            status="done",
            message=user_message,
        )
    )

    pipeline_started = _agent_time.time()

    def result_chunk(payload: dict[str, Any]) -> str:
        duration_s = round(_agent_time.time() - pipeline_started, 2)
        return _sse({"event": "result", **payload, "duration_s": duration_s})

    display = agent_display_name("orchester")
    yield _sse(
        _step_event(
            ctx,
            agent_id="orchester",
            node_id="orchester",
            status="running",
            message=_ui_text(language, f"Running {display}…", f"در حال اجرای {display}…"),
        )
    )

    try:
        for step in _orchester_events(ctx):
            yield _sse(step)
    except Exception as exc:
        err_text = _sql_error_message(exc)
        yield _sse(
            _step_event(
                ctx,
                agent_id="orchester",
                node_id="orchester",
                status="failed",
                message=err_text,
            )
        )
        ctx["last_error"] = err_text
        yield _error_event(err_text, ctx=ctx, agent_id="orchester")
        return

    outcome = ctx.get("_orchester_outcome")
    if isinstance(outcome, tuple) and len(outcome) == 2:
        status, message = str(outcome[0]), str(outcome[1])
    else:
        status, message = "failed", str(ctx.get("last_error") or "Orchester produced no outcome")

    yield _sse(
        _step_event(
            ctx,
            agent_id="orchester",
            node_id="orchester",
            status="done" if status not in ("failed", "fail") else "failed",
            message=message,
            result=status,
        )
    )

    if status in ("failed", "fail"):
        err_kind = "rejection" if status == "fail" and "not allowed" in message.lower() else None
        yield _error_event(message, ctx=ctx, agent_id="orchester", kind=err_kind)
        return

    if ctx.get("final_payload"):
        yield result_chunk(ctx["final_payload"])
        return
    try:
        result = _package_result(ctx)
    except Exception as exc:
        yield _error_event(_sql_error_message(exc), ctx=ctx)
        return
    yield result_chunk(result)


def run_pipeline_sync(
    prompt: str,
    mode: str,
    *,
    language: str = "en",
    report_type: str | None = None,
    chart_type: str | None = None,
    chart_types: list[str] | None = None,
    columns: list[str] | None = None,
    actor: dict[str, Any] | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] | None = None
    error: str | None = None
    for chunk in pipeline_events(
        prompt,
        mode,
        language=language,
        report_type=report_type,
        chart_type=chart_type,
        chart_types=chart_types,
        columns=columns,
        actor=actor,
    ):
        line = chunk.strip()
        if not line.startswith("data:"):
            continue
        payload = json.loads(line[5:].strip())
        if payload.get("event") == "result":
            result = {k: v for k, v in payload.items() if k != "event"}
        if payload.get("event") == "error":
            error = str(payload.get("error") or "Run failed")
    if error:
        raise ValueError(error)
    if not result:
        missing = "Pipeline produced no result"
        _persist_failure(
            missing,
            ctx={
                "prompt": prompt,
                "mode": mode,
                "language": language,
            },
        )
        raise ValueError(missing)
    return result
