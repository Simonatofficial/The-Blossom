/* Preset module definitions + the generic instantiator (docs/08).
   A preset is pure data; instantiation mints fresh ids every time.
   Widgets may carry `ref` keys; links can point at '@ref' to wire presets. */

import { store } from '../../core/store.js';
import { events } from '../../core/events.js';
import { ulid } from '../../core/ids.js';
import { registry } from '../../widgets/registry.js';
import { PRESET_IDENTITIES, PRESET_HOME_LAYOUTS } from '../../fx/identity.js';
import { BLOSSOM_PRESET } from './blossom.js';
import { PRODUCTIVITY_PRESET } from './productivity.js';
import { ACTIVITY_PRESET } from './activity.js';
import { LIRI_PRESET } from './liri.js';
import { STUDY_PRESET } from './study.js';
import { INFCANVAS_PRESET } from './infcanvas.js';
import { WORLD_PRESET } from './worldbuilder.js';
import { DND_CHARACTER_PRESET } from './dndcharacter.js';
import { DND_DM_PRESET } from './dnddm.js';
import { SMALL_PRESETS } from './small.js';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Category/subcategory/tags for the built-in presets (V2 §11/§14). Resolved at
    instantiation, and used by the Modules panel to group legacy instances that
    predate the schema (matched on their stored presetKey). */
export const PRESET_CATEGORIES = {
  blossom: { category: 'Personal', subcategory: 'Life', tags: ['habit', 'journal', 'wellness'] },
  starter: { category: 'Personal', subcategory: 'Life', tags: [] },
  study: { category: 'Work', subcategory: 'Study', tags: ['notes', 'learning'] },
  worldbuilder: { category: 'Creative', subcategory: 'Writing', tags: ['worldbuilding', 'lore'] },
  infinitecanvas: { category: 'Creative', subcategory: 'Art', tags: ['drawing', 'canvas'] },
  dndcharacter: { category: 'Gaming', subcategory: 'Tabletop', tags: ['dnd', 'rpg', 'character'] },
  dnddm: { category: 'Gaming', subcategory: 'Tabletop', tags: ['dnd', 'rpg', 'dm'] },
  reading: { category: 'Personal', subcategory: 'Hobbies', tags: ['reading', 'books'] },
  recipes: { category: 'Personal', subcategory: 'Home', tags: ['cooking', 'food'] },
  budget: { category: 'Personal', subcategory: 'Finance', tags: ['money', 'budget'] },
  musicpractice: { category: 'Creative', subcategory: 'Music', tags: ['music', 'practice'] },
  fitness: { category: 'Personal', subcategory: 'Health', tags: ['fitness', 'health'] }
};

/** Deep-resolve '@ref' / '@today' tokens inside configs and links. */
function resolveTokens(value, refs) {
  if (typeof value === 'string') {
    if (value === '@today') return todayStr();
    if (value.startsWith('@') && refs.has(value)) return refs.get(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(v => resolveTokens(v, refs));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTokens(v, refs);
    return out;
  }
  return value;
}

/** Build one widget (recursing into children), recording @refs + the created list. */
function buildWidget(wDef, pageId, parentWidgetId, refs, created) {
  const widget = store.put('widgets', {
    id: ulid(), type: wDef.type,
    pageId: parentWidgetId ? null : pageId,
    parentWidgetId: parentWidgetId || null,
    name: wDef.name || wDef.type,
    collapsed: !!wDef.collapsed,
    themeOverride: null,
    w: wDef.w || 'full',
    // merge the type's defaults exactly like createWidget does, so preset
    // definitions only need to state what differs
    config: { ...(registry.get(wDef.type)?.defaultConfig?.() || {}), ...structuredClone(wDef.config || {}) },
    links: structuredClone(wDef.links || [])
  });
  if (wDef.ref) refs.set('@' + wDef.ref, widget.id);
  created.push(widget);
  if (wDef.children?.length) {
    widget.config.childOrder = wDef.children.map(c => buildWidget(c, pageId, widget.id, refs, created).id);
    store.put('widgets', widget);
  }
  if (wDef.objects?.length) {
    for (const o of wDef.objects) {
      store.put('objects', { id: ulid(), widgetId: widget.id, kind: o.kind, date: o.date || null, data: structuredClone(o.data || {}) });
    }
  }
  return widget;
}

/** Build one page-def's widgets into an existing page record. */
function buildPageWidgets(pDef, page, refs, created) {
  page.widgets = (pDef.widgets || []).map(wDef => buildWidget(wDef, page.id, null, refs, created).id);
  store.put('pages', page);
}

/** Resolve '@ref' links + deep '@' tokens once every widget exists. */
function resolveCreated(created, refs) {
  for (const widget of created) {
    widget.links = (widget.links || [])
      .map(l => resolveTokens(l, refs))
      .filter(l => l.sourceWidgetId && !String(l.sourceWidgetId).startsWith('@'));
    widget.config = resolveTokens(widget.config, refs);
    store.put('widgets', widget);
  }
}

/**
 * Instantiate a preset module definition.
 * @param {{key, name, icon, pages: object[]}} def
 * @returns {object} the created module record
 */
export function instantiatePreset(def) {
  const refs = new Map(); // '@ref' -> widgetId
  const created = []; // every widget built in this instantiation

  const cat = def.category
    ? { category: def.category, subcategory: def.subcategory || null, tags: def.tags || [] }
    : (PRESET_CATEGORIES[def.key] || { category: null, subcategory: null, tags: [] });
  const mod = store.put('modules', {
    id: ulid(), name: def.name, icon: def.icon || 'flower',
    pages: [], themeOverride: def.theme || null, presetKey: def.key,
    // Living Layout §5.3: bake the preset's world identity into the new module
    // (only here — existing modules stay neutral per the inherit-by-default rule)
    identity: def.identity || PRESET_IDENTITIES[def.key] || null,
    category: cat.category, subcategory: cat.subcategory, tags: cat.tags || []
  });

  // the module's landing page opens in the preset's archetype (§5.3): the page
  // marked home, or the first page when none is marked.
  let homeIdx = def.pages.findIndex(p => p.home);
  if (homeIdx < 0) homeIdx = 0;
  const homeLayout = PRESET_HOME_LAYOUTS[def.key] || null;
  def.pages.forEach((pDef, i) => {
    const layout = pDef.layout || (i === homeIdx ? homeLayout : null) || null;
    const page = store.put('pages', { id: ulid(), moduleId: mod.id, name: pDef.name, icon: pDef.icon || 'circle', widgets: [], themeOverride: null, layout });
    buildPageWidgets(pDef, page, refs, created);
    mod.pages.push(page.id);
    if (pDef.home) mod.homePageId = page.id; // V2 §25: a preset can mark its home page
  });
  store.put('modules', mod);
  resolveCreated(created, refs);
  return mod;
}

/** Build one page-def (widgets + @ref wiring) into an existing module (G page builder). */
export function instantiatePageInto(mod, pDef) {
  const refs = new Map(), created = [];
  const page = store.put('pages', { id: ulid(), moduleId: mod.id, name: pDef.name, icon: pDef.icon || 'circle', widgets: [], themeOverride: null });
  buildPageWidgets(pDef, page, refs, created);
  mod.pages.push(page.id);
  store.put('modules', mod);
  resolveCreated(created, refs);
  events.emit('module:changed', { moduleId: mod.id });
  return page;
}

/** The preset gallery list. Heavier definitions join as phases land (docs/10). */
export const PRESET_MODULES = [
  BLOSSOM_PRESET,
  LIRI_PRESET,
  PRODUCTIVITY_PRESET,
  ACTIVITY_PRESET,
  STUDY_PRESET,
  INFCANVAS_PRESET,
  WORLD_PRESET,
  DND_CHARACTER_PRESET,
  DND_DM_PRESET,
  ...SMALL_PRESETS,
  {
    key: 'starter',
    name: 'My Garden',
    icon: 'flower',
    description: 'A gentle Home page to start from: time, notes, a counter.',
    pages: [
      {
        name: 'Home', icon: 'home',
        widgets: [
          { type: 'time', name: 'Today' },
          { type: 'notes', name: 'Welcome', objects: [{ kind: 'note', data: { html: '<h1>Welcome to My Blossom</h1><p>This space is yours. Tap any card to open it, drag the dots to rearrange, and use the + below to plant more widgets.</p>', lastOpened: null } }] },
          { type: 'counter', name: 'Glasses of water', w: 'half', config: { count: 0, step: 1, dailyReset: true, target: 8 } }
        ]
      }
    ]
  }
];
