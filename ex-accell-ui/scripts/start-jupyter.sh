#!/bin/bash
# Start JupyterLab on loopback with a random token and the project-local config in .jupyter/
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# shellcheck disable=SC1091  # jupyter-env.sh sits next to this script
source "$SCRIPT_DIR/jupyter-env.sh"

echo "JupyterLab: $JUPYTER_URL/?token=$JUPYTER_TOKEN"
exec "${JUPYTER_LAB_CMD[@]}"
