import test from 'node:test';
import assert from 'node:assert/strict';

import { isActive, stateKey } from '../queue-item.js';

test('los estados de la cola tienen etiquetas i18n estables', () => {
  assert.equal(stateKey('downloading'), 'status.downloading');
  assert.equal(stateKey('processing'), 'status.processing');
  assert.equal(stateKey('done'), 'status.done');
  assert.equal(stateKey('error'), 'status.error');
  assert.equal(stateKey('cancelled'), 'status.cancelled');
  assert.equal(stateKey('otro'), 'status.idle');
});

test('solo descargando y procesando son estados activos', () => {
  assert.equal(isActive('downloading'), true);
  assert.equal(isActive('processing'), true);
  assert.equal(isActive('done'), false);
  assert.equal(isActive('error'), false);
  assert.equal(isActive('cancelled'), false);
  assert.equal(isActive('<script>'), false);
});
