# Researcher warehouse SQL rules

1. SELECT or CTE+SELECT only. No writes/DDL/EXEC.
2. Always TOP/FETCH within server max_rows.
3. Prefer catalog.schema.table names from live catalog.
4. No SELECT * when forbid_select_star is on.
5. On SQL error, rewrite once with last_error; do not invent tables.
6. Always emit `goals` and `what_was_done` before handoff.
7. Web search only when warehouse cannot answer public-fact asks.
