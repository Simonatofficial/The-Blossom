/* Music Player widget (docs/05): local files only (offline rule). Audio
   stored as Blobs; playlist, shuffle/repeat, seek, volume, Media Session. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, confirmDialog } from '../ui/components.js';
import { objectsOf, createObject } from './base.js';

const players = new Map(); // widgetId -> { audio, trackId }

function playerFor(widget) {
  if (!players.has(widget.id)) {
    players.set(widget.id, { audio: new Audio(), trackId: null, url: null });
  }
  return players.get(widget.id);
}

registry.register({
  type: 'music',
  name: 'Music Player',
  icon: 'music',
  description: 'Your local songs, softly',
  external: true, internal: false,
  defaultConfig: () => ({ shuffle: false, repeat: false, volume: 0.9 }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const tracks = objectsOf(widget.id, 'track').sort((a, b) => a.createdAt - b.createdAt);
    const p = playerFor(widget);
    p.audio.volume = widget.config.volume ?? 0.9;

    const card = el(`<div class="music-widget">
      <div class="m-now soft" style="text-align:center;font-size:0.86rem;min-height:1.4em"></div>
      <input type="range" class="range m-seek" min="0" max="100" value="0">
      <div class="row" style="justify-content:center;gap:4px">
        <button class="btn-icon m-shuf" style="color:${widget.config.shuffle ? 'var(--accent)' : 'var(--text-soft)'}">${icon('shuffle', 16)}</button>
        <button class="btn-icon m-prev">${icon('chevron-left', 20)}</button>
        <button class="btn-icon m-play" style="width:44px;height:44px;color:var(--accent)">${icon(p.audio.paused ? 'play' : 'pause', 24)}</button>
        <button class="btn-icon m-next">${icon('chevron-right', 20)}</button>
        <button class="btn-icon m-rep" style="color:${widget.config.repeat ? 'var(--accent)' : 'var(--text-soft)'}">${icon('repeat', 15)}</button>
      </div>
      <div class="row"><span class="soft">${icon('volume', 14)}</span><input type="range" class="range m-vol" min="0" max="1" step="0.05"></div>
      <div class="m-list"></div>
    </div>`);
    const now = card.querySelector('.m-now');
    const seek = card.querySelector('.m-seek');
    const playBtn = card.querySelector('.m-play');
    const listEl = card.querySelector('.m-list');

    const trackName = (t) => t?.data.name || '—';
    const current = () => tracks.find(t => t.id === p.trackId) || tracks[0];

    const load = (track, autoplay = true) => {
      if (!track) return;
      if (p.url) URL.revokeObjectURL(p.url);
      p.url = URL.createObjectURL(track.data.blob);
      p.audio.src = p.url;
      p.trackId = track.id;
      now.textContent = trackName(track);
      if (autoplay) p.audio.play();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: trackName(track), artist: 'My Blossom' });
        navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
      }
      renderList();
    };
    const step = (dir) => {
      if (!tracks.length) return;
      let i = tracks.findIndex(t => t.id === p.trackId);
      i = widget.config.shuffle ? Math.floor(Math.random() * tracks.length) : (i + dir + tracks.length) % tracks.length;
      load(tracks[i]);
    };

    playBtn.onclick = () => {
      if (!p.audio.src) { load(current()); return; }
      p.audio.paused ? p.audio.play() : p.audio.pause();
    };
    card.querySelector('.m-prev').onclick = () => step(-1);
    card.querySelector('.m-next').onclick = () => step(1);
    card.querySelector('.m-shuf').onclick = (e) => { widget.config.shuffle = !widget.config.shuffle; store.put('widgets', widget); e.currentTarget.style.color = widget.config.shuffle ? 'var(--accent)' : 'var(--text-soft)'; };
    card.querySelector('.m-rep').onclick = (e) => { widget.config.repeat = !widget.config.repeat; store.put('widgets', widget); e.currentTarget.style.color = widget.config.repeat ? 'var(--accent)' : 'var(--text-soft)'; };

    const vol = card.querySelector('.m-vol');
    vol.value = widget.config.volume ?? 0.9;
    vol.oninput = () => { p.audio.volume = Number(vol.value); widget.config.volume = Number(vol.value); store.put('widgets', widget); };

    p.audio.onplay = () => { playBtn.innerHTML = icon('pause', 24); };
    p.audio.onpause = () => { playBtn.innerHTML = icon('play', 24); };
    p.audio.onended = () => { widget.config.repeat ? p.audio.play() : step(1); };
    p.audio.ontimeupdate = () => { if (p.audio.duration) seek.value = (p.audio.currentTime / p.audio.duration) * 100; };
    seek.oninput = () => { if (p.audio.duration) p.audio.currentTime = (Number(seek.value) / 100) * p.audio.duration; };
    if (p.trackId) now.textContent = trackName(current());

    const renderList = () => {
      listEl.innerHTML = '';
      for (const t of tracks) {
        const row = el(`<button class="m-track ${t.id === p.trackId ? 'on' : ''}"><span class="li-title"></span><span class="btn-icon">${icon('x', 12)}</span></button>`);
        row.querySelector('.li-title').textContent = trackName(t);
        row.onclick = (e) => {
          if (e.target.closest('.btn-icon')) return;
          load(t);
        };
        row.querySelector('.btn-icon').onclick = async (e) => {
          e.stopPropagation();
          if (await confirmDialog({ title: `Remove “${trackName(t)}”?` })) {
            store.trash('objects', t.id);
            ctx.renderWidgetCard(widget);
            ctx.refreshCard(widget);
          }
        };
        listEl.appendChild(row);
      }
      const add = el(`<button class="btn-soft-wide" style="margin-top:6px;padding:8px">${icon('plus', 14)} Add songs</button>`);
      add.onclick = () => {
        const fileIn = el('<input type="file" accept="audio/*" multiple class="hidden">');
        document.body.appendChild(fileIn);
        fileIn.onchange = () => {
          for (const f of fileIn.files) createObject(widget.id, 'track', { blob: f, name: f.name.replace(/\.\w+$/, '') });
          fileIn.remove();
          ctx.refreshCard(widget);
        };
        fileIn.click();
      };
      listEl.appendChild(add);
    };
    renderList();
    host.appendChild(card);
  }
});
