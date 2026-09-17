# Helix agents

This directory holds the **agent army**: shared rules/skills/schema plus Orchester and internal phase folders.

## Status

Agents are **arranged and executed** (Markdown + `helix.config.example.yaml` models). Runtime prompts use assigned rules and skills only — not instruction files.

## Layout

| Path | Purpose |
|------|---------|
| `_shared/rules/` | Army-wide policies: core-behavior, output-contract |
| `_shared/skills/` | Reusable playbooks (`SKILL.md`) |
| `_shared/schema/tables.md` | SQL allowlist + descriptions |
| `orchester/AGENT.md` | Single pipeline agent identity |
| `<phase>/rules/` / `<phase>/skills/` | Internal phase prompts (guardian, data-gatherer, …) |
| `registry.md` | Pipeline index |

## Seed pipeline

```text
orchester
  (phases: guard → gather|research → validate → build → validate → publish)
```

Research mode uses the same Orchester node; the research phase runs tiered gather/validate internally.

## Models

Set `openrouter.agents.orchester.model` in `helix.config.example.yaml` / your local `helix.config.yaml`.

Sub-agent `web-searcher` is not a graph node. Python invokes it when a gather/research phase requests external context.

See [registry.md](registry.md).
