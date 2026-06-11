/* Custom theme editor (docs/03): one scrollable panel, live-previewing on the
   real app behind it. Colors → atmosphere → particles → pointer FX → save.
   Contrast warnings advise but never block. */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { ulid } from '../core/ids.js';
import { icon } from './icons.js';
import { el, field, input, openDrawer, toast } from './components.js';
import { activeTheme, applyGlobalTheme, applyEffects, colorVars, getTheme } from '../fx/themes.js';
import { ATMOSPHERE_PRESETS } from '../fx/atmosphere.js';
import { PRESET_PARTICLES, PRESET_POINTER_FX } from '../presets/particles.js';
import { openParticleEditor } from './particleeditor.js';

const COLOR_LABELS = {
  bg: 'Background', surface: 'Surface', surfaceAlt: 'Surface (alt)', border: 'Border',
  text: 'Text', textSoft: 'Soft text', accent: 'Accent', accentSoft: 'Accent wash',
  highlight: 'Highlight', success: 'Success', warn: 'Warm note'
};

function luminance(hex) {
  const v = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(c1, c2) {
  try {
    const [l1, l2] = [luminance(c1), luminance(c2)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
  } catch { return 21; }
}

function toHex(c) {
  if (c?.startsWith('#')) return c.length === 4 ? '#' + c.slice(1).split('').map(x => x + x).join('') : c;
  const m = c?.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);
  if (!m) return '#888888';
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
}

export function openThemeEditor(themeId = null) {
  const startFrom = themeId ? getTheme(themeId) : activeTheme();
  const draft = structuredClone({ ...startFrom, preset: undefined });
  const editing = themeId && store.get('themes', themeId);
  if (!editing) { draft.id = ulid(); draft.name = `${startFrom.name} (mine)`; }
  draft.custom = true;

  const restore = activeTheme();
  let saved = false;

  const preview = () => {
    for (const [cssVar, val] of Object.entries(colorVars(draft.colors))) {
      document.documentElement.style.setProperty(cssVar, val);
    }
    applyEffects(draft, true);
  };

  const d = openDrawer({
    title: editing ? 'Edit theme' : 'New theme', iconName: 'palette',
    onClose: () => { if (!saved) applyGlobalTheme(restore.id); }
  });

  const nameIn = input(draft.name, 'Theme name');
  nameIn.addEventListener('change', () => { draft.name = nameIn.value.trim() || draft.name; });
  d.body.appendChild(field('Name', nameIn));

  // ---- colors ----
  d.body.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin:6px 0 8px">COLORS</h3>'));
  const contrastNote = el('<p class="soft" style="font-size:0.76rem;color:var(--warn);margin-bottom:8px" hidden></p>');
  const checkContrast = () => {
    const issues = [];
    if (contrast(toHex(draft.colors.text), toHex(draft.colors.surface)) < 4.5) issues.push('text on surface');
    if (contrast(toHex(draft.colors.accent), toHex(draft.colors.bg)) < 3) issues.push('accent on background');
    contrastNote.hidden = !issues.length;
    contrastNote.textContent = issues.length ? `Soft warning: low contrast for ${issues.join(' and ')}.` : '';
  };
  d.body.appendChild(contrastNote);

  for (const [key, label] of Object.entries(COLOR_LABELS)) {
    const row = el(`<div class="row" style="margin-bottom:7px">
      <input type="color" style="width:38px;height:32px;border:1px solid var(--border);border-radius:8px;background:none;padding:2px">
      <span class="grow" style="font-size:0.86rem">${label}</span>
      <input class="input" style="width:130px;font-size:0.8rem" spellcheck="false"></div>`);
    const [swatch, , hexIn] = row.children;
    swatch.value = toHex(draft.colors[key]);
    hexIn.value = draft.colors[key];
    swatch.oninput = () => { draft.colors[key] = swatch.value; hexIn.value = swatch.value; preview(); checkContrast(); };
    hexIn.onchange = () => { draft.colors[key] = hexIn.value.trim(); swatch.value = toHex(hexIn.value); preview(); checkContrast(); };
    d.body.appendChild(row);
  }

  const genGrad = el(`<button class="btn" style="width:100%;margin:6px 0 14px">${icon('wand', 14)} Generate gradient from background</button>`);
  genGrad.onclick = () => {
    const bg = toHex(draft.colors.bg);
    const accent = toHex(draft.colors.accent);
    const mix = (a, b, f) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - f) + parseInt(b.slice(1 + i, 3 + i), 16) * f).toString(16).padStart(2, '0')).join('');
    draft.colors.bgGradient = [bg, mix(bg, accent, 0.22), '160deg'];
    preview();
    toast('Gradient grown from your background', 'wand');
  };
  d.body.appendChild(genGrad);

  // ---- atmosphere ----
  d.body.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin:6px 0 8px">ATMOSPHERE</h3>'));
  const atmoSel = el('<select class="select"></select>');
  atmoSel.appendChild(new Option('None (calm)', ''));
  for (const a of ATMOSPHERE_PRESETS) atmoSel.appendChild(new Option(a.name, a.key));
  atmoSel.value = draft.atmosphere?.preset || '';
  atmoSel.onchange = () => {
    draft.atmosphere = atmoSel.value ? { preset: atmoSel.value, options: draft.atmosphere?.options || {} } : null;
    preview();
  };
  d.body.appendChild(field('Scene', atmoSel));
  const speedIn = el('<input type="range" class="range" min="0.25" max="3" step="0.25">');
  speedIn.value = draft.atmosphere?.options?.speed || 1;
  speedIn.oninput = () => {
    if (draft.atmosphere) { draft.atmosphere.options.speed = Number(speedIn.value); preview(); }
  };
  d.body.appendChild(field('Speed', speedIn));

  // ---- particles + pointer fx ----
  const particleSection = (label, listA, current, set, allowCustom) => {
    d.body.appendChild(el(`<h3 class="soft" style="font-size:0.78rem;margin:6px 0 8px">${label}</h3>`));
    const sel = el('<select class="select"></select>');
    sel.appendChild(new Option('None', ''));
    for (const p of listA) sel.appendChild(new Option(p.name, p.id));
    for (const c of store.all('themes').filter(t => t.type === 'particle')) sel.appendChild(new Option(`${c.name} (custom)`, c.id));
    sel.value = current?.preset || '';
    sel.onchange = () => { set(sel.value ? { preset: sel.value, overrides: {} } : null); preview(); };
    d.body.appendChild(field('Preset', sel));
    if (allowCustom) {
      const custom = el(`<button class="btn" style="width:100%;margin-bottom:14px">${icon('sparkles', 14)} Custom…</button>`);
      custom.onclick = () => openParticleEditor(null, (rec) => {
        sel.appendChild(new Option(`${rec.name} (custom)`, rec.id));
        sel.value = rec.id;
        set({ preset: rec.id, overrides: {} });
        preview();
      });
      d.body.appendChild(custom);
    }
  };
  particleSection('PARTICLES', PRESET_PARTICLES, draft.particles, v => draft.particles = v, true);
  particleSection('POINTER FX', PRESET_POINTER_FX, draft.pointerFx, v => draft.pointerFx = v, false);

  // ---- save ----
  const save = el(`<button class="btn btn-primary" style="width:100%">${icon('save', 15)} Save theme</button>`);
  save.onclick = () => {
    store.put('themes', draft);
    saved = true;
    applyGlobalTheme(draft.id);
    events.emit('saves:changed', {});
    toast(`${draft.name} saved`, 'palette');
    d.close();
  };
  d.body.appendChild(save);

  preview();
  checkContrast();
}
