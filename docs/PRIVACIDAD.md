# Política de Privacidad

**Versión 1.0 · 2026-11-26**

Seyro-MP4 es una herramienta técnica local. No tenemos cuentas, servidores propios, pagos, telemetría, anuncios ni cookies de terceros. Lo que haces ocurre en tu dispositivo.

## Qué se procesa

- La URL que introduces, para consultar metadatos públicos del medio (título, duración, formatos disponibles).
- Los metadatos públicos que devuelve la plataforma.
- Tus preferencias locales (modo, acento, tipografía e idioma), guardadas en una única clave de `localStorage`.
- El historial de trabajos de la sesión, solo en memoria: se pierde al cerrar la app. Los archivos descargados quedan en `~/Seyro-MP4` hasta que los borras tú.

Seyro-MP4 solo realiza la consulta necesaria a la plataforma correspondiente para leer esos datos públicos. Si instalas `yt-dlp` o `ffmpeg` por tu cuenta, los ejecuta localmente como herramientas independientes; Seyro-MP4 no los distribuye ni recoge información de ellos.

## Qué no se guarda ni se envía

- Credenciales, contraseñas ni tokens de acceso.
- Contenido privado o no público.
- Telemetría, métricas de uso ni informes de errores automáticos.
- Datos personales que no hayas introducido tú mismo en la URL.

No hay base de datos nuestra, por lo que no hay transferencia a terceros. Al no recogerse datos personales, no se solicita consentimiento adicional: el tratamiento es el mínimo necesario para ejecutar la consulta que pides, en tu equipo.

## Archivos temporales y diagnóstico

Seyro-MP4 no mantiene una caché propia de metadatos: cada inspección vuelve a preguntar al origen. `yt-dlp` puede crear archivos parciales en `~/Seyro-MP4`; al cancelar se limpian solo los parciales de esa descarga. Puedes vaciar la cola de la sesión desde «Limpiar historial». En la web, elimina los datos del sitio desde la configuración del navegador.

El botón «Copiar diagnóstico» redacta el detalle antes de copiarlo: no incluye rutas de tu sistema, tokens ni la salida cruda del proceso. Tampoco hay informes de error automáticos.

## Contacto y cambios

Abre un Issue en el repositorio de Seyro-MP4 en GitHub. No incluyas datos personales ni URLs privadas en el reporte. Los cambios se publican actualizando la versión y la fecha de este documento.
