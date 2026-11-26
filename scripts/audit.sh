#!/usr/bin/env bash
# Auditoría local reproducible: secretos, XSS/SSRF, consumes, legal y compilación.
# No sustituye a la revisión humana; sí evita regressions automáticas conocidas.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

fail() { echo "ERROR: $*" >&2; exit 1; }
step() { echo "→ $*"; }

step 'secretos y documentación legal'
bash scripts/check-secrets.sh
for file in LICENSE README.md SECURITY.md CONTRIBUTING.md CHANGELOG.md \
  docs/PRIVACIDAD.md docs/TERMINOS.md docs/COOKIES.md docs/DESCARGO.md \
  docs/ARCHITECTURE.md docs/FORMATOS.md docs/DESIGN.md; do
  test -s "$file" || fail "falta el documento $file"
done

step 'frontend: pruebas, i18n, assets y sin HTML inyectado'
bash scripts/check-frontend.sh

step 'sin primitivas de red ni eval en el código enviado al navegador'
if grep -RInE 'fetch[[:space:]]*\(|XMLHttpRequest|eval[[:space:]]*\(|new Function[[:space:]]*\(|console\.(log|debug|info|warn|error)[[:space:]]*\(' \
  src/frontend/*.js docs/assets/*.js; then
  fail 'el frontend contiene red, eval o salida de consola'
fi
if grep -RInE '(src|href)="http://' docs/*.html src/frontend/*.html; then
  fail 'referencia HTTP sin cifrar en HTML'
fi

step 'sin ejecución por shell en Rust'
if grep -RInE 'Command::new\("(sh|bash|cmd)"\)|\.arg\("-c"\)|sh -c|bash -c' \
  core/src engine/src src-tauri/src --include='*.rs'; then
  fail 'hay ejecución de comandos por shell'
fi

step 'accesibilidad básica de las dos interfaces'
for file in src/frontend/index.html docs/index.html; do
  grep -q '<html lang=' "$file" || fail "$file sin idioma declarado"
  grep -q '<main' "$file" || fail "$file sin main"
  grep -q 'rel="icon"' "$file" || fail "$file sin favicon propio"
  if grep -q '<img' "$file"; then
    python3 - "$file" <<'PY' || exit 1
import re
import sys
html = open(sys.argv[1], encoding='utf-8').read()
for tag in re.findall(r'<img\b[^>]*>', html):
    assert re.search(r'\balt=', tag), tag
PY
  fi
done

step 'iconos de Tauri con cabeceras válidas'
python3 - <<'PY' || exit 1
import pathlib
out = pathlib.Path('src-tauri/icons')
expected = {
    '32x32.png': b'\x89PNG\r\n\x1a\n',
    '128x128.png': b'\x89PNG\r\n\x1a\n',
    '128x128@2x.png': b'\x89PNG\r\n\x1a\n',
    'icon.png': b'\x89PNG\r\n\x1a\n',
    'icon.icns': b'icns',
    'icon.ico': b'\x00\x00\x01\x00',
}
for name, magic in expected.items():
    assert (out / name).read_bytes().startswith(magic), name
print('OK: 6 iconos válidos')
PY

step 'Rust: formato, clippy, pruebas y capa Tauri'
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo check -p seyro-mp4-app

echo 'OK: auditoría local completa'
