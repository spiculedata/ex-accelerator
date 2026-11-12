#!/bin/bash
# Shared Jupyter launch settings for start-dev.sh, start-dev-dapr.sh and start-jupyter.sh.
# Source it after changing into ex-accell-ui/:   source "$(dirname "$0")/jupyter-env.sh"
#
# Jupyter listens on loopback only, with a random token that the app shares through
# JUPYTER_URL/JUPYTER_TOKEN, and takes its config from the project-local .jupyter/ folder.

JUPYTER_PORT="${JUPYTER_PORT:-8888}"
# Absolute, so it does not depend on the directory Jupyter is started from
export JUPYTER_CONFIG_DIR="${JUPYTER_CONFIG_DIR:-$PWD/.jupyter}"
export JUPYTER_ALLOW_ORIGIN="${JUPYTER_ALLOW_ORIGIN:-http://localhost:5173}"
export JUPYTER_URL="${JUPYTER_URL:-http://localhost:$JUPYTER_PORT}"

JUPYTER_TOKEN="${JUPYTER_TOKEN:-$(python3 -c 'import secrets; print(secrets.token_hex(24))' 2>/dev/null || openssl rand -hex 24)}"
if [ -z "$JUPYTER_TOKEN" ]; then
    echo "Could not generate a Jupyter token (need python3 or openssl)" >&2
    exit 1
fi
export JUPYTER_TOKEN

# The config written by `npm run jupyter:bootstrap`; without it Jupyter would ignore the origin limits
if [ ! -f "$JUPYTER_CONFIG_DIR/jupyter_lab_config.py" ]; then
    echo "Jupyter is not set up yet: run \`npm run jupyter:bootstrap\` first" >&2
    exit 1
fi

# The same command everywhere: `"${JUPYTER_LAB_CMD[@]}"`, with & or exec as the caller needs
JUPYTER_LAB_CMD=(poetry run jupyter lab "--port=$JUPYTER_PORT" --ServerApp.ip=127.0.0.1 --ServerApp.port_retries=0 --no-browser)

# True once Jupyter answers with our token (sent as a header, not in the URL)
jupyter_is_ready() {
    curl -sf -H "Authorization: token $JUPYTER_TOKEN" "http://localhost:$JUPYTER_PORT/api" > /dev/null
}

# Polls for up to ~30 seconds so a slow start is not reported as a failure
jupyter_wait_until_ready() {
    local attempt
    for attempt in $(seq 1 30); do
        jupyter_is_ready && return 0
        sleep 1
    done
    return 1
}
