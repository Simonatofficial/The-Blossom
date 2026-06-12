/* CR-13: whole-stroke commit pipeline for the Infinite Canvas.

   13b — stamps land in an offscreen STROKE BUFFER at full alpha; the buffer
   composites onto the layer ONCE at the stroke's opacity (eraser: a single
   destination-out pass), so overlapping stamps within one stroke never
   darken each other — no more "trail of circles".

   13a — cost scales with screen pixels, never world area: the buffer lives
   at the stroke's own zoom band (coarsened only until it fits a hard pixel
   cap), tiles outside the brush footprint are skipped via an 8×8 alpha
   probe, work on content stored in finer bands is budgeted (FINE_TILE_CAP)
   and chunked across frames, and a full-cover erase of a finer tile becomes
   a cheap deletion (its stored blob is the undo snapshot — no decode, no
   pixel copies). On any failure the operation aborts with state intact. */

import { RTILE, FINE_TILE_CAP, copyTile } from './infcanvas-raster.js';

const MAX_BUFFER = 4096; // px — stroke buffer hard cap (≈ screen-sized)
const CHUNK = 16;        // cross-band tile writes between frame yields

const nextFrame = () => new Promise(r => (document.hidden ? setTimeout(r, 0) : requestAnimationFrame(r)));

/** Spacing-stamped walk over recorded points (mirrors RasterDoc.stamp). */
export function walkStroke(s, pts, dabFn) {
  let last = null, carry = 0;
  const spacing = Math.max(0.35 / Math.pow(2, s.band), s.size * (s.tool === 'pixel' ? 0.9 : 0.18));
  for (const pt of pts) {
    const [wx, wy, p = 0.5] = pt;
    if (!last) { dabFn(wx, wy, p, pt); last = pt; continue; }
    const [lx, ly, lp = 0.5] = last;
    const dist = Math.hypot(wx - lx, wy - ly);
    if (!dist) continue;
    let pos = spacing - carry;
    while (pos <= dist) {
      const t = pos / dist;
      dabFn(lx + (wx - lx) * t, ly + (wy - ly) * t, lp + (p - lp) * t, pt);
      pos += spacing;
    }
    carry = dist - (pos - spacing);
    last = pt;
  }
}

/**
 * Commit one recorded stroke to the layer tiles in a single pass.
 * @param {import('./infcanvas-raster.js').RasterDoc} doc
 * @param {object} s   session: tool/color/size/opacity/hardness/strength/band/
 *                     pixelErase/mask/layerId (captured at stroke start)
 * @param {Array} pts  [wx, wy, pressure, blendMix?] recorded by the preview
 * @returns {Promise<{bbox: object, degraded: boolean}|null>} null = aborted
 */
export async function commitStroke(doc, s, pts) {
  if (!pts.length) return null;
  const layer = (s.layerId && doc.layer(s.layerId)) || doc.active();
  const erase = s.tool === 'eraser';
  const mask = s.mask || null;
  const pixel = s.tool === 'pixel' || s.pixelErase;

  // stroke bounds, padded by the largest possible stamp
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [wx, wy] of pts) {
    if (wx < x0) x0 = wx; if (wy < y0) y0 = wy;
    if (wx > x1) x1 = wx; if (wy > y1) y1 = wy;
  }
  const pad = Math.max(s.size, 1 / Math.pow(2, s.band));
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;

  // commit band: the stroke's zoom band, coarsened only until the buffer fits
  let band = s.band;
  while (band > -24 && Math.max(x1 - x0, y1 - y0) * Math.pow(2, band) > MAX_BUFFER) band--;
  const sb = Math.pow(2, band);

  // build the buffer — full alpha (13b); origin on the band pixel grid so
  // the pixel brush's snapped squares stay aligned with tile pixels
  const ox = Math.floor(x0 * sb), oy = Math.floor(y0 * sb);
  const bw = Math.min(MAX_BUFFER, Math.ceil(x1 * sb) - ox + 1);
  const bh = Math.min(MAX_BUFFER, Math.ceil(y1 * sb) - oy + 1);
  const buffer = document.createElement('canvas');
  buffer.width = bw;
  buffer.height = bh;
  const bg = buffer.getContext('2d');
  bg.setTransform(sb, 0, 0, sb, -ox, -oy);
  const sBuf = {
    ...s, opacity: 1, mask: null,
    tool: erase ? (s.pixelErase ? 'pixel' : 'pen') : s.tool,
    color: erase ? '#000000' : s.color
  };
  walkStroke(s, pts, (wx, wy, p, src) => {
    if (s.tool === 'blend' && src[3]) sBuf.mix = src[3];
    const wr = Math.max(0.5 / sb, s.size / 2 * (pixel ? 1 : 0.35 + p));
    // eraser stamps mask at full alpha (pressure shapes size only) — the
    // stroke's opacity applies once, at the destination-out composite
    doc.drawDab(sBuf, bg, band, wx, wy, wr, erase ? 1 : p);
  });
  const rect = { x0: ox / sb, y0: oy / sb, x1: (ox + bw) / sb, y1: (oy + bh) / sb };

  // 8×8 alpha probe: how much of a world rect does the stroke cover?
  const probe = document.createElement('canvas');
  probe.width = probe.height = 8;
  const pg = probe.getContext('2d', { willReadFrequently: true });
  const coverage = (wx, wy, ts) => {
    const ss = ts * sb;
    // clamp the source rect to the buffer — drawImage silently draws nothing
    // when the source rect leaves the bitmap (found by the perf tests)
    const sx0 = Math.max(0, wx * sb - ox), sy0 = Math.max(0, wy * sb - oy);
    const sx1 = Math.min(bw, wx * sb - ox + ss), sy1 = Math.min(bh, wy * sb - oy + ss);
    if (sx1 <= sx0 || sy1 <= sy0) return 'none';
    const clipped = sx1 - sx0 < ss - 1e-9 || sy1 - sy0 < ss - 1e-9;
    pg.clearRect(0, 0, 8, 8);
    pg.drawImage(buffer, sx0, sy0, sx1 - sx0, sy1 - sy0, 0, 0, 8, 8);
    const d = pg.getImageData(0, 0, 8, 8).data;
    let min = 255, max = 0;
    for (let i = 3; i < d.length; i += 4) { if (d[i] < min) min = d[i]; if (d[i] > max) max = d[i]; }
    return max === 0 ? 'none' : (min >= 250 && !clipped ? 'full' : 'partial');
  };

  const drawBuf = (g) => {
    g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    g.globalAlpha = s.opacity;
    g.imageSmoothingEnabled = !pixel;
    g.drawImage(buffer, rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
  };

  const touched = new Map();
  const deletes = [];
  let skipped = 0;

  try {
    const bands = doc.bandsOf(layer.id);
    // 1 — content in coarser bands is promoted into the commit band (CR-12)
    for (const b of bands) if (b < band) doc.promote(layer.id, b, band, rect, touched);

    // 2 — content stored in finer bands: budgeted + chunked (13a). Iterates
    // the bands' REAL tiles, so empty space costs nothing at any zoom.
    let wrote = 0, sinceYield = 0;
    const wroteCoords = []; // {ts, set} of fine tiles the stroke painted into
    for (const b of bands.filter(v => v > band)) {
      const ts = RTILE / Math.pow(2, b);
      const sbF = Math.pow(2, b);
      const set = new Set();
      for (const coord of doc.coordsOf(layer.id, b)) {
        const [tx, ty] = coord.split(':').map(Number);
        const twx = tx * ts, twy = ty * ts;
        if (twx >= rect.x1 || twy >= rect.y1 || twx + ts <= rect.x0 || twy + ts <= rect.y0) continue;
        const cov = coverage(twx, twy, ts);
        if (cov === 'none') continue;
        const key = doc.key(layer.id, b, tx, ty);
        if (erase && !mask && s.opacity >= 0.995 && cov === 'full') {
          // whole tile erased — its stored blob is the undo snapshot
          const c = doc.tiles.get(key);
          const before = (doc.dirty.has(key) && c) ? c : (doc.io.loadTile(key) || c);
          if (!before) continue;
          deletes.push({ key, before, after: null });
          doc.tiles.delete(key);
          doc.lru.delete(key);
          doc.missing.add(key);
          doc.dirty.delete(key);
          doc.io.saveTile(key, null);
          continue;
        }
        if (wrote >= FINE_TILE_CAP) { skipped++; continue; }
        wrote++;
        await doc.ensureLoaded([key]);
        const c = doc.tile(layer.id, b, tx, ty, true);
        if (!touched.has(key)) touched.set(key, copyTile(c));
        const g = c.getContext('2d');
        g.save();
        g.transform(sbF, 0, 0, sbF, -tx * RTILE, -ty * RTILE);
        doc.clipMask(g, mask);
        drawBuf(g);
        g.restore();
        doc.dirty.add(key);
        doc.bustMips(key);
        set.add(coord);
        if (++sinceYield >= CHUNK) { sinceYield = 0; await nextFrame(); }
      }
      if (set.size) wroteCoords.push({ ts, set });
    }

    // 3 — the commit band itself (bounded by the buffer cap ≈ screen size).
    // Paint clips out exactly the fine tiles written above (no double-paint);
    // erase never clips — it must clear what sits under fine content too.
    const tsW = RTILE / sb;
    const wKeys = [];
    for (let ty = Math.floor(rect.y0 / tsW); ty <= Math.floor((rect.y1 - 1e-9) / tsW); ty++) {
      for (let tx = Math.floor(rect.x0 / tsW); tx <= Math.floor((rect.x1 - 1e-9) / tsW); tx++) {
        wKeys.push(doc.key(layer.id, band, tx, ty));
      }
    }
    await doc.ensureLoaded(wKeys);
    doc.writeBand(layer.id, band, rect, {
      mask, touched, existingOnly: erase,
      clipCoords: !erase && wroteCoords.length ? wroteCoords : null,
      covers: (wx, wy, ts) => coverage(wx, wy, ts) !== 'none'
    }, drawBuf);

    // 4 — one undoable step
    const tiles = [...touched.entries()].map(([key, before]) => ({
      key, before, after: doc.tiles.get(key) ? copyTile(doc.tiles.get(key)) : null
    }));
    tiles.push(...deletes);
    if (deletes.length) doc.bustLayer(layer.id);
    if (tiles.length) doc.push({ kind: 'tiles', tiles });
    return { bbox: rect, degraded: band < s.band || skipped > 0 };
  } catch (err) {
    // abort cleanly with state intact (13a): restore every touched tile
    for (const [key, before] of touched) {
      const c = doc.tiles.get(key);
      if (!c) continue;
      const g = c.getContext('2d');
      g.clearRect(0, 0, RTILE, RTILE);
      g.drawImage(before, 0, 0);
      doc.dirty.add(key);
      doc.bustMips(key);
    }
    for (const t of deletes) {
      doc.missing.delete(t.key);
      if (t.before instanceof Blob) doc.io.saveTile(t.key, t.before);
      else { doc.tiles.set(t.key, t.before); doc.dirty.add(t.key); }
    }
    doc.bustLayer(layer.id);
    console.warn('Stroke commit aborted, canvas state restored:', err);
    return null;
  }
}
