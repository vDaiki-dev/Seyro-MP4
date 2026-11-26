// Metadatos reales: nunca muestra una altura que el origen no declaró.

import { sanitizeText } from './security.js';

export function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!value) return '';
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, '0')}` : `${rest}s`;
}

export class InspectorPanel {
  constructor(translate) {
    this.t = translate;
  }

  show(list, inspection) {
    if (!list) return;
    const doc = list.ownerDocument;
    const rows = [
      [this.t('label.platform'), this.t(`platform.${sanitizeText(inspection?.platform, 32)}`)],
      [this.t('label.title'), sanitizeText(inspection?.title, 200)],
      [this.t('label.author'), sanitizeText(inspection?.author, 120) || this.t('value.unknown')],
      [this.t('label.duration'), formatDuration(inspection?.duration_seconds) || this.t('value.unknown')],
      [this.t('label.sourceHeight'), inspection?.source_height
        ? `${Number(inspection.source_height)}p`
        : this.t('value.unknown')],
      [this.t('label.trackCount'), String((inspection?.tracks ?? []).length)],
    ].filter(([, value]) => value);

    list.replaceChildren();
    for (const [key, value] of rows) {
      const dt = doc.createElement('dt');
      dt.textContent = key;
      const dd = doc.createElement('dd');
      dd.textContent = value;
      list.append(dt, dd);
    }
    list.hidden = rows.length === 0;
  }

  note(container, inspection) {
    if (!container) return null;
    const count = Math.max(0, Math.floor(Number(inspection?.discarded_above_source) || 0));
    if (!count) {
      container.replaceChildren();
      container.hidden = true;
      return null;
    }
    const doc = container.ownerDocument;
    const note = doc.createElement('p');
    note.className = 'inspector-note';
    note.textContent = this.t('discarded.count', { count });
    container.replaceChildren(note);
    container.hidden = false;
    return note;
  }
}
