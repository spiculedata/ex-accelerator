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

Running `docker compose up -d` with no service names starts everything except `etl`, including
Ollama, Jupyter, WavePulse and the image worker.

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
it to terminate TLS, and set `COOKIE_SECURE=true`.

Behind a proxy, set SvelteKit's `ADDRESS_HEADER` (for example `X-Forwarded-For`) and `XFF_DEPTH` in
`.env` so the login throttle sees real client addresses instead of the proxy's. Only do this when
port 3000 is reachable **only** through the proxy (change the `ui` port mapping to
`127.0.0.1:3000:3000`). Otherwise a client can send its own `X-Forwarded-For` header and pick the
address the throttle sees.

Without `ADDRESS_HEADER` behind a proxy, every request appears to come from the proxy, so the
per-address login limit (20 failed sign-ins per 15 minutes) applies to the **whole site**: that many
failures from anyone locks everyone out for a while. The app logs a warning at startup when it is
running in production without `ADDRESS_HEADER`.

The app adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`
headers to its responses, and `Strict-Transport-Security` (180 days, including subdomains) when
`COOKIE_SECURE=true`. Static files under `/_app/` are served before the app's hooks run, so have your
proxy add `X-Content-Type-Options: nosniff` for them too. Only enable HTTPS-only cookies on a host
whose subdomains are all served over HTTPS, because browsers will remember the HSTS policy.

The Jupyter container runs as an unprivileged user (uid and gid 1000), not as root, so the folder it mounts
(`$DATA_DIR/notebooks`, `/data/notebooks` by default) must be writable by that user:
`sudo mkdir -p /data/notebooks && sudo chown -R 1000:1000 /data/notebooks`. If you ran an earlier, root-owned image, run the
`chown` on the existing folder before upgrading; otherwise the container stops and says so.

Do not publish the Postgres, Redis, Ollama or Jupyter ports to the internet. The compose file maps
them to the host for convenience; bind them to `127.0.0.1` or remove the mappings on a server.

## Backups

Postgres is the only service whose data you cannot recreate. Take regular dumps:

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > analytics-$(date +%F).sql.gz
```

Restore into an empty database with
`gunzip -c analytics-YYYY-MM-DD.sql.gz | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'`.

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
