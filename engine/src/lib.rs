//! Motor local de Seyro-MP4.
//!
//! Solo ejecuta `yt-dlp` y `ffmpeg` como procesos con argumentos explícitos.
//! Nunca usa shell, nunca confía en IDs de la UI y nunca inventa formatos.

pub mod download;
pub mod inspect;
pub mod queue;
pub mod tools;

pub use download::DownloadRequest;
pub use inspect::{build_inspection, inspect, inspect_url};
pub use queue::{Engine, JobState, JobView};
pub use tools::{detect_tools, find_in_path, ToolPaths};
