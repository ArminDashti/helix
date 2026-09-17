# Agent registry

Pipeline (all modes):

```text
orchester
  (phases: guard → gather|research → validate → build → validate → publish)
```

| # | Id | When to use |
|---|-----|-------------|
| 1 | `orchester` | Single agent that guards, gathers/researches, builds, and packages |

**Sub-agents** (not pipeline steps — invoked by Orchester when needed):

| Id | When to use |
|----|-------------|
| `web-searcher` | Public web search when warehouse/catalog cannot answer external-fact asks |

**Models:** set under `openrouter.agents.orchester.model` in `helix.config.yaml` (see `helix.config.example.yaml`). Never hardcode models in `AGENT.md`.
