/* Infinite Canvas engine (docs/08 §2 + docs/12 overhaul).
   Owns the world model: viewport {cx, cy, zoomExp} with scale = 2^zoomExp,
   the 512px display-tile pyramid (cached per power-of-two zoom band, LRU),
   and navigation input (pan / pinch / wheel / undo-redo tap gestures).
   What appears in a tile is delegated to cb.drawTile; what drawing tools do
   with pointers is delegated to cb.toolDown/Move/Up — the engine guarantees
   both speak the SAME screen→world transform (the docs/12 §2 accuracy fix). */

export const SECTOR = 1 << 20;
const TILE = 512;
const MAX_TILES = 96;
const MIN_BAND = -24, MAX_BAND = 10;

export class InfiniteSurface {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   drawTile: (g: CanvasRenderingContext2D, band: number, rect: {x0,y0,x1,y1}) => void,
   *   toolDown: (wx, wy, pressure, e) => void,
   *   toolMove: (wx, wy, pressure, e) => void,
   *   toolUp:   (wx, wy, e) => void,
   *   toolCancel?: () => void,
   *   drawOverlay?: (g, surf) => void,
   *   gesture?: (name: 'undo'|'redo'|'toolbar') => void,
   *   longPress?: (wx, wy, px, py) => boolean,
   *   pickAt?: (wx, wy, px, py) => void,
   *   pickEnd?: () => void,
   *   wantsTbToggle?: () => boolean,
   *   isPan?: () => boolean,
   *   onViewChange?: (view) => void
   * }} cb
   */
  constructor(canvas, cb, view = null) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.cb = cb;
    this.view = view || { cx: 0, cy: 0, zoomExp: 0 };
    this.tiles = new Map();
    this.pointers = new Map();
    this.pinch = null;
    this.tap = null; // multi-finger tap tracking for undo/redo gestures
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const [px, py] = this.screenPt(e);
      this.zoomAt(px, py, -e.deltaY / 480);
    }, { passive: false });
  }

  /* docs/12 §2: THE one screen→canvas mapping every tool shares.
     clientXY → canvas backing-store pixels via the live bounding rect, so CSS
     stretching, DPR, panel offsets, and visual-viewport shifts all cancel. */
  screenPt(e) {
    const r = this.canvas.getBoundingClientRect();
    return [
      (e.clientX - r.left) * (this.canvas.width / r.width),
      (e.clientY - r.top) * (this.canvas.height / r.height)
    ];
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
  eventWorld(e) {
    const [px, py] = this.screenPt(e);
    return this.toWorld(px, py);
  }

  band() { return Math.max(MIN_BAND, Math.min(MAX_BAND, Math.round(this.view.zoomExp))); }

  zoomAt(px, py, dz) {
    const [wx, wy] = this.toWorld(px, py);
    this.view.zoomExp = Math.max(MIN_BAND - 0.49, Math.min(MAX_BAND + 0.49, this.view.zoomExp + dz));
    const s = this.scale();
    this.view.cx = wx - (px - this.canvas.width / 2) / s;
    this.view.cy = wy - (py - this.canvas.height / 2) / s;
    this.cb.onViewChange?.(this.view);
    this.render();
  }

  /* ---- display tile pyramid ---- */

  tile(b, tx, ty) {
    const key = `${b}:${tx}:${ty}`;
    let t = this.tiles.get(key);
    if (t) { t.used = performance.now(); return t.canvas; }
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    const g = c.getContext('2d');
    const sb = Math.pow(2, b);
    const x0 = tx * TILE / sb, y0 = ty * TILE / sb;
    g.setTransform(sb, 0, 0, sb, -x0 * sb, -y0 * sb);
    this.cb.drawTile(g, b, { x0, y0, x1: x0 + TILE / sb, y1: y0 + TILE / sb });
    this.tiles.set(key, { canvas: c, used: performance.now() });
    if (this.tiles.size > MAX_TILES) {
      const oldest = [...this.tiles.entries()].sort((a, b2) => a[1].used - b2[1].used)[0];
      this.tiles.delete(oldest[0]);
    }
    return c;
  }

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
    const band = this.band();
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
    this.cb.drawOverlay?.(g, this); // shape previews, selection ants, cursors
  }

  /* ---- input ---- */

  down(e) {
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    const [px, py] = this.screenPt(e);
    this.pointers.set(e.pointerId, [px, py]);
    const n = this.pointers.size;
    if (n === 1) this.tap = { t: performance.now(), max: 1, moved: false };
    else if (this.tap) this.tap.max = Math.max(this.tap.max, n);
    if (n === 2) {
      // shapes use a second finger as the constrain modifier (docs/12 §3);
      // otherwise it cancels the stroke — pinching must not paint
      if (this.drawing && this.cb.secondFinger?.()) { this.pointers.delete(e.pointerId); return; }
      if (this.drawing) { this.cb.toolCancel?.(); this.drawing = false; }
      this.cancelPress();
      this.picking = false;
      this.pinch = null;
      return;
    }
    if (this.cb.isPan?.() || e.button === 1) { this.panFrom = [px, py]; return; }
    this.drawing = true;
    const [wx, wy] = this.toWorld(px, py);
    // long-press without movement hands the pointer over (eyedropper shortcut)
    this.pressTimer = setTimeout(() => {
      if (this.drawing && this.cb.longPress?.(wx, wy, px, py)) {
        this.drawing = false;
        this.picking = true;
      }
    }, 600);
    this.pressAt = [px, py];
    this.cb.toolDown?.(wx, wy, e.pressure || 0.5, e);
  }

  cancelPress() {
    clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const [px, py] = this.screenPt(e);
    const prev = this.pointers.get(e.pointerId);
    if (this.tap && Math.hypot(px - prev[0], py - prev[1]) > 9) this.tap.moved = true;
    if (this.pressAt && Math.hypot(px - this.pressAt[0], py - this.pressAt[1]) > 7) this.cancelPress();
    this.pointers.set(e.pointerId, [px, py]);
    if (this.picking) { this.cb.pickAt?.(...this.toWorld(px, py), px, py); return; }

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
      this.view.cx -= (px - prev[0]) / s;
      this.view.cy -= (py - prev[1]) / s;
      this.cb.onViewChange?.(this.view);
      this.render();
      return;
    }
    if (!this.drawing) return;
    const [wx, wy] = this.toWorld(px, py);
    this.cb.toolMove?.(wx, wy, e.pressure || 0.5, e);
  }

  up(e) {
    const had = this.pointers.has(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!had) return;
    this.cancelPress();
    // Kleki gestures: clean two-finger tap = undo, three-finger tap = redo.
    // In fullscreen a two-finger DOUBLE tap toggles the toolbar, so the undo
    // dispatch waits one beat for a possible second tap (docs/12 §1).
    if (this.tap && this.pointers.size === 0) {
      const quick = performance.now() - this.tap.t < 350 && !this.tap.moved;
      if (quick && this.tap.max === 2) {
        if (this.cb.wantsTbToggle?.()) {
          if (this.tapWait) {
            clearTimeout(this.tapWait);
            this.tapWait = null;
            this.cb.gesture?.('toolbar');
          } else {
            this.tapWait = setTimeout(() => { this.tapWait = null; this.cb.gesture?.('undo'); }, 320);
          }
        } else this.cb.gesture?.('undo');
      } else if (quick && this.tap.max === 3) this.cb.gesture?.('redo');
      this.tap = null;
    }
    this.pinch = null;
    this.panFrom = null;
    if (this.picking) {
      this.picking = false;
      this.cb.pickEnd?.();
    }
    if (this.drawing) {
      this.drawing = false;
      const [wx, wy] = this.eventWorld(e);
      this.cb.toolUp?.(wx, wy, e);
    }
    this.render();
  }

  /** Re-fit the backing store to the canvas's CSS box (fullscreen, rotation). */
  resize(dpr = Math.min(2, devicePixelRatio || 1)) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
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

/** Polyline points for the shape tools (kept from v1). */
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
