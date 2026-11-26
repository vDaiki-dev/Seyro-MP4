// Sanitización ligera del frontend. Ninguna función toca red ni escribe HTML.

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Texto seguro para títulos, errores, rutas y mensajes. */
export function sanitizeText(value, max = 200) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, '')
    .trim()
    .slice(0, max);
}

/** Claves y valores de configuración: solo caracteres simples. */
export function sanitizeKey(value, fallback = '') {
  const text = sanitizeText(value, 64);
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : fallback;
}

/** HEX de 6 dígitos, con o sin '#'; devuelve forma canónica. */
export function safeHexColor(value, fallback = '#ff6b00') {
  const hex = sanitizeText(value, 7).replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toLowerCase()}` : fallback;
}

/** Escape mínimo para atributos; el runtime usa textContent, no innerHTML. */
export function escapeHtml(value) {
  return sanitizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const KNOWN_HOSTS = [
  'youtube.com', 'youtu.be', 'music.youtube.com', 'instagram.com',
  'tiktok.com', 'vm.tiktok.com', 'open.spotify.com', 'spotify.com',
];

const DIRECT_EXTENSIONS = /\.(mp4|mkv|webm|mp3|m4a|aac|opus|ogg|flac)$/i;

/**
 * Comprobación local de la misma política que aplica el núcleo Rust.
 * No abre red: solo decide si merece enviarse al inspector.
 */
export function validatePublicHttpsUrl(value) {
  const raw = sanitizeText(value, 2048);
  const bad = () => ({ ok: false, code: 'E_URL_INVALIDA', host: '', direct: false });
  if (!raw) return bad();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return bad();
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return bad();
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':');
  const isLocal = host === 'localhost'
    || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal');
  if (!host || isIp || isLocal) return bad();
  const known = KNOWN_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!known) return bad();
  if (raw.includes('..') || raw.includes('\\')) return bad();
  return { ok: true, code: '', host, direct: DIRECT_EXTENSIONS.test(parsed.pathname) };
}

/** Enlaces externos permitidos: solo el repositorio Seyroo. */
export function safeExternalUrl(url) {
  const value = sanitizeText(url, 512);
  const repo = /^https:\/\/github\.com\/vDaiki-dev\/(seyro-mp4|seyropea)(?:[/?#].*)?$/i;
  const pages = /^https:\/\/vdaiki-dev\.github\.io\/Seyro-MP4\/?(?:[?#].*)?$/i;
  return repo.test(value) || pages.test(value) ? value : '';
}
