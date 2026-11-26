#!/usr/bin/env bash
# Comprueba que no haya secretos ni archivos sensibles versionados.
# Se ejecuta en local y en CI; no modifica el repositorio.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
status=0

# 1) Nombres de archivo prohibidos entre los archivos versionados.
while IFS= read -r -d '' file; do
  case "$file" in
    .env|.env.*|*.pem|*.key|*.p12|*.pfx|*.gpg|*.asc|id_rsa*|id_ed25519*|*credentials.json|service-account*.json|.netrc)
      echo "ERROR: archivo sensible versionado: $file" >&2
      status=1
      ;;
  esac
done < <(git ls-files -z)

# 2) Patrones de credenciales en texto versionado. El propio script se excluye.
if git grep -n -I -E \
  'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----|password[[:space:]]*=[[:space:]]*"[^"]+"' \
  -- . ':!scripts/check-secrets.sh' ':!LICENSE'; then
  echo "ERROR: se detectaron patrones de credenciales" >&2
  status=1
fi

if [[ "$status" -ne 0 ]]; then
  exit 1
fi
printf '%s\n' 'OK: sin secretos en archivos versionados'
