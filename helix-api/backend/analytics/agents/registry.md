# Agent registry

Pipeline order (default modes):

```text
guardian
  → data-gatherer
  → validator
  → result-builder
  → validator
  → publisher
      (validator fail → data-gatherer or result-builder, limit 5)
```

Research mode (`mode=research`):

```text
guardian
  → researcher
      (per tier low/medium/high: data-gatherer → validator)
      → aggregates research_brief
  → result-builder
  → validator
  → publisher
```

| # | Id | When to use |
|---|-----|-------------|
| 1 | `guardian` | Block dangerous prompts and check permission |
| 2 | `data-gatherer` | Cheap SELECT + fetch (row-capped) |
| 3 | `researcher` | Research mode: tiered gather/validate and aggregate brief |
| 4 | `validator` | Does the fetch or built result match the user prompt? |
| 5 | `result-builder` | Report from fetched rows (+ research brief in research mode) |
| 6 | `publisher` | Package UI payload |

**Sub-agents** (not pipeline steps — invoked by callers when needed):

| Id | When to use |
|----|-------------|
| `web-searcher` | Public web search when warehouse/catalog cannot answer external-fact asks (invoked by `data-gatherer` or `researcher`) |

**Models:** set per agent under `openrouter.agents.<id>.model` in `helix.config.yaml` (see `helix.config.example.yaml`). Never hardcode models in `AGENT.md`.
