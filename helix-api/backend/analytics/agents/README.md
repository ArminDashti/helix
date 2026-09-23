# Helix agents

Shared schema plus the LangGraph army: orchester, guardian, researcher, final-approver.

## Status

Agents are defined in markdown and synced into the runtime store (`markdown-files/`) on boot. Runtime is LangGraph (`api/pipeline_langgraph.py`).

## Layout

| Path | Purpose |
|------|---------|
| `_shared/schema/tables.md` | Database reference docs (the live catalog comes from Settings) |
| `orchester/` | Supervisor: routing + payload packaging |
| `guardian/` | Safety and product-scope gate |
| `researcher/` | Live catalog + one bounded SELECT on the Settings database |
| `final-approver/` | Validate the fetch, write `text_report`, hand off |
| `web-searcher/` | Public web search sub-agent (disabled by default) |
| `registry.md` | Pipeline index |

## Contract: one rule and one skill per agent

Every agent declares exactly one rule and one skill, in its `AGENT.md` frontmatter and in the runtime assignment maps:

| Agent | Rule | Skill |
|-------|------|-------|
| `orchester` | `orchester` | `orchestrate-pipeline` |
| `guardian` | `guard-prompt` | `guard-prompt` |
| `researcher` | `database-sql` | `gather-data` |
| `final-approver` | `build-result` | `publish-result` |
| `web-searcher` (disabled) | `web-search-only` | `search-web` |

`markdown_store.agent_asset_issues()` reports any agent that drifts from that contract, and `api.tests` fails on it.

## Pipeline

```text
orchester
  → guardian → researcher → final-approver → orchester (package) → frontend
```

`web-searcher` is a sub-agent tool for researcher, not a graph node.

## Protocol

- Agent messages are JSON objects carried in pipeline state; each hop emits an SSE step event to the UI.
- Tools are exposed to the model as OpenAI-style function calls (`execute_select`, `ask_operator`, `submit_result`).
- The database target and its schema come from Settings, never from a hardcoded catalog.
- Keep rule and skill text short: it is concatenated into the agent's system prompt on every call.

## Models

Set `openrouter.agents.<id>.model` in `helix.config.example.yaml` / local `helix.config.yaml`. Never hardcode models in `AGENT.md`.
