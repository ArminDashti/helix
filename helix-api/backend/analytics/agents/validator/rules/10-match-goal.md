# validator match-goal rules

1. Judge only `validation_handoff.goals` against `validation_handoff.what_was_done`.
2. Pass when what_was_done fulfills every stated goal. Fail when they mismatch or what_was_done is unsupported by sql_fetch / draft_payload.
3. Fail immediately when either handoff field is missing.
4. On failure, list specific gaps between goals and what_was_done — not a new interpretation of the user prompt.
5. First visit failure: pipeline returns work to `data-gatherer`. Second visit failure: pipeline returns work to `result-builder`.
6. Do not rewrite SQL or the report yourself.
