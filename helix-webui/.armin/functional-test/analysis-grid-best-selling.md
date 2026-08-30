Date: 2026-08-18
Time: 18:35
Agent: webui-test-functionality
Page: Analysis / grid best-selling products (four-agent pipeline)
page-path: http://127.0.0.1:8000/api/runs/stream

Prompt: پر فروش ترین کالای مراکز تهران1، کرمان، اهواز و شیراز رو لیست کن
Mode: grid
Language: fa
Columns: مرکز / کالا / تعداد / فروش / سود خالص
Caller: username armin

1. API HEALTH
GET /api/health/ returned connected warehouse (SQL Server) and configured LLM.

PASS
================================

2. GRID RUN COMPLETES WITH A RESULT PAYLOAD
Four timed POST /api/runs/stream attempts. None returned event=result with a grid.

FAIL
================================

3. TIMING (WALL CLOCK)

| Attempt | Client total | Guardian LLM | SQL fetcher LLM | Warehouse SELECT | Outcome |
|---------|--------------|--------------|-----------------|------------------|---------|
| A 18:17 | client died ~38s | 7.38s | 272.26s | 7.79s, 4 rows | SQL succeeded; grid not packaged (client gone) |
| B 18:25 | 169.83s (~2m 50s) | 8.9s | 63.7s | timed out at 60s (HYT00) | FAIL |
| C 18:29 | 112.98s (~1m 53s) | 6.07s | 75.76s | rejected (two SQL statements) | FAIL |
| D 18:32 | 90.46s (~1m 30s) | ~instant after connect | ~57s | invalid object Global.Kala | FAIL |

Closest success: Attempt A warehouse returned 4 rows in 7.79s after ~5 minutes of LLM. No column values were delivered to the client.

FAIL
================================

4. REQUESTED COLUMNS AND FOUR CENTERS
No finished grid, so columns and center names could not be asserted. Attempt A row_count=4 matches one top product per named center, but cells were not returned.

BLOCKED
================================

5. SQL FETCHER QUALITY
Generated SQL was not stable: one cheap 4-row query, one scan that hit the 60s ODBC command timeout, one multi-statement batch, one join to Global.Kala (not in the catalog). Execute errors abort the pipeline instead of looping back to SQL fetcher.

FAIL
================================

Summary result:

| test | result |
|------|--------|
| API HEALTH | PASS |
| GRID RUN COMPLETES WITH A RESULT PAYLOAD | FAIL |
| TIMING (WALL CLOCK) | FAIL |
| REQUESTED COLUMNS AND FOUR CENTERS | BLOCKED |
| SQL FETCHER QUALITY | FAIL |

Rate: 3
