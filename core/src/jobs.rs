//! Identificadores de trabajo generados en el núcleo.
//!
//! La interfaz nunca propone un ID: un ID de cliente permitiría actuar sobre
//! trabajos ajenos (IDOR). Aquí se derivan de tiempo + contador monotónico y
//! pasan por la misma lista blanca que cualquier otro identificador.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::security::sanitize_id;

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// Devuelve un ID único por proceso con formato `job-<epoch>-<contador>`.
pub fn new_job_id() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    let sequence = COUNTER.fetch_add(1, Ordering::Relaxed);
    let raw = format!("job-{seconds}-{sequence:x}");
    sanitize_id(&raw, "job-local")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn los_ids_son_unicos_y_seguros() {
        let one = new_job_id();
        let two = new_job_id();
        assert_ne!(one, two);
        for id in [&one, &two] {
            assert!(id.starts_with("job-"));
            assert!(id.len() <= 64);
            assert!(id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-'));
        }
    }
}
