---
name: conduct-research
description: Run low, medium, and high tier passes through data-gatherer and validator
---

# Conduct research

1. Read the user prompt, `mode=research`, language, and requested `report_type`.
2. When the prompt needs public web facts outside the warehouse (benchmarks, news, rates, definitions not in catalog), return JSON with `web_search_queries` (1–3 strings) and optional `web_search_objective` so Python invokes `web-searcher` before tier passes.
3. For each tier in `low`, `medium`, `high`:
   - Apply the tier scope hint for the gather step (minimal → summary → deep breakdown).
   - Run data-gatherer, then first-pass validator on the fetch.
   - On validator fail, retry gather using the validator gap message until pass or tier attempt cap (5).
   - Record tier status, SQL, row count, validator notes, and preview rows when pass.
4. Stop tier work when pass or retry cap is reached; continue to the next tier.
5. Select primary `sql_fetch` from the tier matching `report_type`, else deepest successful tier.
6. Hand tier artifacts to the synthesize step; do not write the final report here.
7. When `web_search_brief` is present, use it for external context only; warehouse numbers still come from validated tier previews.

## Web search

- Researcher may request one `web-searcher` pass at research start via `web_search_queries`.
- Each tier's data-gatherer may request one `web-searcher` pass per tier when tier-specific external facts are needed.
- Do not invent URLs or web facts; rely on `web_search_brief` supplied by the server.

## Tier scope

| Tier | Gather focus |
|------|----------------|
| `low` | Headline facts, minimal columns, tight filters |
| `medium` | Summary grain, grouping or context columns |
| `high` | Breakdowns, comparisons, caveats implied by the prompt |

## Retry

- Retry gather/validate up to 5 times per tier after validator fail.
- Do not pass a tier without validator `pass`.
- Do not skip tiers or reorder them.
