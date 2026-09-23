# Database catalog

The analysis target is the database configured in **Settings** (engine, host, database, credentials). Its schema is introspected at run time and injected into every agent prompt as **Live catalog** — that is the authoritative object and column list for any SELECT.

Never invent tables, views, or columns. Prefer the live catalog over anything written here.

## Query speed

- Filter the driving / fact table first with sargable predicates on keys the user named.
- Bound every SELECT with `TOP`, `FETCH`, or `LIMIT` unless config allows otherwise.
- Join lookup tables only for display columns; resolve names to ids on small lookups.
- Default to a recent time window when the user did not ask for all history.
- Rankings: filter, aggregate, window rank, keep the top row per group, outer bound.

## Catalog

Document your own objects below as sections named exactly `schema.table`. A documented section is kept in the prompt only while that object exists in the connected database, so this file stays valid across engines and databases.
