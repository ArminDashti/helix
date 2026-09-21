---
name: Gather data
description: Write a cheap allowlisted SELECT and fetch preview rows
---

# Gather data

1. Read prompt + catalog + references.
2. Write one cheap SELECT with TOP/FETCH.
3. Call `execute_select`; on error, revise using `last_error`.
4. Set `goals` (user ask) and `what_was_done` (SQL intent + row outcome).
5. Optional `search_web` for public facts only.
6. Finish with JSON `{goals, what_was_done, message}` — no submit_result.
