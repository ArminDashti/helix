# Helix Web UI

React + Vite frontend for Helix — LLM-powered data analysis and charting.

Companion API: [helix-api](https://github.com/ArminDashti/helix-api).

## Run locally

Start the API first (see helix-api README), then:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173 — Vite proxies `/api` to Django at `127.0.0.1:8000`.

Optional: copy `.env.example` to `.env` and set `VITE_API_BASE_URL` for an absolute API base URL.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Analysis — prompt + mode, Run |
| `/results` | Analysis result history (show, export, delete) |
| `/logs` | Failure and error history (show, delete) |
| `/rules` | Rules list and editor |
| `/skills` | Skills list and editor |
| `/agents` | Agent list, Arrange stages (one IF per stage), Graph |
| `/docs` | Table column docs (sql-description and description) |
| `/results` | Analysis result history (show, export, delete) |
| `/settings` | SQL Server + single LLM API (OpenRouter or OpenAI-compatible), base URL, API key, and models |
| `/admin` | Company users & access policies |
| `/about-me` | About page |

## Admin guide PDF (Persian)

Persian admin documentation is shipped at `public/docs/fa/helix-admin-guide.pdf`. Source: `docs/guide/fa/admin-guide.html`. Regenerate after editing the guide:

```bash
npm install
npx playwright install chromium   # once per machine
npm run build:admin-guide-pdf
```

Download from **Settings → General** or **Admin** in the Web UI.
