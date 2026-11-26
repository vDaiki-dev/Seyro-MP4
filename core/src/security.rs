//! Validación de la frontera: URLs, dominios, rutas, nombres de archivo y errores.
//!
//! Ninguna función de aquí realiza E/S de red. Las comprobaciones son
//! deterministas y se usan tanto en pruebas como en la capa de escritorio.

use std::fmt;
use std::path::{Component, Path, PathBuf};

pub const MAX_URL_LENGTH: usize = 2048;
pub const MAX_LABEL_LENGTH: usize = 200;
pub const MAX_FILENAME_LENGTH: usize = 120;
pub const MAX_THUMBNAIL_LENGTH: usize = 1_000_000;

/// Extensiones de salida permitidas. Evita nombres arbitrarios y ejecutables.
pub const ALLOWED_EXTENSIONS: [&str; 9] = [
    "mp4", "mkv", "webm", "mp3", "m4a", "aac", "opus", "ogg", "flac",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SecurityError {
    Empty,
    TooLong,
    ControlCharacter,
    InvalidScheme,
    CredentialsInUrl,
    IpLiteral,
    HostNotAllowed,
    Traversal,
    InvalidPath,
    InvalidFilename,
    ReservedFilename,
    UnsupportedExtension,
}

impl fmt::Display for SecurityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let text = match self {
            Self::Empty => "El valor está vacío",
            Self::TooLong => "El valor supera el límite de longitud",
            Self::ControlCharacter => "El valor contiene caracteres de control",
            Self::InvalidScheme => "Solo se admiten URLs HTTPS",
            Self::CredentialsInUrl => "La URL no debe contener usuario ni contraseña",
            Self::IpLiteral => "No se admiten direcciones IP ni hosts locales",
            Self::HostNotAllowed => "El dominio no está permitido",
            Self::Traversal => "La ruta contiene un segmento '..'",
            Self::InvalidPath => "La ruta no es válida o escapa del directorio elegido",
            Self::InvalidFilename => "El nombre de archivo no es válido",
            Self::ReservedFilename => "El nombre de archivo está reservado por el sistema",
            Self::UnsupportedExtension => "La extensión de salida no está soportada",
        };
        f.write_str(text)
    }
}

impl std::error::Error for SecurityError {}

/// Política de dominios permitidos. Se construye desde el registro de adaptadores.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UrlPolicy<'a> {
    pub allowed_hosts: &'a [&'a str],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedUrl {
    pub raw: String,
    pub host: String,
    /// true cuando la URL apunta directamente a un archivo multimedia conocido.
    pub is_direct_media: bool,
}

/// Elimina caracteres de control sin interpretar HTML ni escapar entidades.
pub fn strip_control_chars(value: &str) -> String {
    value.chars().filter(|c| !c.is_control()).collect()
}

/// Texto seguro para títulos, autores y mensajes visibles.
pub fn sanitize_label(value: &str, max: usize) -> String {
    strip_control_chars(value)
        .trim()
        .chars()
        .take(max)
        .collect()
}

/// Identificadores para atributos y claves internas: solo [A-Za-z0-9_-].
pub fn sanitize_id(value: &str, fallback: &str) -> String {
    let id = strip_control_chars(value);
    if (1..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        id
    } else {
        fallback.to_owned()
    }
}

fn host_matches(host: &str, allowed: &[&str]) -> bool {
    allowed
        .iter()
        .any(|domain| host == *domain || host.strip_suffix(&format!(".{domain}")).is_some())
}

fn direct_media_extension(path: &str) -> bool {
    let path = path.split(['?', '#']).next().unwrap_or("");
    let name = path.rsplit('/').next().unwrap_or("");
    let ext = name.rsplit_once('.').map(|(_, e)| e.to_ascii_lowercase());
    ext.is_some_and(|e| ALLOWED_EXTENSIONS.contains(&e.as_str()))
}

/// Valida una URL pública HTTPS contra la política de dominios.
///
/// Rechaza credenciales, IPs, localhost, esquemas distintos de HTTPS,
/// caracteres de control, barras invertidas y segmentos de traversal.
pub fn validate_media_url(
    input: &str,
    policy: &UrlPolicy<'_>,
) -> Result<ValidatedUrl, SecurityError> {
    if input.trim().is_empty() {
        return Err(SecurityError::Empty);
    }
    if input.chars().any(char::is_control) {
        return Err(SecurityError::ControlCharacter);
    }
    let raw = input.trim();
    if raw.len() > MAX_URL_LENGTH {
        return Err(SecurityError::TooLong);
    }
    let rest = raw
        .strip_prefix("https://")
        .ok_or(SecurityError::InvalidScheme)?;
    let authority_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let authority = &rest[..authority_end];
    if authority.is_empty() || authority.contains('@') {
        return Err(SecurityError::CredentialsInUrl);
    }
    if authority.starts_with('[') {
        return Err(SecurityError::IpLiteral);
    }
    let host = authority
        .split(':')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    if host.is_empty()
        || host.parse::<std::net::IpAddr>().is_ok()
        || host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
    {
        return Err(SecurityError::IpLiteral);
    }
    if !host_matches(&host, policy.allowed_hosts) {
        return Err(SecurityError::HostNotAllowed);
    }
    let tail = &rest[authority_end..];
    let lowered = tail.to_ascii_lowercase();
    if lowered.contains("..")
        || lowered.contains("%2e%2e")
        || lowered.contains('\\')
        || lowered.contains("%5c")
    {
        return Err(SecurityError::Traversal);
    }
    Ok(ValidatedUrl {
        raw: raw.to_owned(),
        host,
        is_direct_media: direct_media_extension(tail),
    })
}

fn is_reserved_windows_name(stem: &str) -> bool {
    let base = stem.split('.').next().unwrap_or("").to_ascii_uppercase();
    let numeric = base.len() == 4
        && (base.starts_with("COM") || base.starts_with("LPT"))
        && base.as_bytes()[3].is_ascii_digit()
        && base.as_bytes()[3] != b'0';
    matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL") || numeric
}

/// Construye un nombre de archivo limpio a partir del título y la calidad real.
pub fn safe_filename(title: &str, quality: &str, extension: &str) -> Result<String, SecurityError> {
    let ext = extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();
    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(SecurityError::UnsupportedExtension);
    }
    let clean = |value: &str, max: usize| -> String {
        sanitize_label(value, max)
            .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], " ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .trim_matches(|c| c == '.' || c == ' ')
            .chars()
            .take(max)
            .collect::<String>()
            .trim()
            .trim_end_matches('.')
            .to_owned()
    };
    let base = clean(title, 90);
    let base = if base.is_empty() {
        "Seyro-MP4".to_owned()
    } else {
        base
    };
    let quality = clean(quality, 24);
    let mut stem = if quality.is_empty() {
        base
    } else {
        format!("{base} - {quality}")
    };
    if stem.chars().count() > MAX_FILENAME_LENGTH {
        stem = stem.chars().take(MAX_FILENAME_LENGTH).collect();
    }
    if is_reserved_windows_name(&stem) {
        stem.insert(0, '_');
    }
    Ok(format!("{stem}.{ext}"))
}

/// Confina un nombre de archivo dentro del directorio elegido por el usuario.
pub fn confine_output(directory: &Path, filename: &str) -> Result<PathBuf, SecurityError> {
    if filename.is_empty() || filename.as_bytes().contains(&0) {
        return Err(SecurityError::InvalidFilename);
    }
    let name = Path::new(filename);
    if name.components().count() != 1 {
        return Err(SecurityError::Traversal);
    }
    if !matches!(name.components().next(), Some(Component::Normal(_))) {
        return Err(SecurityError::InvalidFilename);
    }
    let dir = if let Ok(real) = std::fs::canonicalize(directory) {
        real
    } else {
        directory.to_path_buf()
    };
    let full = dir.join(name);
    if full.components().any(|c| c == Component::ParentDir) {
        return Err(SecurityError::Traversal);
    }
    // Un archivo existente no debe ser un enlace simbólico hacia fuera.
    if let Ok(real_full) = std::fs::canonicalize(&full) {
        if !real_full.starts_with(&dir) {
            return Err(SecurityError::InvalidPath);
        }
    }
    Ok(full)
}

/// Miniatura permitida: solo data URL de imagen embebida, nunca remota.
pub fn safe_thumbnail(src: &str, max: usize) -> Option<String> {
    let value = strip_control_chars(src);
    if value.len() > max {
        return None;
    }
    let (header, data) = value.split_once(",")?;
    if !matches!(
        header,
        "data:image/png;base64"
            | "data:image/jpeg;base64"
            | "data:image/jpg;base64"
            | "data:image/webp;base64"
    ) {
        return None;
    }
    if data.is_empty()
        || !data
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/' || b == b'=')
    {
        return None;
    }
    Some(value)
}

/// Recorta un detalle técnico para el modo diagnóstico sin filtrar secretos.
pub fn redact_detail(raw: &str, max: usize) -> String {
    let cleaned = strip_control_chars(raw);
    let redacted = cleaned
        .split_whitespace()
        .map(|token| {
            let lower = token.to_ascii_lowercase();
            let sensitive = lower.contains("/home/")
                || lower.contains("/users/")
                || lower.contains("c:\\users\\")
                || lower.contains("ghp_")
                || lower.contains("github_pat_")
                || lower.starts_with("file://")
                || (lower.contains("://") && lower.contains('@'));
            let long_opaque = token.len() >= 24
                && token
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');
            if sensitive || long_opaque {
                "<redactado>"
            } else {
                token
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    redacted.chars().take(max).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOSTS: [&str; 6] = [
        "youtube.com",
        "youtu.be",
        "music.youtube.com",
        "instagram.com",
        "tiktok.com",
        "spotify.com",
    ];

    fn policy() -> UrlPolicy<'static> {
        UrlPolicy {
            allowed_hosts: &HOSTS,
        }
    }

    #[test]
    fn acepta_url_publica_con_consulta() {
        let url = validate_media_url("https://www.youtube.com/watch?v=abc123&t=3", &policy())
            .expect("URL válida");
        assert_eq!(url.host, "www.youtube.com");
        assert!(!url.is_direct_media);
    }

    #[test]
    fn rechaza_credenciales_ip_localhost_y_esquema() {
        assert_eq!(
            validate_media_url("http://youtube.com/watch?v=x", &policy()),
            Err(SecurityError::InvalidScheme)
        );
        assert_eq!(
            validate_media_url("https://user:pass@youtube.com/watch", &policy()),
            Err(SecurityError::CredentialsInUrl)
        );
        assert_eq!(
            validate_media_url("https://127.0.0.1/x", &policy()),
            Err(SecurityError::IpLiteral)
        );
        assert_eq!(
            validate_media_url("https://localhost/x", &policy()),
            Err(SecurityError::IpLiteral)
        );
        assert_eq!(
            validate_media_url("https://example.com/x", &policy()),
            Err(SecurityError::HostNotAllowed)
        );
    }

    #[test]
    fn rechaza_traversal_y_caracteres_de_control() {
        assert_eq!(
            validate_media_url("https://youtube.com/a/../b", &policy()),
            Err(SecurityError::Traversal)
        );
        assert_eq!(
            validate_media_url("https://youtube.com/a%5cb", &policy()),
            Err(SecurityError::Traversal)
        );
        assert_eq!(
            validate_media_url("https://youtube.com/x\n", &policy()),
            Err(SecurityError::ControlCharacter)
        );
    }

    #[test]
    fn reconoce_archivo_directo_y_su_extension() {
        let url = validate_media_url("https://youtube.com/media/clip.mp4", &policy()).unwrap();
        assert!(url.is_direct_media);
        assert_eq!(
            safe_filename("Mi vídeo", "1080p", "mp4").unwrap(),
            "Mi vídeo - 1080p.mp4"
        );
        assert_eq!(safe_filename("CON", "", "mp3").unwrap(), "_CON.mp3");
        assert!(!safe_filename("../ruta/../x", "", "mp3")
            .unwrap()
            .contains('/'));
        assert!(safe_filename("x", "", "exe").is_err());
    }

    #[test]
    fn confina_ruta_y_detecta_enlaces_externos() {
        let root = std::env::temp_dir().join(format!("seyro-mp4-seguridad-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&root);
        assert!(confine_output(&root, "../escape.mp4").is_err());
        assert!(confine_output(&root, "a/b.mp4").is_err());
        assert_eq!(
            confine_output(&root, "clip - 720p.mp4").unwrap(),
            root.join("clip - 720p.mp4")
        );

        #[cfg(unix)]
        {
            let target = std::env::temp_dir().join("seyro-mp4-objetivo.mp4");
            let link = root.join("enlace.mp4");
            let _ = std::fs::write(&target, b"x");
            let _ = std::fs::remove_file(&link);
            std::os::unix::fs::symlink(&target, &link).expect("symlink de prueba");
            assert!(confine_output(&root, "enlace.mp4").is_err());
            let _ = std::fs::remove_file(&link);
            let _ = std::fs::remove_file(&target);
        }
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn redacta_rutas_y_tokens_en_diagnostico() {
        let raw =
            "error en /home/seyroo/proyecto con ghp_abcdefghijklmnopqrstuvwxyz y https://u:p@x/y";
        let detail = redact_detail(raw, 500);
        assert!(!detail.contains("/home/seyroo"));
        assert!(!detail.contains("ghp_"));
        assert!(!detail.contains("https://u:p@x/y"));
        assert!(detail.contains("<redactado>"));
        assert!(redact_detail("a".repeat(900).as_str(), 20).len() <= 20);
    }

    #[test]
    fn sanitiza_etiquetas_e_ids() {
        assert_eq!(sanitize_label("  Hola\u{0007} mundo  ", 20), "Hola mundo");
        assert_eq!(sanitize_id("bueno_1", "x"), "bueno_1");
        assert_eq!(sanitize_id("../mal", "x"), "x");
        assert!(safe_thumbnail("data:image/png;base64,AAAA", 1000).is_some());
        assert!(safe_thumbnail("https://ejemplo.com/x.png", 1000).is_none());
    }
}
