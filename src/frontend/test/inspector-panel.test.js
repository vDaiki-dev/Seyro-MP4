import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDuration } from '../inspector-panel.js';

test('la duración es real y legible', () => {
  assert.equal(formatDuration(0), '');
  assert.equal(formatDuration(42), '42s');
  assert.equal(formatDuration(125), '2:05');
  assert.equal(formatDuration(null), '');
  assert.equal(formatDuration(-4), '');
});
