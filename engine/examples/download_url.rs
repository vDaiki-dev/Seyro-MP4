//! Comprobación manual de extremo a extremo:
//! `cargo run -p seyro-mp4-engine --example download_url -- <URL>`
//! Borra el archivo descargado al terminar; solo imprime estados reales.

use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};

use seyro_mp4_engine::{detect_tools, DownloadRequest, Engine, JobState};

fn main() {
    let url = std::env::args().nth(1).unwrap_or_else(|| {
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4".to_owned()
    });
    let tools = detect_tools().unwrap_or_else(|error| {
        eprintln!("{}", error.diagnostic());
        std::process::exit(1);
    });
    let engine = Engine::new(tools);

    let inspection = engine.inspect(&url).unwrap_or_else(|error| {
        eprintln!("inspección: {}", error.diagnostic());
        std::process::exit(1);
    });
    let track = inspection
        .tracks
        .iter()
        .find(|track| track.extension == "mp4")
        .or_else(|| inspection.tracks.first())
        .unwrap_or_else(|| {
            eprintln!("el origen no devolvió pistas");
            std::process::exit(1);
        });
    println!(
        "pista: {} · {} · {}",
        track.source_format_id, track.quality_label, track.extension
    );

    let request = DownloadRequest {
        url,
        video_id: Some(track.source_format_id.clone()),
        audio_id: None,
        title: inspection.title.clone(),
        quality: track.quality_label.clone(),
        extension: track.extension.clone(),
    };
    let job = engine.start_download(request).unwrap_or_else(|error| {
        eprintln!("inicio: {}", error.diagnostic());
        std::process::exit(1);
    });
    let id = job.id.clone();
    let started = Instant::now();
    let mut last = job;
    while started.elapsed() < Duration::from_secs(120) {
        thread::sleep(Duration::from_millis(250));
        last = engine
            .list()
            .into_iter()
            .find(|view| view.id == id)
            .expect("el trabajo sigue en la cola");
        if !last.state.is_active() {
            break;
        }
    }
    println!(
        "estado: {:?} · progreso: {}% · mensaje: {}",
        last.state, last.percent, last.message
    );
    println!("ruta: {}", last.path);

    let path = Path::new(&last.path);
    let bytes = std::fs::metadata(path).map(|info| info.len()).unwrap_or(0);
    println!("bytes verificados: {bytes}");
    if last.state == JobState::Done && bytes > 0 {
        let _ = std::fs::remove_file(path);
        println!("archivo de prueba eliminado");
    } else {
        eprintln!("la descarga no terminó correctamente");
        std::process::exit(1);
    }
}
