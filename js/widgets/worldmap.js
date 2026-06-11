/* WorldMap widget (docs/08 §5 Atlas): the Infinite Canvas engine carrying
   map-specific layers — seamless terrain pattern brushes painted into raster
   tiles, feature stamps, labels with natural zoom-band visibility (big names
   show far out, small names close up), and pins linking to Lore/Civs/
   Characters/other maps. Pins cluster at low zoom. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, openPopover, promptText, popMenu } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { InfiniteSurface } from './infcanvas-engine.js';
import { RasterDoc } from './infcanvas-raster.js';
import { openEntryPicker, openEntry, resolveEntry } from './wb-shared.js';

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
  // deterministic speckle, drawn wrapped so tiles join seamlessly
  let seed = [...key].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  g.fillStyle = t.deco;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 64, y = rnd() * 64, r = 1 + rnd() * 2.4;
    for (const dx of [-64, 0, 64]) {
      for (const dy of [-64, 0, 64]) {
        g.beginPath();
        if (key === 'ocean' || key === 'coast') {
          g.ellipse(x + dx, y + dy, r * 2.4, r * 0.5, 0, 0, Math.PI * 2);
        } else if (key === 'mountain') {
          g.moveTo(x + dx - r * 2, y + dy + r);
          g.lineTo(x + dx, y + dy - r * 2);
          g.lineTo(x + dx + r * 2, y + dy + r);
          g.closePath();
        } else {
          g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        }
        g.fill();
      }
    }
  }
  patternCache.set(key, c);
  return c;
}

/* ---------- feature stamps (small vector glyphs) ---------- */

const STAMPS = {
  mountain: (g, s) => { g.beginPath(); g.moveTo(-s, s * 0.6); g.lineTo(0, -s * 0.8); g.lineTo(s, s * 0.6); g.closePath(); g.fillStyle = '#6e6a64'; g.fill(); g.beginPath(); g.moveTo(-s * 0.25, -s * 0.25); g.lineTo(0, -s * 0.8); g.lineTo(s * 0.25, -s * 0.25); g.closePath(); g.fillStyle = '#e8e6e2'; g.fill(); },
  trees: (g, s) => { g.fillStyle = '#3c6138'; for (const [dx, dy, k] of [[-0.5, 0.3, 0.7], [0.45, 0.15, 0.85], [0, -0.3, 1]]) { g.beginPath(); g.moveTo(dx * s - s * 0.45 * k, dy * s + s * 0.5 * k); g.lineTo(dx * s, dy * s - s * 0.7 * k); g.lineTo(dx * s + s * 0.45 * k, dy * s + s * 0.5 * k); g.closePath(); g.fill(); } },
  city: (g, s) => { g.fillStyle = '#9b8d76'; g.fillRect(-s * 0.8, -s * 0.3, s * 0.5, s * 0.9); g.fillRect(-s * 0.2, -s * 0.7, s * 0.45, s * 1.3); g.fillRect(s * 0.35, -s * 0.1, s * 0.45, s * 0.7); g.fillStyle = '#5d564a'; g.fillRect(-s * 0.2, -s * 0.7, s * 0.45, s * 0.2); },
  tower: (g, s) => { g.fillStyle = '#8b8680'; g.fillRect(-s * 0.22, -s * 0.8, s * 0.44, s * 1.5); g.beginPath(); g.moveTo(-s * 0.35, -s * 0.8); g.lineTo(0, -s * 1.15); g.lineTo(s * 0.35, -s * 0.8); g.closePath(); g.fillStyle = '#7a4a44'; g.fill(); },
  port: (g, s) => { g.strokeStyle = '#5d564a'; g.lineWidth = s * 0.18; g.beginPath(); g.arc(0, -s * 0.1, s * 0.55, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); g.beginPath(); g.moveTo(0, -s * 0.75); g.lineTo(0, s * 0.45); g.stroke(); g.beginPath(); g.arc(0, -s * 0.75, s * 0.16, 0, Math.PI * 2); g.stroke(); },
  village: (g, s) => { g.fillStyle = '#a8906a'; g.fillRect(-s * 0.55, -s * 0.05, s * 1.1, s * 0.6); g.beginPath(); g.moveTo(-s * 0.7, -s * 0.05); g.lineTo(0, -s * 0.65); g.lineTo(s * 0.7, -s * 0.05); g.closePath(); g.fillStyle = '#7a4a44'; g.fill(); }
};

const TOOLS = [
  ['pan', 'move', 'Pan'],
  ['terrain', 'map', 'Terrain brush'],
  ['erase', 'eraser', 'Erase terrain'],
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

registry.register({
  type: 'worldmap',
  name: 'World Map',
  icon: 'map',
  description: 'Paint terrain, stamp features, pin your world together',
  keywords: ['world', 'map', 'atlas', 'terrain', 'pins'],
  external: true, internal: true,
  defaultConfig: () => ({ view: { cx: 0, cy: 0, zoomExp: 0 }, raster: { layers: [], active: null }, terrain: 'plains', brushSize: 80, stampGlyph: 'mountain' }),

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
    const state = { tool: 'pan' };

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

    let strokePts = null;

    const paintSeg = (xa, ya, xb, yb) => {
      const r = cfg.brushSize / 2;
      const rect = { x0: Math.min(xa, xb) - r, y0: Math.min(ya, yb) - r, x1: Math.max(xa, xb) + r, y1: Math.max(ya, yb) + r };
      const erase = state.tool === 'erase';
      doc.rasterOp(rect, surf.band(), (g) => {
        if (erase) g.globalCompositeOperation = 'destination-out';
        else g.fillStyle = g.createPattern(terrainPattern(cfg.terrain), 'repeat');
        g.beginPath();
        g.arc(xa, ya, r, 0, Math.PI * 2);
        g.arc(xb, yb, r, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = r * 2;
        g.lineCap = 'round';
        if (!erase) g.strokeStyle = g.fillStyle;
        else g.strokeStyle = '#000';
        g.beginPath();
        g.moveTo(xa, ya);
        g.lineTo(xb, yb);
        g.stroke();
      }, { erase });
      surf.invalidate(rect);
      surf.render();
    };

    const stamps = () => objectsOf(widget.id, 'stamp');
    const labels = () => objectsOf(widget.id, 'mlabel');
    const pins = () => objectsOf(widget.id, 'pin');

    /** Pin clusters at the current zoom (48px screen buckets). */
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

    const surf = new InfiniteSurface(canvas, {
      drawTile: (g, b, r) => doc.compose(g, r.x0, r.y0, r.x1, r.y1, b),
      isPan: () => state.tool === 'pan',
      onViewChange: (v) => {
        cfg.view = { cx: v.cx, cy: v.cy, zoomExp: v.zoomExp };
        store.put('widgets', widget);
        readout.textContent = surf.scale() >= 1 ? `×${surf.scale().toFixed(1)}` : `×${surf.scale().toPrecision(2)}`;
      },
      toolDown: (wx, wy) => {
        if (state.tool === 'terrain' || state.tool === 'erase') {
          doc.beginBatch();
          strokePts = [wx, wy];
          paintSeg(wx, wy, wx, wy);
        }
      },
      toolMove: (wx, wy) => {
        if (strokePts) {
          paintSeg(strokePts[0], strokePts[1], wx, wy);
          strokePts = [wx, wy];
        }
      },
      toolUp: async (wx, wy, e) => {
        if (strokePts) {
          strokePts = null;
          doc.endBatch();
          doc.flush();
          refresh();
          return;
        }
        const [px, py] = surf.screenPt(e);
        if (state.tool === 'stamp') return tapStamp(wx, wy, px, py, e);
        if (state.tool === 'label') return tapLabel(wx, wy, px, py, e);
        if (state.tool === 'pin') return tapPin(wx, wy, px, py, e);
        if (state.tool === 'pan') return tapPanPin(px, py, e); // pins are tappable while panning
      },
      drawOverlay: (g) => {
        const scale = surf.scale();
        // stamps: world-anchored glyphs, drawn at screen size, culled politely
        for (const o of stamps()) {
          const [sx, sy] = surf.toScreen(o.data.x, o.data.y);
          const s = o.data.size * scale;
          if (s < 3 || s > 600 || sx < -s || sy < -s || sx > canvas.width + s || sy > canvas.height + s) continue;
          g.save();
          g.translate(sx, sy);
          STAMPS[o.data.glyph]?.(g, s / 2);
          g.restore();
        }
        // labels: visible only when their world size reads comfortably —
        // continent names appear far out, village names close in (docs/08)
        for (const o of labels()) {
          const px = o.data.size * scale;
          if (px < 9 || px > 110) continue;
          const [sx, sy] = surf.toScreen(o.data.x, o.data.y);
          g.save();
          g.font = `600 ${px}px system-ui`;
          g.textAlign = 'center';
          g.lineWidth = Math.max(2, px / 7);
          g.strokeStyle = 'rgba(20,24,30,0.55)';
          g.fillStyle = '#f4efe6';
          g.strokeText(o.data.text, sx, sy);
          g.fillText(o.data.text, sx, sy);
          g.restore();
        }
        // pins, clustered at low zoom
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
          } else {
            const { sx, sy } = bucket[0];
            g.save();
            g.translate(sx, sy);
            g.beginPath(); // teardrop
            g.arc(0, -12, 8, Math.PI * 0.85, Math.PI * 0.15);
            g.lineTo(0, 2);
            g.closePath();
            g.fillStyle = 'rgba(216,105,127,0.95)';
            g.fill();
            g.beginPath();
            g.arc(0, -12, 3.4, 0, Math.PI * 2);
            g.fillStyle = '#fff';
            g.fill();
            g.restore();
          }
        }
      }
    }, { ...cfg.view });

    /* ---- tool taps ---- */
    function hitObj(list, px, py, radius = 24) {
      let best = null, bd = radius;
      for (const o of list) {
        const [sx, sy] = surf.toScreen(o.data.x, o.data.y);
        const d = Math.hypot(px - sx, py - sy + (o.kind === 'pin' ? 10 : 0));
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }

    function tapStamp(wx, wy, px, py, e) {
      const hit = hitObj(stamps(), px, py);
      if (hit) {
        return popMenu({ getBoundingClientRect: () => pointRect(e) }, [
          { label: 'Bigger', iconName: 'plus', fn: () => { hit.data.size *= 1.4; saveObject(hit); surf.render(); } },
          { label: 'Smaller', iconName: 'minus', fn: () => { hit.data.size /= 1.4; saveObject(hit); surf.render(); } },
          { label: 'Remove', iconName: 'trash', danger: true, fn: () => { store.del('objects', hit.id); surf.render(); } }
        ]);
      }
      createObject(widget.id, 'stamp', { x: wx, y: wy, size: 56 / surf.scale(), glyph: cfg.stampGlyph });
      surf.render();
    }

    async function tapLabel(wx, wy, px, py, e) {
      const hit = hitObj(labels(), px, py, 30);
      if (hit) {
        return popMenu({ getBoundingClientRect: () => pointRect(e) }, [
          { label: 'Rename', iconName: 'edit', fn: async () => {
            const t = await promptText({ title: 'Label', value: hit.data.text });
            if (t) { hit.data.text = t; saveObject(hit); surf.render(); }
          } },
          { label: 'Bigger', iconName: 'plus', fn: () => { hit.data.size *= 1.4; saveObject(hit); surf.render(); } },
          { label: 'Smaller', iconName: 'minus', fn: () => { hit.data.size /= 1.4; saveObject(hit); surf.render(); } },
          { label: 'Remove', iconName: 'trash', danger: true, fn: () => { store.del('objects', hit.id); surf.render(); } }
        ]);
      }
      const text = await promptText({ title: 'New label', label: 'Name this place' });
      if (!text) return;
      createObject(widget.id, 'mlabel', { x: wx, y: wy, text, size: 22 / surf.scale() });
      surf.render();
    }

    function pinPopover(pin, e) {
      const entry2 = resolveEntry(pin.data.ref);
      const pop = openPopover({ getBoundingClientRect: () => pointRect(e) }, { title: entry2 ? entry2.kind : 'Pin', width: 240 });
      pop.body.appendChild(el('<p style="font-weight:600"></p>')).textContent = entry2?.label || pin.data.note || 'Unlinked pin';
      const row = el('<div class="row" style="gap:6px;margin-top:8px"></div>');
      if (entry2) {
        const open = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px">${icon('arrow-right', 13)} Open</button>`);
        open.onclick = () => { pop.close(); openEntry(pin.data.ref, ctx); };
        row.appendChild(open);
      }
      const del = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px;color:var(--warn)">${icon('trash', 13)} Remove</button>`);
      del.onclick = () => { store.del('objects', pin.id); pop.close(); surf.render(); };
      row.appendChild(del);
      pop.body.appendChild(row);
    }

    function tapPin(wx, wy, px, py, e) {
      const hit = hitObj(pins(), px, py);
      if (hit) return pinPopover(hit, e);
      popMenu({ getBoundingClientRect: () => pointRect(e) }, [
        { label: 'Link an entry…', iconName: 'link', fn: () => openEntryPicker(widget, { title: 'Pin what?', onPick: (en) => {
          createObject(widget.id, 'pin', { x: wx, y: wy, ref: { kind: en.kind, id: en.id }, note: '' });
          surf.render();
          toast('Pinned to the map', 'flag');
        } }) },
        { label: 'Free note pin', iconName: 'note', fn: async () => {
          const note = await promptText({ title: 'Pin note', label: 'What’s here?' });
          if (!note) return;
          createObject(widget.id, 'pin', { x: wx, y: wy, ref: null, note });
          surf.render();
        } }
      ]);
    }

    function tapPanPin(px, py, e) {
      // panning still lets you tap pins/clusters (the Milanote half)
      const buckets = pinBuckets();
      for (const bucket of buckets) {
        const cx = bucket.reduce((n, b) => n + b.sx, 0) / bucket.length;
        const cy = bucket.reduce((n, b) => n + b.sy, 0) / bucket.length;
        if (Math.hypot(px - cx, py - cy + (bucket.length === 1 ? 10 : 0)) > 22) continue;
        if (bucket.length === 1) return pinPopover(bucket[0].p, e);
        surf.zoomAt(cx, cy, 1.4); // dive into the cluster
        return;
      }
    }

    function pointRect(e) {
      return { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 };
    }

    /* ---- toolbar (compact strip, popover flyouts per CR-11) ---- */
    const strip = el('<div class="ic-strip"></div>');
    const btns = {};
    for (const [tool, ic, label] of TOOLS) {
      const b = el(`<button class="ic-btn" title="${label}">${icon(ic, 17)}</button>`);
      b.onclick = (e) => {
        if (state.tool === tool && (tool === 'terrain' || tool === 'stamp')) return toolOptions(tool, e.currentTarget);
        state.tool = tool;
        refresh();
      };
      btns[tool] = b;
      strip.appendChild(b);
    }
    strip.appendChild(el('<span class="ic-gap"></span>'));
    const undoB = el(`<button class="ic-btn" title="Undo terrain">${icon('rotate-ccw', 16)}</button>`);
    undoB.onclick = () => { if (doc.undo()) { surf.invalidate(); surf.render(); doc.flush(); refresh(); } };
    const redoB = el(`<button class="ic-btn" title="Redo terrain">${icon('refresh', 16)}</button>`);
    redoB.onclick = () => { if (doc.redo()) { surf.invalidate(); surf.render(); doc.flush(); refresh(); } };
    const fitB = el(`<button class="ic-btn" title="Fit everything">${icon('maximize', 16)}</button>`);
    fitB.onclick = () => {
      const all = [...stamps(), ...labels(), ...pins()];
      if (!all.length && !doc.io.tileKeys().length) return;
      let bb = null;
      for (const o of all) {
        bb = bb ? { x0: Math.min(bb.x0, o.data.x), y0: Math.min(bb.y0, o.data.y), x1: Math.max(bb.x1, o.data.x), y1: Math.max(bb.y1, o.data.y) } : { x0: o.data.x, y0: o.data.y, x1: o.data.x, y1: o.data.y };
      }
      for (const key of doc.io.tileKeys()) {
        const [, b, tx, ty] = key.split(':');
        const ts = 512 / Math.pow(2, Number(b));
        const r = { x0: tx * ts, y0: ty * ts, x1: (Number(tx) + 1) * ts, y1: (Number(ty) + 1) * ts };
        bb = bb ? { x0: Math.min(bb.x0, r.x0), y0: Math.min(bb.y0, r.y0), x1: Math.max(bb.x1, r.x1), y1: Math.max(bb.y1, r.y1) } : r;
      }
      if (bb) surf.fitTo({ x0: bb.x0 - 100, y0: bb.y0 - 100, x1: bb.x1 + 100, y1: bb.y1 + 100 });
    };
    strip.append(undoB, redoB, fitB);
    wrap.prepend(strip);

    function toolOptions(tool, anchor) {
      const pop = openPopover(anchor, { title: tool === 'terrain' ? 'Terrain' : 'Stamps', width: 250 });
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
      } else {
        const grid = el('<div class="row" style="flex-wrap:wrap;gap:6px"></div>');
        for (const key of Object.keys(STAMPS)) {
          const b = el(`<button class="ic-btn" title="${key}" style="width:48px;height:48px;border:1px solid var(--border)"><canvas width="36" height="36"></canvas></button>`);
          const g = b.querySelector('canvas').getContext('2d');
          g.translate(18, 20);
          STAMPS[key](g, 13);
          if (cfg.stampGlyph === key) b.classList.add('on');
          b.onclick = () => { cfg.stampGlyph = key; store.put('widgets', widget); pop.close(); };
          grid.appendChild(b);
        }
        pop.body.appendChild(grid);
      }
    }

    function refresh() {
      for (const [tool] of TOOLS) btns[tool].classList.toggle('on', state.tool === tool);
      undoB.disabled = !doc.history.length;
      redoB.disabled = !doc.redoStack.length;
    }
    entry.hooks.decoded = () => { surf.invalidate(); surf.render(); };
    refresh();
    surf.render();
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Tap the active terrain or stamp tool again to choose styles. Pins can link lore, civilizations, characters — or another World Map widget for region maps.</p>'));
  }
});
