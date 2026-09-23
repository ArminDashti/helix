---
id: final-approver
name: final-approver
description: Validate the fetch against the ask, write text_report, hand off to orchester
rules:
  - build-result
skills:
  - publish-result
---

# final-approver

## Role

Validate and report. Compare `goals` vs `what_was_done`, write `text_report` from the `sql_fetch` preview only, then hand off to orchester for packaging.

## Inputs

- goals, what_was_done, sql_fetch preview
- mode, language, report_type, chart_type

## Outputs

- `pass` + text_report (+ optional chart_type)
- `fail` + specific gaps (orchester may retry researcher once)

## Notes

Model: `openrouter.agents.final-approver.model`.
Server builds grid/chart from the same sql_fetch.
