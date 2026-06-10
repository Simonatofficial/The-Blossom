/* IndexedDB wrapper (docs/01 persistence).
   Strategy: everything is loaded into an in-memory cache at boot so reads are
   synchronous app-wide; writes update the cache instantly and flush to
   IndexedDB debounced (500ms), force-flushed on pagehide/visibilitychange.
   Migrations are additive only — user data is never dropped. */

const DB_NAME = 'blossom';
const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;
const STORES = ['modules', 'pages', 'widgets', 'objects', 'themes', 'meta', 'saves', 'trash'];
const TRASH_DAYS = 30;

let db = null;
const cache = {};            // storeName -> Map(id -> record)
const dirty = {};            // storeName -> Set(id)
const removed = {};          // storeName -> Set(id)
let flushTimer = null;

for (const s of STORES) { cache[s] = new Map(); dirty[s] = new Set(); removed[s] = new Set(); }

function keyOf(storeName) { return storeName === 'meta' ? 'key' : 'id'; }

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) {
        if (!req.result.objectStoreNames.contains(s)) {
          req.result.createObjectStore(s, { keyPath: keyOf(s) });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function loadStore(storeName) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName).objectStore(storeName).getAll();
    req.onsuccess = () => {
      for (const rec of req.result) cache[storeName].set(rec[keyOf(storeName)], rec);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => store.flush(), 500);
}

export const store = {
  /** Open the database and hydrate the in-memory cache. Call once at boot. */
  async init() {
    db = await openDB();
    await Promise.all(STORES.map(loadStore));
    if (this.getMeta('schemaVersion') == null) this.setMeta('schemaVersion', SCHEMA_VERSION);
    const flushNow = () => { if (document.visibilityState === 'hidden') this.flush(); };
    document.addEventListener('visibilitychange', flushNow);
    window.addEventListener('pagehide', () => this.flush());
    this.purgeTrash();
  },

  /** @returns {object|undefined} */
  get(storeName, id) { return cache[storeName].get(id); },

  /** @returns {object[]} all records in a store */
  all(storeName) { return [...cache[storeName].values()]; },

  /** Upsert a record (stamps updatedAt). Returns the record. */
  put(storeName, record) {
    record.updatedAt = Date.now();
    if (!record.createdAt) record.createdAt = record.updatedAt;
    cache[storeName].set(record[keyOf(storeName)], record);
    dirty[storeName].add(record[keyOf(storeName)]);
    removed[storeName].delete(record[keyOf(storeName)]);
    scheduleFlush();
    return record;
  },

  /** Hard delete (use trash() for user content). */
  del(storeName, id) {
    cache[storeName].delete(id);
    removed[storeName].add(id);
    dirty[storeName].delete(id);
    scheduleFlush();
  },

  /** Soft delete: move a record to the trash store for 30 days (docs/01 rule 8). */
  trash(storeName, id) {
    const rec = cache[storeName].get(id);
    if (!rec) return;
    this.put('trash', { ...rec, id, _store: storeName, deletedAt: Date.now() });
    this.del(storeName, id);
  },

  /** Restore a trashed record to its original store. */
  restore(trashId) {
    const rec = cache.trash.get(trashId);
    if (!rec) return null;
    const { _store, deletedAt, ...orig } = rec;
    this.put(_store, orig);
    this.del('trash', trashId);
    return orig;
  },

  /** Purge trash older than 30 days. Runs at boot. */
  purgeTrash() {
    const cutoff = Date.now() - TRASH_DAYS * 86400000;
    for (const rec of this.all('trash')) {
      if (rec.deletedAt < cutoff) this.del('trash', rec.id);
    }
  },

  /** @returns {any} meta value (settings, wallet, lastActiveDate…) */
  getMeta(key, fallback = null) {
    const rec = cache.meta.get(key);
    return rec ? rec.value : fallback;
  },

  setMeta(key, value) { this.put('meta', { key, value }); },

  /** Write all pending changes to IndexedDB now. */
  flush() {
    clearTimeout(flushTimer);
    const touched = STORES.filter(s => dirty[s].size || removed[s].size);
    if (!touched.length || !db) return;
    const tx = db.transaction(touched, 'readwrite');
    for (const s of touched) {
      const os = tx.objectStore(s);
      for (const id of dirty[s]) { const rec = cache[s].get(id); if (rec) os.put(rec); }
      for (const id of removed[s]) os.delete(id);
      dirty[s].clear();
      removed[s].clear();
    }
    tx.onerror = () => console.error('[store] flush failed', tx.error);
  },

  /** Replace everything (import "Replace" mode). Caller is responsible for backups. */
  async replaceAll(data) {
    this.flush();
    for (const s of STORES) {
      if (s === 'trash') continue;
      for (const id of [...cache[s].keys()]) this.del(s, id);
      for (const rec of (data[s] || [])) this.put(s, rec);
    }
    this.flush();
  },

  /** Snapshot of all user data (for exports). Excludes trash. */
  snapshot() {
    const data = {};
    for (const s of STORES) { if (s !== 'trash') data[s] = this.all(s); }
    return data;
  }
};
