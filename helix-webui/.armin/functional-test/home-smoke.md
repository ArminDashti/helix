Date: 2026-08-08
Time: 10:58
Agent: webui-test-functionality (smoke)
Page: Home / Pipeline run
page-path: http://127.0.0.1:5173/

1. START SERVERS
Restored deleted/corrupted sources wiped by auto-sync (2026-08-07), started Django on :8000 and Vite on :5173.

PASS
================================

2. HOME PAGE LOAD
Opened Home; prompt + mode + Run/Preview demo visible.

PASS
================================

3. NAV PAGES
Instructions, Rules, Skills load agent content from API.

PASS
================================

4. PREVIEW DEMO
Clicked Preview demo → /run shows pipeline flowchart + live log “Local demo preview (no stream).”

PASS
================================

5. API SMOKE
GET /api/agents/, /api/rules/, /api/skills/, /api/admin/openrouter/, /api/admin/database/ → 200 after fixing corrupt technical_architect.md.

PASS
================================

Summary result:

| test | result |
|------|--------|
| START SERVERS | PASS |
| HOME PAGE LOAD | PASS |
| NAV PAGES | PASS |
| PREVIEW DEMO | PASS |
| API SMOKE | PASS |

Rate: 8
