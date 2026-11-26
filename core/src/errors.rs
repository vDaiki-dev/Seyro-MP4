//! Errores con código estable, mensaje humano y detalle redactado.
//!
//! La interfaz nunca recibe una salida cruda de un proceso ni un stack trace.

use std::fmt;

use crate::security::redact_detail;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
    /// Detalle técnico limpio, apto para «Copiar diagnóstico».
    pub detail: Option<String>,
}

impl AppError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            detail: None,
        }
    }

    pub fn technical(code: &'static str, message: impl Into<String>, raw_detail: &str) -> Self {
        Self {
            code,
            message: message.into(),
            detail: Some(redact_detail(raw_detail, 600)),
        }
    }

    /// Texto que se copia al portapapeles en el modo diagnóstico.
    pub fn diagnostic(&self) -> String {
        match &self.detail {
            Some(detail) => format!("{} · {} · detalle: {}", self.code, self.message, detail),
            None => format!("{} · {}", self.code, self.message),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for AppError {}

pub fn invalid_url() -> AppError {
    AppError::new(
        "E_URL_INVALIDA",
        "Revisa el enlace: solo se admiten URLs públicas HTTPS.",
    )
}

pub fn unsupported_platform() -> AppError {
    AppError::new(
        "E_PLATAFORMA_NO_SOPORTADA",
        "Este dominio no tiene adaptador. Puedes probar con un archivo directo.",
    )
}

pub fn restricted() -> AppError {
    AppError::new(
        "E_CONTENIDO_RESTRINGIDO",
        "El origen restringió el acceso (privacidad, región, edad o eliminación). No se intenta eludir.",
    )
}

pub fn drm() -> AppError {
    AppError::new(
        "E_DRM",
        "Este contenido está protegido por DRM. Seyro-MP4 no puede descargarlo y no intenta saltar esa protección.",
    )
}

pub fn format_unavailable() -> AppError {
    AppError::new(
        "E_FORMATO_NO_DISPONIBLE",
        "El formato solicitado no existe en este medio. Elige una pista de la tabla.",
    )
}

pub fn tool_missing(tool: &str) -> AppError {
    AppError::new(
        "E_HERRAMIENTA_FALTANTE",
        format!("Instala {tool} o usa una pista que no requiera procesado."),
    )
}

pub fn cancelled() -> AppError {
    AppError::new("E_CANCELADO", "Descarga cancelada por el usuario.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_detalle_nunca_filtra_rutas_ni_tokens() {
        let error = AppError::technical(
            "E_INTERNO",
            "No se pudo resolver el formato",
            "ffmpeg falló en /home/seyroo/proyectos con ghp_abcdefghijklmnopqrstuvwxyz",
        );
        assert!(!error.diagnostic().contains("/home/seyroo"));
        assert!(!error.diagnostic().contains("ghp_"));
        assert!(error.diagnostic().starts_with("E_INTERNO"));
        assert_eq!(cancelled().code, "E_CANCELADO");
        assert!(drm().message.contains("DRM"));
    }
}
