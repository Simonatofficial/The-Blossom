/* Raster layer core for the Infinite Canvas overhaul (docs/12 §0, §3, §4, §7).
   Layers are sparse grids of 512px raster tiles, allocated only where painted,
   keyed per zoom band so the infinite world model holds: painting rasterizes
   at the current band's native resolution; display composites every band.
   Undo/redo snapshots only the tiles a stroke touched (bounded memory). */

import { ulid } from '../core/ids.js';

export const RTILE = 512;
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'hue', 'saturation', 'color', 'luminosity'];
const MAX_LAYERS = 16;
const HISTORY_CAP = 50;

function blank() {
  const c = document.createElement('canvas');
  c.width = c.height = RTILE;
  return c;
}

function copyTile(c) {
  const d = blank();
  d.getContext('2d').drawImage(c, 0, 0);
  return d;
}

export class RasterDoc {
  /**
   * @param {{layers: {id,name,visible,opacity,blend}[], active: string}} meta
   *        persisted by the caller (widget config) — mutated in place.
   * @param {{loadTile: (key: string) => Blob|null,
   *          saveTile: (key: string, blob: Blob|null) => void,
   *          tileKeys: () => string[],
   *          onTilesDecoded: () => void,
   *          onMetaChange: () => void,
   *          applyTbox?: (id: string, data: object|null) => void}} io
   */
  constructor(meta, io) {
    this.meta = meta;
    this.io = io;
    if (!meta.layers?.length) {
      meta.layers = [{ id: ulid(), name: 'Layer 1', visible: true, opacity: 1, blend: 'normal' }];
      meta.active = meta.layers[0].id;
    }
    this.tiles = new Map();    // key -> canvas (decoded/painted)
    this.missing = new Set();  // keys known to have no stored blob
    this.dirty = new Set();    // keys needing persistence
    this.decoding = new Map(); // key -> Promise (blob still inflating)
    this.history = [];
    this.redoStack = [];
    this.session = null;       // active stroke
    this.batch = null;         // open multi-op history step (select lift+drop)
    this.mask = null;          // active selection polygon (world pts) — paints clip to it
  }

  key(layerId, band, tx, ty) { return `${layerId}:${band}:${tx}:${ty}`; }
  layer(id) { return this.meta.layers.find(l => l.id === id); }
  active() { return this.layer(this.meta.active) || this.meta.layers[0]; }

  /* ---------- tile access ---------- */

  /** Tile canvas for paint/compose. create=true allocates; else may return null. */
  tile(layerId, band, tx, ty, create = false) {
    const key = this.key(layerId, band, tx, ty);
    let c = this.tiles.get(key);
    if (c) return c;
    if (!this.missing.has(key)) {
      const blob = this.io.loadTile(key);
      if (blob) {
        c = blank();
        this.tiles.set(key, c);
        const job = createImageBitmap(blob).then(bmp => {
          // stroke laid down while the blob was decoding stays on top
          const g = c.getContext('2d');
          g.save();
          g.globalCompositeOperation = 'destination-over';
          g.drawImage(bmp, 0, 0);
          g.restore();
          this.decoding.delete(key);
          this.io.onTilesDecoded();
        }).catch(() => this.decoding.delete(key));
        this.decoding.set(key, job);
        return c;
      }
      this.missing.add(key);
    }
    if (!create) return null;
    c = blank();
    this.tiles.set(key, c);
    this.missing.delete(key);
    return c;
  }

  /** Resolve once every listed tile's persisted pixels are decoded into memory. */
  async ensureLoaded(keys) {
    const jobs = [];
    for (const key of keys) {
      const [lid, b, tx, ty] = key.split(':');
      this.tile(lid, Number(b), Number(tx), Number(ty), false);
      const job = this.decoding.get(key);
      if (job) jobs.push(job);
    }
    await Promise.all(jobs);
  }

  /** All known keys (memory + persisted) of one layer. */
  keysOf(layerId) {
    const keys = new Set();
    for (const key of this.io.tileKeys()) if (key.startsWith(layerId + ':')) keys.add(key);
    for (const key of this.tiles.keys()) if (key.startsWith(layerId + ':')) keys.add(key);
    return [...keys];
  }

  /** Persist all dirty tiles (PNG blobs; null blob = deleted tile). */
  flush() {
    for (const key of [...this.dirty]) {
      this.dirty.delete(key);
      const c = this.tiles.get(key);
      if (!c) { this.io.saveTile(key, null); continue; }
      c.toBlob(blob => this.io.saveTile(key, blob), 'image/png');
    }
  }

  /** Every stored band a layer has tiles in (memory + persisted index). */
  bandsOf(layerId) {
    const bands = new Set();
    for (const key of this.io.tileKeys()) {
      const [lid, b] = key.split(':');
      if (lid === layerId) bands.add(Number(b));
    }
    for (const key of this.tiles.keys()) {
      const [lid, b] = key.split(':');
      if (lid === layerId) bands.add(Number(b));
    }
    return [...bands].sort((a, b) => a - b);
  }

  /* ---------- compositing (called from the display tile renderer) ----------
     g is already transformed to WORLD space. Draw layers back→front; a layer
     with blend/opacity composites through a scratch canvas sized to the
     display tile so blend modes apply to the stack below, not per-tile. */
  compose(g, wx0, wy0, wx1, wy1) {
    for (const layer of this.meta.layers) {
      if (!layer.visible) continue;
      g.save();
      g.globalAlpha = layer.opacity ?? 1;
      g.globalCompositeOperation = layer.blend && layer.blend !== 'normal' ? layer.blend : 'source-over';
      for (const band of this.bandsOf(layer.id)) {
        const sb = Math.pow(2, band);
        const ts = RTILE / sb; // tile size in world units
        const tx0 = Math.floor(wx0 / ts), ty0 = Math.floor(wy0 / ts);
        const tx1 = Math.floor(wx1 / ts), ty1 = Math.floor(wy1 / ts);
        if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 256) continue; // band far coarser than view — skip
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            const c = this.tile(layer.id, band, tx, ty, false);
            if (c) g.drawImage(c, tx * ts, ty * ts, ts, ts);
          }
        }
      }
      g.restore();
    }
  }

  /* ---------- painting (docs/12 §3): spacing-based stamping ---------- */

  /**
   * @param {{tool: 'pen'|'pixel'|'eraser'|'blend'|'sketchy', color: string, size: number,
   *          opacity: number, hardness: number, strength?: number, band: number,
   *          pixelErase?: boolean}} state
   */
  begin(state) {
    this.session = { ...state, mask: this.mask, touched: new Map(), last: null, carry: 0, mix: null, bbox: null };
  }

  /** Abort the live stroke and restore every touched tile (long-press pick, pinch). */
  cancel() {
    const s = this.session;
    this.session = null;
    if (!s || !s.touched.size) return null;
    for (const [key, before] of s.touched) {
      const c = this.tiles.get(key);
      if (!c) continue;
      const g = c.getContext('2d');
      g.clearRect(0, 0, RTILE, RTILE);
      g.drawImage(before, 0, 0);
      this.dirty.add(key);
    }
    return s.bbox;
  }

  /** Clip a tile context to the session/selection mask (tile-local coords). */
  clipMask(g, mask, tx, ty, sb) {
    if (!mask?.length) return;
    g.beginPath();
    mask.forEach(([wx, wy], i) => {
      const x = wx * sb - tx * RTILE, y = wy * sb - ty * RTILE;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.closePath();
    g.clip();
  }

  /** One stamp center in world coords; walks spacing from the previous point
      (spacing-based stamping so fast strokes don't gap — docs/12 §3). */
  stamp(wx, wy, pressure = 0.5) {
    const s = this.session;
    if (!s) return;
    if (!s.last) { this.dab(wx, wy, pressure); s.last = [wx, wy, pressure]; return; }
    const [lx, ly, lp] = s.last;
    const dist = Math.hypot(wx - lx, wy - ly);
    if (!dist) return;
    const spacing = Math.max(0.35 / Math.pow(2, s.band), s.size * (s.tool === 'pixel' ? 0.9 : 0.18));
    let pos = spacing - s.carry; // distance along this segment to the next stamp
    while (pos <= dist) {
      const t = pos / dist;
      this.dab(lx + (wx - lx) * t, ly + (wy - ly) * t, lp + (pressure - lp) * t);
      pos += spacing;
    }
    s.carry = dist - (pos - spacing); // accumulated distance since the last stamp
    s.last = [wx, wy, pressure];
  }

  /** Paint one dab into every layer tile it touches (band-native pixels). */
  dab(wx, wy, pressure) {
    const s = this.session;
    const layer = this.active();
    const sb = Math.pow(2, s.band);
    const pr = Math.max(0.5, (s.size * sb) / 2 * (s.tool === 'pixel' ? 1 : (0.35 + pressure)));
    const ts = RTILE / sb;
    const x0 = Math.floor((wx - pr / sb) / ts), x1 = Math.floor((wx + pr / sb) / ts);
    const y0 = Math.floor((wy - pr / sb) / ts), y1 = Math.floor((wy + pr / sb) / ts);
    const wb = { x0: wx - pr / sb, y0: wy - pr / sb, x1: wx + pr / sb, y1: wy + pr / sb };
    s.bbox = s.bbox
      ? { x0: Math.min(s.bbox.x0, wb.x0), y0: Math.min(s.bbox.y0, wb.y0), x1: Math.max(s.bbox.x1, wb.x1), y1: Math.max(s.bbox.y1, wb.y1) }
      : wb;

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const key = this.key(layer.id, s.band, tx, ty);
        const c = this.tile(layer.id, s.band, tx, ty, true);
        // snapshot the pre-stroke state once per tile (blank for fresh tiles)
        if (!s.touched.has(key)) s.touched.set(key, copyTile(c));
        const g = c.getContext('2d');
        g.save();
        this.clipMask(g, s.mask, tx, ty, sb);
        const bx = wx * sb - tx * RTILE, by = wy * sb - ty * RTILE;
        this.drawDab(g, bx, by, pr, pressure);
        g.restore();
        this.dirty.add(key);
      }
    }
  }

  /** Stroke one straight line into the active layer within the live session —
      the sketchy brush's web threads (docs/12 §3). World coords; width/alpha raw. */
  seg(xa, ya, xb, yb, width, alpha) {
    const s = this.session;
    if (!s) return;
    const layer = this.active();
    const sb = Math.pow(2, s.band);
    const pad = width;
    const x0 = Math.floor((Math.min(xa, xb) - pad) * sb / RTILE), x1 = Math.floor((Math.max(xa, xb) + pad) * sb / RTILE);
    const y0 = Math.floor((Math.min(ya, yb) - pad) * sb / RTILE), y1 = Math.floor((Math.max(ya, yb) + pad) * sb / RTILE);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) return; // web threads stay local
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const key = this.key(layer.id, s.band, tx, ty);
        const c = this.tile(layer.id, s.band, tx, ty, true);
        if (!s.touched.has(key)) s.touched.set(key, copyTile(c));
        const g = c.getContext('2d');
        g.save();
        this.clipMask(g, s.mask, tx, ty, sb);
        g.globalAlpha = alpha;
        g.strokeStyle = s.color;
        g.lineWidth = Math.max(0.4, width * sb);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(xa * sb - tx * RTILE, ya * sb - ty * RTILE);
        g.lineTo(xb * sb - tx * RTILE, yb * sb - ty * RTILE);
        g.stroke();
        g.restore();
        this.dirty.add(key);
      }
    }
    const wb = { x0: Math.min(xa, xb) - pad, y0: Math.min(ya, yb) - pad, x1: Math.max(xa, xb) + pad, y1: Math.max(ya, yb) + pad };
    s.bbox = s.bbox
      ? { x0: Math.min(s.bbox.x0, wb.x0), y0: Math.min(s.bbox.y0, wb.y0), x1: Math.max(s.bbox.x1, wb.x1), y1: Math.max(s.bbox.y1, wb.y1) }
      : wb;
  }

  drawDab(g, bx, by, pr, pressure) {
    const s = this.session;
    g.save();
    if (s.tool === 'eraser' && !s.pixelErase) {
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = s.opacity;
      const grad = g.createRadialGradient(bx, by, 0, bx, by, pr);
      grad.addColorStop(Math.min(0.99, s.hardness), 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(bx, by, pr, 0, Math.PI * 2);
      g.fill();
    } else if (s.tool === 'pixel' || s.pixelErase) {
      // hard squares snapped to the band's pixel grid, no AA (docs/12);
      // the eraser's pixel mode shares the path with destination-out
      g.imageSmoothingEnabled = false;
      if (s.tool === 'eraser') g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = s.opacity;
      g.fillStyle = s.color;
      const n = Math.max(1, Math.round(s.size * Math.pow(2, s.band)));
      g.fillRect(Math.floor(bx - n / 2), Math.floor(by - n / 2), n, n);
    } else if (s.tool === 'blend') {
      // smudge: carry color forward, mixing with what's underneath
      const sx = Math.min(RTILE - 1, Math.max(0, Math.round(bx)));
      const sy = Math.min(RTILE - 1, Math.max(0, Math.round(by)));
      const img = g.getImageData(sx, sy, 1, 1).data;
      const under = [img[0], img[1], img[2], img[3] / 255];
      if (!s.mix) s.mix = under[3] > 0 ? under : hexRgb(s.color);
      const k = (s.strength ?? 0.5) * 0.6;
      s.mix = s.mix.map((v, i) => i < 3 ? v + (under[i] - v) * (1 - k) * (under[3] || 0) : 1);
      const grad = g.createRadialGradient(bx, by, 0, bx, by, pr);
      grad.addColorStop(0, `rgba(${s.mix[0] | 0},${s.mix[1] | 0},${s.mix[2] | 0},${0.35 * s.opacity})`);
      grad.addColorStop(1, `rgba(${s.mix[0] | 0},${s.mix[1] | 0},${s.mix[2] | 0},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(bx, by, pr, 0, Math.PI * 2);
      g.fill();
    } else { // pen: hardness-controlled soft stamp, pressure in size+alpha
      g.globalAlpha = s.opacity * (0.5 + pressure * 0.5);
      const grad = g.createRadialGradient(bx, by, 0, bx, by, pr);
      grad.addColorStop(0, s.color);
      grad.addColorStop(Math.min(0.99, s.hardness), s.color);
      grad.addColorStop(1, hexA(s.color, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(bx, by, pr, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  /** Close the stroke; returns its world bbox (for display invalidation). */
  end() {
    const s = this.session;
    this.session = null;
    if (!s || !s.touched.size) return null;
    this.commitTouched(s.touched);
    return s.bbox;
  }

  /** Turn a touched-tile snapshot map into one history step (or feed the batch). */
  commitTouched(touched) {
    if (this.batch) {
      for (const [key, before] of touched) if (!this.batch.has(key)) this.batch.set(key, before);
      return;
    }
    this.push({
      kind: 'tiles',
      tiles: [...touched.entries()].map(([key, before]) => ({ key, before, after: this.tiles.get(key) ? copyTile(this.tiles.get(key)) : null }))
    });
  }

  /** Open a multi-op history step (selection lift → transform → drop = one undo). */
  beginBatch() { this.batch = this.batch || new Map(); }

  endBatch() {
    const touched = this.batch;
    this.batch = null;
    if (touched?.size) this.commitTouched(touched);
  }

  /**
   * Vector-draw straight into the active layer's tiles: draw(g) runs with the
   * context transformed to WORLD coordinates (line widths in world units).
   * Serves shapes; unbounded world rects stay cheap because only intersecting
   * tiles are visited. One history step (unless batched).
   * @returns {object} the world bbox actually painted
   */
  rasterOp(rect, band, draw, { layerId = null, mask = this.mask } = {}) {
    const layer = layerId ? this.layer(layerId) : this.active();
    const sb = Math.pow(2, band);
    const ts = RTILE / sb;
    const x0 = Math.floor(rect.x0 / ts), x1 = Math.floor(rect.x1 / ts);
    const y0 = Math.floor(rect.y0 / ts), y1 = Math.floor(rect.y1 / ts);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 1024) return rect; // safety net
    const touched = new Map();
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const key = this.key(layer.id, band, tx, ty);
        const c = this.tile(layer.id, band, tx, ty, true);
        if (!touched.has(key)) touched.set(key, copyTile(c));
        const g = c.getContext('2d');
        g.save();
        this.clipMask(g, mask, tx, ty, sb);
        g.transform(sb, 0, 0, sb, -tx * RTILE, -ty * RTILE);
        draw(g);
        g.restore();
        this.dirty.add(key);
      }
    }
    this.commitTouched(touched);
    return rect;
  }

  /**
   * Stamp a pixel image (canvas/bitmap) over a world rect into a layer —
   * fill results, gradients, selection drops. op 'destination-out' erases
   * the image's alpha instead of painting it.
   */
  stampImage(img, rect, band, { op = 'source-over', alpha = 1, layerId = null, mask = this.mask } = {}) {
    return this.rasterOp(rect, band, (g) => {
      g.globalCompositeOperation = op;
      g.globalAlpha = alpha;
      g.drawImage(img, rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
    }, { layerId, mask });
  }

  /** Compose ONE layer's raw pixels (no opacity/blend) — selection lifts. */
  composeLayer(g, layerId, wx0, wy0, wx1, wy1) {
    for (const band of this.bandsOf(layerId)) {
      const sb = Math.pow(2, band);
      const ts = RTILE / sb;
      const tx0 = Math.floor(wx0 / ts), ty0 = Math.floor(wy0 / ts);
      const tx1 = Math.floor(wx1 / ts), ty1 = Math.floor(wy1 / ts);
      if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 256) continue;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const c = this.tile(layerId, band, tx, ty, false);
          if (c) g.drawImage(c, tx * ts, ty * ts, ts, ts);
        }
      }
    }
  }

  /* ---------- history (docs/12 §4): 50 steps, tile snapshots ---------- */

  push(entry) {
    this.history.push(entry);
    if (this.history.length > HISTORY_CAP) this.history.shift();
    this.redoStack = [];
    this.io.onMetaChange();
  }

  swap(entry, useBefore) {
    if (entry.kind === 'tiles') {
      for (const t of entry.tiles) {
        const img = useBefore ? t.before : t.after;
        if (img) {
          const c = this.tile(...t.key.split(':').map((v, i) => i ? Number(v) : v), true);
          const g = c.getContext('2d');
          g.clearRect(0, 0, RTILE, RTILE);
          g.drawImage(img, 0, 0);
        } else {
          this.tiles.delete(t.key);
          this.missing.add(t.key);
        }
        this.dirty.add(t.key);
      }
    } else if (entry.kind === 'meta') {
      this.meta.layers = structuredClone(useBefore ? entry.before : entry.after);
      if (!this.layer(this.meta.active)) this.meta.active = this.meta.layers[0]?.id;
    } else if (entry.kind === 'tbox') {
      // text boxes live as objects — the widget glue applies the snapshot
      this.io.applyTbox?.(entry.id, structuredClone(useBefore ? entry.before : entry.after));
    } else if (entry.kind === 'multi') {
      for (const part of entry.parts) this.swap(part, useBefore);
    }
  }

  undo() {
    const e = this.history.pop();
    if (!e) return false;
    this.swap(e, true);
    this.redoStack.push(e);
    this.io.onMetaChange();
    return true;
  }

  redo() {
    const e = this.redoStack.pop();
    if (!e) return false;
    this.swap(e, false);
    this.history.push(e);
    this.io.onMetaChange();
    return true;
  }

  /* ---------- layer operations (docs/12 §7) ---------- */

  metaOp(fn) {
    const before = structuredClone(this.meta.layers);
    fn();
    this.push({ kind: 'meta', before, after: structuredClone(this.meta.layers) });
  }

  addLayer() {
    if (this.meta.layers.length >= MAX_LAYERS) return null;
    let l;
    this.metaOp(() => {
      l = { id: ulid(), name: `Layer ${this.meta.layers.length + 1}`, visible: true, opacity: 1, blend: 'normal' };
      this.meta.layers.push(l);
      this.meta.active = l.id;
    });
    return l;
  }

  /** Undoable: only the meta entry goes; orphaned tiles are vacuumed on the
      NEXT document open, once no history step can resurrect the layer. */
  deleteLayer(id) {
    if (this.meta.layers.length <= 1) return;
    this.metaOp(() => {
      this.meta.layers = this.meta.layers.filter(l => l.id !== id);
      if (this.meta.active === id) this.meta.active = this.meta.layers[this.meta.layers.length - 1].id;
    });
  }

  /** Copy a layer: persisted tiles clone by blob, freshly painted ones by canvas. */
  duplicateLayer(id) {
    if (this.meta.layers.length >= MAX_LAYERS) return null;
    const src = this.layer(id);
    if (!src) return null;
    let dup;
    this.metaOp(() => {
      dup = { ...structuredClone(src), id: ulid(), name: `${src.name} copy` };
      this.meta.layers.splice(this.meta.layers.indexOf(src) + 1, 0, dup);
      this.meta.active = dup.id;
    });
    for (const key of this.keysOf(id)) {
      const newKey = dup.id + key.slice(id.length);
      const mem = this.tiles.get(key);
      if (mem && this.dirty.has(key)) {
        this.tiles.set(newKey, copyTile(mem));
        this.dirty.add(newKey);
      } else {
        const blob = this.io.loadTile(key);
        if (blob) this.io.saveTile(newKey, blob);
        else if (mem) { this.tiles.set(newKey, copyTile(mem)); this.dirty.add(newKey); }
      }
    }
    return dup;
  }

  /** Merge a layer's pixels (with its opacity + blend) into the one below.
      Per-band tile copy keeps the infinite model; one undoable step. */
  async mergeDown(id) {
    const i = this.meta.layers.findIndex(l => l.id === id);
    if (i <= 0) return false;
    const upper = this.meta.layers[i], lower = this.meta.layers[i - 1];
    const upperKeys = this.keysOf(upper.id);
    await this.ensureLoaded(upperKeys);
    await this.ensureLoaded(upperKeys.map(k => lower.id + k.slice(upper.id.length)));
    const touched = new Map();
    for (const key of upperKeys) {
      const [, b, tx, ty] = key.split(':');
      const src = this.tile(upper.id, Number(b), Number(tx), Number(ty), false);
      if (!src) continue;
      const dstKey = this.key(lower.id, Number(b), Number(tx), Number(ty));
      const dst = this.tile(lower.id, Number(b), Number(tx), Number(ty), true);
      if (!touched.has(dstKey)) touched.set(dstKey, copyTile(dst));
      const g = dst.getContext('2d');
      g.save();
      g.globalAlpha = upper.opacity ?? 1;
      g.globalCompositeOperation = upper.blend && upper.blend !== 'normal' ? upper.blend : 'source-over';
      g.drawImage(src, 0, 0);
      g.restore();
      this.dirty.add(dstKey);
    }
    const before = structuredClone(this.meta.layers);
    this.meta.layers.splice(i, 1);
    if (this.meta.active === id) this.meta.active = lower.id;
    const entry = {
      kind: 'multi',
      parts: [
        { kind: 'tiles', tiles: [...touched.entries()].map(([key, b4]) => ({ key, before: b4, after: copyTile(this.tiles.get(key)) })) },
        { kind: 'meta', before, after: structuredClone(this.meta.layers) }
      ]
    };
    this.push(entry);
    // text boxes ride along to the surviving layer (never baked) — the glue
    // appends their moves to this same entry so one undo reverses everything
    this.io.onLayerAbsorbed?.(upper.id, lower.id, entry);
    return true;
  }

  /** Drop persisted tiles whose layer no longer exists (run on fresh open,
      when the history is empty and nothing can bring the layer back). */
  vacuum() {
    if (this.history.length || this.redoStack.length) return;
    const live = new Set(this.meta.layers.map(l => l.id));
    for (const key of this.io.tileKeys()) {
      if (!live.has(key.split(':')[0])) this.io.saveTile(key, null);
    }
  }

  moveLayer(id, dir) {
    this.metaOp(() => {
      const i = this.meta.layers.findIndex(l => l.id === id);
      const j = i + dir;
      if (j < 0 || j >= this.meta.layers.length) return;
      const [l] = this.meta.layers.splice(i, 1);
      this.meta.layers.splice(j, 0, l);
    });
  }

  async clearLayer(id) {
    const keys = this.keysOf(id);
    await this.ensureLoaded(keys); // snapshots must hold decoded pixels
    const tiles = [];
    for (const key of keys) {
      const c = this.tiles.get(key);
      tiles.push({ key, before: c ? copyTile(c) : null, after: null });
      this.tiles.delete(key);
      this.missing.add(key);
      this.dirty.add(key);
    }
    if (tiles.length) this.push({ kind: 'tiles', tiles });
  }
}

/* ---- color helpers ---- */
export function hexA(hex, a) {
  const v = hex.replace('#', '');
  const n = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`;
}
function hexRgb(hex) {
  const v = hex.replace('#', '');
  const n = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 1];
}
