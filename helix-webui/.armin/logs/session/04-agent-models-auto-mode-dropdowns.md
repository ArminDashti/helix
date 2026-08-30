# Agent models Auto, mode dropdowns

- Agent: Composer
- Date: 2026-08-16
- Time: 13:40:00
- Device: PC-ARMIN
- Skills: transform-human-prompt-to-agent-understanding / accept-reject-human-prompt / log-human-prompt / teach-human-technical-in-response / dictionary-by-armin / suggest-for-improving / report-to-human-in-end-of-response / log-session
- Rules: always-run-prompt-gate-skills / always-teach-human-technical-in-response / always-dictionary-by-armin / always-simplify-plan-by-armin / user-pass-default

## Transcript

### User

1. by default all models for all agents must be Auto
2. Delete /html/body/div/div/nav/button
3. All dropdown in all pages must be sorted by A-Z
4. Mode must be
Build chart -> Chart
Grid ->
Research -> low-medium-high
Language

### Agent

Set default LLM model to Auto for every agent (API defaults, example config, live config, Settings UI). Removed the sidebar Menu collapse button. Sorted dropdowns A–Z, except Research depth which stays Low → Medium → High. Analysis Mode is Chart, Grid, Research, with Language as its own field.
