# Test grid best selling products

| Field | Value |
|-------|-------|
| Agent | `Auto` |
| Date | `2026-08-18` |
| Time | `16:12:00` |
| Device | `PC-ARMIN` |

## Skills

`transform-human-prompt-to-agent-understanding` / `accept-reject-human-prompt` / `log-human-prompt` / `webui-test-functionality` / `helix-product-scope` / `dictionary-by-armin` / `suggest-for-improving` / `report-to-human-in-end-of-response`

## Rules

`helix-product-scope` / `restart-api-when-needed`

---

## Transcript

### User

Test the app for
پر فروش ترین کالای مراکز تهران1، کرمان، اهواز و شیراز رو لیست کن
grid
and columns
مرکز/کالا/تعداد/فروش/سود خالص

### Agent

The Analysis page and API health checks passed. The grid chat itself did not return a table. The Vite proxy path died at the 120s Gunicorn worker limit (HTTP 500, empty body). After raising that worker limit to 600s, the same request hit the warehouse ODBC 60s query timeout (HYT00) and returned HTTP 400 with no grid. Columns مرکز/کالا/تعداد/فروش/سود خالص and the four centers were not verified because no result payload arrived. Report: .armin/functional-test/analysis-grid-best-selling.md. Rate: 3.

---

### User

I got
Request rejected
http · HTTP 400

ValueError OperationalError HYT00 [HYT00] [Microsoft][ODBC Driver 18 for SQL Server]Query timeout expired (0) (SQLExecDirectW) ('HYT00', '[HYT00] [Microsoft][ODBC Driver 18 for SQL Server]Query timeout expired (0) (SQLExecDirectW)')
why?

### Agent

The warehouse SELECT did not finish in 60 seconds. The API sets that statement limit on the SQL Server connection. When time ran out, the driver returned HYT00, the API wrapped it as ValueError, and /api/chat mapped it to HTTP 400 because this message is not treated as a 502 (broken-link) error. The request body was valid; the generated query was too heavy for that time limit.
