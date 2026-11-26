// Tema, acento y tipografía. Funciones puras salvo applyTheme, que recibe el document.

import { isLocale, DEFAULT_LOCALE } from './i18n.js';
import { safeHexColor, sanitizeKey } from './security.js';

export const STORAGE_KEY = 'seyro-mp4.settings';
export const MODES = ['paper', 'terminal', 'system'];
export const ACCENTS = [
  { id: 'seyroo', labelKey: 'accent.seyroo', hex: '#ff6b00' },
  { id: 'lime', labelKey: 'accent.lime', hex: '#c6ff00' },
  { id: 'coral', labelKey: 'accent.coral', hex: '#ff4d3d' },
  { id: 'cyan', labelKey: 'accent.cyan', hex: '#00d9ff' },
  { id: 'amber', labelKey: 'accent.amber', hex: '#ffb000' },
];
export const FONTS = [
  {
    id: 'grotesk',
    labelKey: 'font.grotesk',
    css: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  { id: 'mono', labelKey: 'font.mono', css: '"JetBrains Mono", "DejaVu Sans Mono", Consolas, monospace' },
  { id: 'editorial', labelKey: 'font.editorial', css: 'Georgia, "Times New Roman", serif' },
];
export const MONO_STACK = '"JetBrains Mono", "DejaVu Sans Mono", Consolas, monospace';

export const PALETTES = {
  paper: {
    bg: '#f2f0ea', surface: '#ffffff', alt: '#e8e8ea',
    ink: '#111111', muted: '#56534e', border: '#111111',
  },
  terminal: {
    bg: '#0b0b0b', surface: '#131313', alt: '#1d1d1d',
    ink: '#f2f0ea', muted: '#a8a49c', border: '#f2f0ea',
  },
};

export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'system',
  accent: 'seyroo',
  customAccent: '#ff6b00',
  font: 'grotesk',
  locale: 'es',
});

const accentIds = ACCENTS.map((a) => a.id);
const fontIds = FONTS.map((f) => f.id);

/** Normaliza preferencias no confiables contra listas blancas. */
export function normalizeSettings(input) {
  const raw = input && typeof input === 'object' ? input : {};
  return {
    mode: MODES.includes(raw.mode) ? raw.mode : DEFAULT_SETTINGS.mode,
    accent: [...accentIds, 'custom'].includes(raw.accent) ? raw.accent : DEFAULT_SETTINGS.accent,
    customAccent: safeHexColor(raw.customAccent, DEFAULT_SETTINGS.customAccent),
    font: fontIds.includes(raw.font) ? raw.font : DEFAULT_SETTINGS.font,
    locale: isLocale(raw.locale) ? raw.locale : DEFAULT_LOCALE,
  };
}

export function readSettings(storage) {
  if (!storage?.getItem) return { ...DEFAULT_SETTINGS };
  try {
    return normalizeSettings(JSON.parse(storage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(storage, settings) {
  if (!storage?.setItem) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

export function accentHex(settings) {
  const normalized = normalizeSettings(settings);
  if (normalized.accent === 'custom') return normalized.customAccent;
  return ACCENTS.find((a) => a.id === normalized.accent)?.hex || ACCENTS[0].hex;
}

export function hexToRgb(hex) {
  const value = safeHexColor(hex, '#000000').slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function channelLuminance(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa WCAG. */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** Ratio de contraste WCAG entre dos colores. */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** Texto con mejor contraste sobre el acento. */
export function contrastingInk(hex) {
  const onWhite = contrastRatio(hex, '#ffffff');
  const onInk = contrastRatio(hex, PALETTES.paper.ink);
  return onWhite >= onInk ? '#ffffff' : PALETTES.paper.ink;
}

/**
 * Un acento debe poder portar texto (≥4.5:1) y ser visible en al menos
 * uno de los dos modos (≥3:1). Así se evitan colores pastel ilegibles.
 */
export function validateAccent(hex) {
  const color = safeHexColor(hex, '');
  if (!color) return { ok: false, light: 0, dark: 0, text: '' };
  const light = contrastRatio(color, PALETTES.paper.bg);
  const dark = contrastRatio(color, PALETTES.terminal.bg);
  const text = contrastingInk(color);
  const textRatio = contrastRatio(color, text);
  return { ok: textRatio >= 4.5 && Math.max(light, dark) >= 3, light, dark, text };
}

export function effectiveMode(settings, prefersDark = false) {
  const mode = normalizeSettings(settings).mode;
  if (mode === 'system') return prefersDark ? 'terminal' : 'paper';
  return mode;
}

/** Aplica tokens al documento. Sin innerHTML y sin acceso a red. */
export function applyTheme(doc, settings, prefersDark = false) {
  if (!doc?.documentElement) return null;
  const normalized = normalizeSettings(settings);
  const root = doc.documentElement;
  const mode = effectiveMode(normalized, prefersDark);
  const accent = accentHex(normalized);
  const font = FONTS.find((f) => f.id === normalized.font) || FONTS[0];
  // Se conserva 'system' para que CSS siga reaccionando a cambios del SO.
  root.dataset.mode = normalized.mode;
  root.dataset.font = font.id;
  root.dataset.accent = sanitizeKey(normalized.accent, 'seyroo');
  root.lang = normalized.locale;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--on-accent', contrastingInk(accent));
  root.style.setProperty('--font-ui', font.css);
  root.style.setProperty('--font-mono', MONO_STACK);
  return { mode, accent, font: font.id };
}
