# result-builder build-result rules

1. Honor mode strictly: null unused fields per the output contract.
2. Write `text_report` from the SQL fetch preview only.
3. Honor `report_type` length: low about 1–2 lines; medium about 4–5 lines; high about 8–9 lines.
4. Do not invent figures that are not in the fetch preview.
5. Optional `chart_type` hint when mode needs a chart. Server builds grid and chart.
6. Always include `goals` and `what_was_done` in JSON before the validator runs.
7. Result language: if the user prompt is Persian (Farsi) or run `language` is `fa`, write the final `text_report` (and final user-visible message when present) in Persian; otherwise English when `language` is `en`. Internal fields may use any language. Do not translate SQL identifiers.
