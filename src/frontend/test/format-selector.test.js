import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, defaultSelection, normalizeKind,
  readableSize, trackQuality,
} from '../format-selector.js';

test('normaliza los tipos serializados por serde', () => {
  assert.equal(normalizeKind('VideoAudio'), 'video_audio');
  assert.equal(normalizeKind('video_only'), 'video');
  assert.equal(normalizeKind('AudioOnly'), 'audio');
  assert.equal(normalizeKind('<script>'), 'unknown');
});

test('las etiquetas vienen del núcleo y el tamaño es estimado', () => {
  assert.equal(trackQuality({ quality_label: '1080p' }), '1080p');
  assert.equal(trackQuality({ quality: '320kbps' }), '320kbps');
  assert.equal(trackQuality(null), '—');
  assert.equal(readableSize(0), '');
  assert.equal(readableSize(null), '');
  assert.equal(readableSize(2 * 1024 * 1024), '2.0 MB');
});

test('la selección inicial usa pistas reales sin inventar mux', () => {
  const tracks = [
    { source_format_id: '137', kind: 'VideoOnly', extension: 'mp4' },
    { source_format_id: '140', kind: 'AudioOnly', extension: 'm4a' },
  ];
  assert.deepEqual(defaultSelection(tracks), { videoId: '137', audioId: '140' });
  const combined = [{ source_format_id: '22', kind: 'VideoAudio', extension: 'mp4' }];
  assert.deepEqual(defaultSelection(combined), { videoId: '22', audioId: '' });
  assert.deepEqual(defaultSelection([]), { videoId: '', audioId: '' });
});

test('los contenedores ofrecidos son una lista blanca', () => {
  assert.deepEqual(VIDEO_EXTENSIONS, ['mp4', 'mkv', 'webm']);
  assert.deepEqual(AUDIO_EXTENSIONS, ['mp3', 'm4a', 'aac', 'opus', 'ogg', 'flac']);
});
