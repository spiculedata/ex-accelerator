# CLAUDE.md

Guidance for Claude Code (and humans) working in `ex-accell-ui/`, the web app of the
ex-accelerator monorepo. See the root `README.md` and `CONTRIBUTING.md` for the wider project.

## Stack

- SvelteKit 2 / Svelte 5 / TypeScript, built with Vite 7, served with `@sveltejs/adapter-node`
- Tailwind CSS 4 (via `@tailwindcss/vite`/`postcss`; there is no `tailwind.config.*`)
- PostgreSQL with the `pg_duckdb` extension for all data; Redis and Dapr for state, pub/sub and jobs
- Tests: Vitest (unit, `src/**/*.test.ts`) and Playwright (e2e, `tests/pages/`)
- Node 22, npm

## Commands

```bash
npm ci                    # install
npm run dev               # dev server on :5173 (needs Postgres + pg_duckdb, see below)
npm run build             # production build
npm run check             # svelte-check (has pre-existing type errors; do not add new ones)
npm run test:unit         # Vitest
npm run test:e2e          # Playwright (needs `npx playwright install chromium`)
npm run dev:dapr          # dev server plus Dapr sidecars from dapr.yaml
```

Local database for development:

```bash
docker run -d --name pgduckdb -p 5432:5432 -e POSTGRES_PASSWORD=changeme \
  -e POSTGRES_DB=analytics pgduckdb/pgduckdb:17-main
```

Plain Postgres will not work: the pool requires `pg_duckdb`. Copy `.env.example` to `.env` and
set `DATABASE_URL`, `SESSION_SECRET` (32+ chars) and, for the first login, `ADMIN_EMAIL` and
`ADMIN_PASSWORD` (12+ chars).

## Layout

- `src/routes/` pages and `src/routes/api/**/+server.ts` endpoints
- `src/hooks.server.ts` authenticates and authorises every request before routes run
- `src/lib/server/` server-only code: `auth/` (passwords, sessions, access guard, login throttle,
  user repository) and `queryErrors.ts`
- `src/lib/services/` data access and integrations (Postgres pool, per-module `*Db.ts`, Dapr
  clients, workflow generators/executors)
- `src/lib/utils/` pure helpers (`pathSafety.ts`, `highlight.ts`)
- `src/lib/components/`, `src/lib/stores/`, `src/lib/composables/` UI
- `sql/` schemas and migrations; `deploy/components/` (repo root) holds Dapr components for compose

## Data access

- Server code uses `postgresPool` from `src/lib/services/postgres.ts` (`query`, `duckdbQuery`).
  Always use parameterised queries; never interpolate request values into SQL.
- `src/lib/services/duckdb.ts` and the `*Db.ts` services are **browser-side clients** that call
  `/api/unified-analytics?type=...`. The name is historical; there is no DuckDB file database.
- Analytics endpoint policy: a missing table (Postgres `42P01`) returns HTTP 200 with empty data and
  `meta.unavailable`; any other failure returns a generic 500 and logs the detail server-side. Use
  `queryErrorResponse` from `src/lib/server/queryErrors.ts`. Never swallow errors into `[]`.
- API responses use the envelope `{ success, data, error }`.

## Security rules

- Every `/api/*` route requires a session unless listed as public in `src/lib/server/auth/guard.ts`.
  Code-execution endpoints (workflow deploy/generate/execute, Jupyter) are admin-only; viewers are
  read-only. Add new sensitive routes to the guard's admin patterns and update its tests.
- Validate identifiers that become file paths or process arguments with `assertSafeIdentifier` and
  `resolveWithin` (`src/lib/utils/pathSafety.ts`). Spawn processes with `execFile`/`spawn` and an
  argument array, never a shell string.
- Escape before using `{@html}`; use `highlightKeywords` for highlighted text.
- SvelteKit's `error()` **throws**. Validate input before a `try` block or the 4xx becomes a 500.
- Do not log or commit secrets. `.mcp.json`, `.claude/` and `.env` are intentionally untracked.

## Testing and workflow

- Write the test first (red), then the implementation (green), then refactor.
- Mocking `fs/promises` or `child_process` in Vitest needs `vi.hoisted` and a partial mock via
  `importOriginal`; see existing `*.test.ts` files for the pattern.
- E2E tests authenticate through `tests/global-setup.ts`, which mints a signed session cookie, so
  they need no database login.
- Commits use `type: description` (feat, fix, refactor, docs, test, chore, perf, ci).
- Run `npm run test:unit`, `npm run build` and `npm run check` (no new errors) before opening a PR.

## Styling

Use Tailwind utility classes. Avoid new `<style>` blocks and inline `style=` attributes unless a
library requires them (two legacy `<style>` blocks remain in `routes/gdelt` and
`routes/android-research`).

## Dapr and the crawler

- `dapr.yaml` runs the UI (app id `ex-accell-ui`, sidecar HTTP 3500) alongside the crawler
  (app id `telegram-scraper`, gRPC 6481) for local multi-app development. Adjust the crawler's
  `appDirPath` for your machine.
- Crawl jobs are scheduled through the Dapr Jobs API from `/api/jobs`. The job payload's `value`
  is `platform:jsonConfig`, for example `telegram:{"urls":["@channel"],"crawlId":"x","maxPosts":1000}`.
  Job state lives in the Redis state store (`/api/job-state`).
- Components are in `components/` for local runs and `../deploy/components/` for compose.

## Jupyter

Notebook templates live in `notebooks/` and are listed in
`src/routes/text-analytics/research-investigation/+page.svelte`. Bootstrap with
`npm run jupyter:bootstrap` (Poetry, Python 3.12+); `npm run dev:jupyter` starts both servers.
Adding a template means adding the `.ipynb` file and an entry to the `notebookTemplates` array.
