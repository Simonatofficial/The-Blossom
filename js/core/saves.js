/* Saves (docs/01): export/import (file + full-state Blossom code), autosave
   backups, and the day-rollover check that powers all day-based logic. */

import { store } from './store.js';
import { events } from './events.js';
import { ulid } from './ids.js';
import * as codes from './codes.js';

const KEEP_DAILY = 30;

/* ---------- day rollover ---------- */

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Run on boot and visibilitychange. Emits 'day:rolled' once per new day. */
export function checkDayRollover() {
  const today = localToday();
  const last = store.getMeta('lastActiveDate');
  if (!last) { store.setMeta('lastActiveDate', today); return; }
  if (last >= today) return;
  // Listeners (skills finalize, health pays out, streaks update) run sync here.
  events.emit('day:rolled', { from: last, to: today });
  store.setMeta('lastActiveDate', today);
  makeAutosave(`Daily — ${last}`, 'daily');
}

export function initSaves() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkDayRollover();
  });
}

/* ---------- autosaves ---------- */

/**
 * Write a backup into the saves store.
 * @param {string} name @param {'daily'|'manual'|'export'|'safety'} sub
 */
export function makeAutosave(name, sub = 'manual') {
  const rec = store.put('saves', {
    id: ulid(), kind: 'autosave', sub, name,
    date: Date.now(),
    history: [Date.now()],
    payload: codes.snapshotNode('ws', null)
  });
  // keep the most recent 30 daily backups
  const dailies = store.all('saves')
    .filter(s => s.kind === 'autosave' && s.sub === 'daily')
    .sort((a, b) => b.date - a.date);
  for (const old of dailies.slice(KEEP_DAILY)) store.del('saves', old.id);
  events.emit('saves:changed', {});
  return rec;
}

/* ---------- export ---------- */

/** Full-state save code (a ws-type Blossom code). */
export async function saveCode() {
  return codes.encode('ws', codes.snapshotNode('ws', null));
}

/** Download a .blossom JSON file. */
export function downloadFile() {
  const data = {
    format: 'blossom-save', v: 1, exportedAt: Date.now(),
    payload: codes.snapshotNode('ws', null)
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `the-blossom-${localToday()}.blossom`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- import ---------- */

/** Parse a save file's text into a ws payload. */
export function parseSaveFile(text) {
  const data = JSON.parse(text);
  if (data.format !== 'blossom-save' || !data.payload) throw new Error('Not a Blossom save file.');
  return data.payload;
}

/**
 * Import a ws payload.
 * @param {object} payload @param {'merge'|'replace'} mode
 */
export async function importWorkspace(payload, mode) {
  if (mode === 'replace') {
    makeAutosave('Before replace', 'safety'); // docs/01: Replace makes a safety autosave first
    const data = {};
    for (const rec of payload.children || []) {
      const { _s, ...record } = rec;
      if (_s === 'saves' || _s === 'trash') continue; // backups stay local
      (data[_s] = data[_s] || []).push(record);
    }
    const keepSaves = store.all('saves');
    await store.replaceAll(data);
    for (const s of keepSaves) store.put('saves', s);
  } else {
    codes.importNode('ws', payload);
  }
  events.emit('module:changed', {});
  events.emit('page:changed', {});
  events.emit('saves:changed', {});
}
