/* Infinite Canvas widget (docs/08 §2, overhauled per docs/12 / CR-10).
   Glue between the world engine (view/tiles/input), the raster layer doc
   (paint/undo/layers), the selection + text subsystems, and the Kleki-style
   UI. Raster tiles persist as 'rtile' objects (hard-deleted, not trashed —
   they're bulky derivatives); old vector sectors migrate once and stay
   dormant as a backup. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { el, toast, popMenu, promptText } from '../ui/components.js';
import { objectsOf, createObject, todayStr } from './base.js';
import { InfiniteSurface, SECTOR, shapePts } from './infcanvas-engine.js';
import { RasterDoc, RTILE, hexA, advanceMix } from './infcanvas-raster.js';
import { commitStroke } from './infcanvas-commit.js';
import { buildToolbar, openLayerPanel } from './infcanvas-ui.js';
import { openColorPanel } from './infcanvas-palette.js';
import { floodFill, commitGradient, gradientStyle } from './infcanvas-tools.js';
import { SelectTool } from './infcanvas-select.js';
import { TextLayer } from './infcanvas-text.js';

const docs = new Map(); // widgetId -> {doc, hooks} (history survives view close)
const BRUSHES = ['pen', 'blend', 'pixel', 'eraser'];
let toolbarHidden = false; // remembered per session (docs/12 §1)

function openDoc(widget) {
  let entry = docs.get(widget.id);
  if (entry) return entry;
  const tileIndex = new Map();
  for (const o of objectsOf(widget.id, 'rtile')) tileIndex.set(o.data.key, o);
  widget.config.raster = widget.config.raster || { layers: [], active: null };
  entry = { hooks: { decoded: null, meta: null } };
  entry.doc = new RasterDoc(widget.config.raster, {
    loadTile: (key) => tileIndex.get(key)?.data.blob || null,
    saveTile: (key, blob) => {
      let o = tileIndex.get(key);
      if (!blob) {
        if (o) { store.del('objects', o.id); tileIndex.delete(key); }
        return;
      }
      if (o) { o.data.blob = blob; store.put('objects', o); }
      else { o = createObject(widget.id, 'rtile', { key, blob }); tileIndex.set(key, o); }
    },
    tileKeys: () => [...tileIndex.keys()],
    onTilesDecoded: () => entry.hooks.decoded?.(),
    onMetaChange: () => { store.put('widgets', widget); entry.hooks.meta?.(); },
    onLayerAbsorbed: (fromId, toId, histEntry) => {
      for (const o of objectsOf(widget.id, 'tbox')) {
        if (o.data.layerId !== fromId) continue;
        const before = structuredClone(o.data);
        o.data.layerId = toId;
        store.put('objects', o);
        histEntry.parts.push({ kind: 'tbox', id: o.id, before, after: structuredClone(o.data) });
      }
    }
  });
  docs.set(widget.id, entry);
  migrate(widget, entry.doc);
  entry.doc.vacuum(); // deleted-layer leftovers from previous sessions
  const live = new Set(widget.config.raster.layers.map(l => l.id));
  for (const o of objectsOf(widget.id, 'tbox')) {
    if (!live.has(o.data.layerId)) store.del('objects', o.id);
  }
  return entry;
}

/* one-time vector → raster migration (docs/12 §0); originals stay dormant */
function migrate(widget, doc) {
  if (widget.config.migrated) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  for (const so of objectsOf(widget.id, 'sector')) {
    for (const s of (so.data.strokes || [])) {
      const wpts = s.pts.map(([x, y]) => [x + so.data.sx * SECTOR, y + so.data.sy * SECTOR]);
      const span = Math.max(s.bbox.x1 - s.bbox.x0, s.bbox.y1 - s.bbox.y0, s.size || 4, 1e-6);
      const band = clamp(Math.round(Math.log2(256 / span)), -24, 8);
      if (s.tool === 'text') {
        const sb = Math.pow(2, band);
        const [wx, wy] = wpts[0];
        const fs = (s.size || 4) * 6;
        const estW = fs * 0.62 * (s.text || '').length;
        const layer = doc.active();
        for (let tx = Math.floor(wx * sb / RTILE); tx <= Math.floor((wx + estW) * sb / RTILE); tx++) {
          const ty = Math.floor(wy * sb / RTILE);
          for (const tyy of [ty - 1, ty]) {
            const c = doc.tile(layer.id, band, tx, tyy, true);
            const g = c.getContext('2d');
            g.save();
            g.fillStyle = s.color;
            g.font = `${fs * sb}px system-ui`;
            g.fillText(s.text || '', wx * sb - tx * RTILE, wy * sb - tyy * RTILE);
            g.restore();
            doc.dirty.add(doc.key(layer.id, band, tx, tyy));
          }
        }
        continue;
      }
      doc.begin({
        tool: s.tool === 'eraser' ? 'eraser' : 'pen',
        color: s.color, size: s.size || 4,
        opacity: (s.opacity ?? 1) * (s.tool === 'marker' ? 0.55 : 1),
        hardness: 0.92, band
      });
      for (const [wx, wy] of wpts) doc.stamp(wx, wy, 0.6);
      doc.end();
    }
  }
  doc.history = [];
  doc.redoStack = [];
  doc.flush();
  widget.config.migrated = true;
  store.put('widgets', widget);
}

function contentBounds(doc) {
  let bb = null;
  for (const key of new Set([...doc.io.tileKeys(), ...doc.tiles.keys()])) {
    const [, b, tx, ty] = key.split(':');
    const ts = RTILE / Math.pow(2, Number(b));
    const r = { x0: tx * ts, y0: ty * ts, x1: (Number(tx) + 1) * ts, y1: (Number(ty) + 1) * ts };
    bb = bb
      ? { x0: Math.min(bb.x0, r.x0), y0: Math.min(bb.y0, r.y0), x1: Math.max(bb.x1, r.x1), y1: Math.max(bb.y1, r.y1) }
      : r;
  }
  return bb || { x0: -400, y0: -300, x1: 400, y1: 300 };
}

function zoomLabel(scale) {
  return scale >= 1 ? `×${scale >= 10 ? Math.round(scale) : scale.toFixed(1)}` : `×${scale.toPrecision(2)}`;
}

const BRUSH_DEFAULTS = {
  tool: 'pen', color: '#d8697f', colorAlt: '#ffffff', color2: '#ffffff',
  size: 6, opacity: 1, hardness: 0.85, strength: 0.5, stabilizer: 2,
  screenScaled: false, shape: 'line', shapeFill: false, eraserPixel: false,
  fillTol: 24, fillGrow: 0, fillReach: 0, gradType: 'linear',
  gradTo: 'transparent', selectMode: 'rect'
};

registry.register({
  type: 'infcanvas',
  name: 'Infinite Canvas',
  icon: 'maximize',
  description: 'A boundless deep-zoom painting surface',
  keywords: ['draw', 'paint', 'art', 'zoom', 'infinite', 'layers', 'kleki'],
  external: true, internal: true,
  defaultConfig: () => ({ view: { cx: 0, cy: 0, zoomExp: 0 }, migrated: true, raster: { layers: [], active: null } }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const { doc } = openDoc(widget);
    const canvas = el('<canvas style="width:100%;height:130px;border-radius:10px;background:var(--surface-alt)"></canvas>');
    canvas.width = 600;
    canvas.height = 220;
    host.appendChild(canvas);
    const surf = new InfiniteSurface(canvas, {
      drawTile: (g, b, r) => doc.compose(g, r.x0, r.y0, r.x1, r.y1, b)
    });
    surf.fitTo(contentBounds(doc));
    const layers = doc.meta.layers.length;
    host.appendChild(el(`<div class="soft" style="font-size:0.78rem;margin-top:6px;text-align:center">${doc.io.tileKeys().length} painted tiles · ${layers} layer${layers === 1 ? '' : 's'}</div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const entry = openDoc(widget);
    const doc = entry.doc;
    doc.session = null; // clear any state a torn-down view left behind
    doc.batch = null;
    doc.mask = null;
    const state = widget.config.brush = { ...BRUSH_DEFAULTS, ...(widget.config.brush || {}) };
    if (state.tool === 'sketchy') state.tool = 'pen'; // brush retired (CR-13c)
    const cfg = widget.config;

    const wrap = el('<div class="ic-wrap"></div>');
    const box = el('<div class="ic-canvasbox"></div>');
    const canvas = el('<canvas class="ic-surface"></canvas>');
    const readout = el('<span class="chip ic-readout">×1</span>');
    box.append(canvas, readout);
    wrap.appendChild(box);
    host.appendChild(wrap);

    const dpr = Math.min(2, devicePixelRatio || 1);
    // CR-11: distraction-free drawing is a routed FOCUS PAGE (/w/<id>/f),
    // not OS fullscreen — toggling it re-navigates and remounts this view
    const focusMode = router.current().widgetId === widget.id && router.current().focus;
    const resizeCanvas = () => {
      if (focusMode || document.fullscreenElement) {
        canvas.style.height = `${Math.max(200, innerHeight - 24)}px`;
        surf.resize(dpr);
        if (!canvas.width) { canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr); }
      } else {
        const cssW = Math.max(300, (host.clientWidth || 720) - 62);
        const cssH = Math.min(Math.max(280, innerHeight - 210), Math.round(cssW * 0.8));
        canvas.style.height = `${cssH}px`;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      text?.sync();
      surf.render();
    };

    const effSize = () => state.screenScaled ? state.size / surf.scale() : state.size;
    let chase = null, shape = null, grad = null, pickRing = null, exporting = false;
    let live = null;       // in-progress stroke: screen overlay only (CR-12 §4)
    let committing = null; // stroke mid-commit: overlay stays up, input waits (CR-13a)
    let downPt = null;

    /* ---------- live stroke: the in-progress stroke stamps a screen-space
       canvas at FULL alpha; the overlay is drawn at the stroke's opacity and
       pointer-up composites the whole stroke onto the layer once (CR-13b) */

    const brushSession = () => ({
      tool: state.tool, color: state.color, size: effSize(),
      opacity: state.opacity, hardness: state.hardness,
      strength: state.strength, band: surf.band(), pixelErase: state.eraserPixel,
      mask: doc.mask, layerId: doc.active().id
    });

    function startLive(wx, wy, p) {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      live = { canvas: c, g: c.getContext('2d'), s: brushSession(), pts: [], last: null, carry: 0, mix: null };
      livePoint(wx, wy, p);
    }

    function liveDab(wx, wy, p, mix) {
      const { g, s } = live;
      const [sx, sy] = surf.toScreen(wx, wy);
      const wr = Math.max(0.5 / Math.pow(2, s.band), s.size / 2 * (s.tool === 'pixel' ? 1 : 0.35 + p));
      const r = Math.max(0.4, wr * surf.scale());
      g.save();
      if (s.tool === 'pixel' || (s.tool === 'eraser' && s.pixelErase)) {
        g.fillStyle = s.tool === 'eraser' ? '#000' : s.color;
        g.fillRect(Math.round(sx - r), Math.round(sy - r), Math.max(1, Math.round(r * 2)), Math.max(1, Math.round(r * 2)));
      } else {
        const col = s.tool === 'blend' && mix
          ? `rgb(${mix[0] | 0},${mix[1] | 0},${mix[2] | 0})`
          : (s.tool === 'eraser' ? '#000000' : s.color);
        // eraser masks at full alpha (pressure shapes size only, like commit)
        g.globalAlpha = s.tool === 'blend' ? 0.35 : (s.tool === 'eraser' ? 1 : 0.5 + p * 0.5);
        const grad2 = g.createRadialGradient(sx, sy, 0, sx, sy, r);
        grad2.addColorStop(0, col);
        grad2.addColorStop(Math.min(0.99, s.tool === 'blend' ? 0.1 : s.hardness), col);
        grad2.addColorStop(1, hexA(col.startsWith('#') ? col : s.color, 0));
        g.fillStyle = grad2;
        g.beginPath();
        g.arc(sx, sy, r, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    /** Spacing-stamped preview point — mirrors the commit's walk. */
    function livePoint(wx, wy, p) {
      const s = live.s;
      if (s.tool === 'blend') {
        // carry color forward from what's committed under the dab
        live.mix = advanceMix(live.mix, doc.sampleColor(s.layerId, wx, wy), s.strength, s.color);
        live.pts.push([wx, wy, p, live.mix]);
      } else {
        live.pts.push([wx, wy, p]);
      }
      if (!live.last) {
        liveDab(wx, wy, p, live.mix);
        live.last = [wx, wy, p];
        return;
      }
      const [lx, ly, lp] = live.last;
      const dist = Math.hypot(wx - lx, wy - ly);
      if (!dist) return;
      const spacing = Math.max(0.35 / Math.pow(2, s.band), s.size * (s.tool === 'pixel' ? 0.9 : 0.18));
      let pos = spacing - live.carry;
      while (pos <= dist) {
        const t = pos / dist;
        liveDab(lx + (wx - lx) * t, ly + (wy - ly) * t, lp + (p - lp) * t, live.mix);
        pos += spacing;
      }
      live.carry = dist - (pos - spacing);
      live.last = [wx, wy, p];
    }

    /** Wheel-zoom mid-stroke: re-project the preview. */
    function rebuildLive() {
      if (!live) return;
      live.g.clearRect(0, 0, live.canvas.width, live.canvas.height);
      const pts = live.pts;
      live.pts = [];
      live.last = null;
      live.carry = 0;
      live.mix = null;
      for (const [wx, wy, p] of pts) livePoint(wx, wy, p);
    }

    /** Pointer-up: composite the whole stroke onto the layer in one pass
        (CR-13). The overlay keeps covering until the commit lands. */
    async function commitLive() {
      const lv = live;
      live = null;
      if (!lv || !lv.pts.length) return;
      committing = lv;
      const res = await commitStroke(doc, lv.s, lv.pts);
      committing = null;
      if (res) {
        surf.invalidate(res.bbox);
        if (res.degraded) toast('Big stroke — saved at view resolution.', 'info');
      }
      surf.render();
      doc.flush();
      toolbar.refresh();
    }

    const pickColor = (px, py) => {
      const d = surf.g.getImageData(Math.max(0, Math.min(surf.canvas.width - 1, px | 0)), Math.max(0, Math.min(surf.canvas.height - 1, py | 0)), 1, 1).data;
      if (!d[3]) return null;
      return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    };
    const applyPick = (px, py, wx, wy) => {
      const c = pickColor(px, py);
      pickRing = [wx, wy, c || state.color];
      if (c) {
        if (c !== state.color) state.colorAlt = state.color;
        state.color = c;
        toolbar.refresh();
      }
      surf.render();
    };
    const finishPick = () => {
      pickRing = null;
      cfg.recent = [state.color, ...(cfg.recent || []).filter(x => x !== state.color)].slice(0, 10);
      store.put('widgets', widget);
      surf.render();
    };

    const surf = new InfiniteSurface(canvas, {
      drawTile: (g, b, r) => doc.compose(g, r.x0, r.y0, r.x1, r.y1, b),
      isPan: () => state.tool === 'pan',
      wantsTbToggle: () => focusMode,
      onViewChange: (v) => {
        widget.config.view = { cx: v.cx, cy: v.cy, zoomExp: v.zoomExp };
        store.put('widgets', widget);
        readout.textContent = zoomLabel(surf.scale());
        if (live) rebuildLive(); // wheel-zoom mid-stroke: re-project the preview
        text.sync();
        text.positionBar();
      },

      toolDown: (wx, wy, p, e) => {
        if (committing) return; // last stroke still landing (CR-13a) — a beat
        const [px, py] = surf.screenPt(e);
        downPt = [px, py];
        if (state.tool === 'shape') { shape = { kind: state.shape, a: [wx, wy], b: [wx, wy] }; return; }
        if (state.tool === 'gradient') { grad = { a: [wx, wy], b: [wx, wy] }; return; }
        if (state.tool === 'select') { sel.down(wx, wy, px, py); surf.render(); return; }
        if (state.tool === 'eyedropper') { applyPick(px, py, wx, wy); return; }
        if (state.tool === 'fill' || state.tool === 'text') return; // act on the tap (up)
        chase = [wx, wy];
        startLive(wx, wy, p); // a tap paints a dab (docs/12 §2) — preview now, tiles on up
        surf.render();
      },

      toolMove: (wx, wy, p, e) => {
        if (shape) {
          shape.b = constrain(shape, [wx, wy], e?.shiftKey || shape.lock);
          surf.render();
          return;
        }
        if (grad) { grad.b = [wx, wy]; surf.render(); return; }
        if (state.tool === 'select') { sel.move(wx, wy); surf.render(); return; }
        if (state.tool === 'eyedropper') { const [px, py] = surf.screenPt(e); applyPick(px, py, wx, wy); return; }
        if (!chase || !live) return;
        const k = [1, 0.45, 0.3, 0.2, 0.14, 0.09][state.stabilizer] ?? 1; // pull-string stabilizer (§3a)
        chase[0] += (wx - chase[0]) * k;
        chase[1] += (wy - chase[1]) * k;
        livePoint(chase[0], chase[1], p);
        surf.render();
      },

      toolUp: async (wx, wy, e) => {
        if (shape) { commitShape(); return; }
        if (grad) {
          const gr = grad;
          grad = null;
          if (Math.hypot(gr.b[0] - gr.a[0], gr.b[1] - gr.a[1]) * surf.scale() < 4) {
            gr.b = [gr.a[0], gr.a[1] + surf.canvas.height * 0.5 / surf.scale()]; // tap = soft falloff down
          }
          const bbox = commitGradient(surf, doc, gr.a, gr.b, {
            type: state.gradType, color: state.color,
            color2: state.gradTo === 'color' ? state.color2 : null, opacity: state.opacity
          });
          surf.invalidate(bbox);
          surf.render();
          doc.flush();
          toolbar.refresh();
          return;
        }
        if (state.tool === 'select') { sel.up(); surf.render(); return; }
        if (state.tool === 'eyedropper') { finishPick(); return; }
        if (state.tool === 'fill') { await runFill(e); return; }
        if (state.tool === 'text') {
          const [px, py] = surf.screenPt(e);
          if (downPt && Math.hypot(px - downPt[0], py - downPt[1]) < 8) text.createAt(wx, wy);
          return;
        }
        if (!chase) return;
        chase = null;
        commitLive(); // one compositing pass onto the layer (CR-13)
      },

      toolCancel: () => {
        shape = null;
        grad = null;
        if (live) { live = null; surf.render(); } // preview only — nothing to restore
      },
      secondFinger: () => {
        if (!shape) return false;
        shape.lock = true; // second finger = perfect square/circle/45° line
        return true;
      },

      // hold still inside a brush stroke → eyedropper (docs/12 §3)
      longPress: (wx, wy, px, py) => {
        if (!BRUSHES.includes(state.tool)) return false;
        if (live) live = null; // discard the preview
        chase = null;
        surf.render();
        applyPick(px, py, wx, wy);
        return true;
      },
      pickAt: (wx, wy, px, py) => applyPick(px, py, wx, wy),
      pickEnd: finishPick,

      drawOverlay: (g) => {
        if (exporting) return;
        const lv = live || committing; // overlay covers until the commit lands
        if (lv) {
          // stamps are full alpha; the stroke's opacity applies exactly once
          // here and once at commit — never per stamp (CR-13b)
          g.save();
          g.globalAlpha = lv.s.opacity;
          if (lv.s.tool === 'eraser') g.globalCompositeOperation = 'destination-out';
          g.drawImage(lv.canvas, 0, 0);
          g.restore();
        }
        if (grad) {
          g.save();
          g.globalAlpha = state.opacity * 0.85;
          const [ax, ay] = surf.toScreen(grad.a[0], grad.a[1]);
          const [bx, by] = surf.toScreen(grad.b[0], grad.b[1]);
          g.fillStyle = gradientStyle(g, { type: state.gradType, ax, ay, bx, by, color: state.color, color2: state.gradTo === 'color' ? state.color2 : null });
          g.fillRect(0, 0, surf.canvas.width, surf.canvas.height);
          g.restore();
        }
        if (shape) drawShapePreview(g);
        sel.drawOverlay(g);
        if (pickRing) {
          const [sx, sy] = surf.toScreen(pickRing[0], pickRing[1]);
          g.save();
          g.beginPath();
          g.arc(sx, sy, 26, 0, Math.PI * 2);
          g.lineWidth = 10;
          g.strokeStyle = pickRing[2];
          g.stroke();
          g.lineWidth = 2;
          g.strokeStyle = 'rgba(255,255,255,0.9)';
          g.stroke();
          g.restore();
        }
      },
      gesture: (name) => {
        if (name === 'toolbar') return toggleToolbar();
        name === 'undo' ? doUndo() : doRedo();
      }
    }, { ...widget.config.view });

    /* ---------- shapes (line / rect / ellipse, outline or filled) ---------- */
    function constrain(sh, b, lock) {
      if (!lock) return b;
      const dx = b[0] - sh.a[0], dy = b[1] - sh.a[1];
      if (sh.kind === 'line') { // snap to 45°
        const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const d = Math.hypot(dx, dy);
        return [sh.a[0] + Math.cos(ang) * d, sh.a[1] + Math.sin(ang) * d];
      }
      const m = Math.max(Math.abs(dx), Math.abs(dy)); // perfect square / circle
      return [sh.a[0] + Math.sign(dx || 1) * m, sh.a[1] + Math.sign(dy || 1) * m];
    }

    function shapePath(g, kind, a, b) {
      if (kind === 'ellipse') {
        g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1e-6, Math.abs(b[1] - a[1]) / 2 || 1e-6, 0, 0, Math.PI * 2);
      } else if (kind === 'rect') {
        g.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      } else {
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
      }
    }

    function drawShapePreview(g) {
      const pts = shapePts(shape.kind, shape.a, shape.b).map(([x, y]) => surf.toScreen(x, y));
      g.save();
      g.globalAlpha = 0.85 * state.opacity;
      g.strokeStyle = g.fillStyle = state.color;
      g.lineWidth = Math.max(1, effSize() * surf.scale());
      g.lineCap = g.lineJoin = 'round';
      g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      if (state.shapeFill && shape.kind !== 'line') g.fill();
      else g.stroke();
      g.restore();
    }

    function commitShape() {
      let { kind, a, b } = shape;
      shape = null;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) * surf.scale() < 4) {
        // tap = place at a default minimum size (docs/12 §2)
        const d = 48 / surf.scale();
        b = kind === 'line' ? [a[0] + d, a[1]] : [a[0] + d, a[1] + d];
      }
      const lw = effSize();
      const bbox = {
        x0: Math.min(a[0], b[0]) - lw, y0: Math.min(a[1], b[1]) - lw,
        x1: Math.max(a[0], b[0]) + lw, y1: Math.max(a[1], b[1]) + lw
      };
      doc.rasterOp(bbox, surf.band(), (g) => {
        g.globalAlpha = state.opacity;
        g.strokeStyle = g.fillStyle = state.color;
        g.lineWidth = lw;
        g.lineCap = g.lineJoin = 'round';
        g.beginPath();
        shapePath(g, kind, a, b);
        if (state.shapeFill && kind !== 'line') g.fill();
        else g.stroke();
      });
      surf.invalidate(bbox);
      surf.render();
      doc.flush();
      toolbar.refresh();
    }

    /* ---------- fill (docs/12 §6) ---------- */
    async function runFill(e) {
      const [px, py] = surf.screenPt(e);
      const res = await floodFill(surf, doc, px, py, {
        tolerance: state.fillTol, grow: state.fillGrow, reach: state.fillReach,
        color: state.color, opacity: state.opacity
      });
      if (!res) return;
      surf.invalidate(res.bbox);
      surf.render();
      doc.flush();
      toolbar.refresh();
      if (res.edge && !cfg.hintedFillEdge) {
        cfg.hintedFillEdge = true;
        store.put('widgets', widget);
        toast('Filled to the edge of your view.', 'info');
      }
    }

    /* ---------- undo / redo (commit a floating selection first: undoing
       the combined lift+drop step then reads as "cancel the move") ---------- */
    const afterHistory = () => {
      surf.invalidate();
      surf.render();
      text.sync();
      doc.flush();
      toolbar.refresh();
    };
    const doUndo = () => { if (committing) return; if (sel.float) sel.commit(); if (doc.undo()) afterHistory(); };
    const doRedo = () => { if (committing) return; if (doc.redo()) afterHistory(); };

    entry.hooks.decoded = () => { surf.invalidate(); surf.render(); };
    entry.hooks.meta = () => toolbar.refresh();

    const sel = new SelectTool(surf, doc, () => { doc.flush(); toolbar.refresh(); });
    const text = new TextLayer(box, surf, doc, widget, () => state);

    /* ---------- focus page (docs/12 §1, revised by CR-11) ---------- */
    const toggleFocus = () => {
      if (!focusMode) router.openWidget(widget.id, true); // navigate; remounts in focus
      else router.closeWidget(); // back to the regular canvas page
    };
    // optional edge-to-edge: browser fullscreen as a SECONDARY control inside
    // the focus page; Esc exits it without leaving focus
    const toggleBrowserFs = async () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else try { await wrap.requestFullscreen?.(); } catch { /* unsupported — focus page already hides chrome */ }
    };
    const onFsChange = () => { if (canvas.isConnected) setTimeout(resizeCanvas, 60); };
    document.addEventListener('fullscreenchange', onFsChange);

    const toggleToolbar = () => {
      toolbarHidden = !toolbarHidden;
      applyToolbarHidden();
    };
    const applyToolbarHidden = () => {
      wrap.classList.toggle('ic-tb-hidden', toolbarHidden);
      toolbar.tab.innerHTML = icon(toolbarHidden ? 'chevron-right' : 'chevron-left', 14);
      toolbar.tab.title = toolbarHidden ? 'Show toolbar' : 'Hide toolbar';
    };

    /* ---------- toolbar ---------- */
    const toolbar = buildToolbar(state, {
      setTool: (t) => {
        if (state.tool === 'select' && t !== 'select') sel.deselect();
        state.tool = t;
        text.setToolActive(t === 'text');
        store.put('widgets', widget);
        toolbar.refresh();
        surf.render();
      },
      stateChanged: () => { store.put('widgets', widget); toolbar.refresh(); },
      undo: doUndo, redo: doRedo,
      canUndo: () => doc.history.length > 0,
      canRedo: () => doc.redoStack.length > 0,
      openLayers: () => openLayerPanel(doc, () => {
        store.put('widgets', widget);
        surf.invalidate();
        surf.render();
        text.sync();
        toolbar.refresh();
      }),
      openColors: (anchor) => openColorPanel(state, widget, () => toolbar.refresh(), anchor),
      fitAll: () => surf.fitTo(contentBounds(doc)),
      scale: () => surf.scale(),
      isFocus: () => focusMode,
      toggleFocus, toggleBrowserFs, toggleToolbar,
      select: {
        setMode: (m) => { sel.mode = m; },
        active: () => sel.active(),
        hasClipboard: () => sel.hasClipboard(),
        copy: () => { sel.copy(); toast('Selection copied', 'copy'); },
        saveStamp: async () => {
          const snap = sel.snapshot();
          if (!snap) return;
          const { toStampDataUrl, promptNewStamp } = await import('./wb-stamps.js');
          promptNewStamp({ img: toStampDataUrl(snap.canvas, snap.canvas.width, snap.canvas.height), suggestedName: widget.name });
        },
        paste: () => { sel.paste(); surf.render(); },
        duplicate: () => { sel.duplicate(); surf.render(); },
        flip: (ax) => { sel.flip(ax); surf.render(); },
        del: () => {
          const r = sel.erase();
          if (r?.invalidateAll) surf.invalidate();
          else if (r?.bbox) surf.invalidate(r.bbox);
          surf.render();
          doc.flush();
          toolbar.refresh();
        },
        deselect: () => { sel.deselect(); surf.render(); }
      },
      bookmarks: (e) => {
        const marks = objectsOf(widget.id, 'bookmark');
        popMenu(e.currentTarget, [
          ...marks.map(m => ({ label: m.data.name, iconName: 'star', fn: () => {
            surf.view = { cx: m.data.cx, cy: m.data.cy, zoomExp: m.data.zoomExp };
            surf.render();
            text.sync();
            readout.textContent = zoomLabel(surf.scale());
          } })),
          ...(marks.length ? ['sep'] : []),
          { label: 'Save this viewpoint', iconName: 'plus', fn: async () => {
            const name = await promptText({ title: 'Bookmark this view', label: 'Name' });
            if (name) { createObject(widget.id, 'bookmark', { name, ...surf.view }); toast('Viewpoint saved', 'star'); }
          } }
        ]);
      },
      exportPng: async () => {
        sel.commit();
        exporting = true;
        surf.render();
        const snap = document.createElement('canvas');
        snap.width = canvas.width;
        snap.height = canvas.height;
        const sg = snap.getContext('2d');
        sg.drawImage(canvas, 0, 0);
        await text.rasterizeInto(sg); // text boxes rasterize only here (docs/12 §3)
        exporting = false;
        surf.render();
        const blob = await new Promise(r => snap.toBlob(r, 'image/png'));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${widget.name}-${todayStr()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        const mod = store.all('modules').find(m => m.pages.some(p => store.get('pages', p)?.widgets.includes(widget.id)));
        const gal = mod?.pages.flatMap(pid => store.get('pages', pid)?.widgets || [])
          .map(id => store.get('widgets', id)).find(w => w?.type === 'gallery');
        if (gal) {
          createObject(gal.id, 'image', { blob, caption: `${widget.name} · ${zoomLabel(surf.scale())}` });
          toast('Snapshot shelved in the gallery', 'image');
        }
      }
    });
    wrap.prepend(toolbar.el);
    wrap.appendChild(toolbar.tab);
    box.appendChild(toolbar.chip);
    applyToolbarHidden();
    text.setToolActive(state.tool === 'text');

    // marching ants march on their own heartbeat (only while a selection lives)
    const ants = setInterval(() => {
      if (!canvas.isConnected) { clearInterval(ants); return; }
      if (sel.active() && !document.hidden) surf.render();
    }, 120);

    /* keyboard (docs/12 §9): B/E/G/L/T/S/V/I tools, X swap, [ ] size, Ctrl+Z/Y */
    const onKey = (e) => {
      if (!canvas.isConnected) {
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('fullscreenchange', onFsChange);
        return;
      }
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      const setTool = (t) => { toolbar.closeFlyout(); state.tool === t || toolbarAct(t); };
      const toolbarAct = (t) => {
        if (state.tool === 'select' && t !== 'select') sel.deselect();
        state.tool = t;
        text.setToolActive(t === 'text');
        toolbar.refresh();
        surf.render();
      };
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); doRedo(); }
      else if (k === 'b') setTool('pen');
      else if (k === 'e') setTool('eraser');
      else if (k === 'g') setTool('fill');
      else if (k === 'l') { state.shape = 'line'; setTool('shape'); }
      else if (k === 't') setTool('text');
      else if (k === 's' || k === 'v') setTool('select');
      else if (k === 'i') setTool('eyedropper');
      else if (k === 'x') { [state.color, state.colorAlt] = [state.colorAlt, state.color]; toolbar.refresh(); }
      else if (k === '[') { state.size = Math.max(0.1, Math.round(state.size / 1.25 * 10) / 10); toolbar.refresh(); }
      else if (k === ']') { state.size = Math.round(state.size * 1.25 * 10) / 10; toolbar.refresh(); }
      else if (k === 'delete' || k === 'backspace') { if (sel.active()) { e.preventDefault(); toolbar.closeFlyout(); const r = sel.erase(); if (r) { surf.invalidate(r.bbox || null); surf.render(); doc.flush(); toolbar.refresh(); } } }
      else if (k === 'escape') {
        // consume Esc for deselect so the engine doesn't pop the page route
        if (sel.active()) { e.stopPropagation(); sel.deselect(); surf.render(); }
      }
    };
    document.addEventListener('keydown', onKey, true); // capture: runs before the engine's Esc

    readout.textContent = zoomLabel(surf.scale());
    resizeCanvas();
    window.__icDebug = { doc, surf, sel, text, state }; // dev console hook
  }
});
