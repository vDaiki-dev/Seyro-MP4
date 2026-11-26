//! Núcleo de Seyro-MP4.
//!
//! Biblioteca pura: no abre red ni lanza procesos todavía. Contiene las reglas
//! que deben cumplir la capa de escritorio y la CLI: qué URL es aceptable, qué
//! nombres de archivo se pueden escribir, qué plataformas existen y qué pistas
//! se pueden mostrar sin inventar calidades.
//!
//! Familia Seyroo · GPL-3.0-only.

pub mod adapters;
pub mod errors;
pub mod model;
pub mod security;

/// Versión del núcleo, alineada con el workspace.
pub const VERSION: &str = "0.1.0";
