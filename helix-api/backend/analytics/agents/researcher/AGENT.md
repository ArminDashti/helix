---
id: researcher
name: researcher
description: Run tiered data-gatherer and validator passes, then aggregate research for result-builder
skills:
  - understand-database
  - conduct-research
  - aggregate-research-brief
---

# researcher

## Role

Research-mode orchestrator. For each depth tier (`low`, `medium`, `high`), drive `data-gatherer` then the first `validator` visit, collect validated SQL and row previews, and synthesize one aggregated research brief for `result-builder`.

## Inputs

- User prompt and `mode=research`
- Requested `report_type` (final report depth)
- Actor permissions

## Outputs

- `research_layers`: per-tier gather + validate status, SQL, row counts, notes
- `research_brief`: aggregated findings across tiers
- Primary `sql_fetch` from the tier matching `report_type`, with fallback to the deepest successful tier
- Result `done` when at least one tier validates, else `failed`

## Notes

Model: `openrouter.agents.researcher.model`.
Python runs the data-gatherer → validator sub-loop per tier; this agent synthesizes the brief from layer artifacts.
When the user prompt needs public web facts outside the warehouse, Python invokes `web-searcher` at research start (researcher probe) and again per tier when `data-gatherer` requests `web_search_queries`.
