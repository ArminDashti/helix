# researcher conduct-research rules

Research mode runs three tier passes before result-builder. Python drives the sub-loop; these rules govern tier scope and handoff.

1. Run tiers in fixed order: `low`, then `medium`, then `high`.
2. Before tier passes, when the prompt needs public web facts outside the warehouse, return `web_search_queries` (1–3 strings) so Python can invoke `web-searcher` once at research start.
3. Each tier calls `data-gatherer` then first-pass `validator` on the same user prompt.
4. Tier scope (SQL shape, not report length):
   - `low`: minimal columns, tight filters, headline facts only.
   - `medium`: add grouping or context columns needed for a summary.
   - `high`: add breakdown dimensions, comparisons, or caveats the prompt implies.
5. Do not weaken SELECT-only, allowlist, or row-bound rules across tiers.
6. Accept a tier only when validator returns `pass` for that tier's fetch.
7. Retry gather/validate up to the tier attempt cap (5) after validator fail.
8. Record per tier: status, SQL, row count, validator notes, preview rows.
9. Pick primary `sql_fetch` for packaging from the tier matching request `report_type`; fallback `high` → `medium` → `low`.
10. Fail the researcher step when no tier validates.
11. Reset post-research validator visit count so the graph validator audits the built result as a second visit.
12. When `web_search_brief` is present, use it for external context only during synthesis; warehouse numbers still come from validated tier previews.
