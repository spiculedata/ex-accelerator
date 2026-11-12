#!/bin/sh
set -eu

: "${JUPYTER_TOKEN:?JUPYTER_TOKEN must be set, otherwise Jupyter makes its own token and the app cannot link to it}"

# /app/notebooks is usually a bind mount, which hides anything baked into the image. Docker creates a
# missing host folder as root, and this container runs as an unprivileged user, so say how to fix it
# instead of failing on the first write.
if [ ! -w /app/notebooks ]; then
    echo "/app/notebooks is not writable by uid $(id -u) (gid $(id -g))." >&2
    echo "Give that user the host folder, e.g.: sudo chown -R $(id -u):$(id -g) \"\${DATA_DIR:-/data}/notebooks\"" >&2
    exit 1
fi

# The samples live in /app/samples and are copied in without overwriting edits
cp -rn /app/samples/. /app/notebooks/

exec jupyter lab
