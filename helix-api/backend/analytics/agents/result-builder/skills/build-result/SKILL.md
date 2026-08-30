---
name: build-result
description: Write text_report from fetched rows per mode
---

# Build result

1. Read mode and the SQL fetch preview.
2. Write `text_report` from preview numbers when the mode needs a report.
3. Honor `report_type` line budgets: `low` about 1–2 lines; `medium` about 4–5 lines; `high` about 8–9 lines.
4. When a research brief is present, prefer the section matching `report_type` but keep `text_report` to that depth's line budget.
5. Result language: if the user prompt is Persian (Farsi) or run `language` is `fa`, write the final `text_report` (and final user-visible message when present) in Persian; otherwise English when `language` is `en`. Internal fields (`goals`, `what_was_done`) may use any language. Do not translate SQL identifiers.
6. Do not invent values. The server builds grid and chart from the same rows.
7. Return JSON with `goals` (what the report/chart should deliver for this prompt and mode) and `what_was_done` (what you actually wrote in text_report and any chart hint). The validator compares only these two fields.
