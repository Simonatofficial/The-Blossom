/* Raster layer core for the Infinite Canvas overhaul (docs/12 §0, §3, §4, §7).
   Layers are sparse grids of 512px raster tiles, allocated only where painted,
   keyed per zoom band so the infinite world model holds.

   CR-12 invariant: a layer is ONE logical image; zoom is only a camera.
   - Every edit goes through applyWrite(): coarser content under the edit is
     promoted (moved) into the write band, finer existing tiles are written
     directly with a world-space transform — so paint/erase/fill hit the same
     logical content at any zoom, and regions converge to a single native band
     (the finest ever painted there).
   - Rendering far out never culls: bands much finer than the view render
     through a lazily-built, dirt-tracked mip chain instead of being skipped.
   Undo/redo snapshots only the tiles an edit touched (bounded memory). */

import { ulid } from '../core/ids.js';

export const RTILE = 512;
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'hue', 'saturation', 'color', 'luminosity'];
const MAX_LAYERS = 16;
const HISTORY_CAP = 50;
const MIN_MIP = -24; // mip levels stop at the world model's coarsest band

/* CR-13a hard budgets — device-scaled, so a mid-range phone degrades
   gracefully instead of ever crashing. ~1MB per decoded 512px tile. */
const DEV_GB = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;
const TILE_CACHE_MAX = Math.max(96, Math.min(384, DEV_GB * 64));
const HIST_BUDGET = Math.max(32, Math.min(128, DEV_GB * 16)) * 1024 * 1024;
export const FINE_TILE_CAP = 512; // tiles one commit may rewrite outside its own band

function blank() {
  const c = document.createElement('canvas');
  c.width = c.height = RTILE;
  return c;
}

export function copyTile(c) {
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
    this.encoding = new Set(); // keys with a toBlob save in flight (don't evict)
    this.lru = new Map();      // key -> tick of last access (CR-13a eviction)
    this.tick = 0;
    this.mips = new Map();     // render-only downsample cache (CR-12; never persisted)
    this.occ = new Map();      // `${layerId}:${band}` -> Map(level -> Set('tx:ty'))
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
    if (c) { this.lru.set(key, ++this.tick); return c; }
    if (!this.missing.has(key)) {
      const blob = this.io.loadTile(key);
      if (blob) {
        c = blank();
        this.tiles.set(key, c);
        this.lru.set(key, ++this.tick);
        const job = createImageBitmap(blob).then(bmp => {
          this.decoding.delete(key);
          if (this.tiles.get(key) !== c) return; // deleted/evicted mid-decode
          // stroke laid down while the blob was decoding stays on top
          const g = c.getContext('2d');
          g.save();
          g.globalCompositeOperation = 'destination-over';
          g.drawImage(bmp, 0, 0);
          g.restore();
          this.bustMips(key); // mips built from the placeholder are stale
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
    this.lru.set(key, ++this.tick);
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

  /** Existing tile coords of one layer band, as a Set('tx:ty'). */
  coordsOf(layerId, band) {
    const set = new Set();
    const prefix = `${layerId}:${band}:`;
    for (const key of this.keysOf(layerId)) {
      if (key.startsWith(prefix)) set.add(key.slice(prefix.length));
    }
    return set;
  }

  /* ---------- mip chain (CR-12): render-only downsample pyramid so far-out
     views draw real content instead of culling fine bands ---------- */

  /** Occupancy: does any content tile of (layer, band) sit under this mip node? */
  occupied(layerId, band, level, tx, ty) {
    const ok = `${layerId}:${band}`;
    let m = this.occ.get(ok);
    if (!m) {
      m = new Map();
      for (const coord of this.coordsOf(layerId, band)) {
        let [cx, cy] = coord.split(':').map(Number);
        for (let l = band - 1; l >= MIN_MIP; l--) {
          cx = Math.floor(cx / 2);
          cy = Math.floor(cy / 2);
          if (!m.has(l)) m.set(l, new Set());
          m.get(l).add(`${cx}:${cy}`);
        }
      }
      this.occ.set(ok, m);
    }
    return m.get(level)?.has(`${tx}:${ty}`) ?? false;
  }

  /** Register a freshly created content tile in the occupancy index. */
  occAdd(layerId, band, tx, ty) {
    const m = this.occ.get(`${layerId}:${band}`);
    if (!m) return; // index not built yet — will include it when it is
    let cx = tx, cy = ty;
    for (let l = band - 1; l >= MIN_MIP; l--) {
      cx = Math.floor(cx / 2);
      cy = Math.floor(cy / 2);
      if (!m.has(l)) m.set(l, new Set());
      m.get(l).add(`${cx}:${cy}`);
    }
  }

  /** A 512px downsample of (layer, srcBand) content at a coarser level. */
  mipTile(layerId, srcBand, level, tx, ty) {
    const key = `${layerId}:${srcBand}>${level}:${tx}:${ty}`;
    if (this.mips.has(key)) return this.mips.get(key);
    let c = null;
    if (this.occupied(layerId, srcBand, level, tx, ty)) {
      const next = level + 1;
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const src = next === srcBand
            ? this.tile(layerId, srcBand, tx * 2 + dx, ty * 2 + dy, false)
            : this.mipTile(layerId, srcBand, next, tx * 2 + dx, ty * 2 + dy);
          if (!src) continue;
          if (!c) c = blank();
          // drawn twice: ~2× alpha per level cancels the 2× minification fade,
          // so distant work simplifies to firm marks instead of vanishing
          const g = c.getContext('2d');
          g.drawImage(src, dx * RTILE / 2, dy * RTILE / 2, RTILE / 2, RTILE / 2);
          g.drawImage(src, dx * RTILE / 2, dy * RTILE / 2, RTILE / 2, RTILE / 2);
        }
      }
    }
    if (this.mips.size > 600) this.mips.clear(); // simple pressure valve
    this.mips.set(key, c);
    return c;
  }

  /** Drop cached mips above a touched content tile. */
  bustMips(key) {
    const [layerId, b, tx0, ty0] = key.split(':');
    let tx = Number(tx0), ty = Number(ty0);
    const band = Number(b);
    for (let l = band - 1; l >= MIN_MIP; l--) {
      tx = Math.floor(tx / 2);
      ty = Math.floor(ty / 2);
      this.mips.delete(`${layerId}:${band}>${l}:${tx}:${ty}`);
    }
  }

  /** Nuke caches for a layer (undo swaps, clears, merges — coarse but safe). */
  bustLayer(layerId) {
    for (const key of [...this.mips.keys()]) if (key.startsWith(layerId + ':')) this.mips.delete(key);
    for (const key of [...this.occ.keys()]) if (key.startsWith(layerId + ':')) this.occ.delete(key);
  }

  /** Persist all dirty tiles (PNG blobs; null blob = deleted tile). */
  flush() {
    for (const key of [...this.dirty]) {
      this.dirty.delete(key);
      const c = this.tiles.get(key);
      if (!c) { this.io.saveTile(key, null); continue; }
      this.encoding.add(key);
      c.toBlob(blob => { this.io.saveTile(key, blob); this.encoding.delete(key); }, 'image/png');
    }
    this.evict();
  }

  /** CR-13a: resident decoded tiles are an LRU cache, not the document.
      Anything persisted and idle can drop; it reloads from its blob on touch. */
  evict() {
    if (this.tiles.size <= TILE_CACHE_MAX) return;
    const idle = [...this.tiles.keys()]
      .filter(k => !this.dirty.has(k) && !this.encoding.has(k) && !this.decoding.has(k) && this.io.loadTile(k))
      .sort((a, b) => (this.lru.get(a) || 0) - (this.lru.get(b) || 0));
    for (const key of idle) {
      if (this.tiles.size <= TILE_CACHE_MAX) break;
      this.tiles.delete(key);
      this.lru.delete(key);
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
     g is already transformed to WORLD space; rBand is the render band the
     caller draws at. Bands near the render resolution draw their tiles
     directly; much finer bands draw through the mip chain — content is never
     culled at far-out zooms (CR-12 §3). */
  compose(g, wx0, wy0, wx1, wy1, rBand = null) {
    for (const layer of this.meta.layers) {
      if (!layer.visible) continue;
      g.save();
      g.globalAlpha = layer.opacity ?? 1;
      g.globalCompositeOperation = layer.blend && layer.blend !== 'normal' ? layer.blend : 'source-over';
      this.drawLayerContent(g, layer.id, wx0, wy0, wx1, wy1, rBand);
      g.restore();
    }
  }

  /** Compose ONE layer's raw pixels (no opacity/blend) — selection lifts. */
  composeLayer(g, layerId, wx0, wy0, wx1, wy1, rBand = null) {
    this.drawLayerContent(g, layerId, wx0, wy0, wx1, wy1, rBand);
  }

  drawLayerContent(g, layerId, wx0, wy0, wx1, wy1, rBand) {
    // callers that don't know their band: assume the rect is ~one tile wide
    const rB = rBand ?? Math.round(Math.log2(RTILE / Math.max(1e-12, Math.max(wx1 - wx0, wy1 - wy0))));
    const cutoff = rB + 2; // bands above this render via mips at this level
    for (const band of this.bandsOf(layerId)) {
      const level = Math.min(band, cutoff);
      const sb = Math.pow(2, level);
      const ts = RTILE / sb; // drawn-tile size in world units
      const tx0 = Math.floor(wx0 / ts), ty0 = Math.floor(wy0 / ts);
      const tx1 = Math.floor(wx1 / ts), ty1 = Math.floor(wy1 / ts);
      if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 4096) continue; // pathological caller
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const c = level === band
            ? this.tile(layerId, band, tx, ty, false)
            : this.mipTile(layerId, band, level, tx, ty);
          if (c) g.drawImage(c, tx * ts, ty * ts, ts, ts);
        }
      }
    }
  }

  /* ---------- painting (docs/12 §3): spacing-based stamping ---------- */

  /**
   * @param {{tool: 'pen'|'pixel'|'eraser'|'blend', color: string, size: number,
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
      this.bustMips(key);
    }
    return s.bbox;
  }

  /** Clip a WORLD-transformed context to the selection mask polygon. */
  clipMask(g, mask) {
    if (!mask?.length) return;
    g.beginPath();
    mask.forEach(([wx, wy], i) => i ? g.lineTo(wx, wy) : g.moveTo(wx, wy));
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

  /* ---------- THE write path (CR-12): every edit, any zoom, same content ----------
     For an edit over world rect R at write band w:
     1. content in COARSER bands under R is promoted (moved, pixel-aligned)
        into band-w tiles — erasing/painting then naturally affects it;
     2. content in FINER bands under R is written directly (world transform);
     3. band-w tiles cover the rest (allocated for paint, existing-only for
        erase), clipping OUT areas owned by finer tiles so nothing double-draws. */

  applyWrite(rect, wBand, { layerId = null, mask = this.mask, touched, erase = false } = {}, drawFn) {
    const layer = layerId ? this.layer(layerId) : this.active();
    const bands = this.bandsOf(layer.id);
    for (const b of bands) if (b < wBand) this.promote(layer.id, b, wBand, rect, touched);
    const finer = bands.filter(b => b > wBand);
    for (const b of finer) {
      this.writeBand(layer.id, b, rect, { mask, touched, existingOnly: true }, drawFn);
    }
    this.writeBand(layer.id, wBand, rect, { mask, touched, existingOnly: erase, clipFiner: finer }, drawFn);
  }

  /** Move a coarser band's content under rect into the target band
      (nearest-neighbour, pixel-grid aligned — a lossless re-banding). */
  promote(layerId, fromBand, toBand, rect, touched) {
    const sbF = Math.pow(2, fromBand), tsF = RTILE / sbF;
    const sbT = Math.pow(2, toBand), tsT = RTILE / sbT;
    for (const coord of this.coordsOf(layerId, fromBand)) {
      const [ftx, fty] = coord.split(':').map(Number);
      const tile = { x0: ftx * tsF, y0: fty * tsF, x1: (ftx + 1) * tsF, y1: (fty + 1) * tsF };
      // overlap, expanded out to the source band's pixel grid (seam-exact)
      const px = 1 / sbF;
      const x0 = Math.floor(Math.max(rect.x0, tile.x0) / px) * px;
      const y0 = Math.floor(Math.max(rect.y0, tile.y0) / px) * px;
      const x1 = Math.ceil(Math.min(rect.x1, tile.x1) / px) * px;
      const y1 = Math.ceil(Math.min(rect.y1, tile.y1) / px) * px;
      if (x1 <= x0 || y1 <= y0) continue;
      const srcKey = this.key(layerId, fromBand, ftx, fty);
      const src = this.tile(layerId, fromBand, ftx, fty, false);
      if (!src) continue;
      if (touched && !touched.has(srcKey)) touched.set(srcKey, copyTile(src));
      const sx = x0 * sbF - ftx * RTILE, sy = y0 * sbF - fty * RTILE;
      const sw = (x1 - x0) * sbF, sh = (y1 - y0) * sbF;
      for (let ty = Math.floor(y0 / tsT); ty <= Math.floor((y1 - 1e-12) / tsT); ty++) {
        for (let tx = Math.floor(x0 / tsT); tx <= Math.floor((x1 - 1e-12) / tsT); tx++) {
          const dstKey = this.key(layerId, toBand, tx, ty);
          const fresh = !this.tiles.has(dstKey) && !this.io.loadTile(dstKey);
          const dst = this.tile(layerId, toBand, tx, ty, true);
          if (touched && !touched.has(dstKey)) touched.set(dstKey, copyTile(dst));
          if (fresh) this.occAdd(layerId, toBand, tx, ty);
          const g = dst.getContext('2d');
          g.save();
          g.imageSmoothingEnabled = false; // crisp blocks, edges stay aligned
          g.globalCompositeOperation = 'destination-over'; // finer content stays on top
          g.drawImage(src, sx, sy, sw, sh,
            x0 * sbT - tx * RTILE, y0 * sbT - ty * RTILE, (x1 - x0) * sbT, (y1 - y0) * sbT);
          g.restore();
          this.dirty.add(dstKey);
          this.bustMips(dstKey);
        }
      }
      src.getContext('2d').clearRect(sx, sy, sw, sh); // moved, not copied
      this.dirty.add(srcKey);
      this.bustMips(srcKey);
    }
  }

  /** Run drawFn(g, band) world-transformed over one band's tiles in rect.
      CR-13a: existingOnly iterates the band's REAL tiles (content-bounded),
      never the rect's tile range — at low zoom that range is astronomical.
      Optional covers(wx0, wy0, ts) lets a stroke commit skip untouched tiles. */
  writeBand(layerId, band, rect, { mask, touched, existingOnly = false, clipFiner = null, clipCoords = null, covers = null } = {}, drawFn) {
    const sb = Math.pow(2, band);
    const ts = RTILE / sb;
    const x0 = Math.floor(rect.x0 / ts), x1 = Math.floor(rect.x1 / ts);
    const y0 = Math.floor(rect.y0 / ts), y1 = Math.floor(rect.y1 / ts);
    if (!existingOnly && (x1 - x0 + 1) * (y1 - y0 + 1) > 4096) return; // safety net
    const finerCoords = clipCoords || (clipFiner?.length
      ? clipFiner.map(b => ({ b, ts: RTILE / Math.pow(2, b), set: this.coordsOf(layerId, b) }))
      : null);
    const paintOne = (tx, ty, exists) => {
      if (covers && !covers(tx * ts, ty * ts, ts)) return;
      const key = this.key(layerId, band, tx, ty);
      const fresh = !exists && !this.tiles.has(key) && !this.io.loadTile(key);
      const c = this.tile(layerId, band, tx, ty, true);
      if (touched && !touched.has(key)) touched.set(key, copyTile(c));
      if (fresh) this.occAdd(layerId, band, tx, ty);
      const g = c.getContext('2d');
      g.save();
      g.transform(sb, 0, 0, sb, -tx * RTILE, -ty * RTILE); // world space
      this.clipMask(g, mask);
      if (finerCoords) {
        // paint only where no finer band owns the pixels (evenodd hole-punch)
        g.beginPath();
        g.rect(tx * ts, ty * ts, ts, ts);
        let holes = false;
        for (const f of finerCoords) {
          for (const coord of f.set) {
            const [fx, fy] = coord.split(':').map(Number);
            const rx = fx * f.ts, ry = fy * f.ts;
            if (rx + f.ts <= tx * ts || rx >= (tx + 1) * ts || ry + f.ts <= ty * ts || ry >= (ty + 1) * ts) continue;
            g.rect(rx, ry, f.ts, f.ts);
            holes = true;
          }
        }
        if (holes) g.clip('evenodd');
      }
      drawFn(g, band);
      g.restore();
      this.dirty.add(key);
      this.bustMips(key);
    };
    if (existingOnly) {
      for (const coord of this.coordsOf(layerId, band)) {
        const [tx, ty] = coord.split(':').map(Number);
        if (tx < x0 || tx > x1 || ty < y0 || ty > y1) continue;
        paintOne(tx, ty, true);
      }
    } else {
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) paintOne(tx, ty, false);
      }
    }
  }

  /** Sample the layer's composed pixel at a world point (blend brush pickup). */
  sampleColor(layerId, wx, wy) {
    const bands = this.bandsOf(layerId).sort((a, b) => b - a); // finest first
    for (const band of bands) {
      const sb = Math.pow(2, band);
      const ts = RTILE / sb;
      const c = this.tile(layerId, band, Math.floor(wx / ts), Math.floor(wy / ts), false);
      if (!c) continue;
      const px = Math.min(RTILE - 1, Math.max(0, Math.round(wx * sb - Math.floor(wx / ts) * RTILE)));
      const py = Math.min(RTILE - 1, Math.max(0, Math.round(wy * sb - Math.floor(wy / ts) * RTILE)));
      const d = c.getContext('2d').getImageData(px, py, 1, 1).data;
      if (d[3] > 0) return [d[0], d[1], d[2], d[3] / 255];
    }
    return [0, 0, 0, 0];
  }

  /** Paint one dab (world coords) — routed through the shared write path. */
  dab(wx, wy, pressure) {
    const s = this.session;
    const layer = this.active();
    // world-unit radius; floor keeps a tap visible at the zoom it was made
    const wr = Math.max(0.5 / Math.pow(2, s.band), s.size / 2 * (s.tool === 'pixel' ? 1 : (0.35 + pressure)));
    const wb = { x0: wx - wr, y0: wy - wr, x1: wx + wr, y1: wy + wr };
    s.bbox = s.bbox
      ? { x0: Math.min(s.bbox.x0, wb.x0), y0: Math.min(s.bbox.y0, wb.y0), x1: Math.max(s.bbox.x1, wb.x1), y1: Math.max(s.bbox.y1, wb.y1) }
      : wb;
    if (s.tool === 'blend') this.mixStep(layer.id, wx, wy);
    this.applyWrite(wb, s.band, { layerId: layer.id, mask: s.mask, touched: s.touched, erase: s.tool === 'eraser' },
      (g, band) => this.drawDab(s, g, band, wx, wy, wr, pressure));
  }

  /** Advance the blend brush's carried color (sampled once per dab). */
  mixStep(layerId, wx, wy) {
    const s = this.session;
    s.mix = advanceMix(s.mix, this.sampleColor(layerId, wx, wy), s.strength, s.color);
  }

  /** One dab in WORLD coordinates (g is world-transformed by the caller).
      s is passed explicitly so the stroke-buffer commit (CR-13b) can stamp
      with the same math outside a live session. */
  drawDab(s, g, band, wx, wy, wr, pressure) {
    if (s.tool === 'eraser' && !s.pixelErase) {
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = s.opacity;
      const grad = g.createRadialGradient(wx, wy, 0, wx, wy, wr);
      grad.addColorStop(Math.min(0.99, s.hardness), 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(wx, wy, wr, 0, Math.PI * 2);
      g.fill();
    } else if (s.tool === 'pixel' || s.pixelErase) {
      // hard squares snapped to the TARGET band's pixel grid, no AA (docs/12)
      if (s.tool === 'eraser') g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = s.opacity;
      g.fillStyle = s.color;
      const sb = Math.pow(2, band);
      const n = Math.max(1, Math.round(s.size * sb)); // band px
      const side = n / sb;
      g.fillRect(Math.floor((wx - side / 2) * sb) / sb, Math.floor((wy - side / 2) * sb) / sb, side, side);
    } else if (s.tool === 'blend') {
      // smudge: lay the carried color forward (mixStep updated it pre-write)
      const grad = g.createRadialGradient(wx, wy, 0, wx, wy, wr);
      grad.addColorStop(0, `rgba(${s.mix[0] | 0},${s.mix[1] | 0},${s.mix[2] | 0},${0.35 * s.opacity})`);
      grad.addColorStop(1, `rgba(${s.mix[0] | 0},${s.mix[1] | 0},${s.mix[2] | 0},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(wx, wy, wr, 0, Math.PI * 2);
      g.fill();
    } else { // pen: hardness-controlled soft stamp, pressure in size+alpha
      g.globalAlpha = s.opacity * (0.5 + pressure * 0.5);
      const grad = g.createRadialGradient(wx, wy, 0, wx, wy, wr);
      grad.addColorStop(0, s.color);
      grad.addColorStop(Math.min(0.99, s.hardness), s.color);
      grad.addColorStop(1, hexA(s.color, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(wx, wy, wr, 0, Math.PI * 2);
      g.fill();
    }
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
   * Vector-draw into a layer: draw(g) runs with the context transformed to
   * WORLD coordinates (line widths in world units). Routed through the shared
   * cross-band write path (CR-12), so shapes/fills/erases behave at any zoom.
   * One history step (unless batched).
   * @returns {object} the world bbox actually painted
   */
  rasterOp(rect, band, draw, { layerId = null, mask = this.mask, erase = false } = {}) {
    const layer = layerId ? this.layer(layerId) : this.active();
    const touched = new Map();
    this.applyWrite(rect, band, { layerId: layer.id, mask, touched, erase }, draw);
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
    }, { layerId, mask, erase: op === 'destination-out' });
  }

  /* ---------- history (docs/12 §4): 50 steps, tile snapshots,
     byte-budgeted so huge strokes can't balloon memory (CR-13a) ---------- */

  entryBytes(entry) {
    if (entry.kind === 'tiles') {
      let n = 0;
      for (const t of entry.tiles) {
        for (const img of [t.before, t.after]) {
          n += img instanceof Blob ? img.size : (img ? RTILE * RTILE * 4 : 0);
        }
      }
      return n;
    }
    if (entry.kind === 'multi') return entry.parts.reduce((n, p) => n + this.entryBytes(p), 0);
    return 1024;
  }

  push(entry) {
    entry.bytes = entry.bytes ?? this.entryBytes(entry);
    this.history.push(entry);
    if (this.history.length > HISTORY_CAP) this.history.shift();
    let bytes = this.history.reduce((n, e) => n + (e.bytes || 0), 0);
    while (bytes > HIST_BUDGET && this.history.length > 1) {
      bytes -= this.history.shift().bytes || 0;
    }
    this.redoStack = [];
    this.io.onMetaChange();
  }

  swap(entry, useBefore) {
    if (entry.kind === 'tiles') {
      const layers = new Set();
      for (const t of entry.tiles) {
        const img = useBefore ? t.before : t.after;
        if (img instanceof Blob) {
          // CR-13a: bulk-deleted tiles snapshot as their stored blob (cheap);
          // restoring decodes lazily, like a fresh load
          const c = this.tile(...t.key.split(':').map((v, i) => i ? Number(v) : v), true);
          c.getContext('2d').clearRect(0, 0, RTILE, RTILE);
          createImageBitmap(img).then(bmp => {
            if (this.tiles.get(t.key) !== c) return;
            c.getContext('2d').drawImage(bmp, 0, 0);
            this.bustMips(t.key);
            this.io.onTilesDecoded();
          }).catch(() => {});
        } else if (img) {
          const c = this.tile(...t.key.split(':').map((v, i) => i ? Number(v) : v), true);
          const g = c.getContext('2d');
          g.clearRect(0, 0, RTILE, RTILE);
          g.drawImage(img, 0, 0);
        } else {
          this.tiles.delete(t.key);
          this.missing.add(t.key);
        }
        this.dirty.add(t.key);
        layers.add(t.key.split(':')[0]);
      }
      for (const id of layers) this.bustLayer(id); // mips + occupancy now stale
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
    this.bustLayer(lower.id);
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
    this.bustLayer(id);
    if (tiles.length) this.push({ kind: 'tiles', tiles });
  }
}

/** Blend-brush carry: mix the held color toward what's under the dab.
    Shared by the live session (mixStep) and the preview/commit replay. */
export function advanceMix(mix, under, strength, color) {
  if (!mix) return under[3] > 0 ? under : hexRgb(color);
  const k = (strength ?? 0.5) * 0.6;
  return mix.map((v, i) => i < 3 ? v + (under[i] - v) * (1 - k) * (under[3] || 0) : 1);
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
