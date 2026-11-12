#!/bin/bash
# Startup script for Social Explorer UI with Jupyter integration and Dapr sidecar

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

echo "🚀 Starting Social Explorer UI with Jupyter Lab and Dapr..."

# Install dependencies first
echo "📦 Installing Python dependencies..."
poetry install

# One-time notebook setup (NLTK data, templates) is `npm run jupyter:bootstrap`; it is a one-time step
# and is not repeated here.

# Shared token, origin and launch settings (also checks that `npm run jupyter:bootstrap` has run)
source "$SCRIPT_DIR/jupyter-env.sh"

# Start Jupyter Lab in the background, and stop it however this script ends
echo "🔬 Starting Jupyter Lab server..."
"${JUPYTER_LAB_CMD[@]}" &
JUPYTER_PID=$!
trap 'echo "Stopping Jupyter Lab..."; kill "$JUPYTER_PID" 2>/dev/null' EXIT

echo "⏳ Waiting for Jupyter Lab to start..."
if jupyter_wait_until_ready; then
    echo "✅ Jupyter Lab is running at $JUPYTER_URL/?token=$JUPYTER_TOKEN"
else
    echo "⚠️  Jupyter Lab may not be running yet, check the logs"
fi

# Start the SvelteKit development server with Dapr sidecar
echo "🌐 Starting SvelteKit development server with Dapr sidecar..."
echo "🔗 Dapr sidecar will be available at http://localhost:3500"
dapr run --app-id ex-accell-ui --app-port 5173 --dapr-http-port 3500 --dapr-grpc-port 50001 --components-path ./components --config ./dapr.yaml -- npm run dev

