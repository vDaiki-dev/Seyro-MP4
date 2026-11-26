// Selector de pistas verificadas. Nunca propone calidades ausentes.

import { Badge } from './components.js';
import { sanitizeText } from './security.js';

export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm'];
export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'opus', 'ogg', 'flac'];

export function normalizeKind(kind) {
  const value = sanitizeText(kind, 40).toLowerCase();
  if (value.includes('video') && value.includes('audio')) return 'video_audio';
  if (value.includes('video')) return 'video';
  if (value.includes('audio')) return 'audio';
  return 'unknown';
}

export function trackQuality(track) {
  return sanitizeText(track?.quality_label, 40)
    || sanitizeText(track?.quality, 40)
    || '—';
}

export function readableSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`;
}

export function defaultSelection(tracks) {
  const safe = Array.isArray(tracks) ? tracks : [];
  const combined = safe.find((track) => normalizeKind(track.kind) === 'video_audio');
  const video = safe.find((track) => normalizeKind(track.kind) === 'video');
  const audio = safe.find((track) => normalizeKind(track.kind) === 'audio');
  return {
    videoId: combined || video ? (combined || video).source_format_id : '',
    audioId: combined ? '' : (audio?.source_format_id ?? ''),
  };
}

/** Construye la selección con pistas que vienen de una inspección real. */
export class FormatSelector {
  constructor(doc, translate, onDownload = null) {
    this.doc = doc;
    this.t = translate;
    this.onDownload = onDownload;
    this.tracks = [];
    this.selectedVideoId = '';
    this.selectedAudioId = '';
    this.extension = '';
    this.onChange = null;
    this.root = null;
  }

  track(id) {
    return this.tracks.find((item) => item.source_format_id === id) ?? null;
  }

  emitChange() {
    this.onChange?.(this.selection());
  }

  chooseExtension() {
    const video = this.track(this.selectedVideoId);
    const audio = this.track(this.selectedAudioId);
    const allowed = video ? VIDEO_EXTENSIONS : audio ? AUDIO_EXTENSIONS : [];
    const preferred = (video || audio)?.extension ?? '';
    this.extension = allowed.includes(preferred) ? preferred : (allowed[0] ?? '');
  }

  makeTrackButton(track, group) {
    const doc = this.doc;
    const id = sanitizeText(track.source_format_id, 32);
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'format-option';
    button.dataset.trackId = id;
    button.dataset.group = group;
    const selected = group === 'video' ? id === this.selectedVideoId : id === this.selectedAudioId;
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${this.t('label.selection')}: ${trackQuality(track)}`);

    const meta = [
      this.t(`label.${group === 'video' ? 'videoTrack' : 'audioTrack'}`),
      sanitizeText(track.extension, 8).toUpperCase(),
      track.fps ? `${Number(track.fps).toFixed(0)} fps` : '',
      readableSize(track.estimated_size_bytes),
    ].filter(Boolean).join(' · ');

    const text = doc.createElement('span');
    const quality = Badge.create(trackQuality(track), 'accent', doc);
    const detail = doc.createElement('span');
    detail.className = 'format-option__meta';
    detail.textContent = meta;
    text.append(quality, detail);
    button.appendChild(text);

    button.addEventListener('click', () => {
      if (group === 'video') {
        this.selectedVideoId = this.selectedVideoId === id ? '' : id;
        if (this.selectedVideoId && normalizeKind(this.track(id)?.kind) === 'video_audio') {
          this.selectedAudioId = '';
        }
      } else {
        this.selectedAudioId = this.selectedAudioId === id ? '' : id;
        if (this.selectedAudioId && this.selectedVideoId
          && normalizeKind(this.track(this.selectedVideoId)?.kind) === 'video_audio') {
          this.selectedVideoId = '';
        }
      }
      this.chooseExtension();
      this.render();
      this.emitChange();
    });
    return button;
  }

  makeGroup(title, tracks, group) {
    const doc = this.doc;
    const section = doc.createElement('fieldset');
    section.className = 'format-group';
    const legend = doc.createElement('legend');
    legend.textContent = title;
    section.appendChild(legend);
    if (!tracks.length) {
      const empty = doc.createElement('p');
      empty.className = 'format-empty';
      empty.textContent = this.t('value.unknown');
      section.appendChild(empty);
      return section;
    }
    const list = doc.createElement('div');
    list.className = 'format-selector';
    for (const track of tracks) list.appendChild(this.makeTrackButton(track, group));
    section.appendChild(list);
    return section;
  }

  mount(container, inspection) {
    if (!container) return null;
    this.tracks = Array.isArray(inspection?.tracks) ? inspection.tracks : [];
    const defaults = defaultSelection(this.tracks);
    if (!this.track(this.selectedVideoId) && !this.track(this.selectedAudioId)) {
      this.selectedVideoId = defaults.videoId;
      this.selectedAudioId = defaults.audioId;
    }
    this.chooseExtension();
    this.root = this.doc.createElement('div');
    this.root.className = 'selection';
    container.replaceChildren(this.root);
    this.render();
    this.emitChange();
    return this.root;
  }

  render() {
    if (!this.root) return;
    const doc = this.doc;
    this.root.replaceChildren();

    const videos = this.tracks.filter((track) => ['video', 'video_audio'].includes(normalizeKind(track.kind)));
    const audios = this.tracks.filter((track) => normalizeKind(track.kind) === 'audio');
    this.root.append(
      this.makeGroup(this.t('label.videoTrack'), videos, 'video'),
      this.makeGroup(this.t('label.audioTrack'), audios, 'audio'),
    );

    const footer = doc.createElement('div');
    footer.className = 'selection__footer';
    const label = doc.createElement('label');
    label.textContent = this.t('label.container');
    const select = doc.createElement('select');
    select.className = 'selection__extension';
    select.setAttribute('aria-label', this.t('label.container'));
    const allowed = this.selectedVideoId || this.selectedAudioId
      ? (this.selectedVideoId ? VIDEO_EXTENSIONS : AUDIO_EXTENSIONS)
      : [];
    for (const option of allowed) {
      const item = doc.createElement('option');
      item.value = option;
      item.textContent = option.toUpperCase();
      item.selected = option === this.extension;
      select.appendChild(item);
    }
    select.addEventListener('change', () => {
      this.extension = select.value;
      this.render();
      this.emitChange();
    });
    label.appendChild(select);
    footer.appendChild(label);

    const notes = [];
    if (this.selectedVideoId && this.selectedAudioId) notes.push(this.t('label.requiresMux'));
    const audio = this.track(this.selectedAudioId);
    if (audio && this.extension && this.extension !== audio.extension) {
      notes.push(this.t('label.transcoded'));
    }
    if (notes.length) {
      const note = doc.createElement('p');
      note.className = 'selection__note';
      note.textContent = notes.join(' · ');
      footer.appendChild(note);
    }

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'button button--primary selection__download';
    button.textContent = this.t('action.download');
    button.disabled = !this.selection();
    button.addEventListener('click', () => {
      const selection = this.selection();
      if (selection) this.onDownload?.(selection);
    });
    footer.appendChild(button);
    this.root.appendChild(footer);
  }

  selection() {
    const video = this.track(this.selectedVideoId);
    const audio = this.track(this.selectedAudioId);
    if (!video && !audio) return null;
    if (!this.extension) return null;
    const parts = [video && trackQuality(video), audio && trackQuality(audio)].filter(Boolean);
    return {
      videoId: video?.source_format_id ?? '',
      audioId: audio?.source_format_id ?? '',
      extension: this.extension,
      quality: parts.join('+'),
      requiresMux: Boolean(video && audio),
      transcoded: Boolean(audio && this.extension !== audio.extension),
    };
  }
}
