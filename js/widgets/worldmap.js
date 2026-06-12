/* WorldMap widget (docs/08 §5 Atlas, CR-14): the Infinite Canvas engine
   carrying map layers — terrain pattern brushes painted into raster tiles,
   feature stamps (built-in glyphs + My Stamps, placeable or scatter-painted),
   rich text-box labels (curve + zoom-band visibility), and fully
   customizable pins. Opens in POINTER mode: tap to select and edit;
   painting is opt-in. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, openPopover } from '../ui/components.js';
import { objectsOf, createObject } from './base.js';
import { InfiniteSurface } from './infcanvas-engine.js';
import { RasterDoc } from './infcanvas-raster.js';
import { openEntry } from './wb-shared.js';
import { allStamps, getStamp, drawStampAt, stampImageEl, openStampPicker, openStampManager } from './wb-stamps.js';
import { GLYPHS, drawFeature, PointerCtl, MapTextLayer } from './worldmap-objects.js';
import { pinPresets, pinFromPreset, drawPin, openPinEditor } from './worldmap-pins.js';

/* ---------- seamless terrain patterns (64px, deterministic) ---------- */

const TERRAINS = {
  ocean: { base: '#2e5f8a', deco: '#3d76a6', name: 'Ocean' },
  coast: { base: '#7ba7c2', deco: '#e8d9b0', name: 'Coast' },
  plains: { base: '#9dba6e', deco: '#88a85c', name: 'Plains' },
  forest: { base: '#4f7a4a', deco: '#3c6138', name: 'Forest' },
  mountain: { base: '#8b8680', deco: '#6e6a64', name: 'Mountain' },
  desert: { base: '#d9c08a', deco: '#c4a96d', name: 'Desert' },
  tundra: { base: '#cfd8d7', deco: '#b3c2c4', name: 'Tundra' },
  swamp: { base: '#5d6b4a', deco: '#46543a', name: 'Swamp' }
};

const patternCache = new Map();
function terrainPattern(key) {
  if (patternCache.has(key)) return patternCache.get(key);
  const t = TERRAINS[key];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = t.base;
  g.fillRect(0, 0, 64, 64);
  let seed = [...key].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  g.fillStyle = t.deco;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 64, y = rnd() * 64, r = 1 + rnd() * 2.4;
    for (const dx of [-64, 0, 64]) {
      for (const dy of [-64, 0, 64]) {
        g.beginPath();
        if (key === 'ocean' || key === 'coast') g.ellipse(x + dx, y + dy, r * 2.4, r * 0.5, 0, 0, Math.PI * 2);
        else if (key === 'mountain') { g.moveTo(x + dx - r * 2, y + dy + r); g.lineTo(x + dx, y + dy - r * 2); g.lineTo(x + dx + r * 2, y + dy + r); g.closePath(); }
        else g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  patternCache.set(key, c);
  return c;
}

const TOOLS = [
  ['pointer', 'move', 'Pointer — select & edit (default)'],
  ['terrain', 'map', 'Terrain brush'],
  ['erase', 'eraser', 'Erase paint'],
  ['stamp', 'home', 'Feature stamps'],
  ['label', 'type', 'Labels'],
  ['pin', 'flag', 'Pins']
];

const mapDocs = new Map();

function openDoc(widget) {
  let entry = mapDocs.get(widget.id);
  if (entry) return entry;
  const tileIndex = new Map();
  for (const o of objectsOf(widget.id, 'rtile')) tileIndex.set(o.data.key, o);
  widget.config.raster = widget.config.raster || { layers: [], active: null };
  entry = { hooks: {} };
  entry.doc = new RasterDoc(widget.config.raster, {
    loadTile: (key) => tileIndex.get(key)?.data.blob || null,
    saveTile: (key, blob) => {
      let o = tileIndex.get(key);
      if (!blob) { if (o) { store.del('objects', o.id); tileIndex.delete(key); } return; }
      if (o) { o.data.blob = blob; store.put('objects', o); }
      else { o = createObject(widget.id, 'rtile', { key, blob }); tileIndex.set(key, o); }
    },
    tileKeys: () => [...tileIndex.keys()],
    onTilesDecoded: () => entry.hooks.decoded?.(),
    onMetaChange: () => store.put('widgets', widget)
  });
  mapDocs.set(widget.id, entry);
  return entry;
}

/** Old plain labels become rich text boxes once (CR-14 §2). */
function migrateLabels(widget, doc) {
  for (const o of objectsOf(widget.id, 'mlabel')) {
    const size = o.data.size;
    const w = Math.max(size * 2, (o.data.text || '').length * size * 0.62);
    createObject(widget.id, 'tbox', {
      layerId: doc.active().id,
      x: o.data.x - w / 2, y: o.data.y - size * 0.8, w, size,
      color: '#f4efe6', align: 'center', html: o.data.text || '',
      vis: { min: 9, max: 110 }
    });
    store.del('objects', o.id);
  }
}

registry.register({
  type: 'worldmap',
  name: 'World Map',
  icon: 'map',
  description: 'Paint terrain, stamp features, pin your world together',
  keywords: ['world', 'map', 'atlas', 'terrain', 'pins', 'stamps'],
  external: true, internal: true,
  defaultConfig: () => ({
    view: { cx: 0, cy: 0, zoomExp: 0 }, raster: { layers: [], active: null },
    terrain: 'plains', brushSize: 80,
    stampSel: { glyph: 'mountain' }, stampMode: 'place',
    scatter: { density: 0.5, jitter: 0.5, rot: 0.5 },
    pinPresetId: 'p-town'
  }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const { doc } = openDoc(widget);
    const canvas = el('<canvas style="width:100%;height:130px;border-radius:10px;background:#2e5f8a"></canvas>');
    canvas.width = 600;
    canvas.height = 220;
    host.appendChild(canvas);
    const surf = new InfiniteSurface(canvas, { drawTile: (g, b, r) => doc.compose(g, r.x0, r.y0, r.x1, r.y1, b) });
    surf.view = { ...widget.config.view };
    surf.render();
    const pins = objectsOf(widget.id, 'pin').length;
    host.appendChild(el(`<div class="soft" style="font-size:0.78rem;margin-top:6px;text-align:center">${pins} pin${pins === 1 ? '' : 's'} · tap to explore</div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const entry = openDoc(widget);
    const doc = entry.doc;
    doc.session = null; doc.batch = null; doc.mask = null;
    const cfg = widget.config;
    cfg.stampSel = cfg.stampSel || { glyph: 'mountain' };
    cfg.scatter = cfg.scatter || { density: 0.5, jitter: 0.5, rot: 0.5 };
    const state = { tool: 'pointer' }; // the map opens for USING, not painting

    const wrap = el('<div class="ic-wrap"></div>');
    const box = el('<div class="ic-canvasbox"></div>');
    const canvas = el('<canvas class="ic-surface" style="background:#2e5f8a"></canvas>');
    const readout = el('<span class="chip ic-readout">×1</span>');
    box.append(canvas, readout);
    wrap.appendChild(box);
    host.appendChild(wrap);

    const dpr = Math.min(2, devicePixelRatio || 1);
    const cssW = Math.max(300, (host.clientWidth || 720) - 62);
    const cssH = Math.min(Math.max(300, innerHeight - 210), Math.round(cssW * 0.75));
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const accent = () => getComputedStyle(box).getPropertyValue('--accent').trim() || '#d8697f';
    const stamps = () => objectsOf(widget.id, 'stamp');
    const pins = () => objectsOf(widget.id, 'pin');

    /* ---- terrain / scatter painting into raster tiles ---- */
    let strokeLast = null;

    const paintSeg = (xa, ya, xb, yb) => {
      const r = cfg.brushSize / 2;
      const rect = { x0: Math.min(xa, xb) - r, y0: Math.min(ya, yb) - r, x1: Math.max(xa, xb) + r, y1: Math.max(ya, yb) + r };
      const erase = state.tool === 'erase';
      doc.rasterOp(rect, surf.band(), (g) => {
        if (erase) g.globalCompositeOperation = 'destination-out';
        const style = erase ? '#000' : g.createPattern(terrainPattern(cfg.terrain), 'repeat');
        g.fillStyle = style;
        g.beginPath();
        g.arc(xa, ya, r, 0, Math.PI * 2);
        g.arc(xb, yb, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = style;
        g.lineWidth = r * 2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(xa, ya);
        g.lineTo(xb, yb);
        g.stroke();
      }, { erase });
      surf.invalidate(rect);
      surf.render();
    };

    /** Scatter mode (CR-14 §1): rasterize jittered stamps along the drag. */
    let scatterCarry = 0;
    const scatterSeg = (xa, ya, xb, yb) => {
      const stamp = cfg.stampSel.stampId ? getStamp(cfg.stampSel.stampId) : null;
      if (cfg.stampSel.stampId && !stamp) return;
      const wSize = (stamp ? stamp.size : 48) / surf.scale();
      const sc = cfg.scatter;
      const spacing = Math.max(wSize * 0.2, wSize * (2.4 - sc.density * 2.2));
      const dist = Math.hypot(xb - xa, yb - ya) || 0.0001;
      const drops = [];
      let pos = scatterCarry === 0 && strokeLast === null ? 0 : spacing - scatterCarry;
      if (pos === 0) pos = 0.0001;
      while (pos <= dist) {
        const t = pos / dist;
        const jx = (Math.random() - 0.5) * 2 * sc.jitter * wSize;
        const jy = (Math.random() - 0.5) * 2 * sc.jitter * wSize;
        drops.push({
          x: xa + (xb - xa) * t + jx, y: ya + (yb - ya) * t + jy,
          rot: (Math.random() - 0.5) * 2 * sc.rot * Math.PI,
          k: 0.7 + Math.random() * 0.6
        });
        pos += spacing;
      }
      scatterCarry = dist - (pos - spacing);
      if (!drops.length) return;
      const pad = wSize;
      const rect = {
        x0: Math.min(...drops.map(d => d.x)) - pad, y0: Math.min(...drops.map(d => d.y)) - pad,
        x1: Math.max(...drops.map(d => d.x)) + pad, y1: Math.max(...drops.map(d => d.y)) + pad
      };
      const col = accent();
      doc.rasterOp(rect, surf.band(), (g) => {
        for (const d of drops) {
          g.save();
          g.translate(d.x, d.y);
          g.rotate(d.rot);
          if (stamp) drawStampAt(g, stamp, wSize * d.k, col);
          else GLYPHS[cfg.stampSel.glyph]?.(g, wSize * d.k / 2);
          g.restore();
        }
      });
      surf.invalidate(rect);
      surf.render();
    };

    /** Pin clusters at the current zoom. */
    const pinBuckets = () => {
      const buckets = new Map();
      for (const p of pins()) {
        const [sx, sy] = surf.toScreen(p.data.x, p.data.y);
        if (sx < -60 || sy < -60 || sx > canvas.width + 60 || sy > canvas.height + 60) continue;
        const key = `${Math.round(sx / 96)}:${Math.round(sy / 96)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ p, sx, sy });
      }
      return [...buckets.values()];
    };

    const clusterAt = (px, py) => {
      for (const bucket of pinBuckets()) {
        if (bucket.length < 2) continue;
        const cx = bucket.reduce((n, b) => n + b.sx, 0) / bucket.length;
        const cy = bucket.reduce((n, b) => n + b.sy, 0) / bucket.length;
        if (Math.hypot(px - cx, py - cy) < 22) return [cx, cy];
      }
      return null;
    };

    const clustered = () => {
      const ids = new Set();
      for (const bucket of pinBuckets()) {
        if (bucket.length > 1) for (const b of bucket) ids.add(b.p.id);
      }
      return ids;
    };

    const surf = new InfiniteSurface(canvas, {
      drawTile: (g, b, r) => doc.compose(g, r.x0, r.y0, r.x1, r.y1, b),
      isPan: () => state.tool === 'pan',
      onViewChange: (v) => {
        cfg.view = { cx: v.cx, cy: v.cy, zoomExp: v.zoomExp };
        store.put('widgets', widget);
        readout.textContent = surf.scale() >= 1 ? `×${surf.scale().toFixed(1)}` : `×${surf.scale().toPrecision(2)}`;
        text.sync();
        text.positionBar();
        ptr.positionBar();
      },

      toolDown: (wx, wy, p, e) => {
        const [px, py] = surf.screenPt(e);
        downPt = [px, py];
        if (state.tool === 'pointer') {
          const cl = clusterAt(px, py);
          if (cl) { surf.zoomAt(cl[0], cl[1], 1.4); return; }
          ptr.down(wx, wy, px, py);
          surf.render();
          return;
        }
        if (state.tool === 'terrain' || state.tool === 'erase') {
          doc.beginBatch();
          strokeLast = [wx, wy];
          paintSeg(wx, wy, wx, wy);
          return;
        }
        if (state.tool === 'stamp' && cfg.stampMode === 'scatter') {
          doc.beginBatch();
          scatterCarry = 0;
          strokeLast = null;
          scatterSeg(wx, wy, wx + 0.0001, wy);
          strokeLast = [wx, wy];
        }
      },
      toolMove: (wx, wy, p, e) => {
        if (state.tool === 'pointer') { ptr.move(wx, wy, ...surf.screenPt(e)); return; }
        if (!strokeLast) return;
        if (state.tool === 'stamp') scatterSeg(strokeLast[0], strokeLast[1], wx, wy);
        else paintSeg(strokeLast[0], strokeLast[1], wx, wy);
        strokeLast = [wx, wy];
      },
      toolUp: (wx, wy, e) => {
        if (state.tool === 'pointer') { ptr.up(); return; }
        if (strokeLast) {
          strokeLast = null;
          doc.endBatch();
          doc.flush();
          refresh();
          return;
        }
        const [px, py] = surf.screenPt(e);
        if (!downPt || Math.hypot(px - downPt[0], py - downPt[1]) > 8) return; // placements are taps
        if (state.tool === 'stamp') {
          createObject(widget.id, 'stamp', {
            x: wx, y: wy, size: (cfg.stampSel.stampId ? (getStamp(cfg.stampSel.stampId)?.size || 56) : 56) / surf.scale(),
            ...(cfg.stampSel.stampId ? { stampId: cfg.stampSel.stampId } : { glyph: cfg.stampSel.glyph })
          });
          surf.render();
          return;
        }
        if (state.tool === 'label') { text.createAt(wx, wy); return; }
        if (state.tool === 'pin') {
          const preset = pinPresets().find(pr => pr.id === cfg.pinPresetId) || pinPresets()[0];
          const o = createObject(widget.id, 'pin', pinFromPreset(preset, wx, wy, surf.view.zoomExp));
          surf.render();
          ptr.select(o); // chrome + action bar — Edit is one tap away
        }
      },
      drawOverlay: (g) => {
        const col = accent();
        for (const o of stamps()) drawFeature(g, surf, o, col);
        text.drawCurved(g);
        const inCluster = clustered();
        for (const bucket of pinBuckets()) {
          if (bucket.length > 1) {
            const cx = bucket.reduce((n, b) => n + b.sx, 0) / bucket.length;
            const cy = bucket.reduce((n, b) => n + b.sy, 0) / bucket.length;
            g.save();
            g.beginPath();
            g.arc(cx, cy, 14, 0, Math.PI * 2);
            g.fillStyle = 'rgba(216,105,127,0.92)';
            g.fill();
            g.fillStyle = '#fff';
            g.font = '600 12px system-ui';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(String(bucket.length), cx, cy);
            g.restore();
          }
        }
        for (const o of pins()) {
          if (inCluster.has(o.id)) continue;
          drawPin(g, surf, o, { hover: ptr.hover === o, selected: ptr.sel === o });
        }
        ptr.drawOverlay(g);
      }
    }, { ...cfg.view });

    let downPt = null;

    /* ---- pointer controller + text layer ---- */
    const ptr = new PointerCtl({
      surf, widget, box,
      stamps, pins,
      editPin: (o) => openPinEditor(widget, o, {
        onChange: () => { surf.render(); ptr.positionBar(); },
        onDelete: () => { store.del('objects', o.id); ptr.deselect(); surf.render(); }
      }),
      openRef: (o) => openEntry(o.data.ref, ctx),
      onChange: () => surf.render()
    });

    if (!cfg.labelsMigrated) {
      migrateLabels(widget, doc);
      cfg.labelsMigrated = true;
      store.put('widgets', widget);
    }
    const text = new MapTextLayer(box, surf, doc, widget, () => ({ color: '#f4efe6' }));
    text.setToolActive(true); // boxes are selectable in pointer + label modes

    // hover highlight (desktop): a soft ring before you commit to a tap
    canvas.addEventListener('pointermove', (e) => {
      if (state.tool !== 'pointer' || e.buttons) return;
      ptr.setHover(...surf.screenPt(e));
    });
    const onKey = (e) => {
      if (!canvas.isConnected) { document.removeEventListener('keydown', onKey, true); return; }
      if (e.key === 'Escape' && (ptr.sel || text.sel)) {
        e.stopPropagation();
        ptr.deselect();
        text.select(null);
        surf.render();
      }
    };
    document.addEventListener('keydown', onKey, true);

    /* ---- toolbar ---- */
    const strip = el('<div class="ic-strip"></div>');
    const btns = {};
    for (const [tool, ic, label] of TOOLS) {
      const b = el(`<button class="ic-btn" title="${label}">${icon(ic, 17)}</button>`);
      b.onclick = (e) => {
        if (state.tool === tool && ['terrain', 'stamp', 'pin'].includes(tool)) return toolOptions(tool, e.currentTarget);
        state.tool = tool;
        if (tool !== 'pointer') ptr.deselect();
        text.setToolActive(tool === 'pointer' || tool === 'label');
        refresh();
        surf.render();
      };
      btns[tool] = b;
      strip.appendChild(b);
    }
    strip.appendChild(el('<span class="ic-gap"></span>'));
    const undoB = el(`<button class="ic-btn" title="Undo paint">${icon('rotate-ccw', 16)}</button>`);
    undoB.onclick = () => { if (doc.undo()) { surf.invalidate(); surf.render(); text.sync(); doc.flush(); refresh(); } };
    const redoB = el(`<button class="ic-btn" title="Redo paint">${icon('refresh', 16)}</button>`);
    redoB.onclick = () => { if (doc.redo()) { surf.invalidate(); surf.render(); text.sync(); doc.flush(); refresh(); } };
    const stampsB = el(`<button class="ic-btn" title="My Stamps">${icon('sparkles', 16)}</button>`);
    stampsB.onclick = () => openStampManager();
    const fitB = el(`<button class="ic-btn" title="Fit everything">${icon('maximize', 16)}</button>`);
    fitB.onclick = () => {
      let bb = null;
      const grow = (x, y) => {
        bb = bb ? { x0: Math.min(bb.x0, x), y0: Math.min(bb.y0, y), x1: Math.max(bb.x1, x), y1: Math.max(bb.y1, y) } : { x0: x, y0: y, x1: x, y1: y };
      };
      for (const o of [...stamps(), ...pins(), ...text.boxes()]) grow(o.data.x, o.data.y);
      for (const key of doc.io.tileKeys()) {
        const [, b, tx, ty] = key.split(':');
        const ts = 512 / Math.pow(2, Number(b));
        grow(tx * ts, ty * ts);
        grow((Number(tx) + 1) * ts, (Number(ty) + 1) * ts);
      }
      if (bb) surf.fitTo({ x0: bb.x0 - 100, y0: bb.y0 - 100, x1: bb.x1 + 100, y1: bb.y1 + 100 });
    };
    strip.append(undoB, redoB, stampsB, fitB);
    wrap.prepend(strip);

    function toolOptions(tool, anchor) {
      if (tool === 'pin') {
        const pop = openPopover(anchor, { title: 'New pins use…', width: 250 });
        const rowEl = el('<div class="row" style="flex-wrap:wrap;gap:4px"></div>');
        for (const p of pinPresets()) {
          const b = el(`<button class="chip${cfg.pinPresetId === p.id ? ' accent' : ''}"><span class="ic-dot" style="width:10px;height:10px;background:${p.color}"></span> ${p.name}</button>`);
          b.onclick = () => { cfg.pinPresetId = p.id; store.put('widgets', widget); pop.close(); };
          rowEl.appendChild(b);
        }
        pop.body.appendChild(rowEl);
        pop.body.appendChild(el('<p class="soft" style="font-size:0.74rem;margin:8px 0 0">Tap the map to place a pin, then Edit on its toolbar for color, symbol, name, and links.</p>'));
        return;
      }
      const pop = openPopover(anchor, { title: tool === 'terrain' ? 'Terrain' : 'Stamps', width: 270 });
      if (tool === 'terrain') {
        const grid = el('<div class="ic-swatches"></div>');
        for (const [key, t] of Object.entries(TERRAINS)) {
          const b = el(`<button class="ic-swatch" title="${t.name}" style="background:${t.base}"></button>`);
          if (cfg.terrain === key) b.classList.add('on');
          b.onclick = () => { cfg.terrain = key; store.put('widgets', widget); pop.close(); };
          grid.appendChild(b);
        }
        pop.body.appendChild(grid);
        const size = el('<div class="ic-frow" style="margin-top:10px"><span>Size</span><input type="range" class="range" min="10" max="400" style="width:130px"></div>');
        const slider = size.querySelector('input');
        slider.value = cfg.brushSize;
        slider.oninput = () => { cfg.brushSize = Number(slider.value); store.put('widgets', widget); };
        pop.body.appendChild(size);
        return;
      }
      // stamp tool: built-ins + My Stamps, place vs scatter, scatter sliders
      const save = () => store.put('widgets', widget);
      const grid = el('<div class="row" style="flex-wrap:wrap;gap:6px;max-height:170px;overflow:auto"></div>');
      for (const key of Object.keys(GLYPHS)) {
        const b = el(`<button class="ic-btn" title="${key}" style="width:46px;height:46px;border:1px solid var(--border)"><canvas width="34" height="34"></canvas></button>`);
        const g = b.querySelector('canvas').getContext('2d');
        g.translate(17, 19);
        GLYPHS[key](g, 12);
        if (!cfg.stampSel.stampId && cfg.stampSel.glyph === key) b.classList.add('on');
        b.onclick = () => { cfg.stampSel = { glyph: key }; save(); pop.close(); };
        grid.appendChild(b);
      }
      for (const s of allStamps()) {
        const b = el(`<button class="ic-btn" title="${s.name}" style="width:46px;height:46px;border:1px solid var(--border)"><img alt="" style="max-width:34px;max-height:34px"></button>`);
        b.querySelector('img').src = s.img;
        stampImageEl(s); // pre-warm the decode for scatter strokes
        if (cfg.stampSel.stampId === s.id) b.classList.add('on');
        b.onclick = () => { cfg.stampSel = { stampId: s.id }; save(); pop.close(); };
        grid.appendChild(b);
      }
      pop.body.appendChild(grid);
      const more = el(`<div class="row" style="gap:6px;margin:8px 0"><button class="btn" style="font-size:0.78rem;padding:3px 9px">${icon('plus', 12)} My Stamps…</button></div>`);
      more.querySelector('button').onclick = (e) => openStampPicker(e.currentTarget, {
        onPick: (s) => { cfg.stampSel = { stampId: s.id }; save(); pop.close(); }
      });
      pop.body.appendChild(more);
      const modeRow = el('<div class="ic-frow"><span>Mode</span><span class="seg ic-fseg"></span></div>');
      for (const [v, label] of [['place', 'Place'], ['scatter', 'Scatter paint']]) {
        const b = el(`<button type="button"${cfg.stampMode === v ? ' class="active"' : ''}>${label}</button>`);
        b.onclick = () => {
          cfg.stampMode = v;
          save();
          modeRow.querySelectorAll('button').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          sliders.style.display = v === 'scatter' ? '' : 'none';
        };
        modeRow.querySelector('.seg').appendChild(b);
      }
      pop.body.appendChild(modeRow);
      const sliders = el('<div></div>');
      sliders.style.display = cfg.stampMode === 'scatter' ? '' : 'none';
      for (const [key, label] of [['density', 'Density'], ['jitter', 'Jitter'], ['rot', 'Rotation']]) {
        const row = el(`<div class="ic-frow"><span>${label}</span><input type="range" class="range" min="0" max="1" step="0.05" style="width:120px"></div>`);
        const sl = row.querySelector('input');
        sl.value = cfg.scatter[key];
        sl.oninput = () => { cfg.scatter[key] = Number(sl.value); save(); };
        sliders.appendChild(row);
      }
      pop.body.appendChild(sliders);
    }

    function refresh() {
      for (const [tool] of TOOLS) btns[tool].classList.toggle('on', state.tool === tool);
      undoB.disabled = !doc.history.length;
      redoB.disabled = !doc.redoStack.length;
    }
    entry.hooks.decoded = () => { surf.invalidate(); surf.render(); };
    refresh();
    surf.render();
    text.sync();
    // stamp images and pin-symbol icons decode async — settle one frame later
    for (const o of [...stamps(), ...pins()]) {
      const sid = o.data.stampId || (o.data.sym?.t === 'stamp' && o.data.sym.v);
      const s = sid && getStamp(sid);
      if (s) {
        const im = stampImageEl(s);
        if (!im.complete) im.addEventListener('load', () => surf.render(), { once: true });
      }
    }
    setTimeout(() => { if (canvas.isConnected) surf.render(); }, 200);
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">The map opens in pointer mode — tap anything to select, move, resize, or edit it. Tap the active terrain, stamp, or pin tool again for its options. Stamps come from the shared My Stamps library; pins can link lore, civilizations, characters, or other maps.</p>'));
  }
});
