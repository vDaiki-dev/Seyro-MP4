// Cableado de la interfaz. Sin red, sin innerHTML, sin dependencias.

import { buildAppearancePanel } from './appearance.js';
import { Badge, Modal, Skeleton, Toast, Tooltip } from './components.js';
import { translate, translateDom } from './i18n.js';
import { validatePublicHttpsUrl } from './security.js';
import { applyTheme, normalizeSettings, readSettings, validateAccent, writeSettings } from './theme.js';

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
const prefersDark = () => media?.matches ?? false;

let settings = readSettings(storage);
let appearancePanel = null;
let demoTimer = null;
let lastWarnedAccent = '';

applyTheme(doc, settings, prefersDark());
translateDom(doc, settings.locale);
media?.addEventListener?.('change', () => applyTheme(doc, settings, prefersDark()));

const toasts = new Toast(doc.getElementById('toast-root'));
const modal = new Modal(doc.getElementById('modal-root'));
const tooltip = new Tooltip();
tooltip.sync(doc);

const form = doc.getElementById('analyze-form');
const urlInput = doc.getElementById('url-input');
const langButton = doc.getElementById('lang-btn');
const skeletonSlot = doc.getElementById('metadata-slot');
const metadataEmpty = doc.getElementById('metadata-empty');

function t(key, vars) {
  return translate(settings.locale, key, vars);
}

function updateLangButton() {
  const next = settings.locale === 'es' ? 'EN' : 'ES';
  langButton.textContent = `${settings.locale.toUpperCase()} / ${next}`;
  langButton.setAttribute('aria-label', t('label.language'));
}

function ensureValidAccent() {
  if (settings.accent !== 'custom' || settings.customAccent === lastWarnedAccent) return;
  if (!validateAccent(settings.customAccent).ok) {
    toasts.show(t('toast.invalidContrast'), 'error');
    lastWarnedAccent = settings.customAccent;
  } else {
    lastWarnedAccent = '';
  }
}

function patchSettings(patch) {
  const previousLocale = settings.locale;
  settings = normalizeSettings({ ...settings, ...patch });
  writeSettings(storage, settings);
  applyTheme(doc, settings, prefersDark());
  translateDom(doc, settings.locale);
  tooltip.sync(doc);
  updateLangButton();
  ensureValidAccent();

  if (modal.current && appearancePanel) {
    if (patch.locale && patch.locale !== previousLocale) {
      appearancePanel = buildAppearancePanel(settings, patchSettings, doc);
      modal.current.body.replaceChildren(appearancePanel.element);
      tooltip.sync(modal.current.panel);
    } else {
      appearancePanel.sync(settings);
    }
  }
}

function openAppearance() {
  if (modal.current) return;
  appearancePanel = buildAppearancePanel(settings, patchSettings, doc);
  modal.open({
    title: t('modal.appearance.title'),
    body: [appearancePanel.element],
    wide: true,
    actions: [{ label: t('action.close'), onClick: () => modal.close() }],
    onClose: () => { appearancePanel = null; },
  });
}

function openHelp() {
  if (modal.current) return;
  const list = doc.createElement('dl');
  list.className = 'data-list';
  const rows = [
    ['Ctrl / ⌘ + Enter', 'shortcut.analyze'],
    ['Ctrl / ⌘ + ,', 'shortcut.settings'],
    ['Esc', 'shortcut.escape'],
  ];
  for (const [keys, key] of rows) {
    const dt = doc.createElement('dt');
    dt.textContent = keys;
    const dd = doc.createElement('dd');
    dd.textContent = t(key);
    list.append(dt, dd);
  }
  modal.open({
    title: t('modal.shortcuts.title'),
    body: [list, Badge.create(t('app.badge'), 'accent', doc)],
    actions: [{ label: t('action.close'), onClick: () => modal.close() }],
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const check = validatePublicHttpsUrl(urlInput.value);
  if (!check.ok) {
    toasts.show(t('error.E_URL_INVALIDA'), 'error');
    urlInput.focus();
    return;
  }
  // El motor de inspección se conecta en el Paso 5. No se simula una descarga.
  toasts.show(t('toast.enginePending'), 'info');
});

doc.getElementById('appearance-btn').addEventListener('click', openAppearance);
doc.getElementById('help-btn').addEventListener('click', openHelp);
langButton.addEventListener('click', () => {
  patchSettings({ locale: settings.locale === 'es' ? 'en' : 'es' });
});

doc.getElementById('demo-skeleton').addEventListener('click', () => {
  globalThis.clearTimeout(demoTimer);
  metadataEmpty.hidden = true;
  skeletonSlot.hidden = false;
  new Skeleton().mount(skeletonSlot, {
    rows: 3,
    cells: 14,
    seed: 20261126,
    label: t('skeleton.label'),
  });
  demoTimer = globalThis.setTimeout(() => {
    new Skeleton().clear(skeletonSlot);
    skeletonSlot.hidden = true;
    metadataEmpty.hidden = false;
  }, 2200);
});

doc.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key === 'Enter' && !modal.current) {
    event.preventDefault();
    form.requestSubmit();
  } else if (event.key === ',') {
    event.preventDefault();
    openAppearance();
  }
});

updateLangButton();
