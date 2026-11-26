# Formatos, plataformas y calidades reales

**Versión 1.0 · 2026-11-26**

## Regla de oro

Seyro-MP4 **inspecciona antes de prometer**. Si el medio original se subió a 1080p, la interfaz mostrará como máximo `1080p`: nunca `1440p`, nunca `2160p` y nunca una etiqueta bonita calculada desde un valor inventado.

- La altura máxima del origen es el mayor `height` real entre las pistas de vídeo devueltas.
- Las pistas por encima de ese valor se descartan y se cuentan como incidencia interna, no como opción disponible.
- La etiqueta de vídeo usa la altura exacta: `1080p`, `720p`, `480p`, `360p`.
- La etiqueta de audio usa el bitrate real: `320kbps`, `192kbps`, o `bitrate desconocido`.
- `filesize`/`filesize_approx` o `bitrate × duración` solo se muestran como **estimación** cuando hay datos suficientes; si no, se dice «tamaño no disponible».

## Matriz de plataformas

| Plataforma | Dominios | Vídeo | Audio | Estado | Límites honestos |
| --- | --- | --- | --- | --- | --- |
| YouTube | `youtube.com`, `youtu.be`, `music.youtube.com` | Sí | Sí | Soporte prioritario | Vídeo y audio pueden venir en pistas separadas → mux con `ffmpeg`. Contenido público; sin elusión de age-gate, región o privacidad. |
| YouTube Music | `music.youtube.com` | No garantizado | Sí | Parcial | El origen está orientado a audio; muchas canciones tienen DRM o no exponen vídeo. Si solo hay metadatos, se dice claramente. |
| Instagram | `instagram.com` | Sí | Solo dentro del vídeo | Parcial | Publicaciones y reels públicos. Cuentas privadas, historias efímeras y contenido con acceso restringido: **no soportado**. |
| TikTok | `tiktok.com`, `vm.tiktok.com` | Sí | Solo dentro del vídeo | Parcial | Vídeos públicos. Restricciones de edad, región o eliminación del vídeo pueden bloquear la consulta; se muestra el motivo concreto. |
| Spotify | `open.spotify.com` | No | No | **No descargable** | Contenido protegido por DRM. La app lo reconoce y explica que no puede descargarlo; no intenta eludir la protección. |
| Archivo directo | Cualquier host público con URL HTTPS terminada en `.mp4`, `.webm`, `.mkv`, `.mp3`, `.m4a`, `.aac`, `.opus`, `.ogg`, `.flac` | Según archivo | Según archivo | Básico | Sin extracción de plataforma: se descarga el archivo indicado. Se rechazan IP, localhost, credenciales y rutas relativas. Las plataformas registradas siguen limitadas a su dominio. |

«Parcial» significa que la inspección puede funcionar pero los formatos dependen del medio concreto. Ninguna fila garantiza resolución, bitrate o disponibilidad: eso lo decide el inspector.

## Audio y vídeo

- **Vídeo+audio integrados:** un único archivo; sin procesado adicional y sin necesidad de `ffmpeg`.
- **Vídeo solo + audio solo:** se descargan por separado y se combinan con `ffmpeg` (`--merge-output-format`) si el usuario elige ambas pistas. Si falta `ffmpeg`, la operación se bloquea con `E_HERRAMIENTA_FALTANTE`; se puede elegir una pista con audio integrado o solo audio.
- **Solo audio:** mp3, m4a/AAC, Opus, Vorbis (.ogg) y FLAC. Si la extensión elegida coincide con la del origen se descarga tal cual; si no, hace falta `ffmpeg` y se marca como **transcodificado**. Un FLAC creado desde una fuente con pérdida se etiqueta como transcodificado, nunca como máster sin pérdida.
- **Contenedores de vídeo:** mp4, mkv y webm. El contenedor elegido se respeta en el mux; no se inventa una extensión que el origen no ofrece.
- **Sin escalado:** Seyro-MP4 no interpola vídeo para simular más resolución. La conversión de formato no cambia la altura real.

## Nombres de archivo

Se generan desde el título saneado: `Titulo - 1080p-<sufijo>.mp4` o `Titulo - 320kbps-<sufijo>.mp3`. Se eliminan separadores de ruta, caracteres reservados, caracteres de control y nombres reservados de Windows; se limita la longitud a 120 caracteres. El sufijo deriva del ID de trabajo generado en el núcleo: dos descargas del mismo título, o un reintento, nunca se sobrescriben. Nunca se usa el título sin saneamiento como ruta y la ruta final impresa por `yt-dlp` solo se acepta si sigue confinada a `~/Seyro-MP4`.

## Catálogo de errores legibles

| Código | Mensaje que ve el usuario |
| --- | --- |
| `E_URL_INVALIDA` | «Revisa el enlace: solo se admiten URLs públicas HTTPS.» |
| `E_PLATAFORMA_NO_SOPORTADA` | «Este dominio no tiene adaptador. Puedes probar con un archivo directo.» |
| `E_CONTENIDO_RESTRINGIDO` | «El origen restringió el acceso (privacidad, región, edad o eliminación). No se intenta eludir.» |
| `E_DRM` | «Este contenido está protegido por DRM. Seyro-MP4 no puede descargarlo y no intenta saltar esa protección.» |
| `E_FORMATO_NO_DISPONIBLE` | «El formato solicitado no existe en este medio. Elige una pista de la tabla.» |
| `E_HERRAMIENTA_FALTANTE` | «Instala yt-dlp/ffmpeg o usa una pista que no requiera procesado.» |
| `E_INSPECCION` | «No se pudo inspeccionar este enlace.» |
| `E_JSON_INVALIDO` | «La herramienta devolvió metadatos que no se pudieron leer.» |
| `E_RUTA_INVALIDA` / `E_NOMBRE_INVALIDO` / `E_DIRECTORIO` | «La ruta o el nombre de salida no son seguros o no se pudieron crear.» |
| `E_DESCARGA` | «La descarga falló; revisa el diagnóstico.» |
| `E_TRABAJO_NO_ENCONTRADO` | «Ese trabajo ya no existe en la cola.» |
| `E_INTERNO` | «Se produjo un error local. Puedes copiar un diagnóstico sin datos sensibles.» |
| `IPC_NO_DISPONIBLE` | «Esta acción solo está disponible en la aplicación de escritorio.» |
| `E_CANCELADO` | «Descarga cancelada por el usuario.» |

El botón «Copiar diagnóstico» incluye código, plataforma y motivo, nunca rutas del sistema, tokens ni la salida cruda del proceso.
