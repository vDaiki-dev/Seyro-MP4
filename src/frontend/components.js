// Componentes semánticos de Seyro-MP4. Todos construyen nodos con textContent.

import { sanitizeKey, sanitizeText } from './security.js';

function node(doc, tag, className, text) {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = sanitizeText(text, 300);
  return el;
}

/** Aviso breve y no bloqueante. */
export class Toast {
  constructor(root = null, { limit = 4, duration = 3800 } = {}) {
    this.doc = root?.ownerDocument || (typeof document !== 'undefined' ? document : null);
    this.root = typeof root === 'string' ? this.doc?.querySelector(root) : root;
    this.limit = limit;
    this.duration = duration;
  }

  show(message, type = 'info', duration = this.duration) {
    if (!this.root || !this.doc) return null;
    const kind = sanitizeKey(type, 'info');
    const el = node(this.doc, 'div', `toast toast--${kind}`, message);
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    this.root.appendChild(el);
    while (this.root.children.length > this.limit) this.root.firstElementChild.remove();
    const ms = Math.min(Math.max(Number(duration) || this.duration, 800), 20000);
    globalThis.setTimeout(() => el.remove(), ms);
    return el;
  }

  clear() {
    if (this.root) this.root.replaceChildren();
    return this;
  }
}

/** Diálogo accesible: foco inicial, Esc, clic en fondo y restauración de foco. */
export class Modal {
  constructor(root = null) {
    this.doc = root?.ownerDocument || (typeof document !== 'undefined' ? document : null);
    this.root = typeof root === 'string' ? this.doc?.querySelector(root) : root;
    this.current = null;
    this.onEscape = (event) => {
      if (event.key === 'Escape') this.close();
    };
  }

  open({ title, body = [], actions = [], wide = false, onClose = null } = {}) {
    if (!this.root || !this.doc || this.current) return null;
    const previousFocus = this.doc.activeElement;
    const backdrop = node(this.doc, 'div', 'modal-backdrop');
    const panel = node(this.doc, 'div', wide ? 'modal modal--wide' : 'modal');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', sanitizeText(title, 120));

    const heading = node(this.doc, 'h2', 'modal__title', title);
    const content = node(this.doc, 'div', 'modal__body');
    for (const item of Array.isArray(body) ? body : [body]) {
      if (item === null || item === undefined) continue;
      content.appendChild(typeof item === 'string' ? node(this.doc, 'p', '', item) : item);
    }
    const bar = node(this.doc, 'div', 'modal__actions');
    for (const action of actions) {
      const button = node(this.doc, 'button', `button ${action.kind === 'primary' ? 'button--primary' : ''}`, action.label);
      button.type = 'button';
      if (action.onClick) button.addEventListener('click', action.onClick);
      bar.appendChild(button);
    }
    panel.append(heading, content, bar);
    backdrop.appendChild(panel);
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) this.close();
    });
    this.root.appendChild(backdrop);
    this.doc.addEventListener('keydown', this.onEscape);
    this.current = { backdrop, panel, body: content, actions: bar, close: () => this.close() };
    this.previousFocus = previousFocus;
    this.closeHandler = onClose;
    panel.querySelector('button, input, select, textarea, [tabindex]')?.focus();
    return this.current;
  }

  close() {
    if (!this.current) return;
    this.current.backdrop.remove();
    this.doc?.removeEventListener('keydown', this.onEscape);
    this.current = null;
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
    const handler = this.closeHandler;
    this.closeHandler = null;
    handler?.();
  }
}

/** Tooltip accesible sin capturar clics. */
export class Tooltip {
  attach(el, label, shortcut = '') {
    if (!el) return this;
    el.dataset.tooltip = sanitizeText(label, 120);
    if (shortcut) el.dataset.shortcut = sanitizeText(shortcut, 24);
    el.setAttribute('aria-label', [label, shortcut].filter(Boolean).map((v) => sanitizeText(v, 120)).join(' · '));
    return this;
  }

  sync(root) {
    root?.querySelectorAll?.('[title]').forEach((el) => {
      const label = sanitizeText(el.getAttribute('title'), 120);
      if (label && !el.hasAttribute('data-tooltip')) el.dataset.tooltip = label;
    });
    return this;
  }
}

/** Insignia compacta para estados y contadores. */
export class Badge {
  static create(text, variant = 'status', doc = null) {
    const owner = doc || (typeof document !== 'undefined' ? document : null);
    const el = node(owner, 'span', `badge badge--${sanitizeKey(variant, 'status')}`, text);
    el.dataset.variant = sanitizeKey(variant, 'status');
    return el;
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DOT_SIZES = ['sm', 'md', 'lg'];

/** Skeleton DIVAE: puntos de tres tamaños y barras cuadradas. */
export class Skeleton {
  static render({ rows = 3, cells = 10, seed = 1, label = 'Cargando…', doc = null } = {}) {
    const owner = doc || (typeof document !== 'undefined' ? document : null);
    const safeRows = Math.min(Math.max(Math.floor(Number(rows) || 3), 1), 8);
    const safeCells = Math.min(Math.max(Math.floor(Number(cells) || 10), 4), 24);
    const random = mulberry32((Number(seed) || 1) >>> 0);
    const root = node(owner, 'div', 'skeleton');
    root.setAttribute('role', 'status');
    root.setAttribute('aria-busy', 'true');
    root.setAttribute('aria-label', sanitizeText(label, 80));
    for (let row = 0; row < safeRows; row += 1) {
      const dots = node(owner, 'div', 'skeleton__dots');
      dots.setAttribute('aria-hidden', 'true');
      for (let cell = 0; cell < safeCells; cell += 1) {
        const size = DOT_SIZES[Math.floor(random() * DOT_SIZES.length)];
        const dot = node(owner, 'span', `skeleton__dot dot--${size}`);
        dot.style.animationDelay = `${Math.round(random() * 800)}ms`;
        dots.appendChild(dot);
      }
      const barTrack = node(owner, 'div', 'skeleton__bar-track');
      barTrack.setAttribute('aria-hidden', 'true');
      const bar = node(owner, 'span', 'skeleton__bar');
      bar.style.width = `${72 + Math.floor(random() * 26)}%`;
      barTrack.appendChild(bar);
      root.append(dots, barTrack);
    }
    return root;
  }

  mount(container, options = {}) {
    if (!container) return null;
    const element = Skeleton.render({ ...options, doc: container.ownerDocument });
    container.replaceChildren(element);
    return container;
  }

  clear(container) {
    container?.replaceChildren();
    return container;
  }
}

export { DOT_SIZES };
