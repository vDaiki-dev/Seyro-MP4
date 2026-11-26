# Política de seguridad

## Reportar un problema

Abre un **Issue privado** usando el canal *Security* de GitHub en este repositorio, o usa el formulario de reporte de vulnerabilidades de GitHub. No publiques detalles explotables en un Issue público ni incluyas datos personales.

Incluye: versión/commit, sistema operativo, pasos mínimos para reproducirlo y el impacto esperado. Respondemos con una confirmación y, si procede, una corrección antes de divulgar el detalle.

## Alcance

- Núcleo Rust (`core/`): validación de URL, rutas, nombres de archivo, IDs de trabajo y redacción de errores.
- Motor (`engine/`): allowlist de formatos contra la última inspección, argv separado, confinamiento de rutas y cancelación.
- Capa Tauri y frontend: IPC mínimo, CSP, sanitización sin `innerHTML` y persistencia local.
- Web estática de GitHub Pages.

## Fuera de alcance

- Vulnerabilidades en `yt-dlp`, `ffmpeg` o en las plataformas de terceros: repórtalas a sus proyectos.
- Contenido privado o protegido por DRM: Seyro-MP4 no intenta acceder a él.
- Fallos derivados de usar versiones no actualizadas de herramientas externas.

## Compromisos del proyecto

Sin secretos en el repositorio, sin rutas administrativas, sin telemetría, sin ejecución de comandos por shell, sin `innerHTML` con datos externos y sin stack traces en la interfaz. La CI verifica formato, análisis estático, pruebas del núcleo y del motor, compilación de la capa Tauri, i18n, assets sincronizados e higiene de secretos en archivos versionados.
