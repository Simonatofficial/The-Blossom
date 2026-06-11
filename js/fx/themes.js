/* Theme application (docs/03). Colors are injected as CSS variables on :root
   (global) or inline on a wrapper element (per-module/page/widget scoping —
   "theme scoping is just scoped CSS variables, so it's free"). */

import { events } from '../core/events.js';
import { store } from '../core/store.js';
import { PRESET_THEMES } from '../presets/themes.js';
import { setAtmosphere } from './atmosphere.js';
import { setBackground, setPointerFx } from './particles.js';
import { getParticlePreset, getPointerFxPreset } from '../presets/particles.js';

const VAR_MAP = {
  bg: '--bg', surface: '--surface', surfaceAlt: '--surface-alt',
  border: '--border', text: '--text', textSoft: '--text-soft',
  accent: '--accent', accentSoft: '--accent-soft', highlight: '--highlight',
  success: '--success', warn: '--warn', glow: '--glow'
};

/** @returns {object|null} a theme by id — presets first, then custom themes. */
export function getTheme(id) {
  return PRESET_THEMES.find(t => t.id === id) || store.get('themes', id) || null;
}

/** @returns {object[]} all themes (presets + custom; particle defs excluded). */
export function allThemes() {
  return [...PRESET_THEMES, ...store.all('themes').filter(t => t.type !== 'particle')];
}

/** Map a theme's colors to { cssVar: value } pairs. */
export function colorVars(colors) {
  const vars = {};
  for (const [key, cssVar] of Object.entries(VAR_MAP)) {
    if (colors[key]) vars[cssVar] = colors[key];
  }
  if (colors.bgGradient) {
    // CR-4: 2–4 stops, last entry is the angle (2-stop arrays stay valid)
    const angle = colors.bgGradient[colors.bgGradient.length - 1];
    const stops = colors.bgGradient.slice(0, -1);
    vars['--bg-grad-1'] = stops[0];
    vars['--bg-grad-2'] = stops[stops.length - 1];
    vars['--bg-angle'] = angle;
    vars['--bg-image'] = `linear-gradient(${angle}, ${stops.join(', ')})`;
  }
  return vars;
}

/**
 * Scope a theme onto an element (or clear with themeId = null).
 * @param {HTMLElement} el
 * @param {string|null} themeId
 */
export function applyScopedTheme(el, themeId) {
  for (const cssVar of [...Object.values(VAR_MAP), '--bg-grad-1', '--bg-grad-2', '--bg-angle', '--bg-image']) {
    el.style.removeProperty(cssVar);
  }
  const theme = themeId && getTheme(themeId);
  if (!theme) return;
  for (const [cssVar, val] of Object.entries(colorVars(theme.colors))) {
    el.style.setProperty(cssVar, val);
  }
}

/** Apply the workspace theme globally and remember it. */
export function applyGlobalTheme(themeId) {
  const theme = withOverrides(getTheme(themeId) || PRESET_THEMES[1]); // fall back to Space
  for (const [cssVar, val] of Object.entries(colorVars(theme.colors))) {
    document.documentElement.style.setProperty(cssVar, val);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.bg);
  store.setMeta('themeId', theme.id);
  localStorage.setItem('blossom:themeId', theme.id);
  applyEffects(theme);
  events.emit('theme:changed', theme);
}

/** @returns {string} id of the active workspace theme. */
export function activeThemeId() {
  return store.getMeta('themeId') || localStorage.getItem('blossom:themeId') || 'space';
}

/** @returns {object} the active workspace theme (with user overrides merged). */
export function activeTheme() {
  return withOverrides(getTheme(activeThemeId()) || PRESET_THEMES[1]);
}

/* ---- non-destructive effect overrides on any theme (CR-5).
   Stored in meta.settings.themeOverrides[themeId]; merged at apply time —
   presets are never mutated. ---- */

/** The raw override layer for a theme, or null. */
export function themeOverrides(themeId) {
  return store.getMeta('settings', {})?.themeOverrides?.[themeId] || null;
}

/**
 * Patch one override key ('atmosphere'|'particles'|'pointerFx'|'colors').
 * Pass value `undefined` to clear the key, an object/null to set it.
 */
export function setThemeOverride(themeId, key, value) {
  const s = store.getMeta('settings', {});
  s.themeOverrides = s.themeOverrides || {};
  const o = { ...(s.themeOverrides[themeId] || {}) };
  if (value === undefined) delete o[key];
  else o[key] = value;
  if (Object.keys(o).length) s.themeOverrides[themeId] = o;
  else delete s.themeOverrides[themeId];
  store.setMeta('settings', s);
}

/** Clear a theme's whole override layer ("Reset to preset"). */
export function clearThemeOverrides(themeId) {
  const s = store.getMeta('settings', {});
  if (s.themeOverrides) delete s.themeOverrides[themeId];
  store.setMeta('settings', s);
}

/** Merge a theme with its override layer (non-destructive). */
export function withOverrides(theme) {
  if (!theme) return theme;
  const o = themeOverrides(theme.id);
  if (!o) return theme;
  return {
    ...theme,
    atmosphere: 'atmosphere' in o ? o.atmosphere : theme.atmosphere,
    particles: 'particles' in o ? o.particles : theme.particles,
    pointerFx: 'pointerFx' in o ? o.pointerFx : theme.pointerFx,
    colors: { ...theme.colors, ...(o.colors || {}) }
  };
}

/* ---- atmosphere + particle activation (docs/03 scoping: the deepest
   non-inherit theme in the active scope chain wins; engine calls this on
   every page render, we skip redundant re-activations) ---- */

let lastFxKey = null;

function resolveParticleDef(spec, custom) {
  if (!spec?.preset) return null;
  const base = getParticlePreset(spec.preset) || getPointerFxPreset(spec.preset) || store.get('themes', spec.preset)?.def;
  return base ? { ...base, ...(spec.overrides || {}) } : null;
}

/** Activate a theme's atmosphere, background particles, and pointer FX.
    Overrides (CR-5) are merged here, so every caller gets them for free. */
export function applyEffects(rawTheme, force = false) {
  const theme = withOverrides(rawTheme);
  if (!theme) return;
  const key = JSON.stringify([theme.id, theme.atmosphere, theme.particles, theme.pointerFx]);
  if (!force && key === lastFxKey) return;
  lastFxKey = key;
  setAtmosphere(theme.atmosphere || null, theme.colors);
  const pDef = resolveParticleDef(theme.particles);
  setBackground(pDef, pDef?.color || theme.colors.accent);
  const fxDef = resolveParticleDef(theme.pointerFx);
  setPointerFx(fxDef, fxDef?.color || theme.colors.accent);
}
