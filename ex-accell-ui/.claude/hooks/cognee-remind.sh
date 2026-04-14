#!/bin/bash
# Cognee reminder hook — fires once per session on first codebase exploration.
# Uses a temp file with the parent Claude Code PID so it only reminds once.

GUARD="/tmp/.cognee-reminded-${PPID}"

# Only remind once per session
if [ -f "$GUARD" ]; then
  exit 0
fi

touch "$GUARD"

# Check if Cognee MCP is configured in this project
if [ -f ".mcp.json" ] && grep -q "cognee" .mcp.json 2>/dev/null; then
  cat <<'MSG'
COGNEE REMINDER: This project has a shared Cognee knowledge graph.
Before deep codebase exploration, search Cognee first:
  mcp__cognee__search with search_type "GRAPH_COMPLETION" for architecture questions.
After significant work, save knowledge with mcp__cognee__cognify.
See CLAUDE.md for full instructions.
MSG
fi
