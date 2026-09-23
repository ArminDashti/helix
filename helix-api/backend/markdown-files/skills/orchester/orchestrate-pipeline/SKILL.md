---
name: Orchestrate pipeline
description: Route guardian → researcher → final-approver and package the UI payload
---

# Orchestrate pipeline

1. Read each node's `{sender, status, message}` and the run context.
2. Hop in order: guardian pass → researcher; researcher done → final-approver; final-approver pass → package.
3. Package `{ text_report, grid, echarts_option }`: `text_report` from final-approver, grid and chart from the same `sql_fetch`. Null whatever `mode` does not require.
4. Emit one SSE step event per hop so the UI can follow the run.
5. Stop on `fail` with the agent's own message; allow one researcher retry for final-approver gaps.
