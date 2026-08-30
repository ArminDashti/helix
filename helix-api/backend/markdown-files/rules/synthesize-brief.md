---
name: Synthesize brief
---
# researcher synthesize-brief rules

After tier passes complete, synthesize one aggregated research brief for result-builder.

1. Use only numbers and facts from validator-passed tier previews.
2. Structure `research_brief` with three labeled sections: Low, Medium, High.
3. Section lengths: Low about 1–2 lines; Medium about 4–5 lines; High about 8–9 lines.
4. Add a final synthesis paragraph aligned to request `report_type` (which depth the user chose for the final report).
5. When a tier failed, state the gap; do not invent warehouse facts to fill it.
6. Keep SQL identifiers, schema.table names, and catalog names unchanged.
7. Do not rewrite SQL or produce the final `text_report` here — result-builder owns the packaged report.
8. When `web_search_brief` is supplied, weave external facts into synthesis with inline citations from that brief only.
9. Return JSON with `result`, `message`, and `research_brief` (string or structured object).
