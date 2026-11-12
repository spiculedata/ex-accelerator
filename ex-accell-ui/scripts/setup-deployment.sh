#!/bin/bash
# Setup script for Social Explorer Dapr Deployment with Telegram Scraper

echo "🚀 Setting up Social Explorer Dapr deployment..."

# Set paths
# Crawler checkout; override with TELEGRAM_SCRAPER_PATH=/path/to/crawler
TELEGRAM_SCRAPER_PATH="${TELEGRAM_SCRAPER_PATH:-$(cd "$(dirname "$0")/../../crawler" 2>/dev/null && pwd)}"

# Local Dapr secret store (gitignored); start from the example file
if [ ! -f secrets.json ] && [ -f secrets.example.json ]; then
    cp secrets.example.json secrets.json
    echo "📝 Created secrets.json from secrets.example.json"
fi
CURRENT_DIR=$(pwd)

# Check if Redis is running (required for job store)
echo "🔍 Checking Redis availability..."
if ! nc -z localhost 6379 2>/dev/null; then
    echo "⚠️  Redis is not running. Starting Redis with Docker..."
    docker run -d --name redis-dapr -p 6379:6379 redis:alpine
    sleep 3
    if ! nc -z localhost 6379 2>/dev/null; then
        echo "❌ Failed to start Redis. Please ensure Docker is running and try:"
        echo "   docker run -d --name redis-dapr -p 6379:6379 redis:alpine"
        exit 1
    fi
    echo "✅ Redis started successfully"
else
    echo "✅ Redis is already running"
fi

# Check if telegram-scraper exists and build if needed
if [ ! -f "$TELEGRAM_SCRAPER_PATH/telegram-scraper" ]; then
    echo "⚠️  telegram-scraper binary not found. Building..."
    cd "$TELEGRAM_SCRAPER_PATH" || exit 1
    if ! go build -o telegram-scraper; then
        echo "❌ Failed to build telegram-scraper"
        exit 1
    fi
    cd "$CURRENT_DIR" || exit 1
    echo "✅ telegram-scraper built successfully"
else
    echo "✅ telegram-scraper binary exists"
fi

# Create storage directory if it doesn't exist
mkdir -p "$CURRENT_DIR/telegram-data"
echo "✅ Storage directory ready: $CURRENT_DIR/telegram-data"

echo "🎯 Setup complete! You can now start the deployment with:"
echo "   npm run dev:dapr"
echo ""
echo "🔧 Other useful commands:"
echo "   npm run dapr:stop    - Stop all Dapr services"
echo "   npm run dapr:logs    - View deployment logs"
echo "   npm run test:integration - Test job scheduling"