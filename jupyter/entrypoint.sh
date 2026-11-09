#!/bin/sh
set -eu

: "${JUPYTER_TOKEN:?JUPYTER_TOKEN must be set, otherwise Jupyter makes its own token and the app cannot link to it}"

# /app/notebooks is usually a bind mount, which hides anything baked into the image,
# so the samples live in /app/samples and are copied in without overwriting edits
mkdir -p /app/notebooks
cp -rn /app/samples/. /app/notebooks/

exec jupyter lab
