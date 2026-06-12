/* Preset module definitions + the generic instantiator (docs/08).
   A preset is pure data; instantiation mints fresh ids every time.
   Widgets may carry `ref` keys; links can point at '@ref' to wire presets. */

import { store } from '../../core/store.js';
import { ulid } from '../../core/ids.js';
import { registry } from '../../widgets/registry.js';
import { BLOSSOM_PRESET } from './blossom.js';
import { STUDY_PRESET } from './study.js';
import { INFCANVAS_PRESET } from './infcanvas.js';
import { WORLD_PRESET } from './worldbuilder.js';
import { DND_CHARACTER_PRESET } from './dndcharacter.js';
import { SMALL_PRESETS } from './small.js';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

/**
 * Instantiate a preset module definition.
 * @param {{key, name, icon, pages: object[]}} def
 * @returns {object} the created module record
 */
export function instantiatePreset(def) {
  const refs = new Map(); // '@ref' -> widgetId
  const created = []; // every widget built in this instantiation

  const mod = store.put('modules', {
    id: ulid(), name: def.name, icon: def.icon || 'flower',
    pages: [], themeOverride: def.theme || null, presetKey: def.key
  });

  const buildWidget = (wDef, pageId, parentWidgetId) => {
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
      widget.config.childOrder = wDef.children.map(c => buildWidget(c, pageId, widget.id).id);
      store.put('widgets', widget);
    }
    if (wDef.objects?.length) {
      for (const o of wDef.objects) {
        store.put('objects', { id: ulid(), widgetId: widget.id, kind: o.kind, date: o.date || null, data: structuredClone(o.data || {}) });
      }
    }
    return widget;
  };

  for (const pDef of def.pages) {
    const page = store.put('pages', {
      id: ulid(), moduleId: mod.id, name: pDef.name, icon: pDef.icon || 'circle',
      widgets: [], themeOverride: null
    });
    page.widgets = (pDef.widgets || []).map(wDef => buildWidget(wDef, page.id, null).id);
    store.put('pages', page);
    mod.pages.push(page.id);
  }
  store.put('modules', mod);

  // resolve '@ref' links and any '@' tokens deep inside configs
  for (const widget of created) {
    widget.links = (widget.links || [])
      .map(l => resolveTokens(l, refs))
      .filter(l => l.sourceWidgetId && !String(l.sourceWidgetId).startsWith('@'));
    widget.config = resolveTokens(widget.config, refs);
    store.put('widgets', widget);
  }
  return mod;
}

/** The preset gallery list. Heavier definitions join as phases land (docs/10). */
export const PRESET_MODULES = [
  BLOSSOM_PRESET,
  STUDY_PRESET,
  INFCANVAS_PRESET,
  WORLD_PRESET,
  DND_CHARACTER_PRESET,
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
          { type: 'notes', name: 'Welcome', objects: [{ kind: 'note', data: { html: '<h1>Welcome to The Blossom</h1><p>This space is yours. Tap any card to open it, drag the dots to rearrange, and use the + below to plant more widgets.</p>', lastOpened: null } }] },
          { type: 'counter', name: 'Glasses of water', w: 'half', config: { count: 0, step: 1, dailyReset: true, target: 8 } }
        ]
      }
    ]
  }
];
