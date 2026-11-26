# Política de seguridad

## Reportar un problema

Abre un **Issue privado** usando el canal *Security* de GitHub en este repositorio, o usa el formulario de reporte de vulnerabilidades de GitHub. No publiques detalles explotables en un Issue público ni incluyas datos personales.

Incluye: versión/commit, sistema operativo, pasos mínimos para reproducirlo y el impacto esperado. Respondemos con una confirmación y, si procede, una corrección antes de divulgar el detalle.

## Alcance

- Núcleo Rust (`core/`): validación de URL, rutas, nombres de archivo y redacción de errores.
- Capa de escritorio y frontend cuando estén publicadas.
- Web estática de GitHub Pages.

## Fuera de alcance

- Vulnerabilidades en `yt-dlp`, `ffmpeg` o en las plataformas de terceros: repórtalas a sus proyectos.
- Contenido privado o protegido por DRM: Seyro-MP4 no intenta acceder a él.
- Fallos derivados de usar versiones no actualizadas de herramientas externas.

## Compromisos del proyecto

Sin secretos en el repositorio, sin rutas administrativas, sin telemetría, sin ejecución de comandos por shell, sin `innerHTML` con datos externos y sin stack traces en la interfaz. La CI verifica formato, análisis estático, pruebas del núcleo y ausencia de patrones de credenciales en archivos versionados.
