/* The Hub layer (docs/17 §5) — Workspace → Hub → Module → Page → Tool → Object.
   A Hub is a first-class package of connected modules that can also link to other hubs.
   It evolves the v93–v94 module-groups feature: custom hubs are now records in the new
   `hubs` store kind (migrated once from the synced `settings.moduleGroups`), while the two
   built-ins — All (every module) and Favorites (auto most-used + pin/hide) — stay COMPUTED.

   No data loss (docs/17 §5.1): migration copies each group into a Hub with the same id, so
   active-hub / per-hub-last / pins keep working; if migration is skipped the old groups still
   render (read-through fallback). Usage + Favorites state stay in the `settings` meta blob.
   Pure data + a thin `hubs:changed` event; no DOM here. (Cross-device sync of the `hubs`
   store waits for Phase 4 — until then hubs persist locally via IndexedDB, offline-first.) */

import { store } from './store.js';
import { events } from './events.js';

export const ALL = 'all';
export const FAVORITES = 'favorites';
const FAV_MAX = 8;

/* ---- settings access (usage / favorites / active selection live here) ---- */
function settings() { return store.getMeta('settings', {}); }
function saveSettings(s, reflow = true) { store.setMeta('settings', s); if (reflow) events.emit('hubs:changed', {}); }

/* ---- one-time migration: groups → hub records (additive, idempotent) ---- */
function migrate() {
  const s = settings();
  if (s.hubsMigrated) return;
  for (const g of (s.moduleGroups || [])) {
    if (!store.get('hubs', g.id)) {
      store.put('hubs', { id: g.id, name: g.name, icon: g.icon || 'layers', theme: g.theme || null, moduleIds: [...(g.moduleIds || [])], links: [], identity: null });
    }
  }
  s.hubsMigrated = true;
  store.setMeta('settings', s); // silent — no reflow needed during boot
}

/** Custom hubs in user order. Reads the `hubs` store; falls back to legacy groups pre-migration. */
function customHubs() {
  const s = settings();
  if (s.hubsMigrated) return store.all('hubs');
  // read-through fallback: render legacy groups as hub-shaped objects
  return (s.moduleGroups || []).map(g => ({ id: g.id, name: g.name, icon: g.icon || 'layers', moduleIds: g.moduleIds || [], links: [] }));
}
function getCustomHub(id) { return customHubs().find(h => h.id === id) || null; }
function saveHub(hub) { store.put('hubs', hub); events.emit('hubs:changed', {}); }

/* ---- usage (powers Favorites) ---- */
/** Bump a module's open count + recency. Called on a real module change. */
export function recordModuleOpen(moduleId) {
  if (!moduleId) return;
  const s = settings();
  const u = s.moduleUsage || (s.moduleUsage = {});
  const m = u[moduleId] || (u[moduleId] = { count: 0, last: 0 });
  m.count++; m.last = Date.now();
  store.setMeta('settings', s); // no reflow — usage alone shouldn't reflow the rail
}

/* ---- hub listing + membership ---- */
/** customHubs() honoring an explicit `order` field (set by reorderHubs). */
function orderedCustomHubs() {
  return customHubs().slice().sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
}

/** All hubs for the picker: built-ins first, then custom (in user order). */
export function listHubs() {
  return [
    { id: ALL, name: 'All', icon: 'grid', builtin: true },
    { id: FAVORITES, name: 'Favorites', icon: 'star', builtin: true },
    ...orderedCustomHubs().map(h => ({ id: h.id, name: h.name, icon: h.icon || 'layers' }))
  ];
}
export function getHub(id) { return listHubs().find(h => h.id === id) || null; }

/** Ranked Favorites: most-used (recency tie-break), pins forced in, hides removed. */
function favoriteIds() {
  const s = settings();
  const u = s.moduleUsage || {}, pins = s.favPins || [], hides = new Set(s.favHides || []);
  const exists = (id) => !!store.get('modules', id);
  const ranked = store.all('modules')
    .filter(m => !hides.has(m.id) && (u[m.id]?.count || 0) > 0)
    .sort((a, b) => (u[b.id]?.count || 0) - (u[a.id]?.count || 0) || (u[b.id]?.last || 0) - (u[a.id]?.last || 0))
    .map(m => m.id);
  const ordered = [...pins.filter(exists), ...ranked.filter(id => !pins.includes(id))];
  return ordered.slice(0, Math.max(FAV_MAX, pins.length));
}

/** Module ids in a hub (built-ins computed), pruned to existing modules. */
export function hubModuleIds(id) {
  if (id === ALL) return store.all('modules').map(m => m.id);
  if (id === FAVORITES) return favoriteIds();
  const h = getCustomHub(id);
  return (h?.moduleIds || []).filter(mid => store.get('modules', mid));
}
/** Resolved module objects for a hub, in order. */
export function hubModules(id) {
  return hubModuleIds(id).map(mid => store.get('modules', mid)).filter(Boolean);
}

/* ---- hub-to-hub links (docs/17 §5.1) ---- */
/** The links out of a hub: [{ toHubId, rel }]. Built-ins never carry links. */
export function hubLinks(id) {
  return (getCustomHub(id)?.links || []).filter(l => getCustomHub(l.toHubId));
}
/** Resolved linked hubs (objects), pruned to existing custom hubs. */
export function linkedHubs(id) {
  return hubLinks(id).map(l => ({ rel: l.rel, hub: getCustomHub(l.toHubId) })).filter(x => x.hub);
}
/** Link two custom hubs (bidirectional by default, so they connect both ways). */
export function linkHubs(fromId, toId, rel = 'linked', { twoWay = true } = {}) {
  if (fromId === toId) return;
  const add = (aId, bId) => {
    const h = getCustomHub(aId); if (!h || getCustomHub(bId) == null) return;
    h.links = h.links || [];
    if (!h.links.some(l => l.toHubId === bId)) { h.links.push({ toHubId: bId, rel }); store.put('hubs', h); }
  };
  add(fromId, toId);
  if (twoWay) add(toId, fromId);
  events.emit('hubs:changed', {});
}
export function unlinkHubs(fromId, toId, { twoWay = true } = {}) {
  const drop = (aId, bId) => {
    const h = getCustomHub(aId); if (!h?.links) return;
    const next = h.links.filter(l => l.toHubId !== bId);
    if (next.length !== h.links.length) { h.links = next; store.put('hubs', h); }
  };
  drop(fromId, toId);
  if (twoWay) drop(toId, fromId);
  events.emit('hubs:changed', {});
}

/* ---- active hub + per-hub last module ---- */
export function activeHubId() {
  const s = settings();
  const id = s.activeHubId || s.activeGroupId || ALL; // inherit a pre-migration selection
  return getHub(id) ? id : ALL; // a deleted custom hub falls back to All
}
export function setActiveHub(id) { const s = settings(); s.activeHubId = id; saveSettings(s); }
export function hubLastModule(id) {
  const last = (settings().hubLast || settings().groupLast || {})[id];
  return (last && store.get('modules', last) && hubModuleIds(id).includes(last)) ? last : (hubModuleIds(id)[0] || null);
}
export function setHubLast(hubId, moduleId) {
  const s = settings(); (s.hubLast || (s.hubLast = {}))[hubId] = moduleId;
  store.setMeta('settings', s); // silent — doesn't change the rail's contents
}

/* ---- favorites pin / hide ---- */
export function isPinned(moduleId) { return (settings().favPins || []).includes(moduleId); }
export function toggleFavPin(moduleId) {
  const s = settings(); const pins = s.favPins || (s.favPins = []);
  const i = pins.indexOf(moduleId);
  if (i >= 0) pins.splice(i, 1); else { pins.push(moduleId); if ((s.favHides || []).includes(moduleId)) s.favHides = s.favHides.filter(x => x !== moduleId); }
  saveSettings(s); return pins.includes(moduleId);
}
export function isFavHidden(moduleId) { return (settings().favHides || []).includes(moduleId); }
export function toggleFavHide(moduleId) {
  const s = settings(); const hides = s.favHides || (s.favHides = []);
  const i = hides.indexOf(moduleId);
  if (i >= 0) hides.splice(i, 1); else { hides.push(moduleId); s.favPins = (s.favPins || []).filter(x => x !== moduleId); }
  saveSettings(s); return hides.includes(moduleId);
}

/* ---- custom hub CRUD ---- */
export function createHub(name, icon = 'layers') {
  const hub = { id: 'h_' + Date.now().toString(36), name: (name || '').trim() || 'Hub', icon, theme: null, moduleIds: [], links: [], identity: null };
  saveHub(hub); return hub;
}
export function renameHub(id, name) { const h = getCustomHub(id); if (h) { h.name = (name || '').trim() || h.name; saveHub(h); } }
export function setHubIcon(id, icon) { const h = getCustomHub(id); if (h) { h.icon = icon; saveHub(h); } }
export function setHubTheme(id, theme) { const h = getCustomHub(id); if (h) { h.theme = theme || null; saveHub(h); } }
export function deleteHub(id) {
  store.del('hubs', id);
  // sever any inbound links from other hubs
  for (const h of store.all('hubs')) if (h.links?.some(l => l.toHubId === id)) { h.links = h.links.filter(l => l.toHubId !== id); store.put('hubs', h); }
  const s = settings(); if (s.activeHubId === id) s.activeHubId = ALL;
  saveSettings(s);
}
export function reorderHubs(orderedIds) {
  // the `hubs` store is unordered; persist an explicit order on each record's `order` field
  orderedIds.forEach((id, i) => { const h = getCustomHub(id); if (h && h.order !== i) { h.order = i; store.put('hubs', h); } });
  events.emit('hubs:changed', {});
}
export function inHub(hubId, moduleId) { return (getCustomHub(hubId)?.moduleIds || []).includes(moduleId); }
export function toggleModuleInHub(hubId, moduleId) {
  const h = getCustomHub(hubId); if (!h) return false;
  const i = (h.moduleIds = h.moduleIds || []).indexOf(moduleId);
  if (i >= 0) h.moduleIds.splice(i, 1); else h.moduleIds.push(moduleId);
  saveHub(h); return h.moduleIds.includes(moduleId);
}
export function reorderHubModules(hubId, orderedIds) {
  const h = getCustomHub(hubId); if (h) { h.moduleIds = orderedIds.filter(id => store.get('modules', id)); saveHub(h); }
}

/* (orderedCustomHubs is defined above, near listHubs) */

/** Remove a deleted module from every hub, pin, hide, and per-hub last. */
export function pruneModule(moduleId) {
  for (const h of store.all('hubs')) if ((h.moduleIds || []).includes(moduleId)) { h.moduleIds = h.moduleIds.filter(id => id !== moduleId); store.put('hubs', h); }
  const s = settings();
  if (s.favPins) s.favPins = s.favPins.filter(id => id !== moduleId);
  if (s.favHides) s.favHides = s.favHides.filter(id => id !== moduleId);
  if (s.moduleUsage) delete s.moduleUsage[moduleId];
  for (const map of ['hubLast', 'groupLast']) if (s[map]) for (const k of Object.keys(s[map])) if (s[map][k] === moduleId) delete s[map][k];
  saveSettings(s);
}

/** Start the hub layer: run the one-time migration, then track usage per module open. */
export function initHubs() {
  migrate();
  let lastModule = null;
  events.on('route:changed', ({ moduleId }) => {
    if (moduleId && moduleId !== lastModule) {
      lastModule = moduleId;
      recordModuleOpen(moduleId);
      setHubLast(activeHubId(), moduleId);
    }
  });
}
