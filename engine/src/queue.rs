//! Cola real de trabajos: estados verificados, progreso y cancelación.

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use seyro_mp4_core::errors::{self, AppError};
use seyro_mp4_core::jobs::new_job_id;
use seyro_mp4_core::model::{MediaInspection, TrackKind};
use seyro_mp4_core::security::{format_selector, sanitize_id};

use crate::download::{self, DownloadRequest, ProgressEvent};
use crate::inspect::{classify_failure, inspect_url};
use crate::tools::ToolPaths;

const MAX_JOBS: usize = 60;
const MAX_INSPECTIONS: usize = 24;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobState {
    Downloading,
    Processing,
    Done,
    Error,
    Cancelled,
}

impl JobState {
    pub fn is_active(self) -> bool {
        matches!(self, Self::Downloading | Self::Processing)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct JobView {
    pub id: String,
    pub state: JobState,
    pub title: String,
    pub quality: String,
    pub path: String,
    pub percent: u8,
    pub message: String,
}

#[derive(Debug, Clone)]
struct AllowedTrack {
    id: String,
    kind: TrackKind,
    extension: String,
}

struct Job {
    id: String,
    request: DownloadRequest,
    state: JobState,
    template: PathBuf,
    path: PathBuf,
    percent: f64,
    message: String,
    last_error: String,
    child: Option<Arc<Mutex<Child>>>,
    events: Option<Mutex<Receiver<ProgressEvent>>>,
}

/// Estado compartido de la aplicación. No expone procesos ni IDs de cliente.
pub struct Engine {
    paths: ToolPaths,
    jobs: Mutex<HashMap<String, Job>>,
    /// IDs que realmente existieron en cada inspección, con su tipo y extensión.
    allowed: Mutex<HashMap<String, Vec<AllowedTrack>>>,
}

fn lock_map<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn view_of(job: &Job) -> JobView {
    JobView {
        id: job.id.clone(),
        state: job.state,
        title: seyro_mp4_core::security::sanitize_label(&job.request.title, 200),
        quality: job.request.quality.clone(),
        path: job.path.to_string_lossy().into_owned(),
        percent: job.percent.clamp(0.0, 100.0) as u8,
        message: job.message.clone(),
    }
}

fn find_allowed<'a>(tracks: &'a [AllowedTrack], id: &str) -> Option<&'a AllowedTrack> {
    let clean = sanitize_id(id, "");
    if clean != id {
        return None;
    }
    tracks.iter().find(|track| track.id == id)
}

#[derive(Debug)]
struct Plan {
    selector: String,
    container: Option<String>,
    audio_format: Option<String>,
}

impl Engine {
    pub fn new(paths: ToolPaths) -> Self {
        Self {
            paths,
            jobs: Mutex::new(HashMap::new()),
            allowed: Mutex::new(HashMap::new()),
        }
    }

    pub fn paths(&self) -> &ToolPaths {
        &self.paths
    }

    /// Inspecciona y recuerda qué IDs son reales para esa URL exacta.
    pub fn inspect(&self, url: &str) -> Result<MediaInspection, AppError> {
        let (canonical, inspection) = inspect_url(&self.paths, url)?;
        let ids = inspection
            .tracks
            .iter()
            .map(|track| AllowedTrack {
                id: track.source_format_id.clone(),
                kind: track.kind,
                extension: track.extension.clone(),
            })
            .collect();
        let mut allowed = lock_map(&self.allowed);
        if allowed.len() >= MAX_INSPECTIONS {
            allowed.clear();
        }
        allowed.insert(canonical, ids);
        Ok(inspection)
    }

    fn plan(&self, request: &DownloadRequest, id: &str) -> Result<(Plan, PathBuf), AppError> {
        let canonical = request.url.trim();
        let allowed = lock_map(&self.allowed)
            .get(canonical)
            .cloned()
            .ok_or_else(errors::format_unavailable)?;

        let video = request
            .video_id
            .as_deref()
            .map(|id| find_allowed(&allowed, id));
        let audio = request
            .audio_id
            .as_deref()
            .map(|id| find_allowed(&allowed, id));
        if (request.video_id.is_some() && video.is_none())
            || (request.audio_id.is_some() && audio.is_none())
        {
            return Err(errors::format_unavailable());
        }

        let mut ids: Vec<&str> = Vec::with_capacity(2);
        let mux = request.video_id.is_some() && request.audio_id.is_some();
        let extension = request.extension.trim().to_ascii_lowercase();

        let mut container = None;
        let mut audio_format = None;

        if let Some(video) = video.flatten() {
            let valid_kind = if mux {
                video.kind == TrackKind::VideoOnly
            } else {
                matches!(video.kind, TrackKind::VideoOnly | TrackKind::VideoAudio)
            };
            if !valid_kind
                || !download::is_video_extension(&extension)
                || (!mux && extension != video.extension)
            {
                return Err(errors::format_unavailable());
            }
            ids.push(&video.id);
        }

        if let Some(audio) = audio.flatten() {
            if audio.kind != TrackKind::AudioOnly {
                return Err(errors::format_unavailable());
            }
            ids.push(&audio.id);
            // Al mezclar, la extensión elegida es el contenedor final, no el
            // códec de la pista de audio.
            if !mux {
                if !download::is_audio_extension(&extension) {
                    return Err(errors::format_unavailable());
                }
                if extension != audio.extension {
                    audio_format = download::audio_format_arg(&extension).map(str::to_owned);
                    if audio_format.is_none() {
                        return Err(errors::format_unavailable());
                    }
                }
            }
        }

        if ids.is_empty() {
            return Err(errors::format_unavailable());
        }
        let selector = format_selector(&ids).map_err(|_| {
            AppError::new(
                "E_FORMATO_NO_DISPONIBLE",
                "El selector de formato no es válido.",
            )
        })?;

        if mux {
            container = Some(extension.clone());
        }
        if (mux || audio_format.is_some()) && self.paths.ffmpeg.is_none() {
            return Err(errors::tool_missing("ffmpeg"));
        }

        let template = download::output_template(
            &download::default_home(),
            &request.title,
            &request.quality,
            &extension,
            id,
        )?;
        Ok((
            Plan {
                selector,
                container,
                audio_format,
            },
            template,
        ))
    }

    /// Inicia una descarga. El ID del trabajo se genera aquí, nunca en la UI.
    pub fn start_download(&self, request: DownloadRequest) -> Result<JobView, AppError> {
        let id = new_job_id();
        let (plan, template) = self.plan(&request, &id)?;
        let arguments = download::build_argv(
            &plan.selector,
            &template,
            plan.container.as_deref(),
            plan.audio_format.as_deref(),
            &request.url,
        );

        let mut child = Command::new(&self.paths.yt_dlp)
            .args(arguments)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| {
                AppError::technical(
                    "E_INTERNO",
                    "No se pudo iniciar la descarga.",
                    &error.to_string(),
                )
            })?;

        let (sender, receiver) = mpsc::channel();
        if let Some(stderr) = child.stderr.take() {
            let sender = sender.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    if let Some(event) = download::event_from_line(&line) {
                        if sender.send(event).is_err() {
                            break;
                        }
                    }
                }
            });
        }
        if let Some(stdout) = child.stdout.take() {
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    let value = line.trim();
                    if value.is_empty() {
                        continue;
                    }
                    if sender
                        .send(ProgressEvent::FinalPath(value.to_owned()))
                        .is_err()
                    {
                        break;
                    }
                }
            });
        }

        let extension = request.extension.trim().to_ascii_lowercase();
        let job = Job {
            id: id.clone(),
            request,
            state: JobState::Downloading,
            path: download::fallback_path(&template, &extension),
            template,
            percent: 0.0,
            message: String::new(),
            last_error: String::new(),
            child: Some(Arc::new(Mutex::new(child))),
            events: Some(Mutex::new(receiver)),
        };
        {
            let mut jobs = lock_map(&self.jobs);
            if jobs.len() >= MAX_JOBS {
                jobs.retain(|_, existing| existing.state.is_active());
            }
            jobs.insert(id.clone(), job);
        }
        Ok(self.view(&id).expect("el trabajo recién insertado existe"))
    }

    /// Procesa el progreso recibido y los procesos terminados.
    pub fn refresh(&self) {
        let ids: Vec<String> = lock_map(&self.jobs).keys().cloned().collect();
        for id in ids {
            let mut jobs = lock_map(&self.jobs);
            let Some(job) = jobs.get_mut(&id) else {
                continue;
            };
            if let Some(events) = &job.events {
                let guard = lock_map(events);
                while let Ok(event) = guard.try_recv() {
                    match event {
                        ProgressEvent::Downloading(percent) => {
                            job.state = JobState::Downloading;
                            job.percent = percent;
                        }
                        ProgressEvent::Processing => {
                            job.state = JobState::Processing;
                        }
                        ProgressEvent::Diagnostic(line) => {
                            job.last_error = line;
                        }
                        ProgressEvent::FinalPath(candidate) => {
                            if let Some(path) =
                                download::accepted_final_path(&job.template, &candidate)
                            {
                                job.path = path;
                            }
                        }
                    }
                }
            }
            if !job.state.is_active() {
                continue;
            }
            let status = job
                .child
                .as_ref()
                .and_then(|child| lock_map(child).try_wait().ok())
                .flatten();
            match status {
                None => {}
                Some(status) if status.success() => {
                    job.state = JobState::Done;
                    job.percent = 100.0;
                    job.message.clear();
                    job.child = None;
                    job.events = None;
                }
                Some(_) => {
                    job.state = JobState::Error;
                    job.percent = 0.0;
                    job.message = classify_failure(&job.last_error).code.to_owned();
                    job.child = None;
                    job.events = None;
                }
            }
        }
    }

    pub fn view(&self, id: &str) -> Option<JobView> {
        lock_map(&self.jobs).get(id).map(view_of)
    }

    pub fn list(&self) -> Vec<JobView> {
        self.refresh();
        lock_map(&self.jobs).values().map(view_of).collect()
    }

    pub fn cancel(&self, id: &str) -> Result<(), AppError> {
        let mut jobs = lock_map(&self.jobs);
        let job = jobs
            .get_mut(id)
            .ok_or_else(|| AppError::new("E_TRABAJO_NO_ENCONTRADO", "Ese trabajo ya no existe."))?;
        if !job.state.is_active() {
            return Ok(());
        }
        if let Some(child) = &job.child {
            let mut process = lock_map(child);
            let _ = process.kill();
            let _ = process.wait();
        }
        download::cleanup_partials(&job.template);
        job.child = None;
        job.events = None;
        job.state = JobState::Cancelled;
        job.message.clear();
        Ok(())
    }

    pub fn retry(&self, id: &str) -> Result<JobView, AppError> {
        let request = lock_map(&self.jobs)
            .get(id)
            .map(|job| job.request.clone())
            .ok_or_else(|| AppError::new("E_TRABAJO_NO_ENCONTRADO", "Ese trabajo ya no existe."))?;
        self.start_download(request)
    }

    /// Elimina trabajos terminados; los activos se conservan.
    pub fn clear_history(&self) {
        let mut jobs = lock_map(&self.jobs);
        jobs.retain(|_, job| job.state.is_active());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_engine(ffmpeg: bool) -> Engine {
        Engine::new(ToolPaths {
            yt_dlp: PathBuf::from("/usr/bin/yt-dlp"),
            ffmpeg: ffmpeg.then(|| PathBuf::from("/usr/bin/ffmpeg")),
        })
    }

    fn allow(engine: &Engine, url: &str, id: &str, kind: TrackKind, extension: &str) {
        lock_map(&engine.allowed)
            .entry(url.to_owned())
            .or_default()
            .push(AllowedTrack {
                id: id.to_owned(),
                kind,
                extension: extension.to_owned(),
            });
    }

    fn request(url: &str, video: Option<&str>, audio: Option<&str>, ext: &str) -> DownloadRequest {
        DownloadRequest {
            url: url.to_owned(),
            video_id: video.map(str::to_owned),
            audio_id: audio.map(str::to_owned),
            title: "Prueba".to_owned(),
            quality: "1080p".to_owned(),
            extension: ext.to_owned(),
        }
    }

    #[test]
    fn rechaza_ids_que_no_vinieron_de_una_inspeccion() {
        let engine = test_engine(true);
        let request = request("https://youtube.com/watch?v=abc", Some("2160"), None, "mp4");
        assert_eq!(
            engine.start_download(request).unwrap_err().code,
            "E_FORMATO_NO_DISPONIBLE"
        );
        assert!(engine.list().is_empty());
    }

    #[test]
    fn los_estados_activos_se_distinguen_de_los_terminales() {
        assert!(JobState::Downloading.is_active());
        assert!(JobState::Processing.is_active());
        assert!(!JobState::Done.is_active());
        assert!(!JobState::Cancelled.is_active());
    }

    #[test]
    fn limpiar_historial_no_toca_trabajos_activos() {
        let engine = test_engine(true);
        assert!(engine.cancel("inexistente").is_err());
        engine.clear_history();
        assert!(engine.view("inexistente").is_none());
    }

    #[test]
    fn exige_ffmpeg_para_mux_y_no_acepta_extension_irreal() {
        let url = "https://youtube.com/watch?v=mux";
        let engine = test_engine(false);
        allow(&engine, url, "137", TrackKind::VideoOnly, "mp4");
        allow(&engine, url, "140", TrackKind::AudioOnly, "m4a");

        let error = engine
            .plan(&request(url, Some("137"), Some("140"), "mp4"), "job-1-1")
            .unwrap_err();
        assert_eq!(error.code, "E_HERRAMIENTA_FALTANTE");

        let with_ffmpeg = test_engine(true);
        allow(&with_ffmpeg, url, "137", TrackKind::VideoOnly, "mp4");
        allow(&with_ffmpeg, url, "140", TrackKind::AudioOnly, "m4a");
        let plan = with_ffmpeg
            .plan(&request(url, Some("137"), Some("140"), "mkv"), "job-1-2")
            .expect("mux válido");
        assert_eq!(plan.0.selector, "137+140");
        assert_eq!(plan.0.container.as_deref(), Some("mkv"));
        assert_eq!(
            with_ffmpeg
                .plan(&request(url, Some("137"), None, "webm"), "job-1-3")
                .unwrap_err()
                .code,
            "E_FORMATO_NO_DISPONIBLE"
        );
    }

    #[test]
    fn solo_recodifica_audio_si_el_origen_no_entrega_esa_extension() {
        let url = "https://ejemplo.org/cancion.m4a";
        let engine = test_engine(false);
        allow(&engine, url, "audio", TrackKind::AudioOnly, "m4a");
        let plan = engine
            .plan(&request(url, None, Some("audio"), "m4a"), "job-1-4")
            .expect("m4a directo");
        assert_eq!(plan.0.audio_format, None);
        assert_eq!(
            engine
                .plan(&request(url, None, Some("audio"), "mp3"), "job-1-5")
                .unwrap_err()
                .code,
            "E_HERRAMIENTA_FALTANTE"
        );
    }
}
