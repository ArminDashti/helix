---
name: Resolve user intent
description: Connect to the configured warehouse DB and find what the user actually wants before any analysis
---

# Resolve user intent

## When to use

- At the very start of every pipeline run, before understand-database / gather-data
- Any time the prompt looks like an id, key, or shorthand that needs DB lookup

## Instructions

1. **Connect to DB using the configured engine.** Use `api.db_sql.connect()` which reads `helix.config.yaml` (`database` block: engine/host/port/name/user/password). Do not hard-code a connection string. If `engine == sqlite`, the sample DB path is resolved via `sample_database.resolve_sqlite_path`.
2. **List tables via `db_sql.list_tables()`** and rank candidates: tables whose name matches `request|intent|prompt|task|demand|todo|message|user_request|helix_request` first, then all other tables as fallback.
3. **Introspect each candidate** with `db_sql.table_overview(schema, table)` (or `db_sql.list_columns`). Pick columns matching `prompt|request|intent|message|description|text|body|content` as the intent text, and `user|username|actor|owner|created_by` as the user key.
4. **Search rows:**
   - If the raw prompt is a short id/key (e.g. `req-42`, `42`), do `SELECT ... WHERE CAST(intent_col AS TEXT) = ?` with that id.
   - Else if actor username is known, filter `WHERE CAST(user_col AS TEXT) = ?` and order by `id|created_at|timestamp DESC` to get the user's latest request.
   - Else do keyword overlap (`LIKE %word%`) or just fetch the most recent row (`ORDER BY id DESC LIMIT 20`) and pick the best overlap with the prompt.
5. **Return a structured `db_intent` dict:** `{ found, resolved_prompt, original_prompt, source_table, source_row, checked_tables, error }`. On any DB error set `found=false` with `error` but do not throw — the pipeline continues with the raw prompt.
6. **Downstream agents must read `db_intent`.** If `found`, their `goals`/`what_was_done` and SQL must target the resolved prompt. If not found, they must note that DB was consulted and no row matched, then use the raw prompt (and consider a lookup SELECT if the prompt is an id).

## Implementation reference

- Canonical code: `helix-api/backend/api/user_intent.py::resolve_user_intent`
- Pipeline integration: `helix-api/backend/api/pipeline_run.py::_resolve_intent_via_db` (called at start of `pipeline_events`, injects `db_intent` into context and emits a `db-intent` step event)
- All LLM prompts already include `_context_blob(ctx)` which serializes `db_intent`, `original_prompt`, and `prompt` (resolved). Skills/rules must branch on `db_intent.found`.

## Safety

- SELECT-only, row-bounded (`LIMIT 20`), never write.
- Never log credentials; `database_to_connection_string` is for admin UI only.
