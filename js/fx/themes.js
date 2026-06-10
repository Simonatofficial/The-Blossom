/* Theme application (docs/03). Colors are injected as CSS variables on :root
   (global) or inline on a wrapper element (per-module/page/widget scoping —
   "theme scoping is just scoped CSS variables, so it's free"). */

import { events } from '../core/events.js';
import { store } from '../core/store.js';
import { PRESET_THEMES } from '../presets/themes.js';

const VAR_MAP = {
  bg: '--bg', surface: '--surface', surfaceAlt: '--surface-alt',
  border: '--border', text: '--text', textSoft: '--text-soft',
  accent: '--accent', accentSoft: '--accent-soft', highlight: '--highlight',
  success: '--success', warn: '--warn'
};

/** @returns {object|null} a theme by id — presets first, then custom themes. */
export function getTheme(id) {
  return PRESET_THEMES.find(t => t.id === id) || store.get('themes', id) || null;
}

/** @returns {object[]} all themes (presets + custom). */
export function allThemes() {
  return [...PRESET_THEMES, ...store.all('themes')];
}

/** Map a theme's colors to { cssVar: value } pairs. */
export function colorVars(colors) {
  const vars = {};
  for (const [key, cssVar] of Object.entries(VAR_MAP)) {
    if (colors[key]) vars[cssVar] = colors[key];
  }
  if (colors.bgGradient) {
    const [c1, c2, angle] = colors.bgGradient;
    vars['--bg-grad-1'] = c1;
    vars['--bg-grad-2'] = c2;
    vars['--bg-angle'] = angle;
  }
  return vars;
}

/**
 * Scope a theme onto an element (or clear with themeId = null).
 * @param {HTMLElement} el
 * @param {string|null} themeId
 */
export function applyScopedTheme(el, themeId) {
  for (const cssVar of [...Object.values(VAR_MAP), '--bg-grad-1', '--bg-grad-2', '--bg-angle']) {
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
  const theme = getTheme(themeId) || PRESET_THEMES[1]; // fall back to Space
  for (const [cssVar, val] of Object.entries(colorVars(theme.colors))) {
    document.documentElement.style.setProperty(cssVar, val);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.bg);
  store.setMeta('themeId', theme.id);
  localStorage.setItem('blossom:themeId', theme.id);
  events.emit('theme:changed', theme);
}

/** @returns {string} id of the active workspace theme. */
export function activeThemeId() {
  return store.getMeta('themeId') || localStorage.getItem('blossom:themeId') || 'space';
}

/** @returns {object} the active workspace theme. */
export function activeTheme() {
  return getTheme(activeThemeId()) || PRESET_THEMES[1];
}
