#!/bin/sh
# Smoke test for the Jupyter image: start it with a token and check what the README promises.
#
#   jupyter/tests/smoke.sh IMAGE [HOST_PORT]
#
# Needs docker and curl. Everything it starts is removed on exit.
set -eu

IMAGE="${1:?usage: smoke.sh IMAGE [HOST_PORT]}"
PORT="${2:-18888}"
NAME="jupyter-smoke-$$"
VOLUME="jupyter-smoke-notebooks-$$"
ORIGIN="http://app.example.test"
TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
BASE="http://127.0.0.1:${PORT}"

cleanup() {
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
    echo "FAIL: $*" >&2
    docker logs "$NAME" 2>&1 | tail -30 >&2 || true
    exit 1
}
pass() { echo "ok: $*"; }

# A named volume starts with the image's ownership of /app/notebooks, like a correctly prepared bind mount
docker run -d --name "$NAME" -e JUPYTER_TOKEN="$TOKEN" -e JUPYTER_ALLOW_ORIGIN="${ORIGIN}/" \
    -p "127.0.0.1:${PORT}:8888" -v "${VOLUME}:/app/notebooks" "$IMAGE" >/dev/null

echo "waiting for Jupyter on ${BASE}"
i=0
until curl -s -o /dev/null "${BASE}/api/status"; do
    i=$((i + 1))
    [ "$i" -le 60 ] || fail "Jupyter did not answer within 60 seconds"
    docker inspect -f '{{.State.Running}}' "$NAME" | grep -q true || fail "the container stopped"
    sleep 1
done

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

[ "$(status "${BASE}/api/contents")" = "403" ] || fail "no token should be 403"
pass "403 without a token"

[ "$(status -H 'Authorization: token wrong' "${BASE}/api/contents")" = "403" ] || fail "a wrong token should be 403"
pass "403 with a wrong token"

[ "$(status -H "Authorization: token ${TOKEN}" "${BASE}/api/contents")" = "200" ] || fail "the right token should be 200"
pass "200 with the token"

csp="$(curl -s -D - -o /dev/null -H "Authorization: token ${TOKEN}" "${BASE}/api/contents" | tr -d '\r' | grep -i '^content-security-policy:' || true)"
case "$csp" in
    *"frame-ancestors 'self' ${ORIGIN}"*) pass "CSP limits framing to the app origin (trailing slash stripped)" ;;
    *) fail "unexpected Content-Security-Policy: ${csp:-<none>}" ;;
esac

listing="$(curl -s -H "Authorization: token ${TOKEN}" "${BASE}/api/contents")"
case "$listing" in
    *sentiment_analysis.ipynb*) pass "sample notebooks were seeded" ;;
    *) fail "samples were not seeded: ${listing}" ;;
esac

[ "$(docker exec "$NAME" id -u)" != "0" ] || fail "the container runs as root"
pass "runs as an unprivileged user"

docker exec "$NAME" python -c 'import workspace_utils, query_builders' >/dev/null 2>&1 \
    || fail "workspace_utils is not importable"
pass "workspace_utils and query_builders import"

# Without a token the container must refuse to start rather than invent one
if docker run --rm "$IMAGE" >/dev/null 2>&1; then
    fail "the container started without JUPYTER_TOKEN"
fi
pass "refuses to start without JUPYTER_TOKEN"

# A read-only notebooks folder must produce the explanatory message, not a stack trace
message="$(docker run --rm -e JUPYTER_TOKEN="$TOKEN" -v "${VOLUME}:/app/notebooks:ro" "$IMAGE" 2>&1 || true)"
case "$message" in
    *"is not writable by uid"*) pass "explains an unwritable notebooks folder" ;;
    *) fail "no clear message for an unwritable folder: ${message}" ;;
esac

echo "all smoke checks passed"
