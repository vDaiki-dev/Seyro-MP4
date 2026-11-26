// Panel de apariencia: modo, acento con validación de contraste, tipografía e idioma.

import { Badge } from './components.js';
import { LOCALES, translate } from './i18n.js';
import { safeHexColor } from './security.js';
import {
  ACCENTS,
  FONTS,
  MODES,
  accentHex,
  normalizeSettings,
  validateAccent,
} from './theme.js';

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fieldset(doc, legend) {
  const group = el(doc, 'fieldset', 'appearance__group');
  group.appendChild(el(doc, 'legend', 'appearance__legend', legend));
  return group;
}

/** Construye el panel; onChange recibe un parche de preferencias. */
export function buildAppearancePanel(settings, onChange, doc = null) {
  const owner = doc || (typeof document !== 'undefined' ? document : null);
  const current = normalizeSettings(settings);
  const root = el(owner, 'div', 'appearance');

  const modeGroup = fieldset(owner, translate(current.locale, 'label.mode'));
  const modeRow = el(owner, 'div', 'appearance__row');
  const modeButtons = new Map();
  for (const mode of MODES) {
    const button = el(owner, 'button', 'button button--choice', translate(current.locale, `mode.${mode}`));
    button.type = 'button';
    button.dataset.mode = mode;
    button.setAttribute('aria-pressed', String(mode === current.mode));
    button.addEventListener('click', () => onChange({ mode }));
    modeButtons.set(mode, button);
    modeRow.appendChild(button);
  }
  modeGroup.appendChild(modeRow);

  const accentGroup = fieldset(owner, translate(current.locale, 'label.accent'));
  const accentRow = el(owner, 'div', 'appearance__row');
  const accentButtons = new Map();
  for (const accent of ACCENTS) {
    const button = el(owner, 'button', 'button button--swatch', translate(current.locale, accent.labelKey));
    button.type = 'button';
    button.dataset.accent = accent.id;
    button.style.setProperty('--swatch', accent.hex);
    button.setAttribute('aria-pressed', String(accent.id === current.accent));
    button.addEventListener('click', () => onChange({ accent: accent.id }));
    accentButtons.set(accent.id, button);
    accentRow.appendChild(button);
  }

  const customLabel = el(owner, 'label', 'appearance__custom');
  customLabel.appendChild(el(owner, 'span', '', translate(current.locale, 'label.customColor')));
  const color = el(owner, 'input', 'appearance__color');
  color.type = 'color';
  color.value = current.customAccent;
  color.setAttribute('aria-label', translate(current.locale, 'label.customColor'));
  customLabel.appendChild(color);
  const contrast = Badge.create('', 'status', owner);
  contrast.classList.add('appearance__contrast');
  customLabel.appendChild(contrast);
  const refreshContrast = () => {
    const check = validateAccent(color.value);
    contrast.textContent = translate(current.locale, check.ok ? 'contrast.ok' : 'contrast.bad');
    contrast.dataset.variant = check.ok ? 'ok' : 'bad';
    contrast.classList.toggle('badge--bad', !check.ok);
    color.setAttribute('aria-invalid', String(!check.ok));
  };
  color.addEventListener('input', () => {
    const hex = safeHexColor(color.value, current.customAccent);
    refreshContrast();
    onChange({ accent: 'custom', customAccent: hex });
  });
  refreshContrast();

  const customButton = el(owner, 'button', 'button button--swatch', translate(current.locale, 'accent.custom'));
  customButton.type = 'button';
  customButton.dataset.accent = 'custom';
  customButton.style.setProperty('--swatch', accentHex(current));
  customButton.setAttribute('aria-pressed', String(current.accent === 'custom'));
  customButton.addEventListener('click', () => onChange({ accent: 'custom' }));
  accentButtons.set('custom', customButton);
  accentRow.appendChild(customButton);
  accentGroup.append(accentRow, customLabel);

  const fontGroup = fieldset(owner, translate(current.locale, 'label.font'));
  const fontSelect = el(owner, 'select', 'appearance__select');
  fontSelect.setAttribute('aria-label', translate(current.locale, 'label.font'));
  for (const font of FONTS) {
    const option = el(owner, 'option', '', translate(current.locale, font.labelKey));
    option.value = font.id;
    option.selected = font.id === current.font;
    fontSelect.appendChild(option);
  }
  fontSelect.addEventListener('change', () => onChange({ font: fontSelect.value }));
  fontGroup.appendChild(fontSelect);

  const localeGroup = fieldset(owner, translate(current.locale, 'label.language'));
  const localeSelect = el(owner, 'select', 'appearance__select');
  localeSelect.setAttribute('aria-label', translate(current.locale, 'label.language'));
  for (const locale of LOCALES) {
    const option = el(owner, 'option', '', locale.toUpperCase());
    option.value = locale;
    option.selected = locale === current.locale;
    localeSelect.appendChild(option);
  }
  localeSelect.addEventListener('change', () => onChange({ locale: localeSelect.value }));
  localeGroup.appendChild(localeSelect);

  root.append(modeGroup, accentGroup, fontGroup, localeGroup);

  return {
    element: root,
    /** Sincroniza botones activos y la muestra de contraste tras un cambio. */
    sync(nextSettings) {
      const next = normalizeSettings(nextSettings);
      for (const [id, button] of modeButtons) button.setAttribute('aria-pressed', String(id === next.mode));
      for (const [id, button] of accentButtons) {
        button.setAttribute('aria-pressed', String(id === next.accent));
        if (id === 'custom') button.style.setProperty('--swatch', accentHex(next));
      }
      color.value = next.customAccent;
      refreshContrast();
      fontSelect.value = next.font;
      localeSelect.value = next.locale;
    },
  };
}
