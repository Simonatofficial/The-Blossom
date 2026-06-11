/* Infinite Canvas engine (docs/08 §2 — "this is the hard part; do it properly").
   World model: strokes live in world coordinates, stored sector-relative
   (sectors are 2^20-unit tiles) so coordinates stay precise at depth.
   Viewport: {cx, cy, zoomExp} with scale = 2^zoomExp — effectively unbounded.
   Rendering: a 512px tile pyramid cached per power-of-two zoom band, with an
   LOD cutoff (strokes smaller than 0.5px on screen are skipped); pan/zoom
   recomposes cached tiles and only the active stroke renders live. */

export const SECTOR = 1 << 20;
const TILE = 512;
const MAX_TILES = 96;
const MIN_BAND = -24, MAX_BAND = 10;

export class InfiniteSurface {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   strokes: () => {sx:number, sy:number, pts:number[][], tool:string, color:string,
   *                   size:number, opacity:number, text?:string, bbox:{x0,y0,x1,y1}, t:number}[],
   *   onStrokeDone: (pts: number[][], state: object) => void,
   *   onTextAt: (wx: number, wy: number) => void,
   *   onViewChange: (view: object) => void
   * }} cb
   */
  constructor(canvas, cb, view = null) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.cb = cb;
    this.view = view || { cx: 0, cy: 0, zoomExp: 0 };
    this.tool = 'pen';
    this.color = '#d8697f';
    this.size = 4;            // world units (≈ px at ×1)
    this.opacity = 1;
    this.screenScaled = false; // true → brush size fixed in screen px
    this.tiles = new Map();    // key -> {canvas, used}
    this.active = null;        // in-progress stroke (world pts)
    this.pointers = new Map();
    this.pinch = null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomAt(e.offsetX, e.offsetY, -e.deltaY / 480);
    }, { passive: false });
  }

  scale() { return Math.pow(2, this.view.zoomExp); }
  toWorld(px, py) {
    const s = this.scale();
    return [this.view.cx + (px - this.canvas.width / 2) / s, this.view.cy + (py - this.canvas.height / 2) / s];
  }
  toScreen(wx, wy) {
    const s = this.scale();
    return [(wx - this.view.cx) * s + this.canvas.width / 2, (wy - this.view.cy) * s + this.canvas.height / 2];
  }

  zoomAt(px, py, dz) {
    const [wx, wy] = this.toWorld(px, py);
    this.view.zoomExp = Math.max(MIN_BAND - 0.49, Math.min(MAX_BAND + 0.49, this.view.zoomExp + dz));
    const s = this.scale();
    this.view.cx = wx - (px - this.canvas.width / 2) / s;
    this.view.cy = wy - (py - this.canvas.height / 2) / s;
    this.cb.onViewChange?.(this.view);
    this.render();
  }

  /* ---- tile pyramid ---- */

  tileKey(b, tx, ty) { return `${b}:${tx}:${ty}`; }

  tile(b, tx, ty) {
    const key = this.tileKey(b, tx, ty);
    let t = this.tiles.get(key);
    if (t) { t.used = performance.now(); return t.canvas; }
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    const g = c.getContext('2d');
    const sb = Math.pow(2, b);
    const wx0 = tx * TILE / sb, wy0 = ty * TILE / sb;
    const wx1 = wx0 + TILE / sb, wy1 = wy0 + TILE / sb;
    g.setTransform(sb, 0, 0, sb, -wx0 * sb, -wy0 * sb);
    for (const s of this.cb.strokes()) {
      if (s.bbox.x1 < wx0 || s.bbox.x0 > wx1 || s.bbox.y1 < wy0 || s.bbox.y0 > wy1) continue;
      const span = Math.max(s.bbox.x1 - s.bbox.x0, s.bbox.y1 - s.bbox.y0, s.size);
      const px = span * sb;
      if (px < 0.5) {
        // LOD: too small to draw — render a faint speck so distant work
        // still reads from far out (zoom toward the stars to find it)
        if (px < 0.02 || s.tool === 'eraser') continue;
        g.save();
        g.globalAlpha = 0.55;
        g.fillStyle = s.color;
        g.fillRect((s.bbox.x0 + s.bbox.x1) / 2 - 0.4 / sb, (s.bbox.y0 + s.bbox.y1) / 2 - 0.4 / sb, 0.8 / sb, 0.8 / sb);
        g.restore();
        continue;
      }
      drawStroke(g, s, 1 / sb);
    }
    this.tiles.set(key, { canvas: c, used: performance.now() });
    if (this.tiles.size > MAX_TILES) {
      const oldest = [...this.tiles.entries()].sort((a, b2) => a[1].used - b2[1].used)[0];
      this.tiles.delete(oldest[0]);
    }
    return c;
  }

  /** Drop cached tiles touching a world bbox (null → everything). */
  invalidate(bbox = null) {
    if (!bbox) { this.tiles.clear(); return; }
    for (const key of [...this.tiles.keys()]) {
      const [b, tx, ty] = key.split(':').map(Number);
      const sb = Math.pow(2, b);
      const x0 = tx * TILE / sb, y0 = ty * TILE / sb;
      if (!(bbox.x1 < x0 || bbox.x0 > x0 + TILE / sb || bbox.y1 < y0 || bbox.y0 > y0 + TILE / sb)) {
        this.tiles.delete(key);
      }
    }
  }

  render() {
    const { g, canvas, view } = this;
    const W = canvas.width, H = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const band = Math.max(MIN_BAND, Math.min(MAX_BAND, Math.round(view.zoomExp)));
    const sb = Math.pow(2, band);
    const f = this.scale() / sb;
    const [wx0, wy0] = this.toWorld(0, 0);
    const [wx1, wy1] = this.toWorld(W, H);
    const tx0 = Math.floor(wx0 * sb / TILE), ty0 = Math.floor(wy0 * sb / TILE);
    const tx1 = Math.floor(wx1 * sb / TILE), ty1 = Math.floor(wy1 * sb / TILE);
    g.imageSmoothingEnabled = f < 1;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const [sx, sy] = this.toScreen(tx * TILE / sb, ty * TILE / sb);
        g.drawImage(this.tile(band, tx, ty), sx, sy, TILE * f + 0.5, TILE * f + 0.5);
      }
    }
    if (this.active) { // live stroke on top, screen space
      const s = this.scale();
      g.save();
      g.setTransform(s, 0, 0, s, W / 2 - view.cx * s, H / 2 - view.cy * s);
      drawStroke(g, { ...this.active, sx: 0, sy: 0 }, 1 / s);
      g.restore();
    }
  }

  /* ---- input: draw, pan, pinch ---- */

  effectiveSize() { return this.screenScaled ? this.size / this.scale() : this.size; }

  down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (this.pointers.size === 2) { this.active = null; this.pinch = null; return; }
    if (this.tool === 'pan' || e.button === 1) { this.panFrom = [e.offsetX, e.offsetY]; return; }
    const [wx, wy] = this.toWorld(e.offsetX, e.offsetY);
    if (this.tool === 'text') { this.cb.onTextAt?.(wx, wy); return; }
    this.active = {
      tool: this.tool, color: this.color, opacity: this.opacity,
      size: this.effectiveSize(),
      pts: [[wx, wy]], anchor: [wx, wy]
    };
  }

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const prev = this.pointers.get(e.pointerId);
    this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);

    if (this.pointers.size === 2) { // pinch zoom + two-finger pan
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      if (this.pinch) {
        this.zoomAt(cx, cy, Math.log2(d / this.pinch.d));
        const s = this.scale();
        this.view.cx -= (cx - this.pinch.cx) / s;
        this.view.cy -= (cy - this.pinch.cy) / s;
        this.render();
      }
      this.pinch = { d, cx, cy };
      return;
    }
    if (this.panFrom) {
      const s = this.scale();
      this.view.cx -= (e.offsetX - prev[0]) / s;
      this.view.cy -= (e.offsetY - prev[1]) / s;
      this.cb.onViewChange?.(this.view);
      this.render();
      return;
    }
    if (!this.active) return;
    const [wx, wy] = this.toWorld(e.offsetX, e.offsetY);
    if (['line', 'rect', 'ellipse'].includes(this.active.tool)) {
      this.active.pts = shapePts(this.active.tool, this.active.anchor, [wx, wy]);
    } else {
      const last = this.active.pts[this.active.pts.length - 1];
      if (Math.hypot(wx - last[0], wy - last[1]) * this.scale() < 1.5) return;
      this.active.pts.push([wx, wy]);
    }
    this.render();
  }

  up(e) {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    this.panFrom = null;
    if (this.active && this.active.pts.length > 1) {
      const { pts, tool, color, size, opacity } = this.active;
      this.cb.onStrokeDone(pts, { tool: tool === 'marker' ? 'marker' : tool === 'eraser' ? 'eraser' : 'pen', shape: tool, color, size, opacity });
    }
    this.active = null;
    this.render();
  }

  /** Frame a world bbox (fit-all, bookmarks). */
  fitTo(bbox, margin = 0.12) {
    const w = Math.max(1e-6, bbox.x1 - bbox.x0), h = Math.max(1e-6, bbox.y1 - bbox.y0);
    const s = Math.min(this.canvas.width / w, this.canvas.height / h) * (1 - margin);
    this.view.zoomExp = Math.max(MIN_BAND, Math.min(MAX_BAND, Math.log2(s)));
    this.view.cx = (bbox.x0 + bbox.x1) / 2;
    this.view.cy = (bbox.y0 + bbox.y1) / 2;
    this.cb.onViewChange?.(this.view);
    this.render();
  }
}

/** Polyline points for the shape tools. */
export function shapePts(kind, a, b) {
  if (kind === 'line') return [a, b];
  if (kind === 'rect') return [a, [b[0], a[1]], b, [a[0], b[1]], a];
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
  const rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
  return Array.from({ length: 33 }, (_, i) => {
    const t = (i / 32) * Math.PI * 2;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
  });
}

/** Stroke bounds in world coords (with brush padding). */
export function strokeBbox(pts, size) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (y < y0) y0 = y;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { x0: x0 - size, y0: y0 - size, x1: x1 + size, y1: y1 + size };
}

/* Draw one stroke into a context already transformed to world space.
   hairline = 1/scale, so line widths never collapse below one pixel. */
function drawStroke(g, s, hairline) {
  const ox = (s.sx || 0) * SECTOR, oy = (s.sy || 0) * SECTOR;
  if (s.tool === 'text') {
    g.save();
    g.globalAlpha = s.opacity ?? 1;
    g.fillStyle = s.color;
    g.font = `${s.size * 6}px system-ui`;
    g.fillText(s.text || '', ox + s.pts[0][0], oy + s.pts[0][1]);
    g.restore();
    return;
  }
  g.save();
  if (s.tool === 'eraser') g.globalCompositeOperation = 'destination-out';
  else if (s.tool === 'marker') { g.globalAlpha = 0.4 * (s.opacity ?? 1); }
  else g.globalAlpha = s.opacity ?? 1;
  g.strokeStyle = s.color;
  g.lineWidth = Math.max(hairline, s.size * (s.tool === 'marker' ? 2 : 1) * (s.tool === 'eraser' ? 2.5 : 1));
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  s.pts.forEach(([x, y], i) => i ? g.lineTo(ox + x, oy + y) : g.moveTo(ox + x, oy + y));
  g.stroke();
  g.restore();
}
