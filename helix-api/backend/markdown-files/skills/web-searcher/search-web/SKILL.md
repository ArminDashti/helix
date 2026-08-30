---
name: Search web
description: Synthesize public web search hits into a cited brief for the calling
  agent
---

# Search web

1. Read `objective`, `queries`, and the raw `web_search_hits` list (title, url, snippet per row).
2. Drop navigation noise; keep facts, names, numbers, and dates present in snippets.
3. Write `web_search_brief` that answers the objective using only those hits.
4. Cite inline as `[title](url)`; finish with a `Sources:` section listing each URL once.
5. Return JSON: `result` (`done` or `fail`), `message`, `web_search_brief`.
6. Do not request SQL, catalog objects, or warehouse fetches — hand off to the caller for warehouse work.
