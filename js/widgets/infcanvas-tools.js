/* Infinite Canvas: fill + gradient (docs/12 §6 + §3).
   Both compute on the viewport raster (what you see) at screen resolution,
   then stamp the result into the active layer's tiles at the current band —
   the decided approach for flood fill on an unbounded surface. */

import { hexA } from './infcanvas-raster.js';

/** Make sure every persisted tile intersecting a world rect is decoded. */
export async function loadRect(doc, rect) {
  const keys = [];
  for (const layer of doc.meta.layers) {
    for (const band of doc.bandsOf(layer.id)) {
      const ts = 512 / Math.pow(2, band);
      const tx0 = Math.floor(rect.x0 / ts), tx1 = Math.floor(rect.x1 / ts);
      const ty0 = Math.floor(rect.y0 / ts), ty1 = Math.floor(rect.y1 / ts);
      if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 256) continue;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) keys.push(doc.key(layer.id, band, tx, ty));
      }
    }
  }
  await doc.ensureLoaded(keys);
}

/**
 * Flood fill from a tapped screen point (canvas backing px).
 * reach expands the working raster beyond the viewport (0 / 0.5 / 1 ×) —
 * the user-facing "Fill reach"; the raster bound is the max-area safety.
 * @returns {Promise<{bbox: object, edge: boolean}|null>}
 */
export async function floodFill(surf, doc, px, py, { tolerance = 24, grow = 0, reach = 0, color, opacity = 1 }) {
  const scale = surf.scale();
  const W = surf.canvas.width, H = surf.canvas.height;
  const mx = Math.round(W * reach), my = Math.round(H * reach);
  const RW = Math.min(4096, W + 2 * mx), RH = Math.min(4096, H + 2 * my);
  const [vx0, vy0] = surf.toWorld(0, 0);
  const wx0 = vx0 - mx / scale, wy0 = vy0 - my / scale;
  const rect = { x0: wx0, y0: wy0, x1: wx0 + RW / scale, y1: wy0 + RH / scale };
  await loadRect(doc, rect);

  // composite what's visible (all layers, like the display) at screen res
  const src = document.createElement('canvas');
  src.width = RW; src.height = RH;
  const sg = src.getContext('2d', { willReadFrequently: true });
  sg.setTransform(scale, 0, 0, scale, -wx0 * scale, -wy0 * scale);
  doc.compose(sg, rect.x0, rect.y0, rect.x1, rect.y1, surf.band());
  const img = sg.getImageData(0, 0, RW, RH);
  const d = img.data;

  const sx = Math.min(RW - 1, Math.max(0, Math.round(px) + mx));
  const sy = Math.min(RH - 1, Math.max(0, Math.round(py) + my));
  const si = (sy * RW + sx) * 4;
  const seed = [d[si], d[si + 1], d[si + 2], d[si + 3]];
  const tol2 = tolerance * tolerance * 4;
  const within = (i) => {
    const dr = d[i] - seed[0], dg = d[i + 1] - seed[1], db = d[i + 2] - seed[2], da = d[i + 3] - seed[3];
    return dr * dr + dg * dg + db * db + da * da <= tol2;
  };

  // scanline flood
  const mask = new Uint8Array(RW * RH);
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x0, y] = stack.pop();
    let x = x0;
    while (x >= 0 && !mask[y * RW + x] && within((y * RW + x) * 4)) x--;
    x++;
    let above = false, below = false;
    while (x < RW && !mask[y * RW + x] && within((y * RW + x) * 4)) {
      mask[y * RW + x] = 1;
      if (y > 0) {
        const ok = !mask[(y - 1) * RW + x] && within(((y - 1) * RW + x) * 4);
        if (ok && !above) { stack.push([x, y - 1]); above = true; }
        else if (!ok) above = false;
      }
      if (y < RH - 1) {
        const ok = !mask[(y + 1) * RW + x] && within(((y + 1) * RW + x) * 4);
        if (ok && !below) { stack.push([x, y + 1]); below = true; }
        else if (!ok) below = false;
      }
      x++;
    }
  }

  // grow: push the fill N px under anti-aliased line edges (Kleki's "grow")
  let m = mask;
  for (let pass = 0; pass < grow; pass++) {
    const next = new Uint8Array(m);
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW; x++) {
        if (m[y * RW + x]) continue;
        if ((x > 0 && m[y * RW + x - 1]) || (x < RW - 1 && m[y * RW + x + 1]) ||
            (y > 0 && m[(y - 1) * RW + x]) || (y < RH - 1 && m[(y + 1) * RW + x])) {
          next[y * RW + x] = 1;
        }
      }
    }
    m = next;
  }

  let edge = false, any = false;
  for (let x = 0; x < RW && !edge; x++) edge = !!(m[x] || m[(RH - 1) * RW + x]);
  for (let y = 0; y < RH && !edge; y++) edge = !!(m[y * RW] || m[y * RW + RW - 1]);

  // paint the mask in the fill color, stamp into the active layer
  const out = sg.createImageData(RW, RH);
  const [r, g2, b] = hexBytes(color);
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue;
    any = true;
    out.data[i * 4] = r; out.data[i * 4 + 1] = g2; out.data[i * 4 + 2] = b; out.data[i * 4 + 3] = 255;
  }
  if (!any) return null;
  const oc = document.createElement('canvas');
  oc.width = RW; oc.height = RH;
  oc.getContext('2d').putImageData(out, 0, 0);
  const bbox = doc.stampImage(oc, rect, surf.band(), { alpha: opacity });
  return { bbox, edge };
}

/**
 * Commit a dragged gradient (docs/12 §3): a→b world pts, linear or radial,
 * color → transparent or color → color2, opacity-aware, viewport-clipped
 * (the active selection mask clips further via doc.mask inside stampImage).
 */
export function commitGradient(surf, doc, a, b, { type = 'linear', color, color2 = null, opacity = 1 }) {
  const W = surf.canvas.width, H = surf.canvas.height;
  const [ax, ay] = surf.toScreen(a[0], a[1]);
  const [bx, by] = surf.toScreen(b[0], b[1]);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = gradientStyle(g, { type, ax, ay, bx, by, color, color2 });
  g.fillRect(0, 0, W, H);
  const [wx0, wy0] = surf.toWorld(0, 0);
  const [wx1, wy1] = surf.toWorld(W, H);
  return doc.stampImage(c, { x0: wx0, y0: wy0, x1: wx1, y1: wy1 }, surf.band(), { alpha: opacity });
}

/** Shared between the live overlay preview and the commit. */
export function gradientStyle(g, { type, ax, ay, bx, by, color, color2 }) {
  const grad = type === 'radial'
    ? g.createRadialGradient(ax, ay, 0, ax, ay, Math.max(1, Math.hypot(bx - ax, by - ay)))
    : g.createLinearGradient(ax, ay, bx, by);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color2 || hexA(color, 0));
  return grad;
}

function hexBytes(hex) {
  const v = hex.replace('#', '');
  const n = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
