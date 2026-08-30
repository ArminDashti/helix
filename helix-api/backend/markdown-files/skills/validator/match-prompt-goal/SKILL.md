---
name: Match prompt goal
description: Check whether upstream goals match what_was_done before the next pipeline
  step
---

# Match prompt goal

1. Read `validation_handoff` from run context: `goals`, `what_was_done`, and `agent_id`.
2. Evaluate **only** whether `what_was_done` fulfills `goals`. Do not re-judge the user prompt independently.

## Pass

3. Set `result` to `pass` when every goal is clearly satisfied by what_was_done.
4. Use sql_fetch preview and draft_payload (second visit) only to verify claims in what_was_done — not to invent new requirements.

## Fail

5. Set `result` to `fail` when goals and what_was_done mismatch, or when what_was_done is vague or unsupported.
6. List specific gaps between goals and what_was_done (missing filter, wrong grain, invented numbers, mode artifact missing).
7. First visit failure returns work to `data-gatherer`. Second visit failure returns work to `result-builder`.

8. When validation_handoff is missing either field, fail immediately and say upstream must supply both.
9. Do not rewrite SQL or the report here.
