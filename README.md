# Seyro-MP4

**Descarga honesta y multiformato. Inspecciona primero, descarga después. Nunca inventes una resolución.**

Seyro-MP4 es la segunda herramienta de la familia **Seyroo**, continuación de [SeyroPea](https://github.com/vDaiki-dev/seyropea): mismos criterios, mismo lenguaje visual y mismo respeto por tu máquina. Gratuito, de código abierto y sin cuentas ni telemetría.

> **Aviso importante:** Seyro-MP4 no fomenta la piratería, no aloja contenido protegido por derechos de autor y no rompe ni elude DRM. Es una herramienta técnica local: el uso que se haga de ella queda bajo la exclusiva responsabilidad de quien la ejecuta, que debe cumplir la ley aplicable y los términos de cada plataforma. Lee el [descargo completo](docs/DESCARGO.md).

**Web del proyecto:** [vdaiki-dev.github.io/Seyro-MP4](https://vdaiki-dev.github.io/Seyro-MP4/) · **Repositorio:** [vDaiki-dev/Seyro-MP4](https://github.com/vDaiki-dev/Seyro-MP4) · **Licencia:** GPL-3.0-only

---

## Estado actual

| Capa | Estado |
| --- | --- |
| Núcleo de seguridad (URLs, rutas, nombres de archivo, errores) | ✅ Implementado y con pruebas |
| Registro de plataformas y matriz de capacidades reales | ✅ Implementado y con pruebas |
| Modelo de pistas reales y política de calidades honestas | ✅ Implementado y con pruebas |
| Motor de inspección/descarga (`yt-dlp` + `ffmpeg` locales) | 🚧 En construcción (siguiente paso) |
| Interfaz local y componentes (`Toast`, `Modal`, `Tooltip`, `Badge`, `Skeleton`) | ✅ Implementados y con pruebas de lógica |
| Brutalismo limpio, 3 modos, 5 acentos + personalizado, 3 tipografías | ✅ Implementado con contraste WCAG validado |
| Español e inglés con diccionarios centralizados y respaldo | ✅ Implementado y verificado en CI |
| Web estática y páginas legales | ✅ Landing publicada; solo documentación, sin descargador simulado |

No hay capturas ni cifras inventadas: este README se actualiza cuando cada pieza funciona de verdad.

## Vista previa (esquema de interfaz, no una captura)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Seyro-MP4   INSPECTOR · SIN 4K FALSO                    [tema] [ⓘ]  │
├──────────────────────────────────────────────────────────────────────┤
│ Enlace  [ https://…                                    ] [Analizar] │
├──────────────────────────────────────────┬───────────────────────────┤
│ Inspector de medio                       │ Pistas reales detectadas  │
│ · · · • ● · ·  (Skeleton DIVAE)          │ 1080p  V+A  30fps  4.2 Mb │
│ título / autor / duración                │ 1080p  V    30fps  3.1 Mb │
│                                          │ 320kbps A   opus          │
├──────────────────────────────────────────┴───────────────────────────┤
│ Cola: Analizando → Resolviendo → Descargando → Procesando → Listo    │
└──────────────────────────────────────────────────────────────────────┘
```

La matriz de puntos del skeleton procede de la misma idea que [DIVAE](https://github.com/intriXlabs/DIVAE): tres tamaños de punto, color del tema y cero dependencias.

## Características diseñadas (con límites honestos)

- **Inspector previo:** título limpio, autor, duración, miniatura local y tabla con **solo las pistas que existen** (vídeo+audio, solo vídeo, solo audio), con resolución real, FPS, códec y tamaño estimado cuando está disponible.
- **Regla de oro de calidad:** si el original se subió a 1080p, jamás se mostrará 1440p ni 2160p. Las etiquetas usan la altura real de píxeles (`1080p`, `720p`, …) o el bitrate real para audio (`320kbps`).
- **Plataformas con estado visible:** YouTube, YouTube Music, Instagram y TikTok para contenido público; Spotify con descarga **no soportada** por DRM (se explica, no se promete). Consulta la [matriz completa](docs/FORMATOS.md).
- **Cola con estados reales:** analizando, resolviendo formatos, descargando, procesando/muxing, completado o error concreto. Cancelar, reintentar, copiar ruta y limpiar historial.
- **Seguridad desde el primer commit:** URLs permitidas por dominio, sin credenciales en la URL, sin `path traversal`, nombres de archivo seguros, argumentos de procesos como array (nunca shell), errores redactados, sin secretos ni telemetría.
- **Sin bloat:** Rust + JavaScript sin frameworks en runtime, sin CDN, sin servicios de pago; el único `localStorage` guarda `{mode, accent, customAccent, font, locale}`.
- **Brutalismo limpio con ADN Seyroo:** bloques rectos, bordes de 2px, rejilla marcada y contraste real; sin gradientes morado/azul ni sombras difusas. Detalle en [`docs/DESIGN.md`](docs/DESIGN.md).
- **Apariencia propia:** papel, terminal o sistema; acentos curados (naranja Seyroo, lima, coral, cian, ámbar) o uno personalizado validado por WCAG; tipografía grotesca, monotécnica o editorial con fallbacks del sistema y sin red.
- **Español e inglés desde el primer día:** textos, estados, tooltips y errores centralizados, con respaldo automático al español y paridad comprobada en CI.

## Arquitectura

Resumen (detalles en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):

```
core/           Biblioteca Rust pura: seguridad, modelo de pistas, adaptadores, errores
src-tauri/      Capa de escritorio Tauri v2 (se añade con el motor)
src/frontend/   JS + CSS locales: tokens, temas, i18n, componentes y favicon propio
docs/           Landing estática, arquitectura, diseño, formatos y páginas legales
docs/assets/    Copia sincronizada de assets compartidos (sync-web-assets.sh)
scripts/        Chequeo de secretos, frontend, i18n y sincronización de assets
.github/        CI: núcleo, frontend, secretos y documentación obligatoria
```

Decisiones principales: la inspección y la descarga ocurren **en el equipo del usuario**; `yt-dlp` y `ffmpeg` son dependencias opcionales que el usuario instala y que se invocan con argumentos seguros, no binarios empaquetados ni servicios remotos. La web de GitHub Pages es **solo documentación**: no promete descargar nada desde el navegador.

## Instalación y uso del núcleo

```bash
git clone https://github.com/vDaiki-dev/Seyro-MP4.git
cd Seyro-MP4

# Verificación del núcleo (no necesita yt-dlp ni ffmpeg)
cargo fmt --all -- --check
cargo clippy -p seyro-mp4-core --all-targets -- -D warnings
cargo test  -p seyro-mp4-core

# Verificación del frontend (Node incluido en el runner de CI)
bash scripts/check-frontend.sh
# Tras editar un asset compartido, sincronizar la copia de docs/assets:
bash scripts/sync-web-assets.sh
```

Para ver la interfaz mientras se conecta el motor, abre `src/frontend/index.html` con un servidor local estático (por ejemplo `python3 -m http.server` desde esa carpeta). No simula descargas: el botón "Analizar enlace" valida la URL y avisa de que el motor llega en el siguiente paso.

Cuando la interfaz esté terminada, la aplicación de escritorio se ejecutará con `cargo tauri dev` y la compilación de producción con `cargo tauri build`. `yt-dlp` y `ffmpeg` se detectarán en el `PATH`; si faltan, la app indicará qué instalar en lugar de mostrar un error genérico.

## Plataformas y calidades

Ninguna plataforma garantiza todos los formatos: la app inspecciona primero y muestra únicamente lo que devuelve el origen. Spotify está marcado como **no descargable** por DRM. Las cuentas privadas, el contenido con restricción de edad/región y los medios protegidos no se eluden: se explica el motivo. Detalles en [`docs/FORMATOS.md`](docs/FORMATOS.md).

## Legal y privacidad

- [Política de Privacidad](docs/PRIVACIDAD.md)
- [Términos y Condiciones](docs/TERMINOS.md)
- [Aviso de cookies y almacenamiento local](docs/COOKIES.md)
- [Descargo: piratería y derechos de autor](docs/DESCARGO.md)
- [Política de seguridad y reportes](SECURITY.md)

Seyro-MP4 no pide correos, no guarda credenciales, no envía telemetría y no usa cookies propias.

## Licencias

- **Seyro-MP4**: GPL-3.0-only. Ver [`LICENSE`](LICENSE).
- `yt-dlp` y `ffmpeg`: herramientas externas e independientes, instaladas por el usuario; Seyro-MP4 no las redistribuye. Sus licencias son propias de esos proyectos.
- El resto del stack mantiene sus licencias originales.

## Enlaces

- Cambios: [`CHANGELOG.md`](CHANGELOG.md) · Contribuciones: [`CONTRIBUTING.md`](CONTRIBUTING.md) · Arquitectura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Familia Seyroo: [SeyroPea](https://github.com/vDaiki-dev/seyropea)
