#!/usr/bin/env bash
# Common Phrases Flashcards Launcher
cd "$(dirname "$0")"

PORT=8080
echo "Starting Common Phrases Flashcards at http://localhost:$PORT..."
open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || echo "Please open http://localhost:$PORT in your browser"
python3 -m http.server $PORT
