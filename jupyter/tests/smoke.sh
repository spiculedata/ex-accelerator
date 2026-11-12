#!/bin/sh
# Smoke test for the Jupyter image: start it with a token and check what the README promises.
#
#   jupyter/tests/smoke.sh IMAGE
#
# Needs docker and curl. It publishes on a free loopback port and removes everything it starts on exit.
set -eu

IMAGE="${1:?usage: smoke.sh IMAGE}"
NAME="jupyter-smoke-$$"
VOLUME="jupyter-smoke-notebooks-$$"
ROOT_VOLUME="jupyter-smoke-rootowned-$$"
ORIGIN="http://app.example.test"
TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"

cleanup() {
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker volume rm "$VOLUME" "$ROOT_VOLUME" >/dev/null 2>&1 || true
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
    -p 127.0.0.1::8888 -v "${VOLUME}:/app/notebooks" "$IMAGE" >/dev/null

port_of_container() { docker port "$NAME" 8888/tcp | head -n 1 | sed 's/.*://'; }

wait_until_ready() {
    i=0
    until curl -s -o /dev/null "http://127.0.0.1:$(port_of_container)/api/status"; do
        i=$((i + 1))
        [ "$i" -le 60 ] || fail "Jupyter did not answer within 60 seconds"
        docker inspect -f '{{.State.Running}}' "$NAME" | grep -q true || fail "the container stopped"
        sleep 1
    done
}

echo "waiting for Jupyter"
wait_until_ready
BASE="http://127.0.0.1:$(port_of_container)"

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

# A restart over a volume that is already seeded must still come up (the samples are copied without overwriting)
docker restart "$NAME" >/dev/null
wait_until_ready
BASE="http://127.0.0.1:$(port_of_container)"
[ "$(status -H "Authorization: token ${TOKEN}" "${BASE}/api/contents")" = "200" ] || fail "no 200 after a restart"
pass "restarts over an already seeded volume"

# Without a token the container must refuse to start rather than invent one
message="$(docker run --rm "$IMAGE" 2>&1 || true)"
case "$message" in
    *"JUPYTER_TOKEN must be set"*) pass "refuses to start without JUPYTER_TOKEN" ;;
    *) fail "unexpected output without a token: ${message}" ;;
esac

# The real failure: a root-owned folder (what Docker creates for a missing bind mount) must give a clear message.
# Docker Desktop on macOS and Windows maps ownership and ignores the chown, so only check where it took effect.
docker volume create "$ROOT_VOLUME" >/dev/null
docker run --rm -u 0 -v "${ROOT_VOLUME}:/app/notebooks" --entrypoint chown "$IMAGE" root:root /app/notebooks
owner="$(docker run --rm -v "${ROOT_VOLUME}:/app/notebooks" --entrypoint stat "$IMAGE" -c %U /app/notebooks)"
if [ "$owner" = "root" ]; then
    message="$(docker run --rm -e JUPYTER_TOKEN="$TOKEN" -v "${ROOT_VOLUME}:/app/notebooks" "$IMAGE" 2>&1 || true)"
    case "$message" in
        *"is not writable by uid"*) pass "explains a notebooks folder it cannot write to" ;;
        *) fail "no clear message for a root-owned folder: ${message}" ;;
    esac
else
    echo "skip: this Docker does not honour chown on volumes (owner is ${owner}); the root-owned folder check runs on Linux"
fi

echo "all smoke checks passed"
