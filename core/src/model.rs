//! Modelo de pistas reales y política de calidades honestas.
//!
//! La interfaz consume este modelo, nunca el JSON crudo del extractor. Eso
//! permite garantizar que ninguna etiqueta supera la resolución verificada.

use serde::Serialize;

use crate::security::{
    safe_thumbnail, sanitize_id, sanitize_label, ALLOWED_EXTENSIONS, MAX_THUMBNAIL_LENGTH,
};

/// Tipo de pista tal como lo expone el origen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum TrackKind {
    VideoAudio,
    VideoOnly,
    AudioOnly,
}

impl TrackKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::VideoAudio => "Vídeo + audio",
            Self::VideoOnly => "Solo vídeo",
            Self::AudioOnly => "Solo audio",
        }
    }
}

/// Una pista que realmente existe en el medio inspeccionado.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RealTrack {
    pub id: String,
    /// ID exacto del origen, ya restringido a [A-Za-z0-9_-].
    pub source_format_id: String,
    pub kind: TrackKind,
    pub extension: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// Sin altura verificable, la etiqueta no puede prometer resolución.
    pub resolution_unverified: bool,
    pub fps: Option<f64>,
    pub video_bitrate_kbps: Option<u32>,
    pub audio_bitrate_kbps: Option<u32>,
    pub sample_rate_hz: Option<u32>,
    pub channels: Option<u8>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub estimated_size_bytes: Option<u64>,
    /// Requiere mux: vídeo y audio vienen en pistas separadas.
    pub requires_mux: bool,
    /// Un FLAC desde una fuente con pérdida no es un máster lossless.
    pub transcoded: bool,
    /// Etiqueta calculada por el núcleo; viaja a la UI ya verificada.
    pub quality_label: String,
}

impl RealTrack {
    pub fn new(id: &str, kind: TrackKind, extension: &str) -> Self {
        let extension = extension
            .trim()
            .trim_start_matches('.')
            .to_ascii_lowercase();
        let extension = if ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
            extension
        } else {
            "mp4".to_owned()
        };
        let mut track = Self {
            id: sanitize_id(id, "pista"),
            source_format_id: sanitize_id(id, ""),
            kind,
            extension,
            width: None,
            height: None,
            resolution_unverified: false,
            fps: None,
            video_bitrate_kbps: None,
            audio_bitrate_kbps: None,
            sample_rate_hz: None,
            channels: None,
            video_codec: None,
            audio_codec: None,
            estimated_size_bytes: None,
            requires_mux: false,
            transcoded: false,
            quality_label: String::new(),
        };
        track.quality_label = track.quality_label();
        track
    }

    /// Etiqueta corta y verdadera: altura real o bitrate real.
    pub fn quality_label(&self) -> String {
        if self.resolution_unverified {
            return "resolución no verificada".to_owned();
        }
        match self.kind {
            TrackKind::AudioOnly => match self.audio_bitrate_kbps {
                Some(kbps) if kbps > 0 => format!("{kbps}kbps"),
                _ => "bitrate desconocido".to_owned(),
            },
            _ => match self.height {
                Some(height) if height > 0 => format!("{height}p"),
                _ => "resolución desconocida".to_owned(),
            },
        }
    }
}

/// Resultado de una inspección ya filtrada por la política de verdad.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MediaInspection {
    pub platform: String,
    pub title: String,
    pub author: Option<String>,
    pub duration_seconds: Option<u64>,
    pub thumbnail_data_url: Option<String>,
    /// Altura real del origen. 0 significa «no verificable».
    pub source_height: u32,
    pub tracks: Vec<RealTrack>,
    /// Pistas descartadas por superar la altura real del origen.
    pub discarded_above_source: usize,
}

impl MediaInspection {
    /// Construye la inspección aplicando la regla de oro.
    ///
    /// Si `source_height` es conocida, cualquier pista más alta se descarta.
    /// Si no es conocida, se conserva pero se marca como no verificada para
    /// que la interfaz jamás muestre una resolución inventada.
    #[allow(clippy::too_many_arguments)]
    pub fn finalize(
        platform: &str,
        title: &str,
        author: Option<&str>,
        duration_seconds: Option<u64>,
        thumbnail_data_url: Option<&str>,
        source_height: u32,
        raw_tracks: Vec<RealTrack>,
    ) -> Self {
        let platform = sanitize_id(platform, "desconocida");
        let title = sanitize_label(title, 200);
        let author = author
            .map(|a| sanitize_label(a, 120))
            .filter(|a| !a.is_empty());
        let thumbnail_data_url =
            thumbnail_data_url.and_then(|t| safe_thumbnail(t, MAX_THUMBNAIL_LENGTH));
        let mut discarded = 0usize;
        let mut tracks = Vec::with_capacity(raw_tracks.len());
        for mut track in raw_tracks {
            if source_height > 0 {
                if track.height.is_some_and(|h| h > source_height) {
                    discarded += 1;
                    continue;
                }
                track.resolution_unverified = false;
            } else if track.height.is_some() {
                track.height = None;
                track.width = None;
                track.resolution_unverified = true;
            }
            track.quality_label = track.quality_label();
            tracks.push(track);
        }
        Self {
            platform,
            title,
            author,
            duration_seconds,
            thumbnail_data_url,
            source_height,
            tracks,
            discarded_above_source: discarded,
        }
    }

    /// Invariante comprobable: ninguna pista visible supera el origen real.
    pub fn is_truthful(&self) -> bool {
        self.tracks.iter().all(|track| match self.source_height {
            0 => track.height.is_none() && track.resolution_unverified,
            max => track.height.is_none_or(|h| h <= max),
        })
    }

    /// Mayor altura que la interfaz está autorizada a mostrar.
    pub fn max_visible_height(&self) -> Option<u32> {
        if self.source_height == 0 {
            None
        } else {
            self.tracks
                .iter()
                .filter_map(|t| t.height)
                .max()
                .or(Some(self.source_height))
        }
    }
}

/// Estimación de tamaño a partir de bitrate y duración, nunca un número inventado.
pub fn estimate_size_bytes(
    bitrate_kbps: Option<u32>,
    duration_seconds: Option<u64>,
) -> Option<u64> {
    match (bitrate_kbps, duration_seconds) {
        (Some(kbps), Some(seconds)) if kbps > 0 => Some(u64::from(kbps) * 1000 / 8 * seconds),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: &str, height: Option<u32>, kind: TrackKind) -> RealTrack {
        let mut t = RealTrack::new(id, kind, "mp4");
        t.height = height;
        t
    }

    #[test]
    fn nunca_muestra_resolucion_superior_al_origen() {
        let raw = vec![
            track("a", Some(1080), TrackKind::VideoAudio),
            track("b", Some(1440), TrackKind::VideoOnly),
            track("c", Some(2160), TrackKind::VideoOnly),
            track("d", Some(720), TrackKind::VideoAudio),
        ];
        let info = MediaInspection::finalize(
            "youtube",
            "  Prueba <script>  ",
            Some("Canal"),
            Some(120),
            None,
            1080,
            raw,
        );
        assert_eq!(info.tracks.len(), 2);
        assert_eq!(info.discarded_above_source, 2);
        assert!(info.is_truthful());
        assert_eq!(info.max_visible_height(), Some(1080));
        assert_eq!(info.title, "Prueba <script>");
        assert_eq!(info.tracks[0].quality_label(), "1080p");
    }

    #[test]
    fn sin_altura_verificable_no_se_promete_resolucion() {
        let info = MediaInspection::finalize(
            "instagram",
            "Clip",
            None,
            None,
            None,
            0,
            vec![track("a", Some(1080), TrackKind::VideoAudio)],
        );
        assert!(info.is_truthful());
        assert_eq!(info.tracks[0].quality_label(), "resolución no verificada");
        assert_eq!(info.max_visible_height(), None);
    }

    #[test]
    fn audio_usa_bitrate_real_y_estima_tamaño() {
        let mut audio = RealTrack::new("mp3-320", TrackKind::AudioOnly, "mp3");
        audio.audio_bitrate_kbps = Some(320);
        audio.estimated_size_bytes = estimate_size_bytes(audio.audio_bitrate_kbps, Some(100));
        assert_eq!(audio.quality_label(), "320kbps");
        assert_eq!(audio.estimated_size_bytes, Some(4_000_000));
        assert_eq!(estimate_size_bytes(None, Some(100)), None);
        assert_eq!(
            RealTrack::new("x", TrackKind::AudioOnly, "m4a").quality_label(),
            "bitrate desconocido"
        );
    }

    #[test]
    fn sanitiza_miniatura_remota() {
        let info = MediaInspection::finalize(
            "youtube",
            "T",
            None,
            None,
            Some("https://ejemplo.com/miniatura.png"),
            720,
            vec![],
        );
        assert!(info.thumbnail_data_url.is_none());
    }
}
