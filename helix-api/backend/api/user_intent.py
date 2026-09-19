"""Resolve user intent by connecting to the configured warehouse DB.

The pipeline calls this before any LLM step so skills/rules can work from
what the database says the user actually wants, not just the raw chat prompt.

Behaviour:
- Connects via :mod:`api.db_sql` (which respects helix.config.yaml engine/host/name).
- Searches for a table that likely holds user requests (name contains request/intent/task/prompt/message/todo/demand).
- If no such table exists, falls back to scanning text columns of the first few tables.
- Looks up rows matching the actor username or the raw prompt as a key/id.
- Never raises: on any DB error returns ``found=False`` with ``error`` populated,
  so the pipeline can continue with the raw prompt.
"""

from __future__ import annotations

import re
from typing import Any

# Heuristic: table names that probably store user requests
_REQUEST_TABLE_PATTERNS = re.compile(
    r"(request|intent|prompt|task|demand|todo|message|user_request|helix_request|orders?)",
    re.IGNORECASE,
)
# Column names that likely hold the request text
_REQUEST_COLUMN_PATTERNS = re.compile(
    r"(prompt|request|intent|message|description|text|body|content|query|title|what_user_wants|user_want)",
    re.IGNORECASE,
)
# Column that likely identifies the user
_USER_COLUMN_PATTERNS = re.compile(
    r"(user|username|actor|owner|created_by|author|email)",
    re.IGNORECASE,
)


def _pick_request_tables(tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Rank tables: exact request/intent matches first, then any table."""
    scored: list[tuple[int, dict[str, Any]]] = []
    for t in tables:
        name = str(t.get("name") or t.get("full_name") or "")
        if _REQUEST_TABLE_PATTERNS.search(name):
            scored.append((0, t))
        else:
            scored.append((1, t))
    scored.sort(key=lambda x: x[0])
    return [t for _, t in scored]


def _safe_identifier(value: str) -> str:
    """Quote identifier for sqlite/sqlserver/postgres (best-effort, no injection)."""
    # Caller already validates via db_sql, but keep quoting minimal here
    if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", value):
        return f'"{value}"'
    # schema.table
    if "." in value:
        parts = value.split(".")
        return ".".join(_safe_identifier(p) for p in parts)
    return f'"{value}"'


def resolve_user_intent(
    prompt: str,
    *,
    actor: dict[str, Any] | None = None,
    max_candidates: int = 5,
    max_rows_per_table: int = 20,
) -> dict[str, Any]:
    """Connect to DB and find what the user actually wants.

    Returns a dict:
        {
            "found": bool,
            "resolved_prompt": str,   # DB row text if found else original prompt
            "original_prompt": str,
            "source_table": str | None,
            "source_row": dict | None,
            "error": str | None,
            "checked_tables": list[str],
        }
    """
    original = str(prompt or "").strip()
    actor = actor or {}
    username = str(actor.get("username") or "").strip()

    result: dict[str, Any] = {
        "found": False,
        "resolved_prompt": original,
        "original_prompt": original,
        "source_table": None,
        "source_row": None,
        "error": None,
        "checked_tables": [],
    }

    if not original and not username:
        result["error"] = "Empty prompt and no actor to resolve"
        return result

    try:
        from . import db_sql
    except Exception as exc:
        result["error"] = f"db_sql import failed: {exc}"
        return result

    # 1 — connect and list tables
    try:
        tables = db_sql.list_tables()
    except Exception as exc:
        result["error"] = f"list_tables failed: {exc}"
        return result

    if not tables:
        result["error"] = "No tables in live catalog"
        return result

    candidates = _pick_request_tables(tables)[:max_candidates]
    result["checked_tables"] = [str(t.get("full_name") or t.get("name") or "") for t in candidates]

    # 2 — for each candidate table, introspect columns and search rows
    for tbl in candidates:
        full_name = str(tbl.get("full_name") or tbl.get("name") or "")
        if not full_name:
            continue
        # parse schema.table for db_sql.table_overview
        try:
            schema, name = db_sql.parse_table_name(full_name)
        except Exception:
            # sqlite tables may have no schema
            schema, name = "", full_name

        try:
            overview = db_sql.table_overview(schema, name) if schema else db_sql.table_overview("", name)
            columns: list[dict[str, Any]] = overview.get("columns") or []
        except Exception:
            # fallback: try list_columns
            try:
                columns = db_sql.list_columns(schema, name) if hasattr(db_sql, "list_columns") else []
            except Exception:
                continue

        col_names = [str(c.get("name") or "") for c in columns if c.get("name")]
        if not col_names:
            continue

        request_cols = [c for c in col_names if _REQUEST_COLUMN_PATTERNS.search(c)]
        user_cols = [c for c in col_names if _USER_COLUMN_PATTERNS.search(c)]
        # fallback: any text-like column
        if not request_cols:
            request_cols = col_names[:3]

        # Build SELECT to find matching row
        # Strategy A — if username known, filter by user column + order by recent id/timestamp
        # Strategy B — filter where request column LIKE %prompt%
        # Strategy C — just fetch recent rows and let LLM compare

        for req_col in request_cols[:2]:
            # Use db_sql.connect directly so helix.config.yaml engine is respected;
            # for tests this can be patched to a sqlite in-memory DB.
            try:
                with db_sql.connect() as conn:
                    cur = conn.cursor()
                    # Prefer parameterised LIKE search; fallback to TOP/LIMIT
                    # We attempt: SELECT *ordered* by most recent (assume id/datetime desc)
                    # Use dialect-agnostic: fetch with limit
                    quoted_table = _safe_identifier(name) if not schema else f'{_safe_identifier(schema)}.{_safe_identifier(name)}'
                    quoted_req = _safe_identifier(req_col)

                    # Determine order-by column (id, created_at, timestamp, date)
                    order_col = None
                    for cand in ("id", "created_at", "createdAt", "timestamp", "updated_at", "date", "TarikhFaktor"):
                        if cand.lower() in {c.lower() for c in col_names}:
                            order_col = cand
                            break

                    sql = f"SELECT * FROM {quoted_table}"
                    params: tuple[Any, ...] = ()
                    where_clauses: list[str] = []

                    # Prefer username filter when actor is known — lookup latest request for that user
                    if username and user_cols:
                        quoted_user = _safe_identifier(user_cols[0])
                        where_clauses.append(f"CAST({quoted_user} AS TEXT) = ?")
                        params = (username,)
                    # Otherwise, if prompt looks like an ID/key, try exact match on intent column
                    elif bool(re.match(r"^[A-Za-z0-9_-]{1,64}$", original)) and len(original) < 40:
                        where_clauses.append(f"CAST({quoted_req} AS TEXT) = ?")
                        params = (original,)

                    if where_clauses:
                        sql += " WHERE " + " AND ".join(where_clauses)
                    if order_col:
                        sql += f" ORDER BY {_safe_identifier(order_col)} DESC"

                    # Apply row cap — detect engine for TOP vs LIMIT
                    try:
                        from .config_loader import get_database_engine
                        engine = get_database_engine()
                    except Exception:
                        engine = "sqlite"
                    is_sqlserver = engine == "sqlserver"
                    if is_sqlserver:
                        # SQL Server uses TOP; rewrite SELECT already has TOP handling elsewhere
                        # so inject TOP and remove trailing LIMIT
                        if "SELECT" in sql.upper() and "TOP" not in sql.upper():
                            sql = sql.replace("SELECT", f"SELECT TOP ({int(max_rows_per_table)})", 1)
                    else:
                        sql += f" LIMIT {int(max_rows_per_table)}"

                    try:
                        cur.execute(sql, params if params else None)
                    except Exception:
                        # Retry without params / without where clause
                        fallback = f"SELECT * FROM {quoted_table}"
                        if is_sqlserver:
                            fallback = f"SELECT TOP ({int(max_rows_per_table)}) * FROM {quoted_table}"
                        else:
                            fallback += f" LIMIT {int(max_rows_per_table)}"
                        cur.execute(fallback)

                    desc = cur.description or []
                    fetched_cols = [str(d[0]) for d in desc]
                    rows = cur.fetchmany(int(max_rows_per_table))
                    for row in rows:
                        if hasattr(row, "keys"):
                            row_dict = {k: row[k] for k in fetched_cols}
                        else:
                            row_dict = {fetched_cols[i]: row[i] for i in range(len(fetched_cols))}
                        text_val = str(row_dict.get(req_col) or "").strip()
                        if not text_val:
                            # try any request col
                            for c in request_cols:
                                v = str(row_dict.get(c) or "").strip()
                                if v:
                                    text_val = v
                                    req_col = c
                                    break
                        if not text_val:
                            continue
                        # Match heuristic: if we filtered, accept first; otherwise score similarity
                        if params:
                            result["found"] = True
                            result["resolved_prompt"] = text_val
                            result["source_table"] = full_name
                            result["source_row"] = row_dict
                            return result
                        # Unfiltered: look for row whose text contains prompt keywords or is recent
                        # Accept the most recent non-empty row as the user's current intent
                        # if no better match; prefer keyword overlap
                        prompt_words = set(original.lower().split())
                        row_words = set(text_val.lower().split())
                        overlap = len(prompt_words & row_words)
                        if overlap >= 2 or not result.get("source_row"):
                            result["found"] = True
                            result["resolved_prompt"] = text_val
                            result["source_table"] = full_name
                            result["source_row"] = row_dict
                            # continue to find better overlap, but keep current as candidate
                            if overlap >= 3:
                                return result
            except Exception as exc:
                result["error"] = f"query {full_name} failed: {exc}"
                continue

        if result["found"]:
            return result

    # No DB row matched — pipeline will use original prompt but marks intent as db-checked
    if not result.get("error"):
        result["error"] = f"No matching intent row in {', '.join(result['checked_tables']) or 'catalog'}; using raw prompt"
    return result
