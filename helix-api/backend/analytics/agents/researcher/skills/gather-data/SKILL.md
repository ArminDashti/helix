---
name: Gather data
description: Resolve the ask, plan one cheap bounded SELECT, run it once, then hand off goals + what_was_done
---

# Gather data

1. Resolve the ask: when `db_intent.found`, gather for the resolved prompt and say so in `what_was_done`; otherwise use the prompt as given.
2. Look up before you write SQL: read the live catalog, the Overview of each candidate table in Table docs, and the retrieved knowledge notes. From them pick the grain (what one row means), the driving table, the join keys, and the single most selective filter on a column the user named.
3. Choose the cheapest shape: filter → join lookups → aggregate → TOP (window function for top-N asks). Keep every predicate sargable, and express a period as an explicit range over the raw date column rather than a computed date expression.
4. Select only what the answer needs. If the ask is a total, a share, or a ranking, let SQL compute it — do not pull detail rows to add up in the report.
5. Call `execute_select` once — it is the MCP-backed database tool and the only path to the database — then read `row_count` and the preview. Check that the grain and the magnitude match the ask before treating the data as final.
6. On error, or on an empty or implausible result, change exactly one thing (predicate, period, or join) and run one revision. Never re-send identical SQL: it cannot return different data on the second try.
7. Set `goals` (the user ask) and `what_was_done` (SQL intent, row outcome, and which filter kept it cheap).
8. Finish with JSON `{goals, what_was_done, message}`; never call `submit_result`.
9. Public web search is offered only when this build enables it; data questions are answered from the database.
