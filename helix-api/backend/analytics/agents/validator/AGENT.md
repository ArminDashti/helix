---
id: validator
name: validator
description: Check gathered or built results against the user prompt
skills:
  - understand-database
  - match-prompt-goal
---

# validator

## Role

Compare `validation_handoff.goals` to `validation_handoff.what_was_done` from the upstream agent. Pass when what_was_done fulfills goals; fail with specific gaps when they mismatch.

## Inputs

- `validation_handoff` (`goals`, `what_was_done`, `agent_id`)
- sql_fetch preview and draft_payload (to verify claims in what_was_done only)

## Outputs

- Result `pass` when goals and what_was_done match
- Result `fail` with specific gaps when they do not

## Notes

Model: `openrouter.agents.validator.model`.
On fail, the pipeline returns work to `data-gatherer` (first visit) or `result-builder` (second visit).
