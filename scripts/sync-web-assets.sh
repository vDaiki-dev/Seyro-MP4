#!/usr/bin/env bash
# Copia los assets compartidos a docs/assets para GitHub Pages.
# Con --check solo verifica que no haya divergencia; no escribe nada.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

shared=(boot.js i18n.js security.js theme.js styles.css favicon.svg)
mode="${1:-}"

if [[ "$mode" == "--check" ]]; then
  for file in "${shared[@]}"; do
    cmp -s "src/frontend/$file" "docs/assets/$file" || {
      echo "ERROR: docs/assets/$file está desincronizado (ejecuta bash scripts/sync-web-assets.sh)" >&2
      exit 1
    }
  done
  echo 'OK: assets de la web sincronizados con el frontend'
  exit 0
fi

if [[ "$mode" != "" ]]; then
  echo "Uso: bash scripts/sync-web-assets.sh [--check]" >&2
  exit 2
fi

mkdir -p docs/assets
for file in "${shared[@]}"; do
  cp "src/frontend/$file" "docs/assets/$file"
done
echo 'OK: assets compartidos copiados a docs/assets'
