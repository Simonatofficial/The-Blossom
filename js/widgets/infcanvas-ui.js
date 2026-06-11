/* Infinite Canvas UI (docs/12 §7, §9): Kleki-style tool strip with per-tool
   options flyout (size, opacity, stabilizer, tool specifics + a live stroke
   preview), the layer panel, fullscreen + hide-toolbar controls. The active
   tool is unmistakable — filled accent + glow — and one-hand reachable. */

import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, openDrawer, promptText, popMenu } from '../ui/components.js';
import { BLEND_MODES, hexA } from './infcanvas-raster.js';

const TOOLS = [
  ['pan', 'move', 'Pan'],
  ['pen', 'pen', 'Pen brush (B)'],
  ['sketchy', 'scribble', 'Sketchy brush'],
  ['blend', 'droplet', 'Blend brush'],
  ['pixel', 'grid', 'Pixel brush'],
  ['eraser', 'eraser', 'Eraser (E)'],
  ['eyedropper', 'eyedropper', 'Eyedropper (I)'],
  ['fill', 'bucket', 'Fill (G)'],
  ['gradient', 'gradient', 'Gradient'],
  ['shape', 'shapes', 'Shapes (L)'],
  ['select', 'lasso', 'Select (S)'],
  ['text', 'type', 'Text (T)']
];
const TOOL_NAME = Object.fromEntries(TOOLS.map(([t, , l]) => [t, l.replace(/ \(.+\)$/, '')]));
const BRUSHES = ['pen', 'sketchy', 'blend', 'pixel', 'eraser'];

/**
 * @param {object} state mutable tool state (tool, color, size, opacity, …)
 * @param {object} act   actions from the widget glue
 * @returns {{el, tab, chip, refresh, closeFlyout}}
 */
export function buildToolbar(state, act) {
  const strip = el('<div class="ic-strip"></div>');
  let flyout = null;
  const closeFlyout = () => { flyout?.remove(); flyout = null; };

  const toolBtns = {};
  for (const [tool, ic, label] of TOOLS) {
    const b = el(`<button class="ic-btn" title="${label}">${icon(ic, 17)}</button>`);
    b.onclick = () => {
      if (state.tool === tool && tool !== 'pan') { flyout ? closeFlyout() : openFlyout(b, tool); return; }
      closeFlyout();
      act.setTool(tool);
      refresh();
    };
    toolBtns[tool] = b;
    strip.appendChild(b);
  }
  strip.appendChild(el('<span class="ic-gap"></span>'));

  const colorDot = el('<button class="ic-btn" title="Colors (X swaps last two)"><span class="ic-dot"></span></button>');
  colorDot.onclick = (e) => { closeFlyout(); act.openColors(e.currentTarget); }; // popover (CR-11)
  strip.appendChild(colorDot);

  const undoBtn = el(`<button class="ic-btn" title="Undo (Ctrl+Z · two-finger tap)">${icon('rotate-ccw', 16)}</button>`);
  undoBtn.onclick = act.undo;
  const redoBtn = el(`<button class="ic-btn" title="Redo (Ctrl+Y · three-finger tap)">${icon('refresh', 16)}</button>`);
  redoBtn.onclick = act.redo;
  strip.append(undoBtn, redoBtn);

  const layersBtn = el(`<button class="ic-btn" title="Layers">${icon('layers', 16)}</button>`);
  layersBtn.onclick = () => { closeFlyout(); act.openLayers(); };
  strip.appendChild(layersBtn);
  strip.appendChild(el('<span class="ic-gap"></span>'));

  // focus page toggle (CR-11: a route, not OS fullscreen)
  const fsBtn = el(`<button class="ic-btn" title="Focus page">${icon('expand', 16)}</button>`);
  fsBtn.onclick = () => { closeFlyout(); act.toggleFocus(); };
  strip.appendChild(fsBtn);
  if (act.isFocus?.()) {
    // optional edge-to-edge browser fullscreen, secondary, focus page only
    const bfs = el(`<button class="ic-btn" title="Edge-to-edge (browser fullscreen)">${icon('monitor', 16)}</button>`);
    bfs.onclick = () => { closeFlyout(); act.toggleBrowserFs(); };
    strip.appendChild(bfs);
  }
  for (const [ic, title, fn] of [
    ['maximize', 'Fit everything', act.fitAll],
    ['star', 'Bookmarks', (e) => act.bookmarks(e)],
    ['download', 'Export snapshot', act.exportPng]
  ]) {
    const b = el(`<button class="ic-btn" title="${title}">${icon(ic, 16)}</button>`);
    b.onclick = (e) => { closeFlyout(); fn(e); };
    strip.appendChild(b);
  }

  // collapse tab: rides the strip's edge; doubles as the reveal handle (§1)
  const tab = el(`<button class="ic-hide-tab" title="Hide toolbar">${icon('chevron-left', 14)}</button>`);
  tab.onclick = () => act.toggleToolbar();

  // at-a-glance status chip: tool name + live stroke preview (§9 bug fix)
  const chip = el('<div class="ic-toolchip"><canvas width="120" height="30"></canvas><span></span></div>');

  /* ---------- per-tool options flyout ---------- */

  function openFlyout(anchor, tool) {
    closeFlyout();
    flyout = el('<div class="ic-flyout panel"></div>');

    const head = el(`<div class="ic-fhead"><strong>${TOOL_NAME[tool]}</strong><canvas width="132" height="34"></canvas></div>`);
    flyout.appendChild(head);
    const pv = head.querySelector('canvas');
    const repaint = () => { if (BRUSHES.includes(tool)) drawStrokePreview(pv, { ...state, tool }); else pv.style.display = 'none'; };
    repaint();

    const row = (label, input) => {
      const r = el(`<div class="ic-frow"><span>${label}</span></div>`);
      r.appendChild(input);
      flyout.appendChild(r);
      return input;
    };
    const slider = (label, key, min, max, step, fmt = null) => {
      const s = row(label, el(`<input type="range" class="range" min="${min}" max="${max}" step="${step}" style="width:150px">`));
      s.value = state[key];
      s.oninput = () => { state[key] = Number(s.value); act.stateChanged(); repaint(); };
      return s;
    };
    const segRow = (label, key, opts, onSet = null) => {
      const wrap = el('<span class="seg ic-fseg"></span>');
      for (const [val, lab] of opts) {
        const b = el(`<button type="button">${lab}</button>`);
        if (state[key] === val) b.classList.add('active');
        b.onclick = () => {
          wrap.querySelectorAll('button').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          state[key] = val;
          act.stateChanged();
          onSet?.(val);
        };
        wrap.appendChild(b);
      }
      row(label, wrap);
    };

    if (BRUSHES.includes(tool) || tool === 'shape') {
      // size: slider 1–200 plus a typed value with NO upper limit (docs/12 §5)
      const sizeWrap = el('<span class="row" style="gap:6px"></span>');
      const sl = el('<input type="range" class="range" min="1" max="200" step="1" style="width:100px">');
      const num = el('<input class="input" type="number" min="0.1" step="any" style="width:72px;padding:4px 8px">');
      sl.value = Math.min(200, state.size);
      num.value = state.size;
      sl.oninput = () => { state.size = Number(sl.value); num.value = sl.value; sizeNote(); act.stateChanged(); repaint(); };
      num.onchange = () => { state.size = Math.max(0.1, Number(num.value) || 1); sl.value = Math.min(200, state.size); sizeNote(); act.stateChanged(); repaint(); };
      sizeWrap.append(sl, num);
      row('Size', sizeWrap);
      const note = el('<div class="soft" style="font-size:0.72rem;margin:-4px 0 8px"></div>');
      flyout.appendChild(note);
      const sizeNote = () => {
        const onScreen = state.screenScaled ? state.size : state.size * act.scale();
        note.textContent = `${state.size} px · ≈${onScreen >= 10 ? Math.round(onScreen) : onScreen.toPrecision(2)} on screen`;
      };
      sizeNote();
    }

    if (tool !== 'select' && tool !== 'text' && tool !== 'eyedropper') {
      slider('Opacity', 'opacity', 0.05, 1, 0.05);
    }
    if (tool === 'pen' || tool === 'eraser') slider('Hardness', 'hardness', 0.05, 1, 0.05);
    if (tool === 'blend') slider('Strength', 'strength', 0.1, 1, 0.05);
    if (tool === 'sketchy') slider('Web density', 'strength', 0.1, 1, 0.05);
    if (BRUSHES.includes(tool)) slider('Stabilizer', 'stabilizer', 0, 5, 1);
    if (tool === 'eraser') segRow('Mode', 'eraserPixel', [[false, 'Soft'], [true, 'Pixel']]);

    if (tool === 'fill') {
      slider('Tolerance', 'fillTol', 0, 128, 1);
      slider('Grow', 'fillGrow', 0, 8, 1);
      segRow('Fill reach', 'fillReach', [[0, 'Off'], [0.5, '½ view'], [1, '1× view']]);
    }
    if (tool === 'gradient') {
      segRow('Type', 'gradType', [['linear', 'Linear'], ['radial', 'Radial']]);
      segRow('Fade to', 'gradTo', [['transparent', 'Clear'], ['color', 'Color']]);
      const c2 = row('End color', el('<input type="color" class="ic-wheel" style="width:44px;height:32px">'));
      c2.value = state.color2 || '#ffffff';
      c2.oninput = () => { state.color2 = c2.value; act.stateChanged(); };
    }
    if (tool === 'shape') {
      segRow('Shape', 'shape', [['line', 'Line'], ['rect', 'Rect'], ['ellipse', 'Ellipse']]);
      segRow('Style', 'shapeFill', [[false, 'Outline'], [true, 'Filled']]);
    }
    if (tool === 'select') {
      segRow('Mode', 'selectMode', [['rect', 'Rectangle'], ['lasso', 'Lasso']], (v) => act.select.setMode(v));
      const actions = el('<div class="row" style="flex-wrap:wrap;gap:4px;margin-top:4px"></div>');
      const sBtn = (ic, title, fn, needsSel = true) => {
        const b = el(`<button class="btn-icon" title="${title}" style="border:1px solid var(--border)">${icon(ic, 15)}</button>`);
        b.disabled = needsSel ? !act.select.active() : !act.select.hasClipboard();
        b.onclick = () => { fn(); closeFlyout(); };
        actions.appendChild(b);
      };
      sBtn('copy', 'Copy', () => act.select.copy());
      sBtn('download', 'Paste', () => act.select.paste(), false);
      sBtn('plus', 'Duplicate', () => act.select.duplicate());
      sBtn('flip-h', 'Flip horizontal', () => act.select.flip('h'));
      sBtn('flip-v', 'Flip vertical', () => act.select.flip('v'));
      sBtn('trash', 'Delete selection', () => act.select.del());
      sBtn('x', 'Deselect', () => act.select.deselect());
      flyout.appendChild(actions);
    }
    if (tool === 'text') {
      flyout.appendChild(el('<p class="soft" style="font-size:0.78rem;margin:4px 0">Tap the canvas to place a text box. Tap a box to move or restyle it; double-tap to edit — forever.</p>'));
    }
    if (tool === 'eyedropper') {
      flyout.appendChild(el('<p class="soft" style="font-size:0.78rem;margin:4px 0">Tap the canvas to pick a color. Long-press inside any brush does the same.</p>'));
    }

    if (BRUSHES.includes(tool)) {
      const ws = row('Brush scale', el('<button class="btn" style="padding:4px 12px;font-size:0.8rem"></button>'));
      const wsLabel = () => { ws.textContent = state.screenScaled ? 'Screen-scaled' : 'World-scaled'; };
      wsLabel();
      ws.onclick = () => { state.screenScaled = !state.screenScaled; wsLabel(); act.stateChanged(); };
    }

    strip.parentElement.appendChild(flyout);
    const r = anchor.getBoundingClientRect();
    const host = strip.parentElement.getBoundingClientRect();
    flyout.style.left = `${r.right - host.left + 8}px`;
    flyout.style.top = `${Math.max(4, Math.min(r.top - host.top, host.height - 320))}px`;
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
    function away(ev) {
      if (!flyout?.contains(ev.target)) {
        closeFlyout();
        document.removeEventListener('pointerdown', away, true);
      }
    }
  }

  function refresh() {
    for (const [tool] of TOOLS) toolBtns[tool].classList.toggle('on', state.tool === tool);
    colorDot.querySelector('.ic-dot').style.background = state.color;
    undoBtn.disabled = !act.canUndo();
    redoBtn.disabled = !act.canRedo();
    fsBtn.innerHTML = icon(act.isFocus?.() ? 'shrink' : 'expand', 16);
    fsBtn.title = act.isFocus?.() ? 'Exit focus (back)' : 'Focus page';
    chip.querySelector('span').textContent =
      `${TOOL_NAME[state.tool] || state.tool} · ${state.size}px · ${Math.round(state.opacity * 100)}%`;
    const pvc = chip.querySelector('canvas');
    if (BRUSHES.includes(state.tool)) {
      pvc.style.display = '';
      drawStrokePreview(pvc, state);
    } else pvc.style.display = 'none';
  }
  refresh();
  return { el: strip, tab, chip, refresh, closeFlyout };
}

/** Live stroke preview: same dab math as the raster core, mini scale (§9). */
export function drawStrokePreview(canvas, state) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const size = Math.min(18, Math.max(2, state.size));
  const pts = [];
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    pts.push([6 + t * (W - 12), H / 2 + Math.sin(t * Math.PI * 2) * H * 0.22, Math.sin(t * Math.PI)]);
  }
  if (state.tool === 'eraser') {
    g.fillStyle = 'rgba(127,127,127,0.45)';
    g.fillRect(2, H * 0.25, W - 4, H * 0.5);
    g.globalCompositeOperation = 'destination-out';
  }
  if (state.tool === 'pixel' || (state.tool === 'eraser' && state.eraserPixel)) {
    g.fillStyle = state.color;
    g.globalAlpha = state.opacity;
    const n = Math.max(2, Math.round(size / 2));
    for (let i = 0; i < pts.length; i += 3) {
      g.fillRect(Math.round(pts[i][0] - n / 2), Math.round(pts[i][1] - n / 2), n, n);
    }
  } else if (state.tool === 'sketchy') {
    g.strokeStyle = state.color;
    g.lineWidth = 1.2;
    g.globalAlpha = state.opacity;
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.stroke();
    g.globalAlpha = 0.22 * state.opacity;
    for (let i = 4; i < pts.length - 4; i += 5) {
      g.beginPath();
      g.moveTo(pts[i][0], pts[i][1]);
      g.lineTo(pts[i - 4][0], pts[i - 4][1] + 6);
      g.stroke();
    }
  } else {
    for (const [x, y, p] of pts) {
      const pr = Math.max(0.6, size / 2 * (0.35 + p * (state.tool === 'blend' ? 0.5 : 0.65)));
      const grad = g.createRadialGradient(x, y, 0, x, y, pr);
      const hard = state.tool === 'blend' ? 0.1 : (state.hardness ?? 0.85);
      const col = state.tool === 'eraser' ? '#000' : state.color;
      grad.addColorStop(0, col);
      grad.addColorStop(Math.min(0.99, hard), col);
      grad.addColorStop(1, state.tool === 'eraser' ? 'rgba(0,0,0,0)' : hexA(col, 0));
      g.globalAlpha = (state.opacity ?? 1) * (state.tool === 'blend' ? 0.4 : 0.5 + p * 0.5);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, pr, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/* ---------- layer panel (docs/12 §7) — opens per CR-1 placement ---------- */

export function openLayerPanel(doc, onChange) {
  const d = openDrawer({ title: 'Layers', iconName: 'layers' });
  const render = () => {
    d.body.innerHTML = '';
    const list = [...doc.meta.layers].reverse(); // top of list = front-most
    for (const layer of list) {
      const row = el(`<div class="list-item ${layer.id === doc.meta.active ? 'ic-active-layer' : ''}" style="cursor:pointer;flex-wrap:wrap">
        <button class="btn-icon l-eye" title="Visibility">${icon(layer.visible ? 'eye' : 'circle', 15)}</button>
        <span class="li-main"><span class="li-title"></span></span>
        <button class="btn-icon l-up" title="Raise">${icon('chevron-up', 14)}</button>
        <button class="btn-icon l-down" title="Lower">${icon('chevron-down', 14)}</button>
        <button class="btn-icon l-menu" title="More">${icon('more', 14)}</button>
        <div class="row" style="width:100%;gap:8px;margin-top:4px">
          <input type="range" class="range l-op" min="0" max="1" step="0.05" style="flex:1" title="Opacity">
          <select class="select l-blend" style="width:110px;padding:4px 8px;font-size:0.8rem"></select>
        </div></div>`);
      row.querySelector('.li-title').textContent = layer.name;
      const opIn = row.querySelector('.l-op');
      opIn.value = layer.opacity ?? 1;
      opIn.onchange = () => { layer.opacity = Number(opIn.value); onChange(); };
      const blendSel = row.querySelector('.l-blend');
      for (const m of BLEND_MODES) blendSel.appendChild(new Option(m, m));
      blendSel.value = layer.blend || 'normal';
      blendSel.onchange = () => { layer.blend = blendSel.value; onChange(); };
      row.onclick = (e) => {
        if (e.target.closest('button, input, select')) return;
        doc.meta.active = layer.id;
        onChange();
        render();
      };
      row.querySelector('.l-eye').onclick = () => { layer.visible = !layer.visible; onChange(); render(); };
      row.querySelector('.l-up').onclick = () => { doc.moveLayer(layer.id, +1); onChange(); render(); };
      row.querySelector('.l-down').onclick = () => { doc.moveLayer(layer.id, -1); onChange(); render(); };
      row.querySelector('.l-menu').onclick = (e) => {
        popMenu(e.currentTarget, [
          { label: 'Rename', iconName: 'edit', fn: async () => {
            const name = await promptText({ title: 'Rename layer', value: layer.name });
            if (name) { layer.name = name; onChange(); render(); }
          } },
          { label: 'Duplicate', iconName: 'copy', fn: () => {
            if (!doc.duplicateLayer(layer.id)) toast('Sixteen layers is the garden wall.', 'info');
            onChange();
            render();
          } },
          { label: 'Merge down', iconName: 'layers', fn: async () => {
            if (await doc.mergeDown(layer.id)) { onChange(); render(); }
            else toast('Nothing below to merge into.', 'info');
          } },
          { label: 'Clear', iconName: 'x', fn: async () => { await doc.clearLayer(layer.id); onChange(); render(); } },
          'sep',
          { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
            if (doc.meta.layers.length <= 1) { toast('The last layer stays.', 'info'); return; }
            if (await confirmDialog({ title: `Delete “${layer.name}”?`, message: 'Undo can bring it back this session.' })) {
              doc.deleteLayer(layer.id);
              onChange();
              render();
            }
          } }
        ]);
      };
      d.body.appendChild(row);
    }
    const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add layer (${doc.meta.layers.length}/16)</button>`);
    add.onclick = () => { if (doc.addLayer()) { onChange(); render(); } };
    d.body.appendChild(add);
  };
  render();
}
