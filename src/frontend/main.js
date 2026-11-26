// Cableado de la interfaz: datos reales del núcleo, sin red propia ni innerHTML.

import { buildAppearancePanel } from './appearance.js';
import { Badge, Modal, Skeleton, Toast, Tooltip } from './components.js';
import { FormatSelector } from './format-selector.js';
import { InspectorPanel } from './inspector-panel.js';
import { invoke, isDesktop, normalizeError } from './ipc.js';
import { translate, translateDom } from './i18n.js';
import { QueueItem, isActive } from './queue-item.js';
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
let currentInspection = null;
let currentUrl = '';
let analyzing = false;
const views = new Map();
const queueNodes = new Map();

applyTheme(doc, settings, prefersDark());
translateDom(doc, settings.locale);
media?.addEventListener?.('change', () => applyTheme(doc, settings, prefersDark()));

const toasts = new Toast(doc.getElementById('toast-root'));
const modal = new Modal(doc.getElementById('modal-root'));
const tooltip = new Tooltip();
tooltip.sync(doc);

const form = doc.getElementById('analyze-form');
const urlInput = doc.getElementById('url-input');
const analyzeButton = form.querySelector('button[type="submit"]');
const langButton = doc.getElementById('lang-btn');
const skeletonSlot = doc.getElementById('metadata-slot');
const metadataEmpty = doc.getElementById('metadata-empty');
const metadataFields = doc.getElementById('metadata-fields');
const inspectorNote = doc.getElementById('inspector-note');
const tracksEmpty = doc.getElementById('tracks-empty');
const tracksList = doc.getElementById('tracks-list');
const queueList = doc.getElementById('queue-list');
const queueEmpty = doc.getElementById('queue-empty');
const toolsLine = doc.getElementById('tools-status');

const inspector = new InspectorPanel((key, vars) => t(key, vars));
const selector = new FormatSelector(doc, (key, vars) => t(key, vars), downloadSelection);

function t(key, vars) {
  return translate(settings.locale, key, vars);
}

function errorText(error) {
  const normalized = normalizeError(error);
  const known = t(`error.${normalized.code}`);
  const message = known === `error.${normalized.code}` ? normalized.message : known;
  return { ...normalized, label: message };
}

function basename(path) {
  const value = String(path ?? '').trim();
  return value.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

function diagnosticText(normalized) {
  return [normalized.code, normalized.label, normalized.detail
    ? `detalle: ${normalized.detail}`
    : ''].filter(Boolean).join(' · ');
}

function copyText(value, successKey) {
  if (!value) {
    toasts.show(t('toast.pathUnavailable'), 'error');
    return;
  }
  globalThis.navigator?.clipboard?.writeText(value)
    .then(() => toasts.show(t(successKey), 'ok'))
    .catch(() => toasts.show(t('toast.pathUnavailable'), 'error'));
}

function showError(error) {
  const normalized = errorText(error);
  const summary = doc.createElement('p');
  summary.textContent = normalized.label;
  const body = [summary];
  if (normalized.detail) {
    const detail = doc.createElement('p');
    detail.className = 'queue-item__message';
    detail.textContent = normalized.detail;
    body.push(detail);
  }
  const actions = [
    { label: t('action.close'), onClick: () => modal.close() },
    {
      label: t('action.copyDiagnostic'),
      onClick: () => copyText(diagnosticText(normalized), 'toast.copiedDiagnostic'),
    },
  ];
  modal.open({ title: t('status.error'), body, actions });
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

  if (previousLocale !== settings.locale) {
    if (currentInspection) selector.mount(tracksList, currentInspection);
    renderQueue([...views.values()]);
  }
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

function setAnalyzing(value) {
  analyzing = value;
  analyzeButton.disabled = value;
  analyzeButton.setAttribute('aria-busy', String(value));
}

async function analyze(event) {
  event.preventDefault();
  if (analyzing) return;
  const url = urlInput.value.trim();
  const check = validatePublicHttpsUrl(url);
  if (!check.ok) {
    toasts.show(t('error.E_URL_INVALIDA'), 'error');
    urlInput.focus();
    return;
  }
  if (!isDesktop()) {
    toasts.show(t('toast.desktopOnly'), 'info');
    return;
  }

  setAnalyzing(true);
  metadataEmpty.hidden = true;
  metadataFields.hidden = true;
  inspectorNote.hidden = true;
  tracksEmpty.hidden = true;
  tracksList.replaceChildren();
  skeletonSlot.hidden = false;
  new Skeleton().mount(skeletonSlot, {
    rows: 3,
    cells: 14,
    seed: 20261126,
    label: t('skeleton.label'),
  });
  toasts.show(t('toast.inspecting'), 'info');

  try {
    const inspection = await invoke('inspect', { url });
    currentInspection = inspection;
    currentUrl = url;
    inspector.show(metadataFields, inspection);
    inspector.note(inspectorNote, inspection);
    const hasTracks = (inspection.tracks ?? []).length > 0;
    tracksEmpty.hidden = hasTracks;
    if (hasTracks) selector.mount(tracksList, inspection);
  } catch (error) {
    currentInspection = null;
    currentUrl = '';
    tracksEmpty.hidden = false;
    metadataEmpty.hidden = false;
    metadataFields.hidden = true;
    inspectorNote.hidden = true;
    showError(error);
  } finally {
    new Skeleton().clear(skeletonSlot);
    skeletonSlot.hidden = true;
    setAnalyzing(false);
  }
}

async function downloadSelection(selection) {
  if (!currentInspection || !selection) {
    toasts.show(t('toast.nothingSelected'), 'error');
    return;
  }
  const request = {
    url: currentUrl,
    video_id: selection.videoId || null,
    audio_id: selection.audioId || null,
    title: currentInspection.title,
    quality: selection.quality,
    extension: selection.extension,
  };
  try {
    const view = await invoke('start_download', { request });
    toasts.show(t('toast.downloadStarted'), 'ok');
    views.set(view.id, view);
    renderQueue([...views.values()]);
    refreshQueue();
  } catch (error) {
    showError(error);
  }
}

function renderQueue(list) {
  const handlers = queueHandlers;
  const visible = list.filter((view) => views.has(view.id));
  const seen = new Set();
  for (const view of visible) {
    let item = queueNodes.get(view.id);
    if (!item) {
      item = QueueItem.create(view, (key, vars) => t(key, vars), handlers, doc);
      queueNodes.set(view.id, item);
    } else {
      QueueItem.update(item, view, (key, vars) => t(key, vars), handlers);
    }
    seen.add(view.id);
  }
  for (const [id, item] of queueNodes) {
    if (!seen.has(id)) {
      item.remove();
      queueNodes.delete(id);
    }
  }
  const ordered = visible.map((view) => queueNodes.get(view.id));
  queueList.replaceChildren(...ordered);
  queueEmpty.hidden = ordered.length > 0;
}

async function refreshQueue() {
  if (!isDesktop()) return;
  try {
    const list = await invoke('job_list');
    views.clear();
    for (const view of list ?? []) views.set(view.id, view);
    renderQueue([...views.values()]);
  } catch {
    // El sondeo no llena la consola ni interrumpe el trabajo del usuario.
  }
}

const queueHandlers = {
  cancel: async (id) => {
    try {
      await invoke('cancel_job', { id });
      await refreshQueue();
    } catch (error) {
      showError(error);
    }
  },
  retry: async (id) => {
    try {
      await invoke('retry_job', { id });
      await refreshQueue();
    } catch (error) {
      showError(error);
    }
  },
  copy: (id) => copyText(views.get(id)?.path, 'toast.copied'),
};

async function bootstrapDesktop() {
  toolsLine.hidden = false;
  if (!isDesktop()) {
    toolsLine.textContent = `${t('label.tools')}: ${t('error.IPC_NO_DISPONIBLE')}`;
    return;
  }
  try {
    const [status, dir] = await Promise.all([invoke('tools_status'), invoke('default_dir')]);
    const yt = basename(status?.yt_dlp);
    const ff = basename(status?.ffmpeg);
    toolsLine.textContent = `${t('label.tools')}: yt-dlp ${yt || t('value.unknown')} · `
      + `ffmpeg ${ff || t('value.unknown')} · ${t('label.outputDir')}: ${dir}`;
    if (!yt) toasts.show(t('toast.toolsMissing'), 'error');
    await refreshQueue();
  } catch (error) {
    toolsLine.textContent = `${t('label.tools')}: ${t('value.unknown')}`;
    showError(error);
  }
}

form.addEventListener('submit', analyze);
doc.getElementById('appearance-btn').addEventListener('click', openAppearance);
doc.getElementById('help-btn').addEventListener('click', openHelp);
doc.getElementById('clear-history').addEventListener('click', async () => {
  if (!isDesktop()) return;
  try {
    await invoke('clear_history');
    await refreshQueue();
  } catch (error) {
    showError(error);
  }
});
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
    metadataEmpty.hidden = currentInspection === null;
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

queueList.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button[data-action]') : null;
  if (!button) return;
  const handler = queueHandlers[button.dataset.action];
  if (typeof handler === 'function') handler(button.dataset.id);
});

updateLangButton();
bootstrapDesktop();
globalThis.setInterval(() => {
  if (isDesktop() && [...views.values()].some((view) => isActive(view.state))) refreshQueue();
}, 1200);
