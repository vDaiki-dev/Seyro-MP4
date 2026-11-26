import test from 'node:test';
import assert from 'node:assert/strict';

import {
  safeExternalUrl, safeHexColor, sanitizeKey, sanitizeText, validatePublicHttpsUrl,
} from '../security.js';

test('sanitizeText elimina caracteres de control y respeta el límite', () => {
  assert.equal(sanitizeText('  Hola\u0007 mundo  ', 20), 'Hola mundo');
  assert.equal(sanitizeText('abcdef', 3), 'abc');
  assert.equal(sanitizeText(null), '');
});

test('sanitizeKey y safeHexColor usan listas blancas', () => {
  assert.equal(sanitizeKey('bueno_1', 'x'), 'bueno_1');
  assert.equal(sanitizeKey('../mal', 'x'), 'x');
  assert.equal(safeHexColor('#FF6B00'), '#ff6b00');
  assert.equal(safeHexColor('ff6b00'), '#ff6b00');
  assert.equal(safeHexColor('rojo', '#ff6b00'), '#ff6b00');
});

test('safeExternalUrl solo admite repositorios Seyroo y Pages', () => {
  assert.match(safeExternalUrl('https://github.com/vDaiki-dev/Seyro-MP4'), /github\.com/);
  assert.match(safeExternalUrl('https://vdaiki-dev.github.io/Seyro-MP4/'), /github\.io/);
  assert.equal(safeExternalUrl('https://ejemplo.com/descarga.exe'), '');
});

test('validatePublicHttpsUrl acepta dominios conocidos y detecta archivo directo', () => {
  const youtube = validatePublicHttpsUrl('https://www.youtube.com/watch?v=abc123&t=3');
  assert.equal(youtube.ok, true);
  assert.equal(youtube.host, 'www.youtube.com');
  assert.equal(youtube.direct, false);

  const direct = validatePublicHttpsUrl('https://youtube.com/media/clip.mp4');
  assert.equal(direct.ok, true);
  assert.equal(direct.direct, true);

  const music = validatePublicHttpsUrl('https://music.youtube.com/watch?v=x');
  assert.equal(music.host, 'music.youtube.com');

  const media = validatePublicHttpsUrl('https://media.ejemplo.org/cancion.mp3');
  assert.equal(media.ok, true);
  assert.equal(media.direct, true);
});

test('validatePublicHttpsUrl rechaza esquema, credenciales, IP, hosts locales y traversal', () => {
  for (const value of [
    'http://youtube.com/watch?v=x',
    'https://user:pass@youtube.com/watch',
    'https://127.0.0.1/x',
    'https://localhost/x',
    'https://intranet.internal/x',
    'https://ejemplo.com/x',
    'https://youtube.com/a/../b',
    'https://youtube.com/a\\b',
    '',
  ]) {
    assert.equal(validatePublicHttpsUrl(value).ok, false, `debió rechazar: ${value}`);
  }
});
