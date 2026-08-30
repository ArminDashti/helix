# Optimize skills and rules for speed

| Field | Value |
|-------|-------|
| Agent | `Auto` |
| Date | `2026-08-18` |
| Time | `16:40:00` |
| Device | `PC-ARMIN` |

## Skills

`transform-human-prompt-to-agent-understanding` / `accept-reject-human-prompt` / `log-human-prompt` / `helix-product-scope` / `dictionary-by-armin` / `suggest-for-improving` / `report-to-human-in-end-of-response`

## Rules

`helix-product-scope`

---

## Transcript

### User

Optimize skills and rules in order to optimize speed

### Agent

Pipeline skills and rules now require cheap warehouse SQL: filter invoice headers first, sargable dates (no CalculatePersianDate on TarikhFaktor), recent Sal by default, TOP plus ROW_NUMBER for rankings, and aliases that match requested grid columns. New fast-query rule is assigned to architect, builder, sql, and auditor. Both analytics/agents and markdown-files trees were updated so the mounted runtime files are live. Re-run the Tehran1/Kerman/Ahvaz/Shiraz grid to see if it finishes under the 60s driver limit.

---

### User

Ok, restart it and test it again

### Agent

Restarted helix-api (health ok). The same grid chat returned HTTP 200 in about 7 minutes with real warehouse rows. Columns matched مرکز/کالا/تعداد/فروش/سود خالص. Rows for اهواز, شیراز, and کرمان. تهران1 was missing. کالا was product id 18866, and سود خالص equaled فروش. Report: .armin/functional-test/analysis-grid-best-selling.md. Rate: 6.

---

### User

Why does it take so long?

### Agent

The 7m 18s was almost all seven sequential LLM calls (validator → strategist → architect → builder → sql → auditor → publisher), each with the full catalog as the system prompt. The warehouse SELECT only had to finish under 60s. Grid mode still runs builder and publisher even though the server builds the table from the SQL result.

---

### User

Do you think we can reduce number of agents?

### Agent

Yes. Do not delete the seven agents; skip unused ones by mode. Grid and chart only need the SQL agent because the server already builds the table and chart from sql_fetch. Report modes need SQL plus the publisher for text. Strategist, architect, builder, and auditor do not change the grid payload today. That should cut a grid run from seven LLM calls to one.
