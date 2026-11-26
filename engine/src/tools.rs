//! Descubrimiento de herramientas opcionales en el PATH del usuario.

use std::path::{Path, PathBuf};

use seyro_mp4_core::errors::{self, AppError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolPaths {
    pub yt_dlp: PathBuf,
    pub ffmpeg: Option<PathBuf>,
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// Busca un ejecutable en un valor PATH arbitrario. Función pura y testeable.
pub fn find_in_path(path_value: &str, binary: &str) -> Option<PathBuf> {
    let name = if cfg!(windows) && !binary.ends_with(".exe") {
        format!("{binary}.exe")
    } else {
        binary.to_owned()
    };
    std::env::split_paths(path_value)
        .map(|directory| directory.join(&name))
        .find(|candidate| is_executable(candidate))
}

/// Detecta las herramientas reales disponibles. `ffmpeg` es opcional.
pub fn detect_tools() -> Result<ToolPaths, AppError> {
    let path_value = std::env::var("PATH").unwrap_or_default();
    let yt_dlp =
        find_in_path(&path_value, "yt-dlp").ok_or_else(|| errors::tool_missing("yt-dlp"))?;
    let ffmpeg = find_in_path(&path_value, "ffmpeg");
    Ok(ToolPaths { yt_dlp, ffmpeg })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encuentra_solo_ejecutables_reales() {
        let root = std::env::temp_dir().join(format!("seyro-mp4-tools-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&root);
        let tool = root.join("yt-dlp");
        std::fs::write(&tool, b"#!/bin/sh\n").expect("crear falso yt-dlp");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = std::fs::metadata(&tool).unwrap().permissions();
            permissions.set_mode(0o755);
            std::fs::set_permissions(&tool, permissions).unwrap();
        }
        let path = format!("{}:{}", root.display(), "/ruta/que/no/existe");
        assert_eq!(find_in_path(&path, "yt-dlp"), Some(tool));
        assert_eq!(find_in_path(&path, "ffmpeg"), None);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn detecta_ffmpeg_cuando_esta_en_el_path() {
        let path = std::env::var("PATH").unwrap_or_default();
        if find_in_path(&path, "ffmpeg").is_none() {
            return;
        }
        let tools = detect_tools().expect("yt-dlp debería estar disponible en este entorno");
        assert!(tools.ffmpeg.is_some());
        assert!(tools.yt_dlp.exists());
    }
}
