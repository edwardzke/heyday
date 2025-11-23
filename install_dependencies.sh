#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_npm_install() {
  local dir="$1"
  local label="$2"
  if [ -f "${dir}/package.json" ]; then
    echo "==> npm install (${label})"
    (cd "${dir}" && npm install)
  else
    echo "==> Skipping npm install in ${dir} (no package.json)"
  fi
}

echo "==> Installing backend Python dependencies"
(cd "${root_dir}/backend" && pip3 install -r requirements.txt)

run_npm_install "${root_dir}/backend" "backend"
run_npm_install "${root_dir}/frontend" "frontend"
run_npm_install "${root_dir}/HeydayMobile" "mobile"

echo "==> Running backend migrations"
(cd "${root_dir}/backend" && python manage.py migrate)
