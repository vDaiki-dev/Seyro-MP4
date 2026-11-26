import test from 'node:test';
import assert from 'node:assert/strict';

import { invoke, isDesktop, normalizeError } from '../ipc.js';

test('sin puente Tauri no hay IPC', async () => {
  const previous = globalThis.__TAURI__;
  delete globalThis.__TAURI__;
  delete globalThis.__TAURI_INTERNALS__;
  assert.equal(isDesktop(), false);
  await assert.rejects(invoke('inspect', { url: 'https://x' }), (error) => {
    assert.equal(error.code, 'IPC_NO_DISPONIBLE');
    return true;
  });
  if (previous !== undefined) globalThis.__TAURI__ = previous;
});

test('invoke pasa nombre y argumentos sin evaluar cadenas', async () => {
  const calls = [];
  globalThis.__TAURI__ = {
    core: {
      invoke: (command, args) => {
        calls.push([command, args]);
        return Promise.resolve({ ok: true });
      },
    },
  };
  assert.equal(isDesktop(), true);
  const result = await invoke('job_list', {});
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [['job_list', {}]]);
  delete globalThis.__TAURI__;
});

test('normalizeError elimina stack traces y conserva código estable', () => {
  assert.deepEqual(
    normalizeError({ code: 'E_DRM', message: 'DRM', detail: 'ruta', stack: 'secreto' }),
    { code: 'E_DRM', message: 'DRM', detail: 'ruta' },
  );
  assert.equal(normalizeError(new Error('fallo')).code, 'E_INTERNO');
  assert.equal(normalizeError({ code: 'x'.repeat(100) }).code.length, 64);
});
