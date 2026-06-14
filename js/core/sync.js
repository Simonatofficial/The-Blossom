/* Cloud sync (V2 §1): an OPTIONAL mirror of local data to Supabase. IndexedDB
   stays the single source of truth — every read still comes from the local
   store and the app works fully offline. This is the only file that touches
   Supabase, and when `window.BLOSSOM_CONFIG` is missing/empty (or the CDN
   client failed to load) it disables itself silently with no errors shown.

   Model (intentionally simple, per spec):
   - push: any local write upserts one row, debounced 2s.
   - pull: fetch rows newer than the last sync, ingest when strictly newer
     (local wins on a tie).
   - syncAll: pull, then a one-time full push so a fresh account receives
     existing local data.
   Cross-device delete propagation needs tombstones and is out of scope for v1;
   a local delete removes its own remote row so the next pull can't resurrect it. */

import { store } from './store.js';
import { events } from './events.js';

const TABLE = 'blossom_sync';
const AUTH_KEY = 'blossom_auth';
const LAST_SYNC_KEY = 'blossom_last_sync';
const PUSHED_ALL_KEY = 'blossom_pushed_all';
const PUSH_DEBOUNCE = 2000;

/** store name ⇄ record_type (the SQL enum: module|page|widget|object|theme|meta) */
const STORE_TYPE = { modules: 'module', pages: 'page', widgets: 'widget', objects: 'object', themes: 'theme', meta: 'meta' };
const TYPE_STORE = Object.fromEntries(Object.entries(STORE_TYPE).map(([s, t]) => [t, s]));
/** device-local meta keys that must never leave this device */
const META_DENY = new Set(['lastActiveDate', 'lastBackupNudge', 'installedAt', 'schemaVersion']);

let client = null;
let session = null;
let enabled = false;
let status = 'idle';
const pending = new Map();    // "store:id" -> { s, id }   (upserts)
const pendingDel = new Map(); // "store:id" -> { s, id }   (deletes)
let pushTimer = null;

function cfg() {
  const c = window.BLOSSOM_CONFIG || {};
  return (c.supabaseUrl && c.supabaseAnonKey) ? c : null;
}
function keyField(s) { return s === 'meta' ? 'key' : 'id'; }
function setStatus(s) { if (s !== status) { status = s; events.emit('sync:status', { status: s }); } }

export function syncEnabled() { return enabled; }
export function syncStatus() { return status; }
export function kofiHandle() { return (window.BLOSSOM_CONFIG || {}).kofiHandle || null; }

/** Initialize sync when configured. Always safe to call — a no-op otherwise. */
export async function initSync() {
  const c = cfg();
  if (!c || !window.supabase?.createClient) return; // silently disabled (offline / unconfigured)
  try {
    client = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { persistSession: false } });
    await restoreOrCreateSession();
    enabled = true;
    events.on('store:write', ({ store: s, id }) => { if (STORE_TYPE[s]) queuePush(s, id); });
    events.on('store:delete', ({ store: s, id }) => { if (STORE_TYPE[s]) queueDelete(s, id); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPush(); });
    window.addEventListener('online', () => syncAll());
    await syncAll();
  } catch (err) {
    enabled = false;
    console.warn('[sync] disabled —', err?.message || err);
    setStatus('error');
  }
}

/* ---------- auth (anonymous by default; upgradeable to email/password) ---------- */

async function restoreOrCreateSession() {
  const saved = safeParse(localStorage.getItem(AUTH_KEY));
  if (saved?.refresh_token) {
    const { data, error } = await client.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
    if (!error && data?.session) { session = data.session; saveSession(); return; }
  }
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  session = data.session;
  saveSession();
}
function saveSession() {
  if (session) localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
}
function safeParse(s) { try { return JSON.parse(s || 'null'); } catch { return null; } }

/** Upgrade an anonymous account to email/password (Settings → Account). The
    user id is unchanged, so all synced data carries over with no migration. */
export async function upgradeAccount(email, password) {
  if (!client || !session) throw new Error('Sync is not active.');
  const { data, error } = await client.auth.updateUser({ email, password });
  if (error) throw error;
  if (data?.user) session = { ...session, user: data.user };
  return data;
}

/** A snapshot of the current account for the settings UI. */
export function accountInfo() {
  if (!enabled || !session) return { configured: !!cfg(), active: false };
  const u = session.user || {};
  return { configured: true, active: true, anonymous: u.is_anonymous ?? !u.email, email: u.email || null, userId: u.id || null };
}

/* ---------- push (debounced upserts + immediate-on-hide flush) ---------- */

function queuePush(s, id) { const k = `${s}:${id}`; pending.set(k, { s, id }); pendingDel.delete(k); schedulePush(); }
function queueDelete(s, id) { const k = `${s}:${id}`; pendingDel.set(k, { s, id }); pending.delete(k); schedulePush(); }
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(flushPush, PUSH_DEBOUNCE); }

async function flushPush() {
  clearTimeout(pushTimer);
  if (!enabled || !navigator.onLine || (!pending.size && !pendingDel.size)) return;
  const ups = [...pending.values()]; pending.clear();
  const dels = [...pendingDel.values()]; pendingDel.clear();
  setStatus('syncing');
  try {
    const rows = [];
    for (const { s, id } of ups) {
      if (s === 'meta' && META_DENY.has(id)) continue;
      const rec = store.get(s, id);
      if (!rec) continue;
      rows.push({
        user_id: session.user.id,
        record_type: STORE_TYPE[s],
        record_id: String(id),
        payload: rec,
        updated_at: new Date(rec.updatedAt || Date.now()).toISOString()
      });
    }
    if (rows.length) {
      const { error } = await client.from(TABLE).upsert(rows, { onConflict: 'user_id,record_type,record_id' });
      if (error) throw error;
    }
    for (const { s, id } of dels) {
      if (s === 'meta' && META_DENY.has(id)) continue;
      const { error } = await client.from(TABLE).delete().match({ user_id: session.user.id, record_type: STORE_TYPE[s], record_id: String(id) });
      if (error) throw error;
    }
    setStatus('idle');
  } catch (err) {
    for (const u of ups) pending.set(`${u.s}:${u.id}`, u);     // re-queue — nothing lost
    for (const dl of dels) pendingDel.set(`${dl.s}:${dl.id}`, dl);
    console.warn('[sync] push failed', err?.message || err);
    setStatus('error');
  }
}

/* ---------- pull (ingest rows strictly newer than the last sync) ---------- */

export async function pull() {
  if (!enabled || !navigator.onLine) return;
  setStatus('syncing');
  try {
    const last = localStorage.getItem(LAST_SYNC_KEY);
    let q = client.from(TABLE).select('record_type,record_id,payload,updated_at').order('updated_at', { ascending: true });
    if (last) q = q.gt('updated_at', last);
    const { data, error } = await q;
    if (error) throw error;
    let newest = last;
    let touched = false;
    for (const row of data || []) {
      const s = TYPE_STORE[row.record_type];
      if (!s) continue;
      const remote = row.payload;
      const local = store.get(s, remote[keyField(s)]);
      if (!local || (remote.updatedAt || 0) > (local.updatedAt || 0)) { // local wins on a tie
        store.ingest(s, remote);
        touched = true;
      }
      if (!newest || row.updated_at > newest) newest = row.updated_at;
    }
    if (newest) localStorage.setItem(LAST_SYNC_KEY, newest);
    if (touched) { events.emit('module:changed', {}); events.emit('page:changed', {}); }
    setStatus('idle');
  } catch (err) {
    console.warn('[sync] pull failed', err?.message || err);
    setStatus('error');
  }
}

/* ---------- syncAll: pull, then a one-time full push of existing local data ---------- */

export async function syncAll() {
  if (!enabled || !navigator.onLine) return;
  await pull();
  if (!localStorage.getItem(PUSHED_ALL_KEY)) {
    for (const s of Object.keys(STORE_TYPE)) {
      for (const rec of store.all(s)) {
        const id = rec[keyField(s)];
        if (s === 'meta' && META_DENY.has(id)) continue;
        pending.set(`${s}:${id}`, { s, id });
      }
    }
    await flushPush();
    localStorage.setItem(PUSHED_ALL_KEY, '1');
  }
}
