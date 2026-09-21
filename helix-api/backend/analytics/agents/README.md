# Helix agents

Shared rules/skills/schema plus the LangGraph army: orchester, guardian, researcher, final-approver.

## Status

Agents are arranged in markdown + `helix.config.example.yaml` models. Runtime is LangGraph (`api/pipeline_langgraph.py`).

## Layout

| Path | Purpose |
|------|---------|
| `_shared/rules/` | Army-wide policies |
| `_shared/skills/` | Reusable playbooks |
| `_shared/schema/tables.md` | SQL allowlist |
| `orchester/` | Supervisor |
| `guardian/` | Safety + product-scope gate |
| `researcher/` | Warehouse SELECT + optional web |
| `final-approver/` | Validate + report + handoff |
| `registry.md` | Pipeline index |

## Pipeline

```text
orchester
  → guardian → researcher → final-approver → orchester (package) → frontend
```

`web-searcher` is a sub-agent tool for researcher, not a graph node.

## Models

Set `openrouter.agents.<id>.model` in `helix.config.example.yaml` / local `helix.config.yaml`.
