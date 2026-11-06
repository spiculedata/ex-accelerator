#!/bin/bash
# Startup script for Ex-Accelerator UI with Jupyter integration

echo "🚀 Starting Ex-Accelerator UI with Jupyter Lab..."

# Install dependencies first
echo "📦 Installing Python dependencies..."
poetry install

# One-time notebook setup (NLTK data, templates) is `npm run jupyter:bootstrap`; it is not repeated here
# because it must never overwrite notebooks you have edited.

# Start Jupyter Lab in the background
echo "🔬 Starting Jupyter Lab server..."
poetry run jupyter lab --port=8888 --no-browser --allow-root &
JUPYTER_PID=$!

# Wait a moment for Jupyter to start
echo "⏳ Waiting for Jupyter Lab to start..."
sleep 5

# Check if Jupyter Lab is running
if curl -s http://localhost:8888 > /dev/null; then
    echo "✅ Jupyter Lab is running at http://localhost:8888"
else
    echo "⚠️  Jupyter Lab may not be running yet, check the logs"
fi

# Start the SvelteKit development server
echo "🌐 Starting SvelteKit development server..."
npm run dev

# When the script exits, kill Jupyter Lab
trap "echo 'Stopping Jupyter Lab...'; kill $JUPYTER_PID 2>/dev/null" EXIT