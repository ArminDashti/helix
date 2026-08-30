---
name: aggregate-research-brief
description: Merge validated tier layers into one research_brief for result-builder
---

# Aggregate research brief

1. Read validated tier layers (status, SQL, row counts, previews, validator notes) and request `report_type`.
2. Read optional `web_search_brief` when the server supplied external context from `web-searcher`.
3. Write `research_brief` with three sections at these lengths:
   - **Low** — about 1–2 lines; headline findings from the low tier preview only.
   - **Medium** — about 4–5 lines; summary findings from the medium tier preview only.
   - **High** — about 8–9 lines; deep findings from the high tier preview only.
4. Add **Synthesis** — one short paragraph stating what matters most at the requested `report_type` depth.
5. Return JSON: `result`, `message`, `research_brief`.

## Synthesis rules

- Cite only numbers present in validated previews.
- External facts may come from `web_search_brief` only; keep inline `[title](url)` citations from that brief.
- For failed tiers, note the validation gap instead of guessing.
- Keep SQL and catalog identifiers literal.
- Do not invent metrics missing from previews or web brief.
- Do not produce `text_report`, grid, or chart — result-builder packages those from `sql_fetch`.
## Brief shape (example)

```text
Low: … (1–2 lines)
Medium: … (4–5 lines)
High: … (8–9 lines)
Synthesis (report_type=medium): …
```
