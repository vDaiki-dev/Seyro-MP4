import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE, LOCALES, dictionaryKeys, isLocale, translate, translateDom,
} from '../i18n.js';

test('los diccionarios tienen exactamente las mismas claves', () => {
  const spanish = dictionaryKeys(DEFAULT_LOCALE).sort();
  const english = dictionaryKeys('en').sort();
  assert.deepEqual(english, spanish);
  assert.ok(spanish.length > 80, `diccionario demasiado corto: ${spanish.length}`);
});

test('translate usa el idioma pedido y respalda al español', () => {
  assert.equal(translate('es', 'action.analyze'), 'Analizar enlace');
  assert.equal(translate('en', 'action.analyze'), 'Analyze link');
  assert.equal(translate('fr', 'action.analyze'), 'Analizar enlace');
  assert.equal(translate('en', 'clave.inexistente'), 'clave.inexistente');
});

test('translate interpola variables sin interpretar HTML', () => {
  const key = 'demo.interpolation';
  assert.equal(translate('es', key), key);
  // La interpolación se prueba con una clave existente y marcadores literales.
  assert.equal(translate('es', 'app.title', { nada: '<script>' }), 'Seyro-MP4');
});

test('isLocale y LOCALES son la única fuente de idiomas', () => {
  assert.deepEqual(LOCALES, ['es', 'en']);
  assert.equal(isLocale('en'), true);
  assert.equal(isLocale('fr'), false);
});

test('translateDom aplica texto, título, aria y placeholder', () => {
  const make = (dataset) => ({ dataset, textContent: '', attributes: {}, setAttribute(k, v) { this.attributes[k] = v; } });
  const nodes = [
    make({ i18n: 'app.title' }),
    make({ i18nTitle: 'action.settings', i18nAria: 'action.settings' }),
    make({ i18nPlaceholder: 'label.linkPlaceholder' }),
  ];
  const root = { querySelectorAll: (selector) => {
    if (selector === '[data-i18n]') return [nodes[0]];
    if (selector === '[data-i18n-title]') return [nodes[1]];
    if (selector === '[data-i18n-placeholder]') return [nodes[2]];
    return [];
  } };
  translateDom(root, 'en');
  assert.equal(nodes[0].textContent, 'Seyro-MP4');
  assert.equal(nodes[1].attributes.title, 'Appearance and language');
  assert.equal(nodes[1].attributes['aria-label'], 'Appearance and language');
  assert.equal(nodes[2].attributes.placeholder, 'https://...');
  assert.equal(translateDom(null, 'en'), null);
});
