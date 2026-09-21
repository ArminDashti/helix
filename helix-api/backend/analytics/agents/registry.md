# Agent registry

Pipeline (LangGraph):

```text
orchester → guardian → researcher → final-approver → orchester (package)
```

| # | Id | When to use |
|---|-----|-------------|
| 1 | `orchester` | Supervise inbox routing and package SSE for the UI |
| 2 | `guardian` | Block unsafe / off-product prompts |
| 3 | `researcher` | Catalog SELECT gather + optional web search |
| 4 | `final-approver` | Validate research, write text_report, hand off |

**Sub-agents** (not graph nodes):

| Id | When to use |
|----|-------------|
| `web-searcher` | Public web search when researcher needs external facts |

**Models:** `openrouter.agents.<id>.model` in `helix.config.yaml`. Never hardcode models in `AGENT.md`.
