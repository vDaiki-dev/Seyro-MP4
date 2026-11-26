// Web estática: aplica las mismas preferencias que la app, sin telemetría.
import { translate, translateDom } from './i18n.js';
import { MODES, applyTheme, normalizeSettings, readSettings, writeSettings } from './theme.js';

const doc = document;

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const storage = safeStorage();
const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
let settings = readSettings(storage);
const langButton = doc.getElementById('web-lang');
const modeButton = doc.getElementById('web-mode');

function render() {
  applyTheme(doc, settings, media?.matches ?? false);
  translateDom(doc, settings.locale);
  langButton.textContent = `${settings.locale.toUpperCase()} / ${settings.locale === 'es' ? 'EN' : 'ES'}`;
  langButton.setAttribute('aria-label', translate(settings.locale, 'label.language'));
  modeButton.textContent = translate(settings.locale, `mode.${settings.mode}`);
  modeButton.setAttribute('aria-label', translate(settings.locale, 'label.mode'));
}

function patch(values) {
  settings = normalizeSettings({ ...settings, ...values });
  writeSettings(storage, settings);
  render();
}

langButton.addEventListener('click', () => {
  patch({ locale: settings.locale === 'es' ? 'en' : 'es' });
});

modeButton.addEventListener('click', () => {
  const index = MODES.indexOf(settings.mode);
  patch({ mode: MODES[(index + 1) % MODES.length] });
});

media?.addEventListener?.('change', () => applyTheme(doc, settings, media.matches));
render();
