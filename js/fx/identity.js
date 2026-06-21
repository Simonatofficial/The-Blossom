/* Identity resolver (Living Layout, Phase 0: feel-token foundation).
   Given a scope definition's optional `identity` field, resolves it to scoped
   CSS variables on that scope's wrapper element — exactly the pattern
   applyScopedTheme (fx/themes.js) uses for colours, so feel inherits and costs
   nothing extra (docs/15 §2). A scope with no identity stays on the :root
   defaults (today's look), which is why Phase 0 is invisible. */

/**
 * @typedef {object} Identity  A scope's optional feel definition (docs/15 §5.1).
 * @property {'cozy'|'roomy'|'compact'} [feel]        named bundle (data-feel)
 * @property {'frosted'|'paper'|'linen'|'parchment'|'starfield'|'none'} [texture]
 * @property {number} [textureOpacity]               override the bundle's subtlety
 * @property {'calm'|'drifting'|'springy'} [motion]   motion personality
 * @property {'underline'|'rail'|'bloom'|'halo'} [accentShape]
 * @property {number} [density]                       spacing scale multiplier
 * @property {string} [radius]                        e.g. '12px'
 * @property {string} [radiusLg]
 * @property {string} [elevation]                     a box-shadow value
 * @property {boolean} [masthead]                     consumed in Phase 3, not here
 */

const FEELS = new Set(['cozy', 'roomy', 'compact']);
const ACCENT_SHAPES = new Set(['underline', 'rail', 'bloom', 'halo']);

/* ---- Materials (Phase 1, docs/15 §3) -------------------------------------
   A material is the *character* a kind of widget wears: silhouette, surface,
   signature, voice. Applied automatically by widget type (decision 0.1 #1) so
   even existing/default modules gain faces the moment Phase 1 ships; density,
   texture, and motion still inherit from the module/page feel. A widget's
   registry `def.material` or a per-instance `widget.material` overrides the map;
   unmapped types fall back to the clean 'card'. */
const MATERIAL_BY_TYPE = {
  // paper — warm matte, faint grain, serif voice, a maker's-mark watermark
  notes: 'paper', journal: 'paper', docshelf: 'paper', lorewiki: 'paper', notebook: 'paper',
  sessionlog: 'paper', sessionplan: 'paper', compendium: 'paper', spellbook: 'paper',
  elements: 'paper', charsheet: 'paper', pcsheet: 'paper', homebrew: 'paper', dndstory: 'paper',
  // glass — cool frosted, data & tracking, an upper-case micro-label voice
  tracker: 'glass', graph: 'glass', flowergraph: 'glass', health: 'glass', overview: 'glass',
  calendar: 'glass', levelplanner: 'glass', relationshipweb: 'glass', wtimeline: 'glass',
  civprofile: 'glass', time: 'glass', music: 'glass', notifications: 'glass', reminder: 'glass', alarm: 'glass',
  // slate — deep, low-texture, inked frame, tight corners, tactile (dice/combat/games)
  dice: 'slate', dndcombat: 'slate', encounter: 'slate', initiative: 'slate', statblock: 'slate',
  snake: 'slate', solitaire: 'slate', blossoms: 'slate', loottable: 'slate',
  // canvas — edge-to-edge, frame not box, content bleeds
  canvas: 'canvas', canvaboard: 'canvas', infcanvas: 'canvas', worldmap: 'canvas', gallery: 'canvas',
  // everything else → card (clean, lifted)
};
const WATERMARK_MATERIALS = new Set(['paper']);

/**
 * Resolve a widget's material: per-instance override → registry def → type map
 * → 'card'. Returns null for the structural separator (no card face).
 * @param {object} widget
 * @param {object} [def] the registry definition
 * @returns {string|null}
 */
export function materialFor(widget, def) {
  if (!widget || widget.type === 'separator') return null;
  return widget.material || def?.material || MATERIAL_BY_TYPE[widget.type] || 'card';
}

/** @returns {boolean} whether a material carries a corner watermark. */
export function materialHasWatermark(material) {
  return WATERMARK_MATERIALS.has(material);
}

/* Texture names → the CSS gradient library in identity.css (single source). */
const TEXTURE_VAR = {
  frosted: 'var(--tex-frosted)', paper: 'var(--tex-paper)', linen: 'var(--tex-linen)',
  parchment: 'var(--tex-parchment)', starfield: 'var(--tex-starfield)', none: 'none',
};

/* Motion keyword → easing + duration. Mirrors the data-feel bundles in
   identity.css; lets a scope pick a motion independent of its feel bundle. */
const MOTION = {
  calm:     { ease: 'cubic-bezier(0.2, 0.8, 0.4, 1)',       dur: '200ms' },
  drifting: { ease: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', dur: '250ms' },
  springy:  { ease: 'cubic-bezier(0.34, 1.4, 0.64, 1)',     dur: '150ms' },
};

/* Every feel-* var the resolver may set — cleared before each apply so a
   re-render (or a cleared identity) fully resets to inherited/:root values. */
const FEEL_VARS = [
  '--feel-radius', '--feel-radius-lg', '--feel-density', '--feel-pad', '--feel-gap',
  '--feel-surface', '--feel-texture', '--feel-texture-opacity', '--feel-border',
  '--feel-elevation', '--feel-ease', '--feel-dur', '--feel-accent-shape',
];

/**
 * Strip all scoped feel from an element (the data-feel bundle + inline vars).
 * @param {HTMLElement} el
 */
export function clearScopedIdentity(el) {
  if (!el) return;
  el.removeAttribute('data-feel');
  el.removeAttribute('data-accent-shape');
  for (const v of FEEL_VARS) el.style.removeProperty(v);
}

/**
 * Apply a scope's identity to its wrapper (or clear it with identity = null).
 * Sets the data-feel bundle, then writes any explicit overrides as inline
 * scoped vars — deepest non-inherit wins, exactly like theme colours.
 * @param {HTMLElement} el
 * @param {Identity|null} [identity]
 */
export function applyScopedIdentity(el, identity) {
  clearScopedIdentity(el);
  if (!el || !identity) return;

  // 1) the named bundle (cozy | roomy | compact)
  if (FEELS.has(identity.feel)) el.setAttribute('data-feel', identity.feel);

  // 2) explicit overrides as inline scoped vars
  if (identity.texture !== undefined) {
    const tex = TEXTURE_VAR[identity.texture];
    if (tex) {
      el.style.setProperty('--feel-texture', tex);
      // a chosen texture needs a visible-but-subtle opacity, even with no bundle
      el.style.setProperty('--feel-texture-opacity',
        identity.texture === 'none' ? '0' : String(identity.textureOpacity ?? 0.05));
    }
  } else if (identity.textureOpacity != null) {
    el.style.setProperty('--feel-texture-opacity', String(identity.textureOpacity));
  }

  const m = MOTION[identity.motion];
  if (m) {
    el.style.setProperty('--feel-ease', m.ease);
    el.style.setProperty('--feel-dur', m.dur);
  }

  if (ACCENT_SHAPES.has(identity.accentShape)) {
    el.style.setProperty('--feel-accent-shape', identity.accentShape);
    el.setAttribute('data-accent-shape', identity.accentShape); // CSS hook (tabs)
  }

  if (identity.density != null) {
    const d = Number(identity.density);
    el.style.setProperty('--feel-density', String(d));
    el.style.setProperty('--feel-pad', `calc(14px * ${d})`);
    el.style.setProperty('--feel-gap', `calc(14px * ${d})`);
  }
  if (identity.radius) el.style.setProperty('--feel-radius', identity.radius);
  if (identity.radiusLg) el.style.setProperty('--feel-radius-lg', identity.radiusLg);
  if (identity.elevation) el.style.setProperty('--feel-elevation', identity.elevation);
}

/* ---- Preset world identities (Phase 3, docs/15 §5.3) ----------------------
   The six showcase modules each ship a distinct world. Baked into a module
   record at instantiation (presets/modules/index.js) — NOT auto-applied to
   existing modules, so a module with no identity keeps today's look (guardrail
   §9). A user's own modules stay neutral until they opt in. Keyed by presetKey. */
export const PRESET_IDENTITIES = {
  blossom:        { feel: 'cozy',    accentShape: 'bloom',     texture: 'frosted',   motion: 'calm' },
  study:          { feel: 'compact', accentShape: 'underline', texture: 'frosted',   motion: 'springy' },
  infinitecanvas: { feel: 'compact', accentShape: 'rail',      texture: 'none',      motion: 'springy' },
  worldbuilder:   { feel: 'roomy',   accentShape: 'underline', texture: 'linen',     motion: 'drifting' },
  dndcharacter:   { feel: 'cozy',    accentShape: 'bloom',     texture: 'parchment', motion: 'calm' },
  dnddm:          { feel: 'roomy',   accentShape: 'rail',      texture: 'parchment', motion: 'drifting' },
};

/* The layout archetype each preset's home page opens in (§5.3). Baked onto the
   home page at instantiation only. */
export const PRESET_HOME_LAYOUTS = {
  blossom: 'hearth', infinitecanvas: 'gallery', dnddm: 'split',
  dndcharacter: 'hearth', worldbuilder: 'stream', study: null,
};

/* ---- Liveliness dial (Phase 5, docs/15 §7) --------------------------------
   One global setting scaling all the opt-in micro-life shipped across Phases
   1–4: Still (≈ reduced-motion — nothing moves), Gentle (default — earned
   entrances/wisp, no idle motion), Lively (adds the FAB idle breath). Persisted
   in localStorage (a tiny pref, allowed) and mirrored as data-liveliness on
   <body> so CSS (e.g. the FAB breath) and JS guards can both read it. */
const LIVELINESS = new Set(['still', 'gentle', 'lively']);
const LIVE_KEY = 'blossom:liveliness';

/** @returns {'still'|'gentle'|'lively'} the current Liveliness (default gentle). */
export function liveliness() {
  const v = localStorage.getItem(LIVE_KEY);
  return LIVELINESS.has(v) ? v : 'gentle';
}

/** Persist + apply a Liveliness level to <body> (data-liveliness). */
export function setLiveliness(value) {
  const v = LIVELINESS.has(value) ? value : 'gentle';
  localStorage.setItem(LIVE_KEY, v);
  applyLiveliness();
}

/** Mirror the stored Liveliness onto <body>. Call at boot + on change. */
export function applyLiveliness() {
  document.body.setAttribute('data-liveliness', liveliness());
}

/** @returns {boolean} whether earned micro-life may play (not Still / reduced). */
export function motionAllowed() {
  return liveliness() !== 'still'
    && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}
