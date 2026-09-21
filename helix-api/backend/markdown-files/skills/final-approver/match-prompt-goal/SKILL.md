---
name: Match prompt goal
description: Compare goals vs what_was_done before approving the report
---

# Match prompt goal

1. Read goals and what_was_done.
2. Use sql_fetch preview only to verify numeric claims.
3. PASS when what_was_done fulfills goals.
4. FAIL with a short gap list when it does not.
