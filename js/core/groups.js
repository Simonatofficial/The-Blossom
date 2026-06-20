/* Module groups & usage (workstream D, docs/13 §3b). Hand-picked, ordered sets
   of modules the user swaps between via the top rail, plus two computed
   built-ins: All (every module) and Favorites (auto most-used + pin/hide).
   All state lives in the synced `settings` meta blob. Pure data + a thin event
   so the rail and the Modules panel re-render; no DOM here. */

import { store } from './store.js';
import { events } from './events.js';

export const ALL = 'all';
export const FAVORITES = 'favorites';
const FAV_MAX = 8;

/* ---- settings access ---- */
function settings() { return store.getMeta('settings', {}); }
function save(s) { store.setMeta('settings', s); events.emit('groups:changed', {}); }
function customGroups(s = settings()) { return s.moduleGroups || []; }

/* ---- usage (powers Favorites) ---- */
/** Bump a module's open count + recency. Called on a real module change. */
export function recordModuleOpen(moduleId) {
  if (!moduleId) return;
  const s = settings();
  const u = s.moduleUsage || (s.moduleUsage = {});
  const m = u[moduleId] || (u[moduleId] = { count: 0, last: 0 });
  m.count++; m.last = Date.now();
  store.setMeta('settings', s); // no groups:changed — usage alone shouldn't reflow the rail
}

/* ---- group listing + membership ---- */
/** All groups for the picker: built-ins first, then custom (in user order). */
export function listGroups() {
  return [
    { id: ALL, name: 'All', icon: 'grid', builtin: true },
    { id: FAVORITES, name: 'Favorites', icon: 'star', builtin: true },
    ...customGroups().map(g => ({ id: g.id, name: g.name, icon: g.icon || 'layers' }))
  ];
}

export function getGroup(id) { return listGroups().find(g => g.id === id) || null; }

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

/** Module ids in a group (built-ins computed), pruned to existing modules. */
export function groupModuleIds(id) {
  if (id === ALL) return store.all('modules').map(m => m.id);
  if (id === FAVORITES) return favoriteIds();
  const g = customGroups().find(x => x.id === id);
  return (g?.moduleIds || []).filter(mid => store.get('modules', mid));
}

/** Resolved module objects for a group, in order. */
export function groupModules(id) {
  return groupModuleIds(id).map(mid => store.get('modules', mid)).filter(Boolean);
}

/* ---- active group + per-group last module ---- */
export function activeGroupId() {
  const id = settings().activeGroupId || ALL;
  return getGroup(id) ? id : ALL; // a deleted custom group falls back to All
}
export function setActiveGroup(id) {
  const s = settings(); s.activeGroupId = id; save(s);
}
export function groupLastModule(id) {
  const last = settings().groupLast?.[id];
  return (last && store.get('modules', last) && groupModuleIds(id).includes(last)) ? last : (groupModuleIds(id)[0] || null);
}
export function setGroupLast(groupId, moduleId) {
  const s = settings(); (s.groupLast || (s.groupLast = {}))[groupId] = moduleId;
  store.setMeta('settings', s); // silent — doesn't change the rail's contents
}

/* ---- favorites pin / hide ---- */
export function isPinned(moduleId) { return (settings().favPins || []).includes(moduleId); }
export function toggleFavPin(moduleId) {
  const s = settings(); const pins = s.favPins || (s.favPins = []);
  const i = pins.indexOf(moduleId);
  if (i >= 0) pins.splice(i, 1); else { pins.push(moduleId); (s.favHides || []).includes?.(moduleId) && (s.favHides = s.favHides.filter(x => x !== moduleId)); }
  save(s); return pins.includes(moduleId);
}
export function isFavHidden(moduleId) { return (settings().favHides || []).includes(moduleId); }
export function toggleFavHide(moduleId) {
  const s = settings(); const hides = s.favHides || (s.favHides = []);
  const i = hides.indexOf(moduleId);
  if (i >= 0) hides.splice(i, 1); else { hides.push(moduleId); s.favPins = (s.favPins || []).filter(x => x !== moduleId); }
  save(s); return hides.includes(moduleId);
}

/* ---- custom group CRUD ---- */
export function createGroup(name, icon = 'layers') {
  const s = settings(); const groups = s.moduleGroups || (s.moduleGroups = []);
  const g = { id: 'g_' + Date.now().toString(36), name: name.trim() || 'Group', icon, moduleIds: [] };
  groups.push(g); save(s); return g;
}
export function renameGroup(id, name) {
  const s = settings(); const g = customGroups(s).find(x => x.id === id);
  if (g) { g.name = name.trim() || g.name; save(s); }
}
export function setGroupIcon(id, icon) {
  const s = settings(); const g = customGroups(s).find(x => x.id === id);
  if (g) { g.icon = icon; save(s); }
}
export function deleteGroup(id) {
  const s = settings(); s.moduleGroups = customGroups(s).filter(x => x.id !== id);
  if (s.activeGroupId === id) s.activeGroupId = ALL;
  save(s);
}
export function reorderGroups(orderedIds) {
  const s = settings(); const by = new Map(customGroups(s).map(g => [g.id, g]));
  s.moduleGroups = orderedIds.map(id => by.get(id)).filter(Boolean);
  save(s);
}
export function inGroup(groupId, moduleId) {
  return (customGroups().find(g => g.id === groupId)?.moduleIds || []).includes(moduleId);
}
export function toggleModuleInGroup(groupId, moduleId) {
  const s = settings(); const g = customGroups(s).find(x => x.id === groupId);
  if (!g) return false;
  const i = g.moduleIds.indexOf(moduleId);
  if (i >= 0) g.moduleIds.splice(i, 1); else g.moduleIds.push(moduleId);
  save(s); return g.moduleIds.includes(moduleId);
}
export function reorderGroupModules(groupId, orderedIds) {
  const s = settings(); const g = customGroups(s).find(x => x.id === groupId);
  if (g) { g.moduleIds = orderedIds.filter(id => store.get('modules', id)); save(s); }
}

/** Remove a deleted module from every group, pin, hide, and per-group last. */
export function pruneModule(moduleId) {
  const s = settings();
  for (const g of customGroups(s)) g.moduleIds = (g.moduleIds || []).filter(id => id !== moduleId);
  if (s.favPins) s.favPins = s.favPins.filter(id => id !== moduleId);
  if (s.favHides) s.favHides = s.favHides.filter(id => id !== moduleId);
  if (s.moduleUsage) delete s.moduleUsage[moduleId];
  if (s.groupLast) for (const k of Object.keys(s.groupLast)) if (s.groupLast[k] === moduleId) delete s.groupLast[k];
  save(s);
}

/** Start usage tracking: bump on each real module change. */
export function initGroups() {
  let lastModule = null;
  events.on('route:changed', ({ moduleId }) => {
    if (moduleId && moduleId !== lastModule) {
      lastModule = moduleId;
      recordModuleOpen(moduleId);
      setGroupLast(activeGroupId(), moduleId);
    }
  });
}
