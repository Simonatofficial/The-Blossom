/* Infinite Canvas selection (docs/12 §3): rectangle + freehand lasso with
   marching ants and a transform frame — move, uniform scale, rotate, flip,
   copy/paste/duplicate/delete. A lift → transform → drop runs inside one
   batched history step; the selection polygon doubles as the paint mask. */

import { loadRect } from './infcanvas-tools.js';

let clipboard = null; // {canvas, w, h} — world-sized copy buffer, app-wide

const HANDLE = 22; // screen px hit radius for frame handles

export class SelectTool {
  constructor(surf, doc, onChange) {
    this.surf = surf;
    this.doc = doc;
    this.onChange = onChange;
    this.mode = 'rect'; // 'rect' | 'lasso'
    this.poly = null;   // world pts (closed region outline)
    this.float = null;  // lifted pixels mid-transform
    this.draft = null;  // selection being dragged out
    this.drag = null;   // active frame-handle drag
  }

  active() { return !!(this.poly || this.float); }
  hasClipboard() { return !!clipboard; }

  setMask() { this.doc.mask = this.float ? null : this.poly; }

  bboxOf(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x; if (y < y0) y0 = y;
      if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    return { x0, y0, x1, y1 };
  }

  /** Map an original-poly point through the float's current transform. */
  mapPt([x, y]) {
    const f = this.float;
    let dx = (x - f.cx0) * f.fx * f.scale, dy = (y - f.cy0) * f.fy * f.scale;
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    return [f.cx + dx * c - dy * s, f.cy + dx * s + dy * c];
  }

  /** The transform frame's corner points (world). */
  corners() {
    const f = this.float;
    if (f) {
      const w2 = f.w / 2, h2 = f.h / 2;
      return [[-w2, -h2], [w2, -h2], [w2, h2], [-w2, h2]].map(([dx, dy]) => {
        const c = Math.cos(f.rot), s = Math.sin(f.rot);
        const x = dx * f.scale, y = dy * f.scale;
        return [f.cx + x * c - y * s, f.cy + x * s + y * c];
      });
    }
    const b = this.bboxOf(this.poly);
    return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  }

  center() {
    if (this.float) return [this.float.cx, this.float.cy];
    const b = this.bboxOf(this.poly);
    return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  }

  inside(wx, wy) {
    // even-odd test against the current outline polygon
    const pts = this.float ? this.float.poly0.map(p => this.mapPt(p)) : this.poly;
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > wy) !== (yj > wy) && wx < ((xj - xi) * (wy - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  hitHandle(px, py) {
    if (!this.active()) return null;
    const cs = this.corners().map(([x, y]) => this.surf.toScreen(x, y));
    const [rx, ry] = this.rotateHandle(cs);
    if (Math.hypot(px - rx, py - ry) < HANDLE) return 'rotate';
    for (const [cx, cy] of cs) if (Math.hypot(px - cx, py - cy) < HANDLE) return 'scale';
    return null;
  }

  rotateHandle(cs) {
    const mx = (cs[0][0] + cs[1][0]) / 2, my = (cs[0][1] + cs[1][1]) / 2;
    const cx = (cs[0][0] + cs[2][0]) / 2, cy = (cs[0][1] + cs[2][1]) / 2;
    const d = Math.max(1, Math.hypot(mx - cx, my - cy));
    return [mx + ((mx - cx) / d) * 28, my + ((my - cy) / d) * 28];
  }

  /* ---------- pointer routing (the glue calls these for the select tool) ---------- */

  down(wx, wy, px, py) {
    if (this.active()) {
      const h = this.hitHandle(px, py);
      if (h) {
        this.lift();
        const f = this.float;
        this.drag = { kind: h, start: [wx, wy], scale0: f.scale, rot0: f.rot, cx: f.cx, cy: f.cy };
        return;
      }
      if (this.inside(wx, wy)) {
        this.lift();
        this.drag = { kind: 'move', start: [wx, wy], cx: this.float.cx, cy: this.float.cy };
        return;
      }
      this.commit(); // tapped outside — drop the float, start fresh
      this.poly = null;
      this.setMask();
    }
    this.draft = { a: [wx, wy], b: [wx, wy], pts: [[wx, wy]] };
  }

  move(wx, wy) {
    const d = this.drag;
    if (d) {
      const f = this.float;
      if (d.kind === 'move') {
        f.cx = d.cx + (wx - d.start[0]);
        f.cy = d.cy + (wy - d.start[1]);
      } else if (d.kind === 'scale') {
        const r0 = Math.max(1e-9, Math.hypot(d.start[0] - d.cx, d.start[1] - d.cy));
        f.scale = Math.max(0.02, d.scale0 * Math.hypot(wx - d.cx, wy - d.cy) / r0);
      } else if (d.kind === 'rotate') {
        f.rot = d.rot0 + Math.atan2(wy - d.cy, wx - d.cx) - Math.atan2(d.start[1] - d.cy, d.start[0] - d.cx);
      }
      return;
    }
    if (this.draft) {
      this.draft.b = [wx, wy];
      if (this.mode === 'lasso') this.draft.pts.push([wx, wy]);
    }
  }

  up() {
    if (this.drag) { this.drag = null; this.onChange(); return; }
    const d = this.draft;
    this.draft = null;
    if (!d) return;
    const minWorld = 6 / this.surf.scale();
    if (this.mode === 'rect') {
      const { a, b } = d;
      if (Math.abs(b[0] - a[0]) < minWorld || Math.abs(b[1] - a[1]) < minWorld) return;
      this.poly = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
    } else {
      if (d.pts.length < 3) return;
      const bb = this.bboxOf(d.pts);
      if (bb.x1 - bb.x0 < minWorld && bb.y1 - bb.y0 < minWorld) return;
      this.poly = d.pts;
    }
    this.setMask();
    loadRect(this.doc, this.bboxOf(this.poly)); // warm tiles so lift is instant
    this.onChange();
  }

  /* ---------- lift / commit (one history step) ---------- */

  lift() {
    if (this.float || !this.poly) return;
    const doc = this.doc, surf = this.surf;
    const band = surf.band();
    const bb = this.bboxOf(this.poly);
    const w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
    const es = Math.min(Math.pow(2, band), 4096 / w, 4096 / h);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * es));
    c.height = Math.max(1, Math.ceil(h * es));
    const g = c.getContext('2d');
    g.setTransform(es, 0, 0, es, -bb.x0 * es, -bb.y0 * es);
    g.beginPath();
    this.poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    g.clip();
    doc.composeLayer(g, doc.active().id, bb.x0, bb.y0, bb.x1, bb.y1);

    doc.beginBatch();
    doc.rasterOp(bb, band, (og) => {
      og.globalCompositeOperation = 'destination-out';
      og.fillStyle = '#000';
      og.beginPath();
      this.poly.forEach(([x, y], i) => i ? og.lineTo(x, y) : og.moveTo(x, y));
      og.closePath();
      og.fill();
    }, { mask: null });
    surf.invalidate(bb);

    this.float = {
      canvas: c, w, h, band,
      cx0: bb.x0 + w / 2, cy0: bb.y0 + h / 2,
      cx: bb.x0 + w / 2, cy: bb.y0 + h / 2,
      scale: 1, rot: 0, fx: 1, fy: 1,
      poly0: this.poly.map(p => [...p])
    };
    this.setMask();
  }

  commit() {
    const f = this.float;
    if (!f) return;
    const doc = this.doc, surf = this.surf;
    const band = surf.band();
    const cs = this.corners();
    const bb = this.bboxOf(cs);
    const w = Math.max(1e-9, bb.x1 - bb.x0), h = Math.max(1e-9, bb.y1 - bb.y0);
    const es = Math.min(Math.pow(2, band), 4096 / w, 4096 / h);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.ceil(w * es));
    out.height = Math.max(1, Math.ceil(h * es));
    const g = out.getContext('2d');
    g.setTransform(es, 0, 0, es, -bb.x0 * es, -bb.y0 * es);
    g.translate(f.cx, f.cy);
    g.rotate(f.rot);
    g.scale(f.scale * f.fx, f.scale * f.fy);
    g.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h);
    doc.stampImage(out, bb, band, { mask: null });
    doc.endBatch();
    this.poly = f.poly0.map(p => this.mapPt(p));
    this.float = null;
    this.setMask();
    surf.invalidate(bb);
    this.onChange();
  }

  /* ---------- actions ---------- */

  copy() {
    if (!this.active()) return;
    if (this.float) {
      clipboard = { canvas: this.float.canvas, w: this.float.w, h: this.float.h };
      return;
    }
    const bb = this.bboxOf(this.poly);
    const w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
    const es = Math.min(Math.pow(2, this.surf.band()), 4096 / w, 4096 / h);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * es));
    c.height = Math.max(1, Math.ceil(h * es));
    const g = c.getContext('2d');
    g.setTransform(es, 0, 0, es, -bb.x0 * es, -bb.y0 * es);
    g.beginPath();
    this.poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    g.clip();
    this.doc.composeLayer(g, this.doc.active().id, bb.x0, bb.y0, bb.x1, bb.y1);
    clipboard = { canvas: c, w, h };
  }

  /** Paste lands as a floating selection mid-viewport (docs/12 §3). */
  paste(offset = 0) {
    if (!clipboard) return;
    this.commit();
    const { surf } = this;
    const fit = Math.min(1, (surf.canvas.width * 0.8 / surf.scale()) / clipboard.w,
      (surf.canvas.height * 0.8 / surf.scale()) / clipboard.h);
    const cx = surf.view.cx + offset / surf.scale(), cy = surf.view.cy + offset / surf.scale();
    const w2 = clipboard.w / 2, h2 = clipboard.h / 2;
    this.doc.beginBatch(); // no erase part — the drop alone is the step
    this.float = {
      canvas: clipboard.canvas, w: clipboard.w, h: clipboard.h, band: surf.band(),
      cx0: cx, cy0: cy, cx, cy, scale: fit, rot: 0, fx: 1, fy: 1,
      poly0: [[cx - w2, cy - h2], [cx + w2, cy - h2], [cx + w2, cy + h2], [cx - w2, cy + h2]]
    };
    this.setMask();
    this.onChange();
  }

  duplicate() {
    if (!this.active()) return;
    this.copy();
    this.paste(18);
  }

  erase() {
    if (this.float) { // deleting a float = keep the lift's erase, drop the pixels
      this.doc.endBatch();
      this.poly = this.float.poly0.map(p => this.mapPt(p));
      this.float = null;
      this.setMask();
      this.onChange();
      return { invalidateAll: true };
    }
    if (!this.poly) return null;
    const bb = this.bboxOf(this.poly);
    this.doc.rasterOp(bb, this.surf.band(), (g) => {
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000';
      g.beginPath();
      this.poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.closePath();
      g.fill();
    }, { mask: null });
    this.onChange();
    return { bbox: bb };
  }

  flip(axis) {
    if (!this.active()) return;
    this.lift();
    if (axis === 'h') this.float.fx *= -1;
    else this.float.fy *= -1;
    this.onChange();
  }

  deselect() {
    this.commit();
    this.poly = null;
    this.draft = null;
    this.setMask();
    this.onChange();
  }

  /* ---------- overlay ---------- */

  drawOverlay(g) {
    const surf = this.surf;
    const dash = (pts, close) => {
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const [sx, sy] = surf.toScreen(x, y);
        i ? g.lineTo(sx, sy) : g.moveTo(sx, sy);
      });
      if (close) g.closePath();
      const off = (performance.now() / 50) % 12;
      g.lineWidth = 1.4;
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.setLineDash([6, 6]);
      g.lineDashOffset = off;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineDashOffset = off + 6;
      g.stroke();
      g.setLineDash([]);
    };
    g.save();
    if (this.draft) {
      const { a, b, pts } = this.draft;
      dash(this.mode === 'rect' ? [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]] : pts, true);
      g.restore();
      return;
    }
    if (!this.active()) { g.restore(); return; }

    if (this.float) {
      const f = this.float;
      const [sx, sy] = surf.toScreen(f.cx, f.cy);
      g.save();
      g.translate(sx, sy);
      g.rotate(f.rot);
      const k = f.scale * surf.scale();
      g.scale(k * f.fx, k * f.fy);
      g.drawImage(f.canvas, -f.w / 2, -f.h / 2, f.w, f.h);
      g.restore();
      dash(f.poly0.map(p => this.mapPt(p)), true);
    } else {
      dash(this.poly, true);
    }

    // transform frame: corner squares + rotate knob
    const cs = this.corners().map(([x, y]) => surf.toScreen(x, y));
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.fillStyle = 'rgba(40,40,48,0.9)';
    g.lineWidth = 1.5;
    for (const [cx, cy] of cs) {
      g.beginPath();
      g.rect(cx - 5, cy - 5, 10, 10);
      g.fill();
      g.stroke();
    }
    const [rx, ry] = this.rotateHandle(cs);
    g.beginPath();
    g.arc(rx, ry, 6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }
}
