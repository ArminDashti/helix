# Helix agents

This directory holds the **agent army**: shared rules/skills/schema plus one folder per pipeline agent.

## Status

Agents are **arranged and executed** (Markdown + `helix.config.example.yaml` models). Runtime prompts use assigned rules and skills only — not instruction files.

## Layout

| Path | Purpose |
|------|---------|
| `_shared/rules/` | Army-wide policies: core-behavior, output-contract |
| `_shared/skills/` | Reusable playbooks (`SKILL.md`) |
| `_shared/schema/tables.md` | SQL allowlist + descriptions |
| `<agent_id>/AGENT.md` | Identity, role, skills list (no model — models live in config) |
| `<agent_id>/rules/` | Agent-specific rules |
| `<agent_id>/skills/` | Agent-specific skills |
| `registry.md` | Pipeline index |

## Seed pipeline

Default:

```text
guardian → data-gatherer → validator → result-builder → validator → publisher
```

Research mode:

```text
guardian → researcher → result-builder → validator → publisher
```

Researcher runs `data-gatherer → validator` for each of `low`, `medium`, and `high`, aggregates a brief, then hands off to `result-builder`. When the prompt needs public web facts, Python invokes `web-searcher` at research start (researcher probe) and per tier when `data-gatherer` requests it.

## Adding an agent

1. Create `agents/<agent_id>/` with `AGENT.md`.
2. Add optional `rules/` and `skills/`.
3. Register in `registry.md`.
4. Add `openrouter.agents.<agent_id>.model` in `helix.config.example.yaml` / your local `helix.config.yaml`.

Sub-agents (e.g. `web-searcher`) live under `agents/<agent_id>/` but are **not** pipeline graph nodes. Python invokes them when a caller agent requests external context.

See [registry.md](registry.md) for the current six-step pipeline.
