//! Registro de plataformas y capacidades reales.
//!
//! Un adaptador no promete formatos: declara qué tipo de contenido puede
//! inspeccionar y qué límites tiene. El inspector decide después qué pistas
//! existen de verdad.

use crate::security::ValidatedUrl;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SupportLevel {
    /// Vídeo y audio disponibles en condiciones normales.
    Full,
    /// Solo algunos medios públicos; depende del origen concreto.
    Partial,
    /// Se pueden leer metadatos, pero no descargar contenido.
    MetadataOnly,
    /// Sin adaptador: se explica en lugar de dar un error genérico.
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlatformAdapter {
    pub id: &'static str,
    pub label: &'static str,
    pub domains: &'static [&'static str],
    pub video: bool,
    pub audio: bool,
    pub drm: bool,
    pub support: SupportLevel,
    pub note: &'static str,
}

impl PlatformAdapter {
    /// La descarga solo se ofrece cuando no hay DRM y hay un tipo de pista útil.
    pub fn supports_download(&self) -> bool {
        !self.drm
            && matches!(self.support, SupportLevel::Full | SupportLevel::Partial)
            && (self.video || self.audio)
    }

    /// Posibilidad de combinar vídeo y audio de pistas separadas.
    pub fn can_mux(&self) -> bool {
        self.supports_download() && self.video && self.audio
    }
}

/// El orden importa: las coincidencias exactas se resuelven antes que los sufijos.
pub const ADAPTERS: [PlatformAdapter; 6] = [
    PlatformAdapter {
        id: "youtube_music",
        label: "YouTube Music",
        domains: &["music.youtube.com"],
        video: false,
        audio: true,
        drm: false,
        support: SupportLevel::Partial,
        note: "Orientado a audio; la disponibilidad depende de cada pista pública.",
    },
    PlatformAdapter {
        id: "youtube",
        label: "YouTube",
        domains: &["youtube.com", "youtu.be"],
        video: true,
        audio: true,
        drm: false,
        support: SupportLevel::Full,
        note: "Público. Vídeo y audio pueden venir separados y requerir mux.",
    },
    PlatformAdapter {
        id: "instagram",
        label: "Instagram",
        domains: &["instagram.com"],
        video: true,
        audio: false,
        drm: false,
        support: SupportLevel::Partial,
        note: "Solo contenido público; cuentas privadas e historias no soportadas.",
    },
    PlatformAdapter {
        id: "tiktok",
        label: "TikTok",
        domains: &["tiktok.com", "vm.tiktok.com"],
        video: true,
        audio: false,
        drm: false,
        support: SupportLevel::Partial,
        note: "Solo vídeos públicos; restricciones de región o edad pueden bloquear.",
    },
    PlatformAdapter {
        id: "spotify",
        label: "Spotify",
        domains: &["open.spotify.com", "spotify.com"],
        video: false,
        audio: false,
        drm: true,
        support: SupportLevel::MetadataOnly,
        note: "Contenido protegido por DRM: no descargable, sin elusión.",
    },
    PlatformAdapter {
        id: "directo",
        label: "Archivo directo",
        domains: &[],
        video: true,
        audio: true,
        drm: false,
        support: SupportLevel::Partial,
        note: "URL HTTPS directa a un archivo multimedia conocido.",
    },
];

/// Dominios que la política de URLs debe aceptar.
pub fn all_allowed_hosts() -> Vec<&'static str> {
    ADAPTERS
        .iter()
        .flat_map(|adapter| adapter.domains.iter().copied())
        .collect()
}

/// Resuelve un host por coincidencia exacta primero y por subdominio después.
pub fn resolve_host(host: &str) -> Option<&'static PlatformAdapter> {
    let host = host.trim().trim_end_matches('.').to_ascii_lowercase();
    ADAPTERS
        .iter()
        .find(|adapter| adapter.domains.contains(&host.as_str()))
        .or_else(|| {
            ADAPTERS.iter().find(|adapter| {
                adapter
                    .domains
                    .iter()
                    .any(|domain| host.strip_suffix(&format!(".{domain}")).is_some())
            })
        })
}

/// Resuelve el adaptador correspondiente a una URL ya validada.
pub fn resolve(url: &ValidatedUrl) -> Option<&'static PlatformAdapter> {
    if url.is_direct_media {
        ADAPTERS.iter().find(|adapter| adapter.id == "directo")
    } else {
        resolve_host(&url.host)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::security::{validate_media_url, UrlPolicy};

    #[test]
    fn youtube_music_gana_sobre_youtube_por_coincidencia_exacta() {
        assert_eq!(
            resolve_host("music.youtube.com").map(|a| a.id),
            Some("youtube_music")
        );
        assert_eq!(
            resolve_host("www.youtube.com").map(|a| a.id),
            Some("youtube")
        );
        assert_eq!(resolve_host("youtu.be").map(|a| a.id), Some("youtube"));
        assert_eq!(resolve_host("example.org").map(|a| a.id), None);
    }

    #[test]
    fn spotify_no_ofrece_descarga_y_lo_dice() {
        let spotify = resolve_host("open.spotify.com").unwrap();
        assert!(!spotify.supports_download());
        assert!(spotify.drm);
        assert!(spotify.note.contains("DRM"));
        assert!(!spotify.can_mux());
    }

    #[test]
    fn matriz_de_capacidades_es_coherente() {
        for adapter in ADAPTERS {
            assert!(!adapter.note.is_empty(), "{} sin nota", adapter.id);
            if adapter.supports_download() {
                assert!(adapter.video || adapter.audio);
                assert!(!adapter.drm);
            }
        }
        let youtube = resolve_host("youtube.com").unwrap();
        assert!(youtube.can_mux());
        let instagram = resolve_host("instagram.com").unwrap();
        assert!(!instagram.can_mux());
    }

    #[test]
    fn url_directa_resuelve_al_adaptador_directo() {
        let hosts = all_allowed_hosts();
        let policy = UrlPolicy {
            allowed_hosts: &hosts,
        };
        let url = validate_media_url("https://youtube.com/archivo/clip.mp3", &policy).unwrap();
        assert_eq!(resolve(&url).map(|a| a.id), Some("directo"));
        let video = validate_media_url("https://youtube.com/watch?v=abc", &policy).unwrap();
        assert_eq!(resolve(&video).map(|a| a.id), Some("youtube"));
    }
}
