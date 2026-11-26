import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCENTS, DEFAULT_SETTINGS, STORAGE_KEY, accentHex, applyTheme, contrastRatio,
  effectiveMode, normalizeSettings, readSettings, validateAccent, writeSettings,
} from '../theme.js';

function fakeStorage(initial = '') {
  const data = new Map([[STORAGE_KEY, initial]]);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

function fakeDoc() {
  const properties = new Map();
  return {
    documentElement: {
      dataset: {},
      lang: '',
      style: { setProperty: (name, value) => properties.set(name, value) },
    },
    properties,
  };
}

test('normalizeSettings filtra valores no confiables', () => {
  assert.deepEqual(normalizeSettings({
    mode: 'admin', accent: '<script>', customAccent: 'no-es-hex',
    font: 'remote', locale: 'fr',
  }), DEFAULT_SETTINGS);
  assert.equal(normalizeSettings({ mode: 'terminal', locale: 'en' }).locale, 'en');
});

test('readSettings y writeSettings son tolerantes a fallos', () => {
  assert.deepEqual(readSettings(fakeStorage('{ JSON roto')), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings(null), DEFAULT_SETTINGS);
  const storage = fakeStorage();
  const saved = { ...DEFAULT_SETTINGS, mode: 'paper', accent: 'lime' };
  assert.equal(writeSettings(storage, saved), true);
  assert.deepEqual(readSettings(storage), saved);
  assert.equal(writeSettings(null, saved), false);
});

test('accentHex resuelve presets y color personalizado', () => {
  assert.equal(accentHex({ accent: 'lime' }), '#c6ff00');
  assert.equal(accentHex({ accent: 'custom', customAccent: '#ABCDEF' }), '#abcdef');
  assert.equal(accentHex({}), ACCENTS[0].hex);
});

test('contrastRatio y validateAccent aplican WCAG', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ff6b00', '#ff6b00'), 1);
  for (const accent of ACCENTS) {
    assert.equal(validateAccent(accent.hex).ok, true, `acento rechazado: ${accent.id}`);
  }
  assert.equal(validateAccent('no-es-hex').ok, false);
});

test('effectiveMode respeta el sistema', () => {
  assert.equal(effectiveMode({ mode: 'system' }, false), 'paper');
  assert.equal(effectiveMode({ mode: 'system' }, true), 'terminal');
  assert.equal(effectiveMode({ mode: 'paper' }, true), 'paper');
});

test('applyTheme fija tokens sin tocar el HTML', () => {
  const doc = fakeDoc();
  const applied = applyTheme(doc, { mode: 'system', font: 'mono', accent: 'cyan', locale: 'en' }, true);
  assert.deepEqual(applied, { mode: 'terminal', accent: '#00d9ff', font: 'mono' });
  assert.equal(doc.documentElement.dataset.mode, 'system');
  assert.equal(doc.documentElement.dataset.font, 'mono');
  assert.equal(doc.documentElement.dataset.accent, 'cyan');
  assert.equal(doc.documentElement.lang, 'en');
  assert.equal(doc.properties.get('--accent'), '#00d9ff');
  assert.match(doc.properties.get('--font-mono'), /monospace/);
  assert.equal(applyTheme(null, DEFAULT_SETTINGS), null);
});
