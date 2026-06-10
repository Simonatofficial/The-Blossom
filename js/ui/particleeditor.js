/* Custom particle editor (docs/03): live preview on top, collapsible control
   groups below. Custom definitions live in the themes store (type 'particle'). */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { ulid } from '../core/ids.js';
import { loop } from '../fx/loop.js';
import { icon } from './icons.js';
import { el, field, input, seg, openDrawer, toast, promptText } from './components.js';
import { Layer, SPRITE_NAMES } from '../fx/particles.js';
import { PRESET_PARTICLES } from '../presets/particles.js';

export function openParticleEditor(existingId = null, onSaved = null) {
  const existing = existingId && store.get('themes', existingId);
  const def = structuredClone(existing?.def || PRESET_PARTICLES[4]); // start from cherry blossoms
  def.color = def.color || '#f5b8c4';
  let name = existing?.name || 'My particles';

  const d = openDrawer({ title: 'Particle editor', iconName: 'sparkles' });

  // live preview region running the definition in isolation
  const previewCanvas = el('<canvas style="width:100%;height:150px;border-radius:12px;background:rgba(0,0,0,0.18)"></canvas>');
  d.body.appendChild(previewCanvas);
  previewCanvas.width = 360;
  previewCanvas.height = 150;
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

  // shape
  const shapeWrap = el('<div></div>');
  const renderShape = () => {
    shapeWrap.innerHTML = '';
    shapeWrap.appendChild(field('Shape', seg(
      [{ value: 'sprite', label: 'Sprite' }, { value: 'char', label: 'Text' }, { value: 'emoji', label: 'Emoji' }],
      def.shape.kind, (v) => { def.shape.kind = v; if (v === 'sprite' && !SPRITE_NAMES.includes(def.shape.value)) def.shape.value = 'petal'; renderShape(); rebuild(); })));
    if (def.shape.kind === 'sprite') {
      const sel = el('<select class="select"></select>');
      for (const s of SPRITE_NAMES) sel.appendChild(new Option(s, s));
      sel.value = def.shape.value;
      sel.onchange = () => { def.shape.value = sel.value; rebuild(); };
      shapeWrap.appendChild(field('Sprite', sel));
    } else {
      const vIn = input(def.shape.value || '', def.shape.kind === 'emoji' ? '❀' : '*');
      vIn.addEventListener('change', () => { def.shape.value = vIn.value || '✦'; rebuild(); });
      shapeWrap.appendChild(field(def.shape.kind === 'emoji' ? 'Emoji' : 'Characters', vIn));
    }
    const colorIn = el('<input type="color" class="input" style="height:38px;padding:3px">');
    if (/^#([0-9a-f]{6})$/i.test(def.color)) colorIn.value = def.color;
    colorIn.oninput = () => { def.color = colorIn.value; rebuild(); };
    shapeWrap.appendChild(field('Color', colorIn));
  };
  renderShape();
  d.body.appendChild(shapeWrap);

  // behavior + effects
  const behaviorSel = el('<select class="select"></select>');
  for (const b of ['fallDown', 'floatUp', 'flowLeft', 'flowRight', 'flowDiagonal', 'drift', 'random', 'orbit', 'bounce']) {
    behaviorSel.appendChild(new Option(b, b));
  }
  behaviorSel.value = def.behavior;
  behaviorSel.onchange = () => { def.behavior = behaviorSel.value; rebuild(); };
  d.body.appendChild(field('Behavior', behaviorSel));

  const fxRow = el('<div class="row" style="flex-wrap:wrap;margin-bottom:14px"></div>');
  for (const e of ['twinkle', 'grow', 'shrink']) {
    const chip = el(`<button class="chip ${def.effects?.includes(e) ? 'accent' : ''}" style="cursor:pointer">${e}</button>`);
    chip.onclick = () => {
      def.effects = def.effects || [];
      def.effects.includes(e) ? def.effects.splice(def.effects.indexOf(e), 1) : def.effects.push(e);
      chip.classList.toggle('accent');
      rebuild();
    };
    fxRow.appendChild(chip);
  }
  d.body.appendChild(field('Effects', fxRow));

  // sliders
  const slider = (label, get, set, min, max, step) => {
    const s = el(`<input type="range" class="range" min="${min}" max="${max}" step="${step}">`);
    s.value = get();
    s.oninput = () => { set(Number(s.value)); rebuild(); };
    d.body.appendChild(field(label, s));
  };
  slider('Speed', () => def.speed || 1, v => def.speed = v, 0.1, 8, 0.1);
  slider('Size', () => def.size || 16, v => def.size = v, 4, 60, 1);
  slider('Size variation', () => def.sizeVar || 0.3, v => def.sizeVar = v, 0, 1, 0.05);
  slider('Count', () => def.maxCount || 40, v => def.maxCount = v, 4, 150, 2);
  slider('Sway', () => def.rotation?.sway || 0, v => (def.rotation = def.rotation || {}).sway = v, 0, 1.5, 0.05);
  slider('Spin', () => def.rotation?.spin || 0, v => (def.rotation = def.rotation || {}).spin = v, 0, 1.5, 0.05);

  const areaSel = el('<select class="select"></select>');
  for (const a of ['random', 'top', 'bottom', 'left', 'right', 'center']) areaSel.appendChild(new Option(a, a));
  areaSel.value = def.spawn?.area || 'random';
  areaSel.onchange = () => { (def.spawn = def.spawn || {}).area = areaSel.value; rebuild(); };
  d.body.appendChild(field('Spawn from', areaSel));

  const save = el(`<button class="btn btn-primary" style="width:100%">${icon('save', 15)} Save particles</button>`);
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
