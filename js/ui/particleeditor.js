/* Custom particle editor (docs/03 · V2 §6): live preview on top, plain-English
   controls below with numeric readouts. Custom defs live in the themes store
   (type 'particle'). */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { ulid } from '../core/ids.js';
import { loop } from '../fx/loop.js';
import { icon } from './icons.js';
import { el, field, input, seg, switchEl, rangeField, openDrawer, toast } from './components.js';
import { Layer, SPRITE_NAMES } from '../fx/particles.js';
import { PRESET_PARTICLES } from '../presets/particles.js';

/* plain-English behaviour names (V2 §6) → engine keys */
const BEHAVIORS = [
  ['Fall', 'fallDown'], ['Float', 'floatUp'], ['Move Left', 'flowLeft'], ['Move Right', 'flowRight'],
  ['Flow (angle)', 'flow'], ['Drift', 'drift'], ['Swim', 'swim'], ['Random', 'random'],
  ['Orbit', 'orbit'], ['Bounce', 'bounce']
];
const EFFECTS = [
  ['Twinkle / glitter', 'twinkle'], ['Pulse Grow', 'pulseGrow'], ['Pulse Shrink', 'pulseShrink'], ['Pop', 'pop']
];

/** Map a legacy edge-area to an X/Y spawn range so the new sliders have sane starts. */
function areaToRanges(area) {
  return {
    top: { xRange: [0, 1], yRange: [0, 0.04] }, bottom: { xRange: [0, 1], yRange: [0.96, 1] },
    left: { xRange: [0, 0.04], yRange: [0, 1] }, right: { xRange: [0.96, 1], yRange: [0, 1] },
    center: { xRange: [0.35, 0.65], yRange: [0.35, 0.65] }, random: { xRange: [0, 1], yRange: [0, 1] }
  }[area] || { xRange: [0, 1], yRange: [0, 1] };
}

export function openParticleEditor(existingId = null, onSaved = null, baseDef = null) {
  const existing = existingId && store.get('themes', existingId);
  const def = structuredClone(existing?.def || baseDef || PRESET_PARTICLES[4]); // default: cherry blossoms
  def.color = def.color || '#f5b8c4';
  if (!def.spawn?.xRange) { const r = areaToRanges(def.spawn?.area); def.spawn = { ...(def.spawn || {}), ...r, shape: def.spawn?.shape || 'box', spread: def.spawn?.spread ?? 1 }; }
  let name = existing?.name || (baseDef ? `${baseDef.name} (tuned)` : 'My particles');

  const d = openDrawer({ title: 'Particle editor', iconName: 'sparkles' });

  // live preview running the definition in isolation
  const previewCanvas = el('<canvas style="width:100%;height:150px;border-radius:12px;background:rgba(0,0,0,0.18)"></canvas>');
  d.body.appendChild(previewCanvas);
  previewCanvas.width = 360; previewCanvas.height = 150;
  const layer = new Layer(previewCanvas, 60);
  previewCanvas.width = 360; previewCanvas.height = 150; // Layer.resize used window size
  const rebuild = () => layer.setDef({ ...def, maxCount: Math.min(40, def.maxCount || 30) }, def.color);
  rebuild();
  const unsub = loop.add((dt, now) => {
    if (!previewCanvas.isConnected) { unsub(); return; }
    layer.tick(dt, now);
  });

  const nameIn = input(name, 'Name');
  nameIn.addEventListener('change', () => { name = nameIn.value.trim() || name; });
  d.body.appendChild(field('Name', nameIn));

  /* ---- shape source: Sprite / Text / Emoji / Image ---- */
  const shapeWrap = el('<div></div>');
  const renderShape = () => {
    shapeWrap.innerHTML = '';
    shapeWrap.appendChild(field('Particle', seg(
      [{ value: 'sprite', label: 'Shape' }, { value: 'char', label: 'Text' }, { value: 'emoji', label: 'Emoji' }, { value: 'image', label: 'Image' }],
      def.shape.kind, (v) => {
        def.shapes = null; // single-source when edited by hand
        def.shape = { kind: v, value: v === 'sprite' ? (SPRITE_NAMES.includes(def.shape.value) ? def.shape.value : 'petal') : def.shape.value || '' };
        renderShape(); rebuild();
      })));
    if (def.shape.kind === 'sprite') {
      const sel = el('<select class="select"></select>');
      for (const s of SPRITE_NAMES) sel.appendChild(new Option(s, s));
      sel.value = def.shape.value;
      sel.onchange = () => { def.shape.value = sel.value; rebuild(); };
      shapeWrap.appendChild(field('Shape', sel));
    } else if (def.shape.kind === 'image') {
      const btn = el(`<button class="btn" style="width:100%">${icon('image', 15)} ${def.shape.value ? 'Replace image' : 'Upload image'}</button>`);
      btn.onclick = () => pickImage((dataUrl) => { def.shape.value = dataUrl; renderShape(); rebuild(); });
      shapeWrap.appendChild(field('Image (max 512px)', btn));
      if (def.shape.value) shapeWrap.appendChild(el(`<img src="${def.shape.value}" style="max-height:54px;border-radius:8px;border:1px solid var(--border)">`));
    } else {
      const vIn = input(def.shape.value || '', def.shape.kind === 'emoji' ? '❀' : '*');
      vIn.addEventListener('input', () => { def.shape.value = vIn.value || (def.shape.kind === 'emoji' ? '✦' : '*'); rebuild(); });
      shapeWrap.appendChild(field(def.shape.kind === 'emoji' ? 'Emoji' : 'Characters', vIn));
    }
    if (def.shape.kind !== 'image') {
      const colorIn = el('<input type="color" class="input" style="height:38px;padding:3px">');
      if (/^#([0-9a-f]{6})$/i.test(def.color)) colorIn.value = def.color;
      colorIn.oninput = () => { def.color = colorIn.value; def.gradient = null; rebuild(); };
      shapeWrap.appendChild(field('Color', colorIn));
    }
  };
  renderShape();
  d.body.appendChild(shapeWrap);

  /* ---- behaviour + flow angle ---- */
  const behaviorSel = el('<select class="select"></select>');
  for (const [label, val] of BEHAVIORS) behaviorSel.appendChild(new Option(label, val));
  behaviorSel.value = def.behavior;
  const flowWrap = el('<div></div>');
  const renderFlow = () => {
    flowWrap.innerHTML = '';
    if (def.behavior === 'flow') {
      flowWrap.appendChild(field('Flow direction', rangeField({ min: 0, max: 360, step: 1, value: def.flowAngle || 0, unit: '°', onInput: v => { def.flowAngle = v; rebuild(); } })));
    }
  };
  behaviorSel.onchange = () => { def.behavior = behaviorSel.value; renderFlow(); rebuild(); };
  d.body.appendChild(field('Behavior', behaviorSel));
  d.body.appendChild(flowWrap);
  renderFlow();

  /* ---- effects (renamed) ---- */
  const fxRow = el('<div class="row" style="flex-wrap:wrap;margin-bottom:14px"></div>');
  for (const [label, val] of EFFECTS) {
    const on = def.effects?.includes(val);
    const chip = el(`<button class="chip ${on ? 'accent' : ''}" style="cursor:pointer"></button>`);
    chip.textContent = label;
    chip.onclick = () => {
      def.effects = def.effects || [];
      def.effects.includes(val) ? def.effects.splice(def.effects.indexOf(val), 1) : def.effects.push(val);
      chip.classList.toggle('accent');
      rebuild();
    };
    fxRow.appendChild(chip);
  }
  d.body.appendChild(field('Effects', fxRow));

  /* ---- numeric sliders (V2 §6: every slider shows its value) ---- */
  const addSlider = (label, get, set, opts) => {
    d.body.appendChild(field(label, rangeField({ ...opts, value: get(), onInput: v => { set(v); rebuild(); } })));
  };
  addSlider('Speed', () => def.speed || 1, v => def.speed = v, { min: 0.1, max: 8, step: 0.1, unit: '×' });
  addSlider('Size', () => def.size || 16, v => def.size = v, { min: 4, max: 60, step: 1, unit: 'px' });
  addSlider('Size variation', () => Math.round((def.sizeVar ?? 0.3) * 100), v => def.sizeVar = v / 100, { min: 0, max: 100, step: 5, unit: '%' });
  addSlider('Count', () => def.maxCount || 40, v => def.maxCount = v, { min: 4, max: 150, step: 2 });
  addSlider('Angle', () => def.angle || 0, v => def.angle = v, { min: 0, max: 360, step: 1, unit: '°' });
  addSlider('Spin', () => def.rotation?.spin || 0, v => (def.rotation = def.rotation || {}).spin = v, { min: 0, max: 1.5, step: 0.05, unit: '×' });
  addSlider('Sway Angle', () => def.rotation?.sway || 0, v => (def.rotation = def.rotation || {}).sway = v, { min: 0, max: 1.5, step: 0.05, unit: '×' });
  addSlider('Spawn Angle Spread', () => def.spawnAngleSpread || 0, v => def.spawnAngleSpread = v, { min: 0, max: 180, step: 5, unit: '°' });

  /* ---- spawn zone (X/Y range + shape + spread) ---- */
  const sp = def.spawn;
  d.body.appendChild(el('<div class="dsec" style="margin-top:4px"><h3 style="font-size:0.92rem">Spawn zone</h3></div>'));
  d.body.appendChild(field('Shape', seg(
    [{ value: 'box', label: 'Box' }, { value: 'radial', label: 'Radial' }], sp.shape || 'box', (v) => { sp.shape = v; rebuild(); })));
  addSlider('X from', () => Math.round(sp.xRange[0] * 100), v => sp.xRange = [v / 100, sp.xRange[1]], { min: 0, max: 100, step: 1, unit: '%' });
  addSlider('X to', () => Math.round(sp.xRange[1] * 100), v => sp.xRange = [sp.xRange[0], v / 100], { min: 0, max: 100, step: 1, unit: '%' });
  addSlider('Y from', () => Math.round(sp.yRange[0] * 100), v => sp.yRange = [v / 100, sp.yRange[1]], { min: 0, max: 100, step: 1, unit: '%' });
  addSlider('Y to', () => Math.round(sp.yRange[1] * 100), v => sp.yRange = [sp.yRange[0], v / 100], { min: 0, max: 100, step: 1, unit: '%' });
  addSlider('Spread', () => Math.round((sp.spread ?? 1) * 100), v => sp.spread = v / 100, { min: 0, max: 100, step: 5, unit: '%' });

  const save = el(`<button class="btn btn-primary" style="width:100%;margin-top:8px">${icon('save', 15)} Save particles</button>`);
  save.onclick = () => {
    const rec = existing || { id: ulid(), type: 'particle' };
    rec.name = name;
    rec.def = structuredClone(def);
    store.put('themes', rec);
    events.emit('saves:changed', {});
    toast(`${name} saved`, 'sparkles');
    d.close();
    onSaved?.(rec);
  };
  d.body.appendChild(save);
}

/** Pick an image file → downscale to ≤512px → data-URL (V2 §6 image particles). */
function pickImage(onReady) {
  const fileIn = el('<input type="file" accept="image/png,image/jpeg,image/webp" class="hidden">');
  document.body.appendChild(fileIn);
  fileIn.onchange = () => {
    const file = fileIn.files[0];
    fileIn.remove();
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const max = 512, scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      onReady(c.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); toast('That image could not be read.', 'info'); };
    img.src = URL.createObjectURL(file);
  };
  fileIn.click();
}
