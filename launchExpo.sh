#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_VENV="$BACKEND_DIR/venv/bin/activate"
EXPO_DIR="$ROOT_DIR/HeydayMobile"
BACKEND_LOG="$BACKEND_DIR/.runserver.log"

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

  exit "$exit_code"
}
trap cleanup EXIT INT TERM

[[ -d "$BACKEND_DIR" ]] || { log "Missing backend directory at $BACKEND_DIR"; exit 1; }
[[ -d "$EXPO_DIR" ]] || { log "Missing Expo directory at $EXPO_DIR"; exit 1; }

log "Starting Django backend..."
if [[ -f "$BACKEND_VENV" ]]; then
  # shellcheck disable=SC1090
  source "$BACKEND_VENV"
fi

(
  cd "$BACKEND_DIR"
  log "Backend logs -> $BACKEND_LOG"
  PYTHONUNBUFFERED=1 python manage.py runserver 0.0.0.0:8000 >"$BACKEND_LOG" 2>&1
) &
BACKEND_PID=$!
sleep 1
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  log "Backend failed to start; check $BACKEND_LOG"
  exit 1
fi


log "Starting Expo dev server in foreground (interactive)..."
(
  cd "$EXPO_DIR"
  npm run start
)
EXPO_EXIT_CODE=$?

log "Expo exited with code $EXPO_EXIT_CODE"
