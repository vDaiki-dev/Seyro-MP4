//! Inspección real con `yt-dlp --dump-single-json`.
//!
//! El JSON del extractor nunca se envía a la interfaz: se convierte a
//! `MediaInspection`, que aplica la regla de altura real del origen.

use std::process::Command;

use serde_json::Value;
use seyro_mp4_core::adapters::{all_allowed_hosts, resolve};
use seyro_mp4_core::errors::{self, AppError};
use seyro_mp4_core::model::{MediaInspection, RealTrack, TrackKind};
use seyro_mp4_core::security::{
    redact_detail, sanitize_label, validate_media_url, UrlPolicy, ALLOWED_EXTENSIONS,
};

use crate::tools::ToolPaths;

fn number(value: Option<&Value>) -> Option<f64> {
    match value {
        Some(Value::Number(number)) => number.as_f64(),
        _ => None,
    }
}

fn integer(value: Option<&Value>) -> Option<u64> {
    number(value).map(|value| value as u64)
}

fn text(value: Option<&Value>) -> Option<&str> {
    value.and_then(Value::as_str).filter(|s| !s.is_empty())
}

/// `Some` solo cuando el origen declara explícitamente el códec; `null` es
/// «desconocido», no «ausente». Las fuentes directas suelen omitirlo.
fn codec_flag(value: Option<&Value>) -> Option<bool> {
    match value {
        Some(Value::String(codec)) if !codec.is_empty() => Some(codec != "none"),
        _ => None,
    }
}

fn extension_flag(value: Option<&Value>, video: bool) -> Option<bool> {
    let extension = text(value)?.to_ascii_lowercase();
    Some(if video {
        crate::download::is_video_extension(&extension)
    } else {
        crate::download::is_audio_extension(&extension)
    })
}

fn field<'a>(format: &'a Value, names: &[&str]) -> Option<&'a Value> {
    names.iter().find_map(|name| format.get(*name))
}

/// Convierte un objeto `format` de yt-dlp en una pista verificable.
pub fn track_from_format(format: &Value) -> Option<RealTrack> {
    let raw_id = text(format.get("format_id"))?;
    let id = seyro_mp4_core::security::sanitize_id(raw_id, "");
    if id.is_empty() {
        return None;
    }
    let extension = text(format.get("ext"))
        .unwrap_or("mp4")
        .to_ascii_lowercase();
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return None;
    }

    let video = codec_flag(format.get("vcodec"))
        .or_else(|| extension_flag(format.get("video_ext"), true))
        .unwrap_or_else(|| crate::download::is_video_extension(&extension));
    let audio = codec_flag(format.get("acodec"))
        .or_else(|| extension_flag(format.get("audio_ext"), false))
        .unwrap_or_else(|| crate::download::is_audio_extension(&extension));
    let kind = match (video, audio) {
        (true, true) => TrackKind::VideoAudio,
        (true, false) => TrackKind::VideoOnly,
        (false, true) => TrackKind::AudioOnly,
        (false, false) => return None,
    };

    let mut track = RealTrack::new(&id, kind, &extension);
    track.width = integer(field(format, &["width"])).and_then(|v| u32::try_from(v).ok());
    track.height = integer(field(format, &["height"])).and_then(|v| u32::try_from(v).ok());
    track.fps = number(format.get("fps"));
    track.video_bitrate_kbps = number(format.get("tbr"))
        .map(|v| v as u32)
        .filter(|v| *v > 0);
    track.audio_bitrate_kbps = number(field(format, &["abr", "tbr"]))
        .map(|v| v as u32)
        .filter(|v| *v > 0);
    track.sample_rate_hz = integer(format.get("asr")).and_then(|v| u32::try_from(v).ok());
    track.channels = integer(format.get("channels")).and_then(|v| u8::try_from(v).ok());
    track.video_codec = text(format.get("vcodec")).map(|v| sanitize_label(v, 40));
    track.audio_codec = text(format.get("acodec")).map(|v| sanitize_label(v, 40));
    track.estimated_size_bytes = integer(field(format, &["filesize", "filesize_approx"]));
    track.requires_mux = kind == TrackKind::VideoOnly;
    Some(track)
}

/// Construye la inspección definitiva desde el JSON ya obtenido.
pub fn build_inspection(platform: &str, json: &Value) -> MediaInspection {
    let title = text(json.get("title")).unwrap_or("Sin título");
    let author = text(json.get("uploader"))
        .or_else(|| text(json.get("channel")))
        .or_else(|| text(json.get("artist")));
    let duration = integer(json.get("duration"));
    let thumbnail = text(json.get("thumbnail"));

    let mut tracks: Vec<RealTrack> = json
        .get("formats")
        .and_then(Value::as_array)
        .map(|formats| formats.iter().filter_map(track_from_format).collect())
        .unwrap_or_default();

    if tracks.is_empty() {
        // Las fuentes directas pueden no tener formatos: la propia raíz es la pista.
        let mut root = json.clone();
        if root.get("format_id").is_none() {
            root["format_id"] = Value::String("source".to_owned());
        }
        if let Some(track) = track_from_format(&root) {
            tracks.push(track);
        }
    }

    // La altura del origen es la declarada por el medio. Solo si no está
    // disponible se deduce del máximo real observado; nunca de un valor
    // configurable ni de una pista inconsistente.
    let source_height = integer(json.get("height"))
        .and_then(|height| u32::try_from(height).ok())
        .filter(|height| *height > 0)
        .or_else(|| tracks.iter().filter_map(|track| track.height).max())
        .unwrap_or(0);

    MediaInspection::finalize(
        platform,
        title,
        author,
        duration,
        thumbnail,
        source_height,
        tracks,
    )
}

/// Traduce una salida de error a un código estable, sin filtrar el detalle.
pub fn classify_failure(stderr: &str) -> AppError {
    let lowered = stderr.to_ascii_lowercase();
    if lowered.contains("drm") {
        return errors::drm();
    }
    if [
        "private video",
        "sign in",
        "log in",
        "age",
        "region",
        "not available",
        "removed",
    ]
    .iter()
    .any(|needle| lowered.contains(needle))
    {
        return errors::restricted();
    }
    if lowered.contains("unsupported url") || lowered.contains("no video") {
        return errors::unsupported_platform();
    }
    AppError::technical(
        "E_INSPECCION",
        "No se pudo inspeccionar este enlace.",
        stderr,
    )
}

/// Ejecuta la inspección y devuelve también la URL canónica validada.
/// Solo pasa esa URL como argumento separado: nunca hay shell ni interpolación.
pub fn inspect_url(tools: &ToolPaths, url: &str) -> Result<(String, MediaInspection), AppError> {
    let hosts = all_allowed_hosts();
    let policy = UrlPolicy {
        allowed_hosts: &hosts,
    };
    let validated = validate_media_url(url, &policy).map_err(|_| errors::invalid_url())?;
    let adapter = resolve(&validated).ok_or_else(errors::unsupported_platform)?;
    if !adapter.supports_download() {
        return Err(if adapter.drm {
            errors::drm()
        } else {
            errors::restricted()
        });
    }

    let output = Command::new(&tools.yt_dlp)
        .args([
            "--dump-single-json",
            "--no-warnings",
            "--no-playlist",
            "--skip-download",
            &validated.raw,
        ])
        .output()
        .map_err(|error| {
            AppError::technical(
                "E_INTERNO",
                "No se pudo ejecutar yt-dlp.",
                &error.to_string(),
            )
        })?;

    if !output.status.success() {
        return Err(classify_failure(&String::from_utf8_lossy(&output.stderr)));
    }

    let json: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
        AppError::technical(
            "E_JSON_INVALIDO",
            "yt-dlp devolvió metadatos que no se pudieron leer.",
            &redact_detail(&error.to_string(), 400),
        )
    })?;

    Ok((validated.raw, build_inspection(adapter.id, &json)))
}

/// Conveniencia para llamadas que solo necesitan la inspección.
pub fn inspect(tools: &ToolPaths, url: &str) -> Result<MediaInspection, AppError> {
    inspect_url(tools, url).map(|(_, inspection)| inspection)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Value {
        serde_json::json!({
            "title": "  Prueba real  ",
            "uploader": "Canal",
            "duration": 120,
            "thumbnail": "https://ejemplo.com/miniatura.png",
            "width": 1920,
            "height": 1080,
            "formats": [
                {"format_id":"137","ext":"mp4","vcodec":"avc1","acodec":"none",
                 "width":1920,"height":1080,"fps":30.0,"tbr":5000.0,
                 "filesize_approx":75000000},
                {"format_id":"140","ext":"m4a","vcodec":"none","acodec":"mp4a",
                 "abr":128.0,"asr":44100,"channels":2},
                {"format_id":"313","ext":"webm","vcodec":"vp9","acodec":"none",
                 "width":3840,"height":2160,"fps":30.0},
                {"format_id":"999","ext":"exe","vcodec":"avc1","acodec":"none","height":720}
            ]
        })
    }

    #[test]
    fn convierte_formatos_reales_y_descarta_lo_irreal() {
        let result = build_inspection("youtube", &sample());
        assert_eq!(result.title, "Prueba real");
        assert_eq!(result.source_height, 1080);
        assert_eq!(result.discarded_above_source, 1);
        assert_eq!(result.tracks.len(), 2);
        assert!(result.thumbnail_data_url.is_none());
        assert!(result.is_truthful());

        let video = &result.tracks[0];
        assert_eq!(video.source_format_id, "137");
        assert_eq!(video.quality_label(), "1080p");
        assert!(video.requires_mux);
        assert_eq!(video.video_codec.as_deref(), Some("avc1"));

        let audio = &result.tracks[1];
        assert_eq!(audio.source_format_id, "140");
        assert_eq!(audio.quality_label(), "128kbps");
        assert_eq!(audio.channels, Some(2));
    }

    #[test]
    fn las_fuentes_directas_sin_codec_declarado_no_se_descartan() {
        let json = serde_json::json!({
            "format_id": "mp4",
            "ext": "mp4",
            "vcodec": null,
            "video_ext": "mp4",
            "audio_ext": "none",
            "title": "Directo"
        });
        let track = track_from_format(&json).expect("pista directa verificable");
        assert_eq!(track.source_format_id, "mp4");
        assert_eq!(track.kind, TrackKind::VideoOnly);
        assert_eq!(track.video_codec, None);
        assert!(!track.quality_label().is_empty());
    }

    #[test]
    fn sin_formatos_usa_la_pista_superior() {
        let json = serde_json::json!({
            "title": "Directo", "ext": "mp4", "vcodec": "h264", "acodec": "aac",
            "width": 1280, "height": 720, "duration": 60
        });
        let result = build_inspection("directo", &json);
        assert_eq!(result.source_height, 720);
        assert_eq!(result.tracks.len(), 1);
        assert!(!result.tracks[0].requires_mux);
    }

    #[test]
    fn clasifica_restricciones_sin_filtrar_el_detalle() {
        assert_eq!(
            classify_failure("ERROR: Private video").code,
            "E_CONTENIDO_RESTRINGIDO"
        );
        assert_eq!(
            classify_failure("ERROR: unsupported url").code,
            "E_PLATAFORMA_NO_SOPORTADA"
        );
        let raw = format!(
            "fallo en /home/seyroo con gh{}p_abcdefghijklmnopqrstuvwxyz",
            ""
        );
        let error = classify_failure(&raw);
        assert_eq!(error.code, "E_INSPECCION");
        assert!(!error.diagnostic().contains("/home/seyroo"));
        assert!(!error.diagnostic().contains("ghp_"));
    }
}
