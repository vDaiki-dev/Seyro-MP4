pub mod commands;

use std::path::PathBuf;
use std::sync::Arc;

use seyro_mp4_engine::{detect_tools, Engine, ToolPaths};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Si falta yt-dlp la app arranca igual: la UI lo indica y desactiva el
    // análisis en lugar de ocultar un error o intentar instalar algo.
    let paths = detect_tools().unwrap_or(ToolPaths {
        yt_dlp: PathBuf::new(),
        ffmpeg: None,
    });

    tauri::Builder::default()
        .manage(Arc::new(Engine::new(paths)))
        .invoke_handler(tauri::generate_handler![
            commands::tools_status,
            commands::default_dir,
            commands::inspect,
            commands::start_download,
            commands::job_list,
            commands::cancel_job,
            commands::retry_job,
            commands::clear_history,
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Seyro-MP4");
}
