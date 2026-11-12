#!/usr/bin/env bash
# One-command demo: starts a throwaway PostgreSQL + pg_duckdb container, loads the synthetic demo
# dataset and runs the app on http://localhost:5173, bound to this machine only.
#
#   npm run demo            start (or resume) the demo
#   npm run demo -- --stop  stop the demo database
#   npm run demo -- --reset delete the demo database and sign-in, then exit (run npm run demo to start fresh)
#   npm run demo -- --help  show this help
#
# Nothing here writes your .env or touches any database other than the demo container. The database
# settings it exports take precedence over any in your .env; other settings there still apply.
set -euo pipefail

cd "$(dirname "$0")/.."

CONTAINER="${DEMO_DB_CONTAINER:-social-explorer-demo-db}"
PORT="${DEMO_DB_PORT:-55432}"
# Pinned to the multi-arch index digest of 17-main (verified with `docker buildx imagetools inspect`)
IMAGE="pgduckdb/pgduckdb:17-main@sha256:c1c6ae663570deacca7da929d562f2a41da339e1afbabc7e0f1f417c877c25ea"
DB="analytics"
APP_PORT="${DEMO_APP_PORT:-5173}"
STATE_DIR=".demo"
ADMIN_EMAIL="demo@example.com"

LABEL="social-explorer.demo=1"
exists() { docker container inspect "$CONTAINER" >/dev/null 2>&1; }
# Only ever touch a container this script created, whatever DEMO_DB_CONTAINER says
guard() {
  exists || return 0
  [ "$(docker container inspect -f '{{index .Config.Labels "social-explorer.demo"}}' "$CONTAINER")" = "1" ] || {
    echo "Container $CONTAINER exists but was not created by this demo, so it is left alone. Set DEMO_DB_CONTAINER to another name." >&2
    exit 1
  }
}
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1: $2" >&2; exit 1; }; }

case "${1:-}" in
  "") ;;
  --help|-h)
    cat <<'HELP'
Social Explorer one-command demo

  npm run demo            start (or resume) the demo on http://localhost:5173
  npm run demo -- --stop  stop the demo database, keeping its data
  npm run demo -- --reset delete the demo database and sign-in, then exit
  npm run demo -- --help  show this help

Environment: DEMO_DB_PORT (55432), DEMO_APP_PORT (5173), DEMO_DB_CONTAINER (social-explorer-demo-db).
HELP
    exit 0
    ;;
  --stop)
    guard
    docker stop "$CONTAINER" >/dev/null 2>&1 && echo "Stopped $CONTAINER (data kept; run npm run demo to resume)." || echo "$CONTAINER is not running."
    exit 0
    ;;
  --reset)
    guard
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    rm -rf "$STATE_DIR"
    echo "Demo database and sign-in removed. Run npm run demo to start fresh."
    echo "To reclaim the disk space of the image as well: docker rmi $IMAGE"
    exit 0
    ;;
  *)
    echo "Unknown option: $1 (try --help)" >&2
    exit 2
    ;;
esac

need node "install Node 22 from https://nodejs.org"
need npm "install Node 22 from https://nodejs.org"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 22 ] || { echo "Node 22 or newer is required (found $(node -v)). Install it from https://nodejs.org" >&2; exit 1; }
need docker "install Docker from https://docs.docker.com/get-docker/ and start it"
docker info >/dev/null 2>&1 || { echo "Docker is installed but not running. Start it and try again." >&2; exit 1; }

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)..."
  npm ci
fi

# Secrets are generated once and kept in .demo/ (ignored by git, mode 0600) so a restart reuses them
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
secret() { # secret <file> <bytes>: create the file only if generation produced something usable
  local file="$STATE_DIR/$1" value
  [ -s "$file" ] && return 0
  # node is already required, and unlike the python3 stub on macOS it never opens an install dialog
  value="$(node -p "require('node:crypto').randomBytes($2).toString('base64url')")" || value=""
  [ "${#value}" -ge 16 ] || { echo "Could not generate a random secret with node." >&2; exit 1; }
  (umask 077; printf '%s\n' "$value" > "$file")
}
# If a container exists, every saved secret must too, or the printed sign-in would not match the data
had_secrets=1
for f in admin-password db-password session-secret; do [ -s "$STATE_DIR/$f" ] || had_secrets=0; done
if exists && [ "$had_secrets" = 0 ]; then
  guard
  echo "The demo database exists but its saved credentials are gone. Run: npm run demo -- --reset" >&2
  exit 1
fi
secret admin-password 18
secret session-secret 48
secret db-password 18
ADMIN_PASSWORD="$(cat "$STATE_DIR/admin-password")"
SESSION_SECRET="$(cat "$STATE_DIR/session-secret")"
DB_PASSWORD="$(cat "$STATE_DIR/db-password")"

# Fail early, before starting the database or printing credentials, if something already holds the app port
if node -e "const s=require('node:net').connect({host:'127.0.0.1',port:+process.argv[1]});s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1))" "$APP_PORT"; then
  echo "Port $APP_PORT is already in use. Free it or set DEMO_APP_PORT to another port." >&2
  exit 1
fi

if exists; then
  guard
  docker start "$CONTAINER" >/dev/null || {
    echo "Could not start the demo database. If port $PORT is now in use, free it or run: npm run demo -- --reset" >&2
    exit 1
  }
else
  echo "Starting PostgreSQL with pg_duckdb on 127.0.0.1:$PORT (first run pulls the image)..."
  if ! docker run -d --name "$CONTAINER" --label "$LABEL" -p "127.0.0.1:$PORT:5432" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" -e POSTGRES_DB="$DB" "$IMAGE" >/dev/null; then
    # We just created (or failed to create) this name, so removing it cannot hit a database the user wanted
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    echo "Could not start the database. If port $PORT is in use, set DEMO_DB_PORT to another port." >&2
    exit 1
  fi
fi

printf "Waiting for the database"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -d "$DB" >/dev/null 2>&1; then ready=1; break; fi
  printf "."; sleep 1
done
echo
[ "${ready:-}" = 1 ] || { echo "The database did not become ready in 60 seconds. Check: docker logs $CONTAINER" >&2; exit 1; }

export DATABASE_URL="postgresql://postgres:$DB_PASSWORD@127.0.0.1:$PORT/$DB"
export POSTGRES_HOST=127.0.0.1 POSTGRES_PORT="$PORT" POSTGRES_DB="$DB" POSTGRES_USER=postgres POSTGRES_PASSWORD="$DB_PASSWORD"
export SESSION_SECRET ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME="Demo admin"
export COOKIE_SECURE=false

# --if-empty makes the loader exit 0 when data exists, which is how a resumed demo is recognised.
# Its output streams straight through, and a real failure keeps its non-zero exit status.
echo "Loading demo data (the first run applies the schema, this takes a few seconds)..."
npm run --silent seed:demo -- --if-empty || {
  echo "If this is a database authentication error, the saved credentials no longer match the container: npm run demo -- --reset" >&2
  exit 1
}

cat <<MSG

  Social Explorer demo  ->  http://localhost:$APP_PORT
  Sign in with           $ADMIN_EMAIL
  Password               $ADMIN_PASSWORD

  The data is synthetic (a fictional coastal city). Open the project "Marlow Bay Civic Pulse".
  This runs the web app and database only. Pages that need the full stack (Jupyter notebooks,
  workflows, crawling) are not available; see docs-site/guide/deployment.md for the compose stack.
  Stop with Ctrl+C, then: npm run demo -- --stop      Wipe it: npm run demo -- --reset

MSG

# 127.0.0.1 only: the demo uses a generated password but is not meant to be reachable from the network
exec npx vite dev --host 127.0.0.1 --port "$APP_PORT" --strictPort
