#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_VENV="$BACKEND_DIR/venv/bin/activate"
EXPO_DIR="$ROOT_DIR/HeydayMobile"

log() {
  echo "[launch-expo] $*"
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    log "Stopping Django backend (pid $BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "${EXPO_PID:-}" ]] && kill -0 "$EXPO_PID" 2>/dev/null; then
    log "Stopping Expo server (pid $EXPO_PID)"
    kill "$EXPO_PID" 2>/dev/null || true
    wait "$EXPO_PID" 2>/dev/null || true
  fi

  exit "$exit_code"
}
trap cleanup EXIT INT TERM

[[ -d "$BACKEND_DIR" ]] || { log "Missing backend directory at $BACKEND_DIR"; exit 1; }
[[ -d "$EXPO_DIR" ]] || { log "Missing Expo directory at $EXPO_DIR"; exit 1; }

log "Starting Django backend..."
(
  cd "$BACKEND_DIR"
  if [[ -f "$BACKEND_VENV" ]]; then
    # shellcheck disable=SC1090
    source "$BACKEND_VENV"
  fi
  python manage.py runserver
) &
BACKEND_PID=$!


log "Starting Expo dev server in foreground (interactive)..."
(
  cd "$EXPO_DIR"
  npm run start
)
EXPO_EXIT_CODE=$?

log "Expo exited with code $EXPO_EXIT_CODE"
wait -n "$BACKEND_PID" || true