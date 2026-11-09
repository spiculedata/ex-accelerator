# Getting started

This page gets the web app running locally for development or evaluation.

::: tip What you need
- **Node 22**
- **Docker** (for PostgreSQL with the `pg_duckdb` extension)
- `git`
:::

## 1. Get the code and install

```bash
git clone https://github.com/spiculedata/social-explorer.git
cd social-explorer/ex-accell-ui
npm ci
cp .env.example .env
```

## 2. Start the database

The app needs PostgreSQL with the [`pg_duckdb`](https://github.com/duckdb/pg_duckdb) extension. The
project's compose file uses the `pgduckdb/pgduckdb:17-main` image, which you can run on its own:

```bash
docker run -d --name ex-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=changeme -e POSTGRES_DB=analytics \
  pgduckdb/pgduckdb:17-main
```

A plain PostgreSQL image will not work: the app enables `pg_duckdb` when it connects.

## 3. Configure the first admin

Add these to `.env` (see [Configuration](./configuration) for everything else):

```bash
POSTGRES_PASSWORD=changeme
POSTGRES_DB=analytics
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=choose-at-least-12-characters
```

The admin account is created on first use, when the users table is empty. After that you can
remove `ADMIN_PASSWORD` from your environment.

## 4. Run it

For development:

```bash
npm run dev
```

Open `http://localhost:5173` and sign in with the admin credentials.

For a production-style run:

```bash
npm run build
SESSION_SECRET=$(openssl rand -hex 32) \
ORIGIN=http://localhost:3000 PORT=3000 \
node build
```

`SESSION_SECRET` is **required** in production. `ORIGIN` must match the URL users visit.

::: tip Safari and plain HTTP
Production mode marks the session cookie `Secure`. Chrome and Firefox accept that on
`http://localhost`, but Safari does not. For a local production-style run in Safari, add
`COOKIE_SECURE=false`.
:::

## Full stack

`docker-compose.yml` at the repository root also defines Redis, Dapr sidecars, the crawler, ETL,
Jupyter, the WavePulse radio service and an Ollama container for local models. It requires
`SESSION_SECRET` to be set. A step-by-step guide for the full stack is still being written; follow
[issue #60](https://github.com/spiculedata/social-explorer/issues/60) for progress.

## Next steps

- [Configuration](./configuration)
- [Authentication and roles](./authentication)
- [Architecture overview](../architecture/overview)
