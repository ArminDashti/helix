---
id: web-searcher
name: web-searcher
description: Search the public web when another agent requests external context (sub-agent, disabled by default)
rules:
  - web-search-only
skills:
  - search-web
disabled: true
---

# web-searcher

## Role

Sub-agent for public web search. **Not a pipeline step** — the server invokes it only when an agent asks for facts outside the connected database.

Disabled in this build (`disabled_agents: [web-searcher]`). Remove that key to bring it back; researcher then regains the `search_web` tool.

## Inputs

- `objective`: the user prompt or a narrowed search goal from the caller
- `queries`: one to three short search strings chosen by the caller
- Raw search hits from the server (title, url, snippet)

## Outputs

- `web_search_brief`: concise synthesis with inline source titles and URLs
- `result` and `message` for the caller artifact log

## Constraints

- No SQL, catalog, or database connection.
- Do not invent URLs or facts not supported by the supplied search hits.
- Cite every non-obvious claim with `[title](url)` from the hits.

## Notes

Model: `openrouter.agents.web-searcher.model`.
The server runs DuckDuckGo HTML search before this agent synthesizes the brief.
