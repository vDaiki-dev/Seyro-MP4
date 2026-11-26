// Cada elemento de la cola muestra un estado real del proceso local.

import { Badge } from './components.js';
import { sanitizeText } from './security.js';

const STATE_KEYS = {
  downloading: 'status.downloading',
  processing: 'status.processing',
  done: 'status.done',
  error: 'status.error',
  cancelled: 'status.cancelled',
};

const ACTIVE = new Set(['downloading', 'processing']);

export function stateKey(state) {
  return STATE_KEYS[sanitizeText(state, 20)] ?? 'status.idle';
}

export function isActive(state) {
  return ACTIVE.has(sanitizeText(state, 20));
}

function variantFor(state) {
  if (state === 'done') return 'ok';
  if (state === 'error') return 'bad';
  return 'accent';
}

function actionButton(doc, label, action, id, handlers) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'button button--small';
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  button.setAttribute('aria-label', label);
  const handler = handlers?.[action];
  if (typeof handler === 'function') button.addEventListener('click', () => handler(id));
  return button;
}

export class QueueItem {
  static create(view, translate, handlers = {}, doc = null) {
    const owner = doc || (typeof document !== 'undefined' ? document : null);
    const item = owner.createElement('li');
    item.className = 'queue-item';
    item.dataset.id = sanitizeText(view.id, 64);
    QueueItem.update(item, view, translate, handlers);
    return item;
  }

  static update(item, view, translate, handlers = {}) {
    if (!item) return item;
    const doc = item.ownerDocument;
    const id = sanitizeText(view.id, 64);
    const state = sanitizeText(view.state, 20);
    const title = sanitizeText(view.title, 200);
    const percent = Math.max(0, Math.min(100, Math.round(Number(view.percent) || 0)));

    const stateBox = doc.createElement('span');
    stateBox.className = `queue-item__state queue-item__state--${state}`;
    stateBox.appendChild(Badge.create(translate(stateKey(state)), variantFor(state), doc));

    const body = doc.createElement('div');
    body.className = 'queue-item__body';
    const name = doc.createElement('p');
    name.className = 'queue-item__name';
    name.textContent = `${title || id} · ${sanitizeText(view.quality, 40)}`;
    body.appendChild(name);

    if (isActive(state)) {
      const track = doc.createElement('div');
      track.className = 'progress';
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(percent));
      track.setAttribute('aria-label', translate('label.status'));
      const bar = doc.createElement('span');
      bar.className = 'progress__bar';
      bar.style.width = `${percent}%`;
      track.appendChild(bar);
      body.appendChild(track);
    }

    const path = doc.createElement('p');
    path.className = 'queue-item__path';
    path.textContent = sanitizeText(view.path, 300);
    body.appendChild(path);

    if (view.message) {
      const message = doc.createElement('p');
      message.className = 'queue-item__message';
      message.textContent = translate(`error.${sanitizeText(view.message, 48)}`);
      body.appendChild(message);
    }

    const actions = doc.createElement('div');
    actions.className = 'queue-item__actions';
    if (isActive(state)) {
      actions.appendChild(actionButton(doc, translate('action.cancel'), 'cancel', id, handlers));
    }
    if (state === 'error' || state === 'cancelled') {
      actions.appendChild(actionButton(doc, translate('action.retry'), 'retry', id, handlers));
    }
    if (view.path && state === 'done') {
      actions.appendChild(actionButton(doc, translate('action.copyPath'), 'copy', id, handlers));
    }

    item.replaceChildren(stateBox, body, actions);
    return item;
  }
}
