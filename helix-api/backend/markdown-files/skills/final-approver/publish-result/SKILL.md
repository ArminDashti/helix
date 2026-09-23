---
name: Publish result
description: Validate the fetch against the ask, write text_report, hand off to orchester
---

# Publish result

1. Read `goals`, `what_was_done`, and the `sql_fetch` preview.
2. Check every goal against the fetched rows. On a gap, return `fail` with the gap list — missing filter, wrong grain, invented number, missing artifact.
3. Write `text_report` at the requested depth from preview numbers only; name units, grain, and filters, and say plainly when a result is empty. Never invent a figure.
4. Leave unused artifacts null per `mode`, and add `chart_type` when the mode needs a chart.
5. Return JSON `{result, message, text_report, chart_type}`; orchester packages `{text_report, grid, echarts_option}` from the same fetch.
