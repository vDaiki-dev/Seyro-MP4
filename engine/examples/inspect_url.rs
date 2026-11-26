//! Comprobación manual: `cargo run -p seyro-mp4-engine --example inspect_url -- <URL>`.
//! Imprime solo lo que devolvió el origen, nunca una calidad calculada.

use seyro_mp4_engine::{detect_tools, inspect};

fn main() {
    let Some(url) = std::env::args().nth(1) else {
        eprintln!("Uso: inspect_url <URL HTTPS pública>");
        std::process::exit(2);
    };
    let tools = match detect_tools() {
        Ok(tools) => tools,
        Err(error) => {
            eprintln!("{}", error.diagnostic());
            std::process::exit(1);
        }
    };
    match inspect(&tools, &url) {
        Ok(result) => {
            println!("origen: {}", result.platform);
            println!("título: {}", result.title);
            println!("altura real: {}", result.source_height);
            println!("pistas visibles: {}", result.tracks.len());
            println!("descartadas: {}", result.discarded_above_source);
            for track in result.tracks {
                println!(
                    "- {} · {} · {}",
                    track.source_format_id, track.quality_label, track.extension
                );
            }
        }
        Err(error) => {
            eprintln!("{}", error.diagnostic());
            std::process::exit(1);
        }
    }
}
