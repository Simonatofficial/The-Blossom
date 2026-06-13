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
  events.emit('notify', { category: 'rollover', text: `A new day — ${last} is tended and saved.` });
}

export function initSaves() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkDayRollover();
  });
}

/* ---------- off-device backup reminder (Phase 10: local-only data safety) ----
   Everything lives on this device; the one real loss risk is cleared browser
   data with no external copy. If it's been long since the user downloaded a
   file or copied a save code, drop ONE calm note into the notifications feed
   (never a nagging toast) — at most once a week, and never for a fresh, nearly
   empty install. */

const BACKUP_REMIND_AFTER = 14 * 86400000; // 14 days since the last off-device backup
const BACKUP_REMIND_COOLDOWN = 7 * 86400000;

/** Mark that the user just took an off-device backup (download / copy code). */
export function recordExport() {
  store.setMeta('lastExportAt', Date.now());
}

/** Most recent off-device backup timestamp, or null. */
export function lastExportAt() {
  return store.getMeta('lastExportAt', null);
}

/** Run once on boot; emits a single 'backup' notification when overdue. */
export function maybeBackupReminder() {
  let installed = store.getMeta('installedAt', null);
  if (!installed) { installed = Date.now(); store.setMeta('installedAt', installed); }
  if (store.all('widgets').length < 4) return; // nothing worth worrying about yet
  const last = store.getMeta('lastExportAt', null) || installed;
  const nudged = store.getMeta('lastBackupNudge', 0);
  const now = Date.now();
  if (now - last <= BACKUP_REMIND_AFTER || now - nudged <= BACKUP_REMIND_COOLDOWN) return;
  store.setMeta('lastBackupNudge', now);
  const days = Math.round((now - last) / 86400000);
  events.emit('notify', { category: 'backup', text: `It’s been ${days} days since you backed up off this device — Settings → Saves → Download file keeps your garden safe.` });
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
