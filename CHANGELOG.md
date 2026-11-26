# Changelog

Todos los cambios relevantes se documentan aquí. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones: [Semantic Versioning](https://semver.org/lang/es/).

## [No publicado]

### Añadido
- Motor local `engine/`: inspección real con `yt-dlp --dump-single-json`, pistas verificadas contra la última consulta, filtro anti-escalado y diagnóstico redactado.
- Descarga con `argv` separado, selector de pistas reales, mux/extracción con `ffmpeg` solo cuando hace falta y progreso leído de la salida del proceso.
- Cola con estados reales (descargando, procesando, listo, error, cancelado), cancelación que mata el proceso, reintento con ID generado en el núcleo y limpieza de parciales.
- Capa Tauri v2 con IPC mínimo, CSP estricto, capacidades `core:default` e iconos generados desde el SVG maestro.
- Interfaz conectada al motor: `ipc.js`, `InspectorPanel`, `FormatSelector` y `QueueItem`, sin `innerHTML` y con i18n es/en ampliado.
- Nombres de archivo con sufijo único por trabajo para no sobrescribir descargas anteriores ni colisionar al reintentar.

### Corregido
- Las fuentes directas que declaran `vcodec: null` ya no se descartan: el tipo se infiere de `video_ext`/`audio_ext` sin inventar códecs.
- El texto estático de la landing ya no anuncia que el motor llega «en el siguiente paso».

### Auditado
- `scripts/audit.sh` reproduce localmente secretos, XSS/SSRF, shell en Rust, accesibilidad básica, iconos, i18n y compilación completa.

### Cambiado
- `Core` expone `RealTrack.quality_label` calculado en Rust; la UI ya no calcula calidades.
- CI añade jobs de motor y escritorio, con dependencias GTK/WebKit y verificación de iconos derivados del SVG.
- Interfaz local brutalista con `Toast`, `Modal`, `Tooltip`, `Badge` y `Skeleton` (matriz DIVAE), construida sin `innerHTML` ni dependencias.
- Sistema de temas papel/terminal/sistema, cinco acentos curados, color personalizado validado por contraste WCAG y tres tipografías con fallbacks del sistema.
- Español e inglés centralizados en diccionarios con respaldo automático y comprobación de paridad en CI; selector de idioma en app y web.
- Landing estática alineada con el mismo sistema visual y documentación de diseño en `docs/DESIGN.md`.
- Repositorio público con licencia GPL-3.0-only, `.gitignore` estricto y CI de higiene.
- Núcleo Rust con validación de URLs, rutas y nombres de archivo; registro de plataformas y modelo de pistas reales.
- Documentación legal: privacidad, términos, cookies/almacenamiento local y descargo anti-piratería.
- Matriz honesta de plataformas y reglas de calidades reales.
