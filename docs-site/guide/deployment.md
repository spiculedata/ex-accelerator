# Deployment

The repository ships a Docker Compose file that runs the whole platform. This page covers running
it on a server you control. For a local try-out, see [Getting started](/guide/getting-started).

## Services

| Service | Image / build | Purpose | Needed for the core app |
|---------|---------------|---------|-------------------------|
| `postgres` | `pgduckdb/pgduckdb:17-main` | Analytics database (PostgreSQL with `pg_duckdb`) | Yes |
| `redis` | `redis:7-alpine` | Dapr state store and pub/sub | Yes |
| `dapr-placement` | `daprio/dapr` | Dapr placement service | Yes |
| `ui`, `ui-dapr` | built from `ex-accell-ui/` | Web app and its Dapr sidecar | Yes |
| `ollama` | `ollama/ollama` | Local LLM for AI-assisted features | No |
| `jupyter` | built from `jupyter/` | Research notebooks | No |
| `wavepulse` | built from `wavepulse/` | Radio recording and transcription | No |
| `crawler` | built from `crawler/` | Social media crawler | No |
| `etl`, `image-worker` | built from `etl/` | Data pipelines (`etl` runs under the `etl` profile) | No |

Start only what you need by naming services:

```bash
docker compose up -d --build postgres redis dapr-placement ui ui-dapr
```

## Configuration

Copy `.env.example` to `.env` and set at least:

| Variable | Notes |
|----------|-------|
| `SESSION_SECRET` | Required. 32 or more random characters (`openssl rand -hex 32`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Creates the first admin while the user table is empty. Password: 12+ characters |
| `POSTGRES_PASSWORD` | Change from the example value |
| `COOKIE_SECURE` | Set to `true` whenever the site is served over HTTPS |
| `DATA_DIR` | Where bind-mounted data lives (default `/data` when unset) |

See [Configuration](/guide/configuration) for every variable the application reads.

## HTTPS and reverse proxies

The web app speaks plain HTTP on port 3000. Put a reverse proxy (Caddy, nginx, Traefik) in front of
it to terminate TLS, and set `COOKIE_SECURE=true`. Behind a proxy, set SvelteKit's
`ADDRESS_HEADER` (for example `X-Forwarded-For`) and `XFF_DEPTH` so the login throttle sees real
client addresses instead of the proxy's.

Do not publish the Postgres, Redis, Ollama or Jupyter ports to the internet. The compose file maps
them to the host for convenience; bind them to `127.0.0.1` or remove the mappings on a server.

## Backups

Postgres is the only service whose data you cannot recreate. Take regular dumps:

```bash
docker compose exec -T postgres pg_dump -U postgres analytics | gzip > analytics-$(date +%F).sql.gz
```

Also back up `DATA_DIR` if you use the optional services (recordings, models, notebooks).

## Updating

```bash
git pull
docker compose build ui
docker compose up -d --no-deps ui ui-dapr
```

Read the release notes first; the project is pre-1.0 and the schema may change between versions.

## Maintainers: the deploy workflow

`.github/workflows/deploy.yml` builds and pushes images to a container registry and restarts the UI
over SSH. It is manual (`workflow_dispatch`) until the target server has the auth variables above
and the `production` environment has required reviewers.
