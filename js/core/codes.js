/* Blossom Codes (docs/02): portable snapshots of any node.
   Format: BLSM1.<type>.<base64url(deflate-raw(JSON))>
   type ∈ obj|wgt|pg|mod|ws. Ids are re-minted on import. */

import { store, SCHEMA_VERSION } from './store.js';
import { ulid } from './ids.js';

const TYPE_LABEL = { obj: 'Object', wgt: 'Widget', pg: 'Page', mod: 'Module', ws: 'Workspace', thm: 'Theme / palette' };

/* ---- compression + base64url ---- */

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const bin = atob(str.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

/** Encode a payload object into a Blossom code string. */
export async function encode(type, payload) {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  return `BLSM1.${type}.${toB64url(packed)}`;
}

/** Decode a Blossom code. @returns {{type: string, payload: object}} */
export async function decode(code) {
  const m = code.trim().match(/^BLSM1\.(obj|wgt|pg|mod|ws|thm)\.([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('Not a Blossom code.');
  const bytes = await pipe(fromB64url(m[2]), new DecompressionStream('deflate-raw'));
  return { type: m[1], payload: JSON.parse(new TextDecoder().decode(bytes)) };
}

/* ---- snapshotting nodes ---- */

function widgetTree(widgetId, widgets, objects) {
  const w = store.get('widgets', widgetId);
  if (!w) return;
  widgets.push(w);
  for (const obj of store.all('objects')) if (obj.widgetId === widgetId) objects.push(obj);
  for (const child of store.all('widgets')) {
    if (child.parentWidgetId === widgetId) widgetTree(child.id, widgets, objects);
  }
}

/**
 * Snapshot a node into a code payload.
 * @param {'obj'|'wgt'|'pg'|'mod'|'ws'} type
 * @param {string|null} id root record id (null for ws)
 */
export function snapshotNode(type, id) {
  const payload = { v: SCHEMA_VERSION, exportedAt: Date.now(), root: null, children: [] };
  if (type === 'obj') {
    payload.root = store.get('objects', id);
  } else if (type === 'thm') {
    payload.root = store.get('themes', id);
  } else if (type === 'wgt') {
    const widgets = [], objects = [];
    widgetTree(id, widgets, objects);
    payload.root = widgets.shift();
    payload.children = [...widgets.map(w => ({ _s: 'widgets', ...w })), ...objects.map(o => ({ _s: 'objects', ...o }))];
  } else if (type === 'pg') {
    const page = store.get('pages', id);
    payload.root = page;
    const widgets = [], objects = [];
    for (const wid of page.widgets) widgetTree(wid, widgets, objects);
    payload.children = [...widgets.map(w => ({ _s: 'widgets', ...w })), ...objects.map(o => ({ _s: 'objects', ...o }))];
  } else if (type === 'mod') {
    const mod = store.get('modules', id);
    payload.root = mod;
    const children = [];
    for (const pid of mod.pages) {
      const page = store.get('pages', pid);
      if (!page) continue;
      children.push({ _s: 'pages', ...page });
      const widgets = [], objects = [];
      for (const wid of page.widgets) widgetTree(wid, widgets, objects);
      children.push(...widgets.map(w => ({ _s: 'widgets', ...w })), ...objects.map(o => ({ _s: 'objects', ...o })));
    }
    payload.children = children;
  } else if (type === 'ws') {
    payload.root = { kind: 'workspace' };
    const data = store.snapshot();
    payload.children = Object.entries(data).flatMap(([s, recs]) => recs.map(r => ({ _s: s, ...r })));
  }
  if (!payload.root) throw new Error('Nothing to copy — the source was not found.');
  return payload;
}

/* ---- importing (ids re-minted, refs remapped, outside links dropped) ---- */

function deepRemap(value, idMap) {
  if (typeof value === 'string') return idMap.get(value) || value;
  if (Array.isArray(value)) return value.map(v => deepRemap(v, idMap));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepRemap(v, idMap);
    return out;
  }
  return value;
}

/**
 * Import a decoded payload. All ids are re-minted so imports never collide.
 * @param {string} type
 * @param {object} payload
 * @param {{pageId?: string}} [target] page to attach an imported widget to
 * @returns {{rootId: string|null, counts: object, droppedLinks: number}}
 */
export function importNode(type, payload, target = {}) {
  const rootStore = { obj: 'objects', wgt: 'widgets', pg: 'pages', mod: 'modules', thm: 'themes' }[type];
  let records = (payload.children || []).map(r => ({ ...r }));
  if (type !== 'ws') records.unshift({ _s: rootStore, ...payload.root });

  const idMap = new Map();
  for (const rec of records) {
    if (rec._s === 'meta' || !rec.id) continue;
    idMap.set(rec.id, ulid());
  }
  records = records.map(rec => deepRemap(rec, idMap));

  // Drop links that point outside the snapshot and aren't resolvable locally.
  let droppedLinks = 0;
  const knownIds = new Set([...idMap.values()]);
  for (const rec of records) {
    if (Array.isArray(rec.links)) {
      const kept = rec.links.filter(l => knownIds.has(l.sourceWidgetId) || store.get('widgets', l.sourceWidgetId));
      droppedLinks += rec.links.length - kept.length;
      rec.links = kept;
    }
  }

  const counts = {};
  let rootId = null;
  for (const [i, rec] of records.entries()) {
    const { _s, ...record } = rec;
    if (_s === 'meta') continue; // never clobber settings/wallet via codes
    store.put(_s, record);
    counts[_s] = (counts[_s] || 0) + 1;
    if (i === 0 && type !== 'ws') rootId = record.id;
  }

  // Attach an imported widget to its destination page.
  if (type === 'wgt' && rootId && target.pageId) {
    const w = store.get('widgets', rootId);
    w.pageId = target.pageId;
    w.parentWidgetId = null;
    store.put('widgets', w);
    const page = store.get('pages', target.pageId);
    if (page && !page.widgets.includes(rootId)) {
      page.widgets.push(rootId);
      store.put('pages', page);
    }
  }
  // Register an imported module/page in its parent list.
  if (type === 'mod' && rootId) {
    /* modules list is the store itself — nothing more to do */
  }
  return { rootId, counts, droppedLinks };
}

/** Human label for a code type. */
export function typeLabel(type) { return TYPE_LABEL[type] || type; }

/** Summarize a payload for the import preview. */
export function describePayload(type, payload) {
  const counts = {};
  for (const rec of payload.children || []) counts[rec._s] = (counts[rec._s] || 0) + 1;
  if (type !== 'ws') {
    const s = { obj: 'objects', wgt: 'widgets', pg: 'pages', mod: 'modules', thm: 'themes' }[type];
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}
