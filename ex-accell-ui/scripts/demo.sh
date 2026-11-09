#!/usr/bin/env bash
# One-command demo: starts a throwaway PostgreSQL + pg_duckdb container, loads the synthetic demo
# dataset and runs the app on http://localhost:5173, bound to this machine only.
#
#   npm run demo            start (or resume) the demo
#   npm run demo -- --stop  stop the demo database
#   npm run demo -- --reset delete the demo database and start again from scratch
#
# Nothing here touches .env or any database other than the demo container.
set -euo pipefail

cd "$(dirname "$0")/.."

CONTAINER="${DEMO_DB_CONTAINER:-social-explorer-demo-db}"
PORT="${DEMO_DB_PORT:-55432}"
IMAGE="pgduckdb/pgduckdb:17-main"
DB="analytics"
DB_PASSWORD="demo"
APP_PORT="${DEMO_APP_PORT:-5173}"
STATE_DIR=".demo"
ADMIN_EMAIL="demo@example.com"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1: $2" >&2; exit 1; }; }
random() { python3 -c "import secrets; print(secrets.token_urlsafe($1))" 2>/dev/null || openssl rand -base64 "$1" | tr -d '=+/\n'; }

case "${1:-}" in
  --stop)
    docker stop "$CONTAINER" >/dev/null 2>&1 && echo "Stopped $CONTAINER (data kept; run npm run demo to resume)." || echo "$CONTAINER is not running."
    exit 0
    ;;
  --reset)
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    rm -rf "$STATE_DIR"
    echo "Demo database removed."
    ;;
esac

need node "install Node 22 from https://nodejs.org"
need npm "install Node 22 from https://nodejs.org"
need docker "install Docker from https://docs.docker.com/get-docker/ and start it"
docker info >/dev/null 2>&1 || { echo "Docker is installed but not running. Start it and try again." >&2; exit 1; }

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)..."
  npm ci
fi

# Credentials are generated once and kept in .demo/ (ignored by git) so a restart signs in with the same ones
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
[ -f "$STATE_DIR/admin-password" ] || { random 18 > "$STATE_DIR/admin-password"; chmod 600 "$STATE_DIR/admin-password"; }
[ -f "$STATE_DIR/session-secret" ] || { random 48 > "$STATE_DIR/session-secret"; chmod 600 "$STATE_DIR/session-secret"; }
ADMIN_PASSWORD="$(cat "$STATE_DIR/admin-password")"
SESSION_SECRET="$(cat "$STATE_DIR/session-secret")"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker start "$CONTAINER" >/dev/null
else
  echo "Starting PostgreSQL with pg_duckdb on 127.0.0.1:$PORT (first run pulls the image)..."
  docker run -d --name "$CONTAINER" -p "127.0.0.1:$PORT:5432" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" -e POSTGRES_DB="$DB" "$IMAGE" >/dev/null
fi

printf "Waiting for the database"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; then ready=1; break; fi
  printf "."; sleep 1
done
echo
[ "${ready:-}" = 1 ] || { echo "The database did not become ready in 60 seconds. Check: docker logs $CONTAINER" >&2; exit 1; }

export DATABASE_URL="postgresql://postgres:$DB_PASSWORD@127.0.0.1:$PORT/$DB"
export POSTGRES_HOST=127.0.0.1 POSTGRES_PORT="$PORT" POSTGRES_DB="$DB" POSTGRES_USER=postgres POSTGRES_PASSWORD="$DB_PASSWORD"
export SESSION_SECRET ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME="Demo admin"
export COOKIE_SECURE=false # plain http on localhost

# The loader refuses a database that already has data, which is how a resumed demo is recognised
if out=$(npm run --silent seed:demo 2>&1); then
  echo "$out"
elif echo "$out" | grep -q "already contain rows"; then
  echo "Demo data is already loaded."
else
  echo "$out" >&2
  exit 1
fi

cat <<MSG

  Social Explorer demo  ->  http://localhost:$APP_PORT
  Sign in with           $ADMIN_EMAIL
  Password               $ADMIN_PASSWORD

  The data is synthetic (a fictional coastal city). Open the project "Marlow Bay Civic Pulse".
  Stop with Ctrl+C, then: npm run demo -- --stop      Wipe it: npm run demo -- --reset

MSG

# 127.0.0.1 only: the demo uses a generated password but is not meant to be reachable from the network
exec npx vite dev --host 127.0.0.1 --port "$APP_PORT"
