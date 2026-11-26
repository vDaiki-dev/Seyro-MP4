#!/usr/bin/env bash
# Higiene del frontend: sin HTML inyectado, sin CDN, i18n completo y assets sincronizados.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if grep -RInE '\.innerHTML[[:space:]]*=' src/frontend docs/assets --include='*.js'; then
  echo 'ERROR: se encontró innerHTML' >&2
  exit 1
fi

if grep -RInE '(cdn\.|unpkg\.com|jsdelivr\.net|fonts\.googleapis\.com)' \
  src/frontend docs --include='*.html' --include='*.css' --include='*.js'; then
  echo 'ERROR: referencia remota en el frontend' >&2
  exit 1
fi

for file in src/frontend/favicon.svg src/frontend/styles.css docs/index.html; do
  test -f "$file" || { echo "Falta $file" >&2; exit 1; }
done

node --test src/frontend/test/*.test.js
node scripts/check-i18n.mjs
bash scripts/sync-web-assets.sh --check

echo 'OK: frontend limpio, accesible y autocontenido'
