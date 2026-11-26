# Arquitectura de Seyro-MP4

**Versión 1.0 · 2026-11-26**

## Principios heredados de Seyropea

Seyropea demostró que una herramienta Seyroo puede ser nativa, ligera, determinista y honesta sin frameworks ni servicios remotos. Seyro-MP4 conserva esa filosofía y la traslada al dominio del vídeo:

1. **Local-first:** la consulta y la descarga ocurren en el equipo del usuario. No hay backend propio.
2. **Sin bloat:** Rust + JavaScript sin bundler en runtime, sin CDN, sin telemetría, sin cuentas.
3. **Datos reales:** la interfaz solo muestra lo que el origen devuelve. Si no hay 4K, no existe el botón de 4K.
4. **Frontera endurecida:** todo lo que entra desde la UI se valida en el núcleo antes de tocar red, disco o procesos.

## Decisión central y sus alternativas

| Opción | Por qué se descarta o se elige |
| --- | --- |
| Web pura que descarga desde el navegador | CORS y ausencia de extractores reales: solo podría prometer formatos que no se pueden resolver. Descartada. |
| Servidor propio de descarga | Coste, superficie SSRF, responsabilidad sobre contenido de terceros y gestión de secretos. Descartado para un proyecto gratuito. |
| **Tauri v2 + núcleo Rust local** | Mismo stack que Seyropea, cero coste de alojamiento para la app, diálogos nativos y procesos locales con argumentos seguros. **Elegida.** |
| Empaquetar `yt-dlp`/`ffmpeg` en el instalador | Aumenta el tamaño, envejece mal y complica licencias. Se detectan en el `PATH` y se documentan como opcionales. |
| Base de datos | Innecesaria en el MVP. El historial vive en memoria mientras la app está abierta; solo se persisten las preferencias. Sin IDs de cliente con autoridad. |

La web de GitHub Pages es **documentación estática**: landing, matriz de plataformas y páginas legales. No simula ser un descargador web.

## Componentes

```
core/                     Biblioteca Rust pura, sin red ni procesos
  security.rs             URLs, dominios, rutas, nombres de archivo, redacción de errores
  model.rs                Pistas reales, etiquetas de calidad, filtro anti-escalado
  adapters.rs             Registro de plataformas y capacidades (incluye DRM/estado)
  errors.rs               Errores con código, mensaje humano y detalle redactado
  jobs.rs                 IDs de trabajo generados en el núcleo (anti-IDOR)

engine/                   Única capa con procesos externos
  tools.rs                Descubrimiento de yt-dlp/ffmpeg en PATH, sin shell
  inspect.rs              yt-dlp --dump-single-json → pistas reales + diagnose
  download.rs             argv separado, plantilla confinada, eventos y rutas finales
  queue.rs                Cola en memoria, estados, progreso, cancelación y reintento

src-tauri/                Capa de escritorio Tauri v2
  commands.rs             IPC: inspeccionar, descargar, cancelar, reintentar, limpiar
  lib.rs / main.rs        Estado Arc<Engine> y arranque
  tauri.conf.json         CSP estricta, sin permisos de red ni sistema de archivos
  capabilities/           Solo `core:default` para la ventana `main`
  icons/                  PNG/ICO/ICNS derivados de src/frontend/favicon.svg

src/frontend/             JavaScript + CSS locales, sin bundler ni dependencias
  boot.js                 Preferencias aplicadas en <head>: sin parpadeo
  security.js             Sanitización de texto/URL y allowlist de enlaces
  i18n.js                 Diccionarios es/en, interpolación y respaldo
  theme.js                Modos, acentos, contraste WCAG y tipografías
  components.js           Toast, Modal, Tooltip, Badge, Skeleton (matriz DIVAE)
  appearance.js           Panel de apariencia e idioma
  ipc.js                  Puente Tauri: sin stack traces ni evaluación de cadenas
  inspector-panel.js      Metadatos y aviso de pistas descartadas
  format-selector.js      Selección de pistas reales y contenedor
  queue-item.js           Estado concreto, progreso y acciones de cada tarea
  main.js                 Cableado de la app al motor
  styles.css              Tokens brutalistas Seyroo; sin gradientes ni sombras difusas
  favicon.svg             Marca propia Seyro-MP4
  test/                   Pruebas deterministas con node:test

docs/                     Landing estática, arquitectura, diseño y documentos legales
docs/assets/              Copia sincronizada de boot/i18n/security/theme/styles/favicon
scripts/                  check-secrets, check-frontend, check-i18n, build-icons, sync-web-assets, audit
.github/workflows/ci.yml  Núcleo, motor, escritorio, frontend, secretos y documentación
```

## Configuración local, idiomas y tema

La app y la web comparten un único registro en `localStorage`, `seyro-mp4.settings`, con `{mode, accent, customAccent, font, locale}`. `boot.js` se ejecuta de forma bloqueante en `<head>` y aplica los valores antes de pintar el body: no hay parpadeo. `theme.js` vuelve a validar todo contra listas blancas; un valor manipulado cae a los defaults.

- **Modos:** `paper`, `terminal` y `system`. CSS reacciona a `prefers-color-scheme` cuando el modo es `system`.
- **Acentos:** cinco presets y uno personalizado. `validateAccent` exige ≥4.5:1 para el texto sobre el acento y ≥3:1 contra al menos un fondo; `contrastingInk` elige entre `#111111` y `#ffffff`. El borde de los botones primarios permanece visible con acentos claros.
- **Tipografías:** grotesca del sistema, mono técnica y editorial; el mono se reserva para datos y estados, con independencia de la fuente elegida.
- **i18n:** los textos viven en `i18n.js`; `translateDom` aplica `data-i18n`, `data-i18n-title`, `data-i18n-aria` y `data-i18n-placeholder`. Toda clave ausente respalda al español. La CI verifica que es/en tengan exactamente las mismas claves y que cada clave usada en HTML exista en ambos.

No hay telemetría, ni peticiones de fuentes o CDN, ni credenciales en almacenamiento local. Los cuerpos legales siguen siendo Markdown en `docs/` y se enlazan desde ambas interfaces.

## Flujo de datos

```
URL del usuario
   │  sanitizar + validar dominio (core::security)
   ▼
Adaptador resuelto (core::adapters)
   │ Capabilities: vídeo / audio / solo metadatos / no soportado
   ▼
Inspector (yt-dlp --dump-single-json, argv)
   │  JSON → Vec<RealTrack> → filtro por altura real del origen
   ▼
InspectorPanel (Skeleton mientras llega; después tabla de pistas reales)
   │  FormatSelector: V+A / V / A, bitrate, FPS, tamaño estimado
   ▼
Cola en memoria (estados: descargando → procesando → listo / error / cancelado)
   │  progreso real leído de stderr; cancelar = kill + limpieza de parciales
   │  reintentar = nuevo ID generado en el núcleo, nunca reutilizado
   ▼
ffmpeg solo si hay mux V+A o recodificación de audio; siempre con argv
   ▼
Archivo con nombre seguro y sufijo único, dentro de ~/Seyro-MP4
   │  ruta final impresa por yt-dlp, aceptada solo si sigue confinada
```

## Verdad de calidades

- La altura del origen se toma del **máximo real** entre las pistas de vídeo devueltas. Nunca de un valor configurable.
- Una pista con `height > max_source_height` se descarta y se registra como inconsistencia; nunca se muestra.
- La etiqueta usa la altura exacta (`1080p`, `720p`, `480p`). No se redondea hacia arriba ni se inventa `2160p`.
- Para audio sin vídeo, la etiqueta es el bitrate real (`320kbps`) o `bitrate desconocido` si el origen no lo informa.
- Un FLAC generado desde una fuente con pérdida se etiqueta como **transcodificado**, no como lossless original.

Detalles operativos en [`FORMATOS.md`](FORMATOS.md).

## Seguridad aplicada

| Riesgo | Control |
| --- | --- |
| Rutas administrativas abiertas | No hay backend ni rutas de administración; Pages sirve archivos estáticos. |
| IDOR | Los IDs de trabajo los genera el núcleo; la UI no elige IDs. Cada operación verifica que el ID pertenezca a la cola en memoria. |
| Credenciales expuestas | Sin claves en código; se rechazan URL con `user:pass@`; no se solicitan tokens de plataformas. |
| Secretos en Git | `.gitignore` estricto desde el primer commit, `SECURITY.md`, CI con escaneo de patrones y revisión antes de cada push. |
| Inyección de prompts | No hay LLM en el MVP. Si se añade, los metadatos serán datos, nunca instrucciones. |
| XSS | `textContent`/`escapeHtml` para todo texto dinámico; sin `innerHTML` con datos externos; CSP estricto. |
| SQLi / inyección de comandos | Sin base de datos; procesos con `Command::new(...).args([...])`, nunca `sh -c`. |
| SSRF / path traversal | Solo HTTPS y dominios permitidos; se rechazan IPs, localhost y `..`; la ruta final se confina al directorio elegido. |
| Errores verbose | `AppError` expone código + mensaje humano; el detalle se redacta antes de copiarse. |

## Fases de entrega

1. **Base:** repositorio, licencia, seguridad, adaptadores, modelo, documentación legal y CI.
2. **Identidad y componentes:** tokens Seyroo, favicon, `Toast`, `Modal`, `Tooltip`, `Badge`, `Skeleton`, estados de foco y accesibilidad.
3. **Motor (completado):** inspector y descargador con `yt-dlp`/`ffmpeg`, cola real, diagnóstico legible y app Tauri conectada.
4. **Web y docs:** landing estática en `docs/`, enlaces legales y documentación alineada con el motor (estado actual).
5. **Auditoría final:** secretos, XSS/SSRF/traversal, consola limpia, accesibilidad y coherencia con Seyropea.

## Verificación

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test  --workspace
cargo check -p seyro-mp4-app
bash scripts/check-frontend.sh
bash scripts/check-secrets.sh
bash scripts/audit.sh
```
