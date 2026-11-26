# Contribuir

Gracias por interesarte en Seyro-MP4. El proyecto es pequeño a propósito: se aceptan cambios que mejoren la claridad, la honestidad de la información o la seguridad real.

## Antes de empezar

1. Lee [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y [`docs/FORMATOS.md`](docs/FORMATOS.md).
2. Para cambios de interfaz, respeta los tokens de Seyroo y los componentes semánticos existentes.
3. Para cambios en el motor, añade una prueba determinista. Ninguna prueba debe depender de red.

## Flujo

```bash
git checkout -b feat/nombre-corto
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test  --workspace
bash scripts/check-frontend.sh
bash scripts/check-secrets.sh
git commit -m "feat(amplio): descripción concreta"
git push -u origin feat/nombre-corto
```

Abre un Pull Request contra `main` explicando **qué cambia, por qué y cómo se verificó**. Los commits siguen Conventional Commits (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `ci`).

## Reglas que no se negocian

- No añadir calidades que no existan en el medio inspeccionado.
- No añadir credenciales, claves ni tokens al repositorio.
- No ejecutar comandos concatenando datos del usuario en una shell.
- No renderizar títulos, errores ni parámetros como HTML sin saneamiento.
- No incluir contenido de terceros protegido por derechos de autor.
