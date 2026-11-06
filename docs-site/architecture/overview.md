# Architecture overview

ex-accelerator is a monorepo of cooperating services around one PostgreSQL database.

```
            ┌────────────┐      ┌──────────────────────────┐
 Browser ──▶│  Web app   │─────▶│ PostgreSQL + pg_duckdb   │◀── ETL pipelines (Python)
            │ (SvelteKit)│      │ (analytics tables/views) │◀── Radio service (WavePulse)
            └─────┬──────┘      └──────────────────────────┘
                  │ Dapr
        ┌─────────┴──────────┐
        │ Redis (state/pubsub)│── Crawler (Go: Telegram, YouTube)
        └────────────────────┘
```

## Components

| Directory | Role |
|-----------|------|
| `ex-accell-ui/` | SvelteKit 2 / Svelte 5 web app and its API routes (TypeScript, Tailwind CSS 4) |
| PostgreSQL + `pg_duckdb` | Single analytics database. Queries run through DuckDB's engine on PostgreSQL tables |
| `etl/` | Python pipelines that load datasets such as GDELT into the database |
| `crawler/` | Go service that crawls Telegram and YouTube, scheduled through Dapr jobs |
| `wavepulse/` | Radio recording and transcription service, derived from NYU's [WavePulse](https://github.com/NYU-DICE-Lab/WavePulse) |
| `jupyter/` | Jupyter Lab environment for research notebooks |
| `deploy/`, `docker-compose.yml` | Dapr component definitions and the full-stack compose file |

## Web app

- **Server code** lives under `src/lib/server/` (authentication, query error handling) and
  `src/routes/api/` (HTTP endpoints). `src/hooks.server.ts` authenticates and authorises every
  request before routes run.
- **Analytics API.** `/api/unified-analytics?type=...` serves dashboards from the analytics database.
  A missing table returns empty data flagged `meta.unavailable` so unused modules stay quiet;
  real failures return `500`.
- **Workflows.** The workflow builder generates Python Dapr workflows that admins can deploy and run.

## Data model in brief

Posts from every platform land in shared tables that analytics modules (sentiment, topics,
language, engagement) build on, plus views that join them for cross-module analysis.

::: info More detail
This overview is a starting point. Deeper pages on the data model, the crawler and the workflow
engine are planned.
:::
