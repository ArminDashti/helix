---
name: generate-analytical-report
description: Write a text analysis from fetched warehouse rows at the requested depth
---

# Generate analytical report

## When to use

- `mode=analytical_report`: full report is the only UI artifact
- `mode=analytical_report_chart` or `auto`: report accompanies chart/grid as required by the output contract

## Instructions

1. Base every claim on fetched rows (or a stated empty result). No invented numbers.
2. Depth from `report_type` (prose length, not extra SQL):
   - `low` — about 1–2 lines; short headline findings.
   - `medium` — about 4–5 lines; findings plus context.
   - `high` — about 8–9 lines; findings, breakdowns, and caveats.
   Do not ask for extra years or joins to pad the report.
3. Use plain language; name units, time grain, and filters when they affect the claim.
4. For chart modes, explain what the chart shows. Do not ignore the visual.
5. Write `text_report` in Persian when the user prompt is Persian (Farsi) or run `language` is `fa`; otherwise English when `language` is `en`. Internal context (briefs, SQL, goals) may stay as received. Do not translate SQL identifiers.
