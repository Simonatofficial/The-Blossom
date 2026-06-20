/* Identity resolver (Phase 0: feel-token foundation).
   Given a definition's `identity` field, resolves it to scoped CSS variables
   on an element — exactly the pattern applyScopedTheme uses for colours.
   See docs/15. */

/**
 * Feel presets (bundled token sets). Defaults to cozy (today's look).
 * @typedef {object} FeltPreset
 * @property {string} feel - 'cozy'|'roomy'|'compact'
 * @property {string} texture - 'frosted'|'paper'|'linen'|'parchment'|'starfield'|'none'
 * @property {string} ease - easing function name
 * @property {string} dur - timing duration (ms)
 * @property {number} density - scale multiplier
 */

const TEXTURE_GRADIENTS = {
  frosted: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(0,0,0,0.02))',
  paper: 'repeating-linear-gradient(90deg, rgba(200,180,160,0.03) 0px, transparent 1px, transparent 3px)',
  linen: 'repeating-linear-gradient(45deg, rgba(180,160,140,0.02) 0px, transparent 2px, transparent 4px)',
  parchment: 'radial-gradient(ellipse at 20% 50%, rgba(255,200,100,0.015), rgba(200,180,160,0.01))',
  starfield: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
  none: 'none',
};

/**
 * Clear all feel-token CSS vars from an element (or global if el is null).
 * @param {HTMLElement|null} el
 */
export function clearScopedIdentity(el = null) {
  const target = el || document.documentElement;
  const feelVars = [
    '--feel-radius', '--feel-radius-lg', '--feel-density',
    '--feel-pad', '--feel-gap', '--feel-surface', '--feel-texture',
    '--feel-border', '--feel-elevation', '--feel-ease', '--feel-dur',
    '--feel-accent-shape'
  ];
  for (const cssVar of feelVars) {
    if (el) target.style.removeProperty(cssVar);
    else document.documentElement.style.removeProperty(cssVar);
  }
}

/**
 * Apply a scoped identity (or clear with identity = null).
 * Mirrors applyScopedTheme: set data-feel + inline vars on the element.
 * @param {HTMLElement} el
 * @param {object|null} identity - { feel, texture, motion, accentShape, masthead? }
 */
export function applyScopedIdentity(el, identity) {
  clearScopedIdentity(el);
  if (!identity) return;

  // data-feel triggers the CSS preset bundles (cozy/roomy/compact)
  const feel = identity.feel || 'cozy';
  el.setAttribute('data-feel', feel);

  // explicit texture override (if provided)
  if (identity.texture !== undefined) {
    const grad = TEXTURE_GRADIENTS[identity.texture];
    if (grad) el.style.setProperty('--feel-texture', grad);
  }

  // motion personality overrides
  if (identity.motion === 'drifting') {
    el.style.setProperty('--feel-ease', 'cubic-bezier(0.25, 0.46, 0.45, 0.94)');
    el.style.setProperty('--feel-dur', '250ms');
  } else if (identity.motion === 'springy') {
    el.style.setProperty('--feel-ease', 'cubic-bezier(0.34, 1.56, 0.64, 1)');
    el.style.setProperty('--feel-dur', '150ms');
  } else if (identity.motion === 'calm') {
    el.style.setProperty('--feel-ease', 'cubic-bezier(0.2, 0.8, 0.4, 1)');
    el.style.setProperty('--feel-dur', '200ms');
  }

  // accent shape (controls tab bar, signature rule appearance)
  if (identity.accentShape) {
    el.style.setProperty('--feel-accent-shape', identity.accentShape);
  }

  // any other feel-token overrides passed explicitly
  if (identity.radius) el.style.setProperty('--feel-radius', identity.radius);
  if (identity.radiusLg) el.style.setProperty('--feel-radius-lg', identity.radiusLg);
  if (identity.density) {
    el.style.setProperty('--feel-density', identity.density);
    el.style.setProperty('--feel-pad', `calc(14px * ${identity.density})`);
    el.style.setProperty('--feel-gap', `calc(14px * ${identity.density})`);
  }
  if (identity.elevation) el.style.setProperty('--feel-elevation', identity.elevation);
}
