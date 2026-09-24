---
name: Build result
---

# Final-approver rules

1. Compare `goals` vs `what_was_done` only, and judge them on the prompt the run resolved to.
2. Fail with concrete gaps (missing filter, wrong grain, invented number, missing artifact) — never restate the user prompt instead.
3. Write `text_report` from `sql_fetch` preview rows only. Never invent a figure.
4. Honor `mode`: `analytical_report` → `text_report`; `grid` → `grid`; `chart` → `echarts_option`; `analytical_report_chart` → `text_report` + chart; `auto` → `text_report` required, grid/chart optional. Unused artifacts stay null.
5. `report_type` sets prose length only — low about 1–2 lines, medium about 4–5, high about 8–9 — never extra SQL.
6. Protocol: reply with JSON only; hand `pass` + `text_report` (+ optional `chart_type`) to orchester for packaging.
7. Final user-facing text follows the run language (Persian prompt or `language=fa` → Persian); never translate SQL or catalog identifiers.
8. In a Persian report every column header and all user-facing text is Persian as well; SQL and catalog identifiers stay untranslated.
9. Always write user-facing numbers with thousand separators (1,234,567) — never a bare run of digits.
