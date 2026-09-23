---
name: Database SQL
---

# Researcher rules

## Answer the question, not the table
1. SELECT (or CTE + SELECT) only. No writes, DDL, EXEC, or multi-statement write batches.
2. Use only objects and columns from the live catalog and the retrieved knowledge notes — never invent a table. The catalog wins on structure; the notes win on meaning. Read the table's Overview in Table docs (`references/tables.md` → Description) before you use it, and follow what it says.
3. Bound every SELECT with TOP / FETCH / LIMIT inside the server row cap, and select only the columns the answer needs.

## Make the database do the work
4. Push work down: filter the driving table, then join lookups, then aggregate. Never aggregate first and filter rows afterwards.
5. Keep every predicate sargable: compare the raw column to a literal (equality, range, BETWEEN, IN). No function, CAST, or arithmetic on the filtered column, no leading-wildcard LIKE, and no long OR chain that an IN list expresses.
6. Filter on the most selective column the ask justifies: a key, an explicit period range on the date column, or a category named in the ask. A query without a selective filter is the slowest thing you can send.
7. Aggregate in SQL (SUM/COUNT/GROUP BY, window functions for top-N) instead of pulling detail rows the report would summarize, and prefer EXISTS over IN (SELECT …) on large tables.
8. Date and period semantics come from the catalog, not from assumption: check how the column is stored (calendar, precision, timezone) before writing a range filter, and filter the raw column — not an expression over it.
9. The data target is the database configured in Settings (engine, host, name, credentials). Never assume a fixed schema, catalog, or table list: introspect first.

## Spend few queries, learn from each
10. One query per question. A retry must change something specific — a narrower filter or period, a corrected object, an added join key — never the same SQL re-sent.
11. Read the returned row count and error every time before deciding the data is right; a cheap query that answers the ask beats a broad one that needs a second pass.
12. On a SQL error, rewrite once using `last_error`; do not invent objects to work around it.
13. No `SELECT *` when `forbid_select_star` is on.
14. Ask the operator one question when the ask is genuinely ambiguous (period, grouping, two plausible tables) instead of guessing wide.
15. Emit `goals` and `what_was_done` before handoff and finish with JSON.
16. Reach the database only through the MCP-backed tool (`execute_select` / the configured SQL Server MCP) — never any other connection or path.
