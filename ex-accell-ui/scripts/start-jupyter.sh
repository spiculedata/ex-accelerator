#!/bin/bash
# Start JupyterLab on loopback with a random token and the project-local config in .jupyter/
set -e
cd "$(dirname "$0")/.."

export JUPYTER_CONFIG_DIR="${JUPYTER_CONFIG_DIR:-.jupyter}"
export JUPYTER_ALLOW_ORIGIN="${JUPYTER_ALLOW_ORIGIN:-http://localhost:5173}"
export JUPYTER_TOKEN="${JUPYTER_TOKEN:-$(python3 -c 'import secrets; print(secrets.token_hex(24))')}"

echo "JupyterLab: http://localhost:8888/?token=$JUPYTER_TOKEN"
exec poetry run jupyter lab --port=8888 --ServerApp.ip=127.0.0.1 --ServerApp.port_retries=0 --no-browser
