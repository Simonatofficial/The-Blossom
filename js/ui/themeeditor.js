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

/* bgGradient is stored as [stop, …, "Ndeg"]; each stop is a colour with an
   optional position ("#rrggbb 30%"). Parse it into {stops:[{color,pos}], angle}. */
function parseGradient(arr, fallbackBg) {
  const bg = toHex(fallbackBg);
  if (!Array.isArray(arr) || arr.length < 3) return { stops: [{ color: bg, pos: 0 }, { color: bg, pos: 100 }], angle: 160 };
  const angle = parseFloat(arr[arr.length - 1]) || 160;
  const cols = arr.slice(0, -1), n = cols.length;
  const stops = cols.map((s, i) => {
    const str = String(s).trim();
    const m = str.match(/\s([\d.]+)%$/);
    return { color: toHex(m ? str.slice(0, m.index).trim() : str), pos: m ? parseFloat(m[1]) : Math.round((i / Math.max(1, n - 1)) * 100) };
  });
  return { stops, angle };
}

function serializeGradient(stops, angle) {
  return [...[...stops].sort((a, b) => a.pos - b.pos).map(s => `${s.color} ${Math.round(s.pos)}%`), `${Math.round(angle)}deg`];
}

/* The draggable-stop gradient editor (V2 §9): a live gradient bar with movable
   colour stops (2–6), a per-stop colour + position, and an angle control. Edits
   write draft.colors.bgGradient and live-preview; discrete changes run the full
   preview() so the atmosphere re-colours, drags just repaint the cheap bg vars. */
function buildGradientEditor(draft, preview) {
  const wrap = el('<div></div>');
  let { stops, angle } = parseGradient(draft.colors.bgGradient, draft.colors.bg);
  let sel = 0;

  const bar = el('<div style="position:relative;height:46px;border-radius:10px;border:1px solid var(--border);margin:6px 0 4px;touch-action:none"></div>');
  const controls = el('<div></div>');

  const liveBar = () => {
    const vars = colorVars(draft.colors);
    for (const k of ['--bg-grad-1', '--bg-grad-2', '--bg-angle', '--bg-image']) if (vars[k]) document.documentElement.style.setProperty(k, vars[k]);
  };
  const commit = (full) => { draft.colors.bgGradient = serializeGradient(stops, angle); paintBar(); full ? preview() : liveBar(); };

  function paintBar() {
    const sorted = [...stops].sort((a, b) => a.pos - b.pos);
    bar.style.background = `linear-gradient(90deg, ${sorted.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
    [...bar.querySelectorAll('.gstop')].forEach(h => h.remove());
    stops.forEach((s, i) => {
      const h = el('<div class="gstop" style="position:absolute;top:50%;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);transform:translate(-50%,-50%);cursor:grab"></div>');
      h.style.left = s.pos + '%';
      h.style.background = s.color;
      if (i === sel) { h.style.outline = '2px solid var(--accent)'; h.style.outlineOffset = '2px'; }
      attachDrag(h, i);
      bar.appendChild(h);
    });
  }

  function attachDrag(h, i) {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      sel = i; paintBar(); renderControls();
      const rect = bar.getBoundingClientRect();
      const move = (ev) => { stops[i].pos = Math.round(Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100))); commit(false); renderControls(); };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); commit(true); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }

  bar.addEventListener('dblclick', (e) => {
    if (stops.length >= 6) { toast('Up to 6 stops', 'info'); return; }
    const rect = bar.getBoundingClientRect();
    const pos = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
    stops.push({ color: stops[sel]?.color || toHex(draft.colors.bg), pos });
    sel = stops.length - 1; commit(true); renderControls();
  });

  function renderControls() {
    controls.innerHTML = '';
    const s = stops[sel] || stops[0];
    const row = el(`<div class="row" style="margin:2px 0 8px;gap:8px;align-items:center">
      <input type="color" style="width:38px;height:32px;border:1px solid var(--border);border-radius:8px;background:none;padding:2px">
      <input class="input" type="number" min="0" max="100" style="width:62px">
      <span class="soft" style="font-size:0.8rem">%</span>
      <button class="btn grow" style="padding:6px">Remove stop</button>
    </div>`);
    const [sw, posIn, , del] = row.children;
    sw.value = s.color; posIn.value = s.pos;
    sw.oninput = () => { s.color = sw.value; commit(true); };
    posIn.onchange = () => { s.pos = Math.max(0, Math.min(100, Number(posIn.value) || 0)); commit(true); };
    del.disabled = stops.length <= 2;
    del.onclick = () => { if (stops.length <= 2) return; stops.splice(sel, 1); sel = Math.max(0, sel - 1); commit(true); renderControls(); };
    controls.appendChild(row);
  }

  const angleRow = el(`<div class="row" style="gap:8px;margin-bottom:8px;align-items:center">
    <span class="soft" style="font-size:0.8rem;min-width:42px">Angle</span>
    <input type="range" class="range grow" min="0" max="360" step="5">
    <input class="input" type="number" min="0" max="360" style="width:62px">
    <span class="soft" style="font-size:0.8rem">°</span>
  </div>`);
  const [, angR, angN] = angleRow.children;
  angR.value = angle; angN.value = angle;
  angR.oninput = () => { angle = Number(angR.value); angN.value = angle; commit(false); };
  angR.addEventListener('change', () => commit(true));
  angN.onchange = () => { angle = Math.max(0, Math.min(360, Number(angN.value) || 0)); angR.value = angle; commit(true); };

  const addBtn = el(`<button class="btn" style="width:100%;margin-bottom:14px">${icon('plus', 14)} Add stop</button>`);
  addBtn.onclick = () => {
    if (stops.length >= 6) { toast('Up to 6 stops', 'info'); return; }
    stops.push({ color: stops[sel]?.color || toHex(draft.colors.bg), pos: 50 });
    sel = stops.length - 1; commit(true); renderControls();
  };

  const hint = el('<p class="soft" style="font-size:0.74rem;margin:0 0 8px">Drag the dots to move stops · double-tap the bar to add one</p>');
  wrap.append(bar, hint, controls, angleRow, addBtn);
  paintBar(); renderControls();
  return wrap;
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

  // ---- gradient (V2 §9: draggable-stop editor) ----
  d.body.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin:10px 0 4px">GRADIENT</h3>'));
  d.body.appendChild(buildGradientEditor(draft, preview));

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
