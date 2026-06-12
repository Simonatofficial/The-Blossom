/* WorldMap pins (CR-14): fully customizable POIs — per-pin color, symbol
   (SVG icon · emoji · any My Stamp), size, name + label visibility, link,
   notes — plus reusable pin presets (a varied default set, and user presets
   stored as type:'pinpreset' records so they ride Blossom codes). */

import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon, iconNames } from '../ui/icons.js';
import { el, toast, openPanel, openPopover, input, seg } from '../ui/components.js';
import { saveObject } from './base.js';
import { openEntryPicker, resolveEntry } from './wb-shared.js';
import { getStamp, drawStampAt, openStampPicker } from './wb-stamps.js';

export const PIN_COLORS = ['#d8697f', '#e0a23c', '#7fae7f', '#5f8fc0', '#9a7fd1', '#c75d4f', '#4fa3a5', '#8a8076'];

/** The varied out-of-the-box set — pins should never feel limiting. */
export const DEFAULT_PRESETS = [
  { id: 'p-capital', name: 'Capital', color: '#e0a23c', sym: { t: 'icon', v: 'star' }, size: 30, labelVis: 'always' },
  { id: 'p-town', name: 'Town', color: '#d8697f', sym: { t: 'icon', v: 'home' }, size: 24, labelVis: 'zoom' },
  { id: 'p-dungeon', name: 'Dungeon', color: '#9a7fd1', sym: { t: 'icon', v: 'key' }, size: 24, labelVis: 'hover' },
  { id: 'p-nature', name: 'Wilds', color: '#7fae7f', sym: { t: 'icon', v: 'leaf' }, size: 22, labelVis: 'hover' },
  { id: 'p-port', name: 'Port', color: '#5f8fc0', sym: { t: 'icon', v: 'waves' }, size: 24, labelVis: 'zoom' },
  { id: 'p-quest', name: 'Quest', color: '#c75d4f', sym: { t: 'icon', v: 'flag' }, size: 26, labelVis: 'always' }
];

export function pinPresets() {
  return [...DEFAULT_PRESETS, ...store.all('themes').filter(t => t.type === 'pinpreset')];
}

export function savePinPreset(pin, name) {
  const rec = store.put('themes', {
    id: ulid(), type: 'pinpreset', name,
    color: pin.color, sym: structuredClone(pin.sym), size: pin.size, labelVis: pin.labelVis
  });
  toast('Pin style saved', 'flag');
  return rec;
}

/** Fresh pin data at a world point from a preset (or the first default). */
export function pinFromPreset(preset, wx, wy, zoomExp) {
  const p = preset || DEFAULT_PRESETS[0];
  return {
    x: wx, y: wy, ref: null, note: '', name: '',
    color: p.color, sym: structuredClone(p.sym), size: p.size,
    labelVis: p.labelVis || 'zoom', zoomRef: zoomExp
  };
}

/* ---------- canvas rendering ---------- */

const iconImgs = new Map(); // `${name}:${color}` -> Image
function iconImage(name, color) {
  const key = `${name}:${color}`;
  let im = iconImgs.get(key);
  if (!im) {
    const svg = icon(name, 48).replace(/currentColor/g, color);
    im = new Image();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    iconImgs.set(key, im);
  }
  return im;
}

/** Whether a pin's name renders right now. */
export function pinLabelVisible(pin, surf, hover) {
  if (!pin.name) return false;
  if (pin.labelVis === 'always') return true;
  if (pin.labelVis === 'hover') return hover;
  return surf.view.zoomExp >= (pin.zoomRef ?? 0) - 1.2; // 'zoom': near its home band and in
}

/**
 * Draw one pin at its screen point. The teardrop scales with data.size
 * (screen px — pins read the same at every zoom, like map UI should).
 */
export function drawPin(g, surf, o, { hover = false, selected = false } = {}) {
  const pin = o.data;
  const [sx, sy] = surf.toScreen(pin.x, pin.y);
  const s = pin.size || 24;
  const r = s / 2;
  g.save();
  g.translate(sx, sy);
  if (hover || selected) {
    g.beginPath();
    g.arc(0, -s * 0.62, r + 5, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 2;
    g.stroke();
  }
  // teardrop body
  g.beginPath();
  g.arc(0, -s * 0.62, r, Math.PI * 0.78, Math.PI * 0.22);
  g.lineTo(0, 0);
  g.closePath();
  g.fillStyle = pin.color || '#d8697f';
  g.shadowColor = 'rgba(0,0,0,0.3)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 1;
  g.fill();
  g.shadowColor = 'transparent';
  // symbol in the head
  const sym = pin.sym || { t: 'icon', v: 'flag' };
  const inner = r * 1.15;
  if (sym.t === 'emoji') {
    g.font = `${Math.round(inner)}px system-ui`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(sym.v, 0, -s * 0.62);
  } else if (sym.t === 'stamp') {
    const stamp = getStamp(sym.v);
    if (stamp) {
      g.save();
      g.translate(0, -s * 0.62);
      drawStampAt(g, stamp, inner, pin.color);
      g.restore();
    }
  } else {
    const im = iconImage(sym.v || 'flag', '#ffffff');
    if (im.complete && im.naturalWidth) g.drawImage(im, -inner / 2, -s * 0.62 - inner / 2, inner, inner);
  }
  // name label
  if (pinLabelVisible(pin, surf, hover || selected)) {
    g.font = `600 ${Math.max(11, s * 0.46)}px system-ui`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(20,24,30,0.6)';
    g.fillStyle = '#f4efe6';
    g.strokeText(pin.name, 0, 4);
    g.fillText(pin.name, 0, 4);
  }
  g.restore();
}

/* ---------- editor (a Panel: everything about one pin) ---------- */

/**
 * @param {object} widget the map widget
 * @param {object} o the pin object record
 * @param {{onChange: () => void, onDelete: () => void}} hooks
 */
export function openPinEditor(widget, o, { onChange, onDelete }) {
  const pin = o.data;
  const d = openPanel({ title: 'Pin', iconName: 'flag' });
  const save = () => { saveObject(o); onChange(); };

  // preset quick-apply + save-as-preset
  const presetRow = el('<div class="row" style="flex-wrap:wrap;gap:4px;margin-bottom:10px"></div>');
  for (const p of pinPresets()) {
    const b = el(`<button class="chip" title="Apply style"><span class="ic-dot" style="width:10px;height:10px;background:${p.color}"></span> ${p.name}</button>`);
    b.onclick = () => {
      Object.assign(pin, { color: p.color, sym: structuredClone(p.sym), size: p.size, labelVis: p.labelVis });
      save();
      render();
    };
    presetRow.appendChild(b);
  }
  const saveP = el(`<button class="chip accent">${icon('plus', 11)} Save style…</button>`);
  saveP.onclick = async () => {
    const { promptText } = await import('../ui/components.js');
    const name = await promptText({ title: 'Save pin style', label: 'Style name', value: pin.name || 'My pin' });
    if (name) savePinPreset(pin, name);
  };
  presetRow.appendChild(saveP);
  d.body.appendChild(presetRow);

  const body = el('<div></div>');
  d.body.appendChild(body);

  const render = () => {
    body.innerHTML = '';
    const row = (label, control) => {
      const r = el(`<div class="ic-frow" style="margin:8px 0"><span style="min-width:74px">${label}</span></div>`);
      r.appendChild(control);
      body.appendChild(r);
      return control;
    };

    const nameIn = input(pin.name || '', 'Name this place');
    nameIn.onchange = () => { pin.name = nameIn.value.trim(); save(); };
    row('Name', nameIn);

    // color: swatches + wheel
    const colors = el('<span class="row" style="gap:4px;flex-wrap:wrap"></span>');
    for (const c of PIN_COLORS) {
      const b = el(`<button class="ic-swatch${pin.color === c ? ' on' : ''}" style="background:${c};width:24px;height:24px"></button>`);
      b.onclick = () => { pin.color = c; save(); render(); };
      colors.appendChild(b);
    }
    const wheel = el(`<input type="color" class="ic-wheel" style="width:32px;height:26px" value="${pin.color || '#d8697f'}">`);
    wheel.oninput = () => { pin.color = wheel.value; save(); };
    colors.appendChild(wheel);
    row('Color', colors);

    // symbol: icon / emoji / stamp
    const symRow = el('<span class="row" style="gap:6px;flex-wrap:wrap"></span>');
    const iconBtn = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px">${icon(pin.sym?.t === 'icon' ? pin.sym.v : 'flag', 14)} Icon</button>`);
    iconBtn.onclick = (e) => {
      const pop = openPopover(e.currentTarget, { title: 'Pick an icon', width: 264 });
      const grid = el('<div class="row" style="flex-wrap:wrap;gap:4px;max-height:220px;overflow:auto"></div>');
      for (const n of iconNames()) {
        const b = el(`<button class="btn-icon" title="${n}">${icon(n, 16)}</button>`);
        b.onclick = () => { pin.sym = { t: 'icon', v: n }; pop.close(); save(); render(); };
        grid.appendChild(b);
      }
      pop.body.appendChild(grid);
    };
    const emojiIn = el('<input class="input" style="width:64px;text-align:center" placeholder="🐉">');
    if (pin.sym?.t === 'emoji') emojiIn.value = pin.sym.v;
    emojiIn.onchange = () => {
      const v = emojiIn.value.trim();
      if (v) { pin.sym = { t: 'emoji', v: [...v][0] }; save(); render(); }
    };
    const stampBtn = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px">${icon('sparkles', 14)} Stamp</button>`);
    stampBtn.onclick = (e) => openStampPicker(e.currentTarget, {
      title: 'Pin symbol',
      onPick: (s) => { pin.sym = { t: 'stamp', v: s.id }; save(); render(); }
    });
    symRow.append(iconBtn, emojiIn, stampBtn);
    row('Symbol', symRow);

    const sizeSeg = seg([
      { value: 18, label: 'S' }, { value: 26, label: 'M' }, { value: 36, label: 'L' }
    ], [18, 26, 36].includes(pin.size) ? pin.size : null, (v) => { pin.size = v; sizeNum.value = v; save(); });
    const sizeWrap = el('<span class="row" style="gap:6px"></span>');
    const sizeNum = el(`<input class="input" type="number" min="10" max="120" style="width:64px;padding:4px 8px" value="${pin.size || 24}">`);
    sizeNum.onchange = () => { pin.size = Math.max(10, Math.min(120, Number(sizeNum.value) || 24)); save(); };
    sizeWrap.append(sizeSeg, sizeNum);
    row('Size', sizeWrap);

    row('Show name', seg([
      { value: 'always', label: 'Always' }, { value: 'hover', label: 'On tap' }, { value: 'zoom', label: 'By zoom' }
    ], pin.labelVis || 'zoom', (v) => { pin.labelVis = v; if (v === 'zoom') pin.zoomRef = pin.zoomRef ?? 0; save(); }));

    // link target
    const entry = resolveEntry(pin.ref);
    const linkRow = el('<span class="row" style="gap:6px;flex-wrap:wrap"></span>');
    const linkBtn = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px">${icon('link', 13)} <span></span></button>`);
    linkBtn.querySelector('span').textContent = entry ? entry.label : 'Link an entry…';
    linkBtn.onclick = () => openEntryPicker(widget, { title: 'Pin links to…', onPick: (en) => {
      pin.ref = { kind: en.kind, id: en.id };
      if (!pin.name) pin.name = en.label;
      save();
      openPinEditor(widget, o, { onChange, onDelete }); // panel was replaced by the picker
    } });
    linkRow.appendChild(linkBtn);
    if (entry) {
      const un = el(`<button class="btn-icon" title="Unlink">${icon('x', 13)}</button>`);
      un.onclick = () => { pin.ref = null; save(); render(); };
      linkRow.appendChild(un);
    }
    row('Links to', linkRow);

    const noteIn = el('<textarea class="input" rows="2" placeholder="Notes about this place…" style="width:100%;margin-top:4px"></textarea>');
    noteIn.value = pin.note || '';
    noteIn.onchange = () => { pin.note = noteIn.value; save(); };
    body.appendChild(noteIn);

    const danger = el(`<button class="btn" style="margin-top:12px;color:var(--warn)">${icon('trash', 14)} Remove pin</button>`);
    danger.onclick = () => { d.close(); onDelete(); };
    body.appendChild(danger);
  };
  render();
}
