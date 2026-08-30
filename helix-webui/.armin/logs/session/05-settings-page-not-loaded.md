# Settings page not loaded

| Field | Value |
|-------|-------|
| Agent | `Auto` |
| Date | `2026-08-16` |
| Time | `14:32:00` |
| Device | `PC-ARMIN` |

## Skills

`transform-human-prompt-to-agent-understanding` / `accept-reject-human-prompt` / `log-human-prompt` / `webui-debug-functionality` / `request-preflight` / `teach-human-technical-in-response` / `dictionary-by-armin` / `suggest-for-improving` / `report-to-human-in-end-of-response` / `log-session`

## Rules

`user-pass-default` / prompt-gate / teach / dictionary / report / simplify-plan (omitted)

---

## Transcript

### User

The settings page isn't loaded

### Agent

The settings route crashed on render because `useApiStatus()` was called without an import. That produced a Vite overlay (`useApiStatus is not defined`) and a blank page. The import from `ApiStatusContext` was added, and the load effect now always clears the loading flag in `finally`. Refresh the settings URL if hot reload left the old overlay.
