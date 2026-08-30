---
name: Publish result
description: Final check and handoff for UI payload packaging
---

# Publish result

1. Read mode, language, `sql_fetch`, and `text_report`.
2. Confirm the draft matches mode requirements.
3. Confirm result language: if the user prompt is Persian (Farsi) or run `language` is `fa`, `text_report` (and the final user-visible message when present) must be Persian; otherwise English when `language` is `en`. Do not fail on intermediate briefs or SQL language.
4. Set `result` to `done` when ready for server packaging, or `fail` with gaps.
5. The server emits `{ text_report, grid, echarts_option }` from the same fetch.
