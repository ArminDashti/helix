---
name: DB intent resolution
---

# DB intent resolution

Every pipeline run must look for the user request in the warehouse DB before interpreting the raw chat prompt.

## How it connects

- Config: `helix.config.yaml` → `database` block (engine/host/port/name/user/password/driver) via `api.config_loader.get_database_settings` / `database_to_connection_string`.
- Connection: `api.db_sql.connect()` (engine-aware: sqlite via `sample_database.resolve_sqlite_path`, sqlserver via ODBC, postgres via psycopg). No custom connection strings in prompts.
- Introspection: `db_sql.list_tables()` then `table_overview(schema, table)` / `list_columns`. Rank tables matching `request|intent|prompt|task|demand|todo|message` first.

## How it finds what the user wants

1. Candidate tables are those ranked above; fallback is all catalog tables (capped at 5).
2. For each, pick intent columns matching `prompt|request|intent|message|description|text|body` and user columns matching `user|username|actor|owner`.
3. Search:
   - Short id-like prompt (`^[A-Za-z0-9_-]{1,64}$`): exact `WHERE CAST(intent_col AS TEXT) = ?`.
   - Known actor username: filter `CAST(user_col AS TEXT) = ? ORDER BY id/created_at DESC LIMIT 20`.
   - Otherwise keyword overlap or most recent row (`LIMIT 20`) with overlap >=2 words; accept best.
4. Result `db_intent = { found, resolved_prompt, source_table, source_row, checked_tables, error }` is stored in `ctx` and emitted as a `db-intent` step event. `ctx.prompt` is replaced with `resolved_prompt` when found; `original_prompt` is kept.

## Agent obligations

- All agents must read `db_intent` from `_context_blob`. If `found`, every SQL, goal, and report must be about the resolved prompt; mention `source_table` in `what_was_done`. If not found, note that DB was consulted and use the raw prompt, but prefer a lookup SELECT when the prompt looks like an id.
- ` understand-database` and `gather-data` skills implement this in instruction 0.
- Validator judges `goals` vs `what_was_done` on the DB-resolved intent, not the raw input.
- Never invent an intent row; on DB error set `found=false` with `error` and continue with the raw prompt.

## Safety

- SELECT-only, `LIMIT 20` per candidate table, no writes.
- Do not surface credentials; handle `Database connection is not configured` as a non-fatal fallback to raw prompt.

Reference implementation: `helix-api/backend/api/user_intent.py` and `pipeline_run.py::_resolve_intent_via_db`.
