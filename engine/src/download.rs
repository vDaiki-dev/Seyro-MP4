//! Construcción segura de la orden de descarga y rutas de salida.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use seyro_mp4_core::errors::{self, AppError};
use seyro_mp4_core::security::{
    confine_output, safe_filename, sanitize_id, ALLOWED_EXTENSIONS, MAX_FILENAME_LENGTH,
};

/// Petición enviada por la interfaz. Los IDs se comprueban contra la última
/// inspección antes de convertirse en argumentos.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub url: String,
    pub video_id: Option<String>,
    pub audio_id: Option<String>,
    pub title: String,
    pub quality: String,
    pub extension: String,
}

/// Evento real del proceso: progreso, cambio de fase o último error legible.
#[derive(Debug, Clone, PartialEq)]
pub enum ProgressEvent {
    Downloading(f64),
    Processing,
    Diagnostic(String),
    FinalPath(String),
}

pub fn is_video_extension(extension: &str) -> bool {
    matches!(extension, "mp4" | "mkv" | "webm")
}

pub fn is_audio_extension(extension: &str) -> bool {
    matches!(extension, "mp3" | "m4a" | "aac" | "opus" | "ogg" | "flac")
}

/// Formato que yt-dlp/ffmpeg entienden para la extracción de audio.
pub fn audio_format_arg(extension: &str) -> Option<&'static str> {
    match extension {
        "mp3" => Some("mp3"),
        "m4a" => Some("m4a"),
        "aac" => Some("aac"),
        "opus" => Some("opus"),
        "ogg" => Some("vorbis"),
        "flac" => Some("flac"),
        _ => None,
    }
}

/// Directorio propio y predecible dentro del hogar del usuario.
pub fn download_dir(home: &Path) -> PathBuf {
    home.join("Seyro-MP4")
}

pub fn default_home() -> PathBuf {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
}

/// Crea el directorio y devuelve la plantilla `-o` con `%(ext)s`.
///
/// `unique` es el ID generado por el núcleo: se añade como sufijo corto para
/// que dos descargas del mismo título no se sobrescriban, incluso al reintentar.
pub fn output_template(
    home: &Path,
    title: &str,
    quality: &str,
    extension: &str,
    unique: &str,
) -> Result<PathBuf, AppError> {
    if !ALLOWED_EXTENSIONS.contains(&extension) {
        return Err(errors::format_unavailable());
    }
    let directory = download_dir(home);
    std::fs::create_dir_all(&directory).map_err(|error| {
        AppError::technical(
            "E_DIRECTORIO",
            "No se pudo crear la carpeta de descargas.",
            &error.to_string(),
        )
    })?;
    let mut filename = safe_filename(title, quality, extension)
        .map_err(|error| AppError::new("E_NOMBRE_INVALIDO", error.to_string()))?;
    let suffix: String = sanitize_id(unique, "")
        .chars()
        .rev()
        .take(12)
        .collect::<Vec<char>>()
        .into_iter()
        .rev()
        .collect();
    if !suffix.is_empty() {
        let stem = filename
            .strip_suffix(&format!(".{extension}"))
            .unwrap_or(&filename);
        let keep = MAX_FILENAME_LENGTH.saturating_sub(suffix.chars().count() + 1);
        let stem = stem.chars().take(keep).collect::<String>();
        filename = format!("{stem}-{suffix}.{extension}");
    }
    let full = confine_output(&directory, &filename)
        .map_err(|_| AppError::new("E_RUTA_INVALIDA", "La ruta de salida no es segura."))?;
    Ok(full.with_extension("%(ext)s"))
}

/// Ruta esperada si yt-dlp no imprime una ruta final verificable.
pub fn fallback_path(template: &Path, extension: &str) -> PathBuf {
    PathBuf::from(template.to_string_lossy().replace("%(ext)s", extension))
}

/// Acepta la ruta impresa por yt-dlp solo si sigue confinada al directorio.
pub fn accepted_final_path(template: &Path, candidate: &str) -> Option<PathBuf> {
    let directory = template.parent()?;
    let trimmed = candidate.trim();
    if trimmed.is_empty() || trimmed.contains("..") || trimmed.contains('\\') {
        return None;
    }
    let path = Path::new(trimmed);
    let name = path.file_name()?.to_str()?;
    if path.is_absolute() {
        let base = std::fs::canonicalize(directory).unwrap_or_else(|_| directory.to_path_buf());
        let real = std::fs::canonicalize(path).ok()?;
        if !real.starts_with(base) {
            return None;
        }
    }
    confine_output(directory, name).ok()
}

/// Argumentos separados: nunca se interpola una cadena en un shell.
pub fn build_argv(
    selector: &str,
    template: &Path,
    container: Option<&str>,
    audio_format: Option<&str>,
    url: &str,
) -> Vec<OsString> {
    let mut arguments: Vec<OsString> = [
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "--print",
        "after_move:filepath",
        "-f",
        selector,
        "-o",
    ]
    .iter()
    .map(OsString::from)
    .collect();
    arguments.push(template.as_os_str().to_os_string());
    if let Some(container) = container {
        arguments.push(OsString::from("--merge-output-format"));
        arguments.push(OsString::from(container));
    }
    if let Some(format) = audio_format {
        arguments.push(OsString::from("--extract-audio"));
        arguments.push(OsString::from("--audio-format"));
        arguments.push(OsString::from(format));
    }
    arguments.push(OsString::from(url));
    arguments
}

/// Extrae el porcentaje real de una línea de progreso de yt-dlp.
pub fn progress_from_line(line: &str) -> Option<f64> {
    let start = line.find("[download]")?;
    let token = line[start + "[download]".len()..]
        .split_whitespace()
        .find(|part| part.ends_with('%'))?;
    token
        .trim_end_matches('%')
        .parse::<f64>()
        .ok()
        .filter(|value| (0.0..=100.0).contains(value))
}

/// Clasifica una línea de salida en un evento observable por la cola.
pub fn event_from_line(line: &str) -> Option<ProgressEvent> {
    if let Some(percent) = progress_from_line(line) {
        return Some(ProgressEvent::Downloading(percent));
    }
    let lowered = line.to_ascii_lowercase();
    if lowered.contains("[ffmpeg]")
        || lowered.contains("[extractaudio]")
        || lowered.contains("merging formats")
    {
        return Some(ProgressEvent::Processing);
    }
    if lowered.contains("error:") || lowered.contains("ERROR:") {
        return Some(ProgressEvent::Diagnostic(line.trim().to_owned()));
    }
    None
}

/// Borra solo restos temporales de esta misma plantilla al cancelar.
pub fn cleanup_partials(template: &Path) {
    let Some(parent) = template.parent() else {
        return;
    };
    let printed = template.to_string_lossy().replace("%(ext)s", "");
    let Some(name) = Path::new(&printed).file_name().and_then(|v| v.to_str()) else {
        return;
    };
    let Ok(entries) = std::fs::read_dir(parent) else {
        return;
    };
    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let value = file_name.to_string_lossy();
        if value.starts_with(name)
            && [".part", ".ytdl", ".temp"]
                .iter()
                .any(|suffix| value.ends_with(suffix))
        {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extensiones_separadas_por_tipo() {
        assert!(is_video_extension("mp4"));
        assert!(!is_video_extension("mp3"));
        assert!(is_audio_extension("opus"));
        assert!(!is_audio_extension("webm"));
        assert_eq!(audio_format_arg("ogg"), Some("vorbis"));
        assert_eq!(audio_format_arg("mp4"), None);
    }

    #[test]
    fn la_plantilla_confina_el_nombre_y_limita_la_extension() {
        let root = std::env::temp_dir().join(format!("seyro-mp4-salida-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&root);
        let template =
            output_template(&root, "../Título: raro", "1080p", "mp4", "job-1-a").unwrap();
        assert!(template.starts_with(download_dir(&root)));
        assert!(template.to_string_lossy().ends_with(".%(ext)s"));
        assert!(!template.to_string_lossy().contains(".."));
        assert_eq!(
            fallback_path(&template, "mp4")
                .extension()
                .and_then(|v| v.to_str()),
            Some("mp4")
        );
        assert!(output_template(&root, "x", "", "exe", "job-1-a").is_err());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn el_sufijo_evita_sobrescribir_y_no_rompe_el_confinamiento() {
        let root = std::env::temp_dir().join(format!("seyro-mp4-sufijo-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&root);
        let first = output_template(&root, "Mismo título", "1080p", "mp4", "job-1-a").unwrap();
        let second = output_template(&root, "Mismo título", "1080p", "mp4", "job-1-b").unwrap();
        assert_ne!(first, second);
        assert!(first.starts_with(download_dir(&root)));
        assert!(first.to_string_lossy().contains("-a.%(ext)s"));
        assert!(second.to_string_lossy().contains("-b.%(ext)s"));
        let hostile = output_template(&root, "x", "", "mp4", "../../malicious").unwrap();
        assert!(hostile.starts_with(download_dir(&root)));
        assert!(!hostile.to_string_lossy().contains(".."));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn la_ruta_final_impresa_no_puede_salir_del_directorio() {
        let root = std::env::temp_dir().join(format!("seyro-mp4-ruta-{}", std::process::id()));
        let template = root.join("video.%(ext)s");
        let _ = std::fs::create_dir_all(&root);
        let real = root.join("video.mp4");
        let _ = std::fs::write(&real, b"");
        assert_eq!(
            accepted_final_path(&template, &real.to_string_lossy()),
            Some(real.clone())
        );
        assert!(accepted_final_path(&template, "../video.mp4").is_none());
        assert!(accepted_final_path(&template, "/tmp/video.mp4").is_none());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn los_argumentos_van_separados_y_el_progreso_es_real() {
        let arguments = build_argv(
            "137+140",
            Path::new("/tmp/x.%(ext)s"),
            Some("mp4"),
            None,
            "https://youtube.com/watch?v=a;b",
        );
        assert_eq!(arguments.len(), 12);
        assert_eq!(arguments[6], "137+140");
        assert_eq!(arguments[8], "/tmp/x.%(ext)s");
        assert_eq!(arguments[10], "mp4");
        assert!(arguments.last().unwrap().to_string_lossy().contains("a;b"));

        assert_eq!(
            event_from_line("[download]  45.2% of 10.00MiB"),
            Some(ProgressEvent::Downloading(45.2))
        );
        assert_eq!(
            event_from_line("[ffmpeg] Merging formats"),
            Some(ProgressEvent::Processing)
        );
        assert_eq!(event_from_line("[download] Destination: x.mp4"), None);
        assert_eq!(event_from_line("[download] 999% of x"), None);
    }
}
