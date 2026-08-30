---
name: Gather data
description: Write SELECT from references and catalog, validate safety, execute, and
  retry on errors
---

# Gather data

1. Read the user prompt, mode, all references, and the live catalog.
2. Write one cheap SELECT with a row bound on the final SELECT. For Iranian months, filter `Sal` plus a Gregorian `TarikhFaktor` range from the run-context calendar hint.
3. Return JSON with `sql`, `result`, `message`, `goals`, and `what_was_done`.
4. `goals`: what you intend to fetch for this user prompt (table, filters, grain, metrics).
5. `what_was_done`: what you actually wrote and fetched (summarize SQL intent and row outcome). The validator compares only these two fields.

## SQL safety (before execution)

**Must reject**

- `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `TRUNCATE`, `DROP`, `ALTER`, `CREATE`, `EXEC` / `EXECUTE`
- Multi-statement batches that include any write/DDL
- Objects not listed in references or the live catalog
- Unbounded heavy fetches (no TOP/FETCH/LIMIT on the final SELECT; forbidden `SELECT *` when configured; obvious cartesian products)
- Full fact-table scans with no filter when the user named centers, a year, or did not ask for all history
- Scalar functions on filter keys or date columns in WHERE, JOIN, or GROUP BY
- Nested queries that aggregate the same unfiltered fact more than once

**Must allow (when safe)**

- Single `SELECT` (or CTE + SELECT) against catalog-listed objects
- Aggregations with clear grouping **after** a sargable filter on the driving table
- Ranked "top N per group" using a window function then keep rank = 1, with `TOP` on the outer SELECT
- Row-bounded extracts respecting `sql.max_rows`

## Retry behavior

6. On warehouse error in context, fix the SQL using the error text; do not invent numbers.
7. When `last_error` contains validator gaps (goals vs what_was_done), revise SQL and update both handoff fields. Do not weaken row bounds or SELECT-only rules.
8. On approve, the server executes the SQL and stores rows in `sql_fetch`.
9. When the prompt needs public web facts outside the warehouse, return JSON with `web_search_queries` (1–3 strings) and optional `web_search_objective`; omit `sql`. The server runs `web-searcher` once, then retries gather with `web_search_brief`.
10. When `web_search_brief` is present, use it for external context only; still write warehouse SQL from catalog hits.
