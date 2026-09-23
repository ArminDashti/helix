# Agent registry

Pipeline (LangGraph):

```text
orchester → guardian → researcher → final-approver → orchester (package)
```

| # | Id | Rule | Skill | When to use |
|---|-----|------|-------|-------------|
| 1 | `orchester` | `orchester` | `orchestrate-pipeline` | Route the run, package SSE for the UI |
| 2 | `guardian` | `guard-prompt` | `guard-prompt` | Block unsafe / off-product prompts |
| 3 | `researcher` | `database-sql` | `gather-data` | Live catalog SELECT against the Settings database |
| 4 | `final-approver` | `build-result` | `publish-result` | Validate the fetch, write `text_report`, hand off |

**Sub-agents** (not graph nodes):

| Id | Rule | Skill | When to use |
|----|------|-------|-------------|
| `web-searcher` | `web-search-only` | `search-web` | Public web search — **disabled by default** (`disabled_agents: [web-searcher]`) |

One rule and one skill per agent; nothing else is assigned.

**Models:** `openrouter.agents.<id>.model` in `helix.config.yaml`. Never hardcode models in `AGENT.md`.
