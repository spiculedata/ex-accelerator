# Contributing to Social Explorer

Thanks for helping out! This guide covers setup, conventions and the pull request process.
By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Repository layout

| Path | What it is |
|------|------------|
| `ex-accell-ui/` | Main web app (SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS 4) |
| `etl/` | Python ETL pipelines into PostgreSQL |
| `jupyter/` | Jupyter research environment |
| `wavepulse/` | Radio ingestion/transcription service, derived from [NYU-DICE-Lab/WavePulse](https://github.com/NYU-DICE-Lab/WavePulse) (see its `NOTICE`) |
| `deploy/`, `docker-compose.yml` | Dapr components and the full-stack compose file |

## Development setup (web app)

You need **Node 22**, **Docker**, and (for browser tests) Playwright's Chromium.

```bash
cd ex-accell-ui
npm ci
cp .env.example .env
```

Start a database. The app requires PostgreSQL with the `pg_duckdb` extension:

```bash
docker run -d --name ex-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=changeme -e POSTGRES_DB=analytics \
  pgduckdb/pgduckdb:17-main
```

Edit `.env` so the database settings match, and add authentication settings:

```bash
SESSION_SECRET=$(openssl rand -hex 32)   # optional in dev (an ephemeral one is generated)
ADMIN_EMAIL=you@example.com               # first-run admin, created when the users table is empty
ADMIN_PASSWORD='at-least-12-characters'
```

Then `npm run dev` and sign in at <http://localhost:5173>.

## Checks to run before opening a PR

```bash
npm run check          # svelte-check (note: some pre-existing errors; don't add new ones)
npm run test:unit      # Vitest
npm run build
npm run test:e2e       # Playwright; first run: npx playwright install chromium
```

## Dependency overrides

`ex-accell-ui/package.json` pins two nested dependencies through npm `overrides`, because the
packages that pull them in have not released fixes:

- `image-size`: reached via `helia` → `react-native` → `metro`, which never runs in this app.
- `qs`: reached via `express` under `@dapr/dapr`, whose HTTP server the app does not use.

Re-check both after upgrading `helia` or `@dapr/dapr`, and drop an override once the parent
requires a fixed version. CI runs `npm audit --omit=dev --audit-level=high` weekly and when
dependencies change.

## Conventions

- **Tests first.** Write a failing test, make it pass, then refactor. New behaviour needs tests;
  bug fixes need a regression test.
- **Commits:** `type: description` where type is one of `feat`, `fix`, `refactor`, `docs`, `test`,
  `chore`, `perf`, `ci`. Keep the subject short; use the body for the why.
- **Styling:** Tailwind utility classes only. No `<style>` blocks or inline styles.
- **Immutability:** prefer returning new objects over mutating inputs.
- **Size:** keep functions small and files under ~800 lines.
- **No `console.log`** in production code; use `createLogger` from `$lib/utils/logger`.
- **Errors:** handle them explicitly. Never return a success response for a failed operation.
- **API responses:** `{ success, data, error }` envelope.
- **Server-only code** goes under `src/lib/server/`.
- **Security:** validate input at boundaries, use parameterised SQL, never build shell commands from
  user input (use `execFile`/`spawn` with argument arrays), and never commit secrets.

## Pull requests

1. Fork and branch from `main` (`feat/...`, `fix/...`).
2. Keep PRs focused; link the issue (`Refs #123`).
3. Describe what changed, why, and how you tested it. Include screenshots for UI changes.
4. All CI checks must pass.

## Licensing

Social Explorer is licensed under the [Apache License 2.0](LICENSE). By submitting a contribution
you agree it is licensed under the same terms (section 5 of the license). Files under `wavepulse/`
derive from third-party work; keep their copyright headers and modification notices intact.

## Reporting security issues

Please do **not** open a public issue. See [SECURITY.md](SECURITY.md).
