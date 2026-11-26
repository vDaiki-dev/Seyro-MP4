//! Superficie IPC. Sin rutas administrativas, sin secretos y sin IDs de cliente.

use std::sync::Arc;

use serde::Serialize;
use seyro_mp4_core::errors::AppError;
use seyro_mp4_core::model::MediaInspection;
use seyro_mp4_engine::download;
use seyro_mp4_engine::{DownloadRequest, Engine, JobView};
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct ToolsStatus {
    pub yt_dlp: String,
    pub ffmpeg: Option<String>,
}

#[tauri::command]
pub fn tools_status(state: State<'_, Arc<Engine>>) -> ToolsStatus {
    let paths = state.paths();
    ToolsStatus {
        yt_dlp: paths
            .yt_dlp
            .to_str()
            .filter(|path| !path.is_empty())
            .unwrap_or("")
            .to_owned(),
        ffmpeg: paths
            .ffmpeg
            .as_ref()
            .and_then(|path| path.to_str())
            .map(str::to_owned),
    }
}

#[tauri::command]
pub fn default_dir() -> String {
    download::download_dir(&download::default_home())
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
pub async fn inspect(
    url: String,
    state: State<'_, Arc<Engine>>,
) -> Result<MediaInspection, AppError> {
    let engine = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || engine.inspect(&url))
        .await
        .map_err(|error| {
            AppError::technical(
                "E_INTERNO",
                "La inspección se interrumpió.",
                &error.to_string(),
            )
        })?
}

#[tauri::command]
pub fn start_download(
    request: DownloadRequest,
    state: State<'_, Arc<Engine>>,
) -> Result<JobView, AppError> {
    state.start_download(request)
}

#[tauri::command]
pub fn job_list(state: State<'_, Arc<Engine>>) -> Vec<JobView> {
    state.list()
}

#[tauri::command]
pub fn cancel_job(id: String, state: State<'_, Arc<Engine>>) -> Result<(), AppError> {
    state.cancel(&id)
}

#[tauri::command]
pub fn retry_job(id: String, state: State<'_, Arc<Engine>>) -> Result<JobView, AppError> {
    state.retry(&id)
}

#[tauri::command]
pub fn clear_history(state: State<'_, Arc<Engine>>) {
    state.clear_history();
}
