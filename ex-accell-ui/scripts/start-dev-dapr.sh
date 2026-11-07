#!/bin/bash
# Startup script for Ex-Accelerator UI with Jupyter integration and Dapr sidecar

cd "$(dirname "$0")/.."

echo "🚀 Starting Ex-Accelerator UI with Jupyter Lab and Dapr..."

# Install dependencies first
echo "📦 Installing Python dependencies..."
poetry install

# One-time notebook setup (NLTK data, templates) is `npm run jupyter:bootstrap`; it is a one-time step
# and is not repeated here.

# Jupyter listens on loopback only, with a random token that the app shares through JUPYTER_URL/JUPYTER_TOKEN
export JUPYTER_CONFIG_DIR="${JUPYTER_CONFIG_DIR:-.jupyter}"
export JUPYTER_ALLOW_ORIGIN="${JUPYTER_ALLOW_ORIGIN:-http://localhost:5173}"
JUPYTER_TOKEN="${JUPYTER_TOKEN:-$(python3 -c 'import secrets; print(secrets.token_hex(24))' 2>/dev/null || openssl rand -hex 24)}"
[ -n "$JUPYTER_TOKEN" ] || { echo "Could not generate a Jupyter token (need python3 or openssl)" >&2; exit 1; }
export JUPYTER_TOKEN
export JUPYTER_URL="${JUPYTER_URL:-http://localhost:8888}"

# Start Jupyter Lab in the background
echo "🔬 Starting Jupyter Lab server..."
poetry run jupyter lab --port=8888 --ServerApp.ip=127.0.0.1 --ServerApp.port_retries=0 --no-browser &
JUPYTER_PID=$!

# Wait a moment for Jupyter to start
echo "⏳ Waiting for Jupyter Lab to start..."
sleep 5

# Check if Jupyter Lab is running
if curl -s "http://localhost:8888/api?token=$JUPYTER_TOKEN" > /dev/null; then
    echo "✅ Jupyter Lab is running at http://localhost:8888/?token=$JUPYTER_TOKEN"
else
    echo "⚠️  Jupyter Lab may not be running yet, check the logs"
fi

# Start the SvelteKit development server with Dapr sidecar
echo "🌐 Starting SvelteKit development server with Dapr sidecar..."
echo "🔗 Dapr sidecar will be available at http://localhost:3500"
dapr run --app-id ex-accell-ui --app-port 5173 --dapr-http-port 3500 --dapr-grpc-port 50001 --components-path ./components --config ./dapr.yaml -- npm run dev

# When the script exits, kill Jupyter Lab
trap "echo 'Stopping Jupyter Lab...'; kill $JUPYTER_PID 2>/dev/null" EXIT