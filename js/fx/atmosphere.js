/* Atmosphere engine (docs/03 · V2 §7): slow, reactive background scenes.
   Renders at half resolution and upscales (atmospheres are soft by nature);
   one atmosphere active at most; pauses via fx/loop when hidden. Static
   geometry (mountains, forests, constellations, planets) is precomputed in
   init so each frame stays cheap. */

import { loop } from './loop.js';

let canvas = null, g = null;
let layers = []; // [{ key, state, options, colors }] — multiple atmospheres stack (V2 §7)
let unsub = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const W = () => canvas.width, H = () => canvas.height;

function softBlob(size, color) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cg = c.getContext('2d');
  const grad = cg.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  cg.fillStyle = grad;
  cg.fillRect(0, 0, size, size);
  return c;
}

function hexToRgba(hex, a) {
  if (!hex?.startsWith('#')) return `rgba(120,180,200,${a})`;
  const v = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`;
}
function parseColor(c) {
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = c.match(/rgba?\(([^)]+)\)/i); // also accept lerpHex's own rgb(…) output
  if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2]]; }
  return [255, 255, 255];
}
function lerpHex(a, b, t) {
  const x = parseColor(a), y = parseColor(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
}
/** Interpolate a [[pos,hex],…] stop list at t (0–1). */
function gradStop(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    if (t <= t1) return lerpHex(c0, c1, (t - t0) / (t1 - t0 || 1));
  }
  return stops[stops.length - 1][1];
}
/** Blend a 3-colour [top,mid,bottom] palette across night→golden→day by pos. */
function palBlend(night, golden, day, pos) {
  const f = pos < 0.5 ? pos / 0.5 : (pos - 0.5) / 0.5;
  const a = pos < 0.5 ? night : golden, b = pos < 0.5 ? golden : day;
  return [lerpHex(a[0], b[0], f), lerpHex(a[1], b[1], f), lerpHex(a[2], b[2], f)];
}
function skyGradient(top, mid, bottom, alpha = 0.72) {
  const grad = g.createLinearGradient(0, 0, 0, H());
  grad.addColorStop(0, top); grad.addColorStop(0.5, mid); grad.addColorStop(1, bottom);
  g.globalAlpha = alpha; g.fillStyle = grad; g.fillRect(0, 0, W(), H()); g.globalAlpha = 1;
}

/* ---------- presets ---------- */

const PRESETS = {
  /* Day / night: a 6+ stop sky that warms and cools while the sun and moon
     ride a shared arc (the moon trails the sun by half a day). */
  dayNight: {
    init(state) {
      // soft, low-opacity halos so they read as a gentle glow that blends with
      // the sky rather than a hard coloured disc clashing with the gradient.
      state.sunGlow = softBlob(180, 'rgba(255,234,190,0.34)');
      state.moonGlow = softBlob(150, 'rgba(206,220,255,0.26)');
      state.stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.7, tw: Math.random() * Math.PI * 2, r: 0.5 + Math.random() * 1.2 }));
      state.zenith = [[0, '#05060f'], [0.18, '#161334'], [0.26, '#3a3a6e'], [0.5, '#5fa0e0'], [0.74, '#7a4a78'], [0.82, '#3a2a64'], [0.9, '#161334'], [1, '#05060f']];
      state.horizon = [[0, '#0b0c1c'], [0.18, '#2a2350'], [0.26, '#e9a36a'], [0.5, '#bcdcf4'], [0.74, '#e0703c'], [0.82, '#7a4a78'], [0.9, '#241d44'], [1, '#0b0c1c']];
    },
    tick(state, now, o) {
      const speed = o.speed || 1;
      if (state.t0 == null) { const d = new Date(); state.t0 = now - (d.getHours() / 24 + d.getMinutes() / 1440) * 600000 / speed; }
      const dayFrac = (((now - state.t0) / 1000 * speed / 600) % 1 + 1) % 1;
      skyGradient(gradStop(state.zenith, dayFrac), lerpHex(gradStop(state.zenith, dayFrac), gradStop(state.horizon, dayFrac), 0.5), gradStop(state.horizon, dayFrac), 0.7);
      const night = Math.max(0, Math.min(1, dayFrac < 0.5 ? (0.22 - dayFrac) / 0.1 : (dayFrac - 0.78) / 0.1));
      if (night > 0) for (const s of state.stars) {
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now / 700 + s.tw * 6));
        g.fillStyle = `rgba(235,235,255,${tw * night * 0.9})`;
        g.beginPath(); g.arc(s.x * W(), s.y * H(), s.r, 0, Math.PI * 2); g.fill();
      }
      const horizonY = H() * 0.82, arcH = H() * 0.66;
      // let the sun/moon ride in from off-screen and fully exit (the extended
      // range dips below the horizon at the edges so they rise and set cleanly).
      const su = (dayFrac - 0.22) / 0.56;
      if (su > -0.12 && su < 1.12) {
        const x = W() * su, y = horizonY - Math.sin(su * Math.PI) * arcH;
        g.drawImage(state.sunGlow, x - 90, y - 90);
        g.fillStyle = '#ffe39a'; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fill();
      }
      const mu = ((dayFrac + 0.5) % 1 - 0.22) / 0.56;
      if (mu > -0.12 && mu < 1.12) {
        const x = W() * mu, y = horizonY - Math.sin(mu * Math.PI) * arcH;
        g.drawImage(state.moonGlow, x - 75, y - 75);
        g.fillStyle = '#eef0fb'; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(30,40,80,0.30)'; g.beginPath(); g.arc(x - 5, y - 3, 10, 0, Math.PI * 2); g.fill();
      }
    }
  },

  /* Constellations: a seeded starfield with a few preset shapes, lines only
     between genuinely close stars, the whole sky slowly rotating. */
  constellations: {
    init(state) {
      const SHAPES = [
        { pts: [[0, 0], [0.5, 0.12], [1, 0.04], [0.18, 0.5], [0.5, 0.55], [0.82, 0.5], [0.32, 1], [0.68, 1]], lines: [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [2, 5], [3, 6], [5, 7]] }, // orion
        { pts: [[0, 0.2], [0.25, 0], [0.5, 0.1], [0.75, 0.05], [0.78, 0.4], [1, 0.55], [0.95, 0.85]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [4, 6]] }, // ursa major
        { pts: [[0, 0.3], [0.25, 0], [0.5, 0.35], [0.75, 0.05], [1, 0.4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] }, // cassiopeia
        { pts: [[0, 0], [0.15, 0.2], [0.3, 0.4], [0.5, 0.55], [0.7, 0.6], [0.85, 0.78], [0.78, 1]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] }, // scorpius
        { pts: [[0.2, 0], [0.5, 0.2], [0, 0.5], [0.5, 0.72], [0.9, 0.5]], lines: [[0, 1], [1, 2], [1, 4], [2, 3], [3, 4]] }, // lyra
        { pts: [[0.5, 0], [0.5, 0.45], [0.5, 0.9], [0, 0.5], [1, 0.5]], lines: [[0, 1], [1, 2], [3, 1], [1, 4]] }, // cygnus
        { pts: [[0, 0.4], [0.22, 0.1], [0.45, 0], [0.7, 0.1], [0.9, 0.4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] }, // corona
        { pts: [[0, 1], [0.5, 0], [1, 1]], lines: [[0, 1], [1, 2], [2, 0]] } // triangulum
      ];
      state.field = Array.from({ length: 120 }, () => ({ x: (Math.random() - 0.5) * 1.8, y: (Math.random() - 0.5) * 1.8, tw: Math.random() * Math.PI * 2, period: 0.5 + Math.random() * 2.5, r: 0.5 + Math.random() * 1.2 }));
      const picks = SHAPES.slice().sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 2));
      state.cons = picks.map(sh => {
        const cx = (Math.random() - 0.5) * 1.0, cy = (Math.random() - 0.5) * 1.0, scale = 0.18 + Math.random() * 0.14, rot = Math.random() * Math.PI * 2;
        const ca = Math.cos(rot), sa = Math.sin(rot);
        const stars = sh.pts.map(([px, py]) => {
          const x = px - 0.5, y = py - 0.5;
          return { x: cx + (x * ca - y * sa) * scale, y: cy + (x * sa + y * ca) * scale, tw: Math.random() * Math.PI * 2, period: 1 + Math.random() * 2, r: 1 + Math.random() * 1.1, glowUntil: 0 };
        });
        return { stars, lines: sh.lines };
      });
    },
    tick(state, now, o, colors) {
      const rot = now / 1000 * (o.speed ?? 1) * (Math.PI * 2 / 60); // 60s / rotation at ×1
      const ca = Math.cos(rot), sa = Math.sin(rot);
      // pivot the whole sky around a point at the BOTTOM-centre (like the celestial
      // pole low on the horizon) so stars wheel in arcs overhead, not around the
      // middle of the screen. A larger scale spreads the field across the height.
      const cx = W() / 2, cy = H(), scale = Math.max(W(), H());
      const place = (p) => [cx + (p.x * ca - p.y * sa) * scale, cy + (p.x * sa + p.y * ca) * scale];
      g.fillStyle = 'rgba(60,72,150,0.05)'; g.fillRect(0, 0, W(), H());
      for (const s of state.field) {
        const [x, y] = place(s);
        if (x < -8 || x > W() + 8 || y < -8 || y > H() + 8) continue;
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 1000 * (Math.PI * 2 / s.period) + s.tw));
        g.fillStyle = `rgba(225,225,250,${tw * 0.85})`;
        g.beginPath(); g.arc(x, y, s.r, 0, Math.PI * 2); g.fill();
      }
      const acc = colors?.accent || '#a0b8e8';
      for (const c of state.cons) {
        const pts = c.stars.map(place);
        g.strokeStyle = hexToRgba(acc, 0.25); g.lineWidth = 0.6;
        for (const [a, b] of c.lines) {
          if (Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]) > 0.15 * W()) continue; // close only
          g.beginPath(); g.moveTo(pts[a][0], pts[a][1]); g.lineTo(pts[b][0], pts[b][1]); g.stroke();
        }
        c.stars.forEach((s, i) => {
          const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now / 1000 * (Math.PI * 2 / s.period) + s.tw));
          const glow = now < s.glowUntil ? 2 : 1;
          g.fillStyle = `rgba(235,235,255,${Math.min(1, tw * glow)})`;
          g.beginPath(); g.arc(pts[i][0], pts[i][1], glow > 1 ? 3 : 1.8, 0, Math.PI * 2); g.fill();
        });
        c._pts = pts;
      }
    },
    pointer(state, x, y) {
      for (const c of state.cons || []) for (const [i, p] of (c._pts || []).entries()) {
        if (Math.hypot(p[0] - x, p[1] - y) < 16) c.stars[i].glowUntil = performance.now() + 2200;
      }
    }
  },

  sunset: sunScene(true),
  sunrise: sunScene(false),

  /* Waves: 3–5 stacked sinusoidal swells filling the lower canvas, foam on the
     front crest. Size, speed and layer count rise with the energy slider. */
  waves: {
    init() {},
    tick(state, now, o, colors) {
      const energy = (o.energy ?? 50) / 100;
      const layers = 3 + Math.round(energy * 2);
      const base = H() - H() * (0.16 + energy * 0.18);
      const acc = colors?.accent || '#3a86b0';
      for (let i = 0; i < layers; i++) {
        const amp = (4 + i * 4) * (0.6 + energy);
        const sp = (0.4 + i * 0.22) * (0.5 + energy * 1.2);
        const phase = i * 1.3;
        const crest = [];
        g.fillStyle = hexToRgba(acc, 0.1 + i * 0.04);
        g.beginPath(); g.moveTo(0, H());
        for (let x = 0; x <= W(); x += 12) {
          const y = base - (layers - 1 - i) * (H() * 0.05) + Math.sin(x / 70 + now / 1000 * sp + phase) * amp;
          g.lineTo(x, y); crest.push([x, y]);
        }
        g.lineTo(W(), H()); g.closePath(); g.fill();
        if (i === layers - 1) {
          g.strokeStyle = 'rgba(255,255,255,0.26)'; g.lineWidth = 1;
          g.beginPath(); crest.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
        }
      }
    }
  },

  /* Mountain range: 3–5 silhouette ridges, foreground darkest. Jaggedness,
     waterfalls and foothill trees grow with the terrain slider. */
  mountainRange: {
    init(state, o) {
      const terrain = (o.terrain ?? 50) / 100;
      state.terrain = terrain;
      state.layers = Array.from({ length: 4 }, (_, li) => {
        const peaks = 4 + li * 2, n = peaks * 2, baseY = 0.5 + li * 0.11;
        const pts = [];
        for (let k = 0; k <= n; k++) {
          const peakH = (0.1 + Math.random() * 0.22 * (0.4 + terrain)) * (1 - li * 0.12);
          pts.push([k / n, baseY - (k % 2 ? peakH : peakH * 0.25)]);
        }
        return { pts, shade: 0.12 + li * 0.16 };
      });
      if (terrain > 0.55) {
        const front = state.layers[3];
        state.falls = Array.from({ length: Math.round((terrain - 0.5) * 6) }, () => {
          const seg = front.pts[1 + Math.floor(Math.random() * (front.pts.length - 2))];
          return { x: seg[0], y: seg[1], len: 0.06 + Math.random() * 0.1 };
        });
        state.trees = Array.from({ length: Math.round(terrain * 18) }, () => ({ x: Math.random(), y: 0.82 + Math.random() * 0.08, h: 0.04 + Math.random() * 0.05 }));
      }
    },
    tick(state, now, o, colors) {
      const acc = colors?.accent || '#6a7a8a';
      for (const L of state.layers) {
        g.fillStyle = hexToRgba(acc, L.shade);
        g.beginPath(); g.moveTo(0, H());
        for (const [x, y] of L.pts) g.lineTo(x * W(), y * H());
        g.lineTo(W(), H()); g.closePath(); g.fill();
      }
      for (const f of state.falls || []) {
        g.strokeStyle = `rgba(225,238,255,${0.35 + 0.15 * Math.sin(now / 400 + f.x * 10)})`;
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(f.x * W(), f.y * H()); g.lineTo(f.x * W(), (f.y + f.len) * H()); g.stroke();
      }
      for (const t of state.trees || []) {
        g.fillStyle = hexToRgba(acc, 0.5);
        g.beginPath(); g.moveTo(t.x * W(), (t.y - t.h) * H()); g.lineTo(t.x * W() - t.h * H() * 0.4, t.y * H()); g.lineTo(t.x * W() + t.h * H() * 0.4, t.y * H()); g.closePath(); g.fill();
      }
    }
  },

  /* Forest: layered tree silhouettes (pine/oak/willow), optional light rays. */
  forest: {
    init(state, o) {
      const density = (o.density ?? 50) / 100;
      state.trees = [];
      for (let li = 0; li < 3; li++) {
        const count = Math.round((6 + density * 22) * (1 - li * 0.2));
        const baseY = 0.78 + li * 0.08;
        for (let k = 0; k < count; k++) {
          state.trees.push({ x: Math.random(), y: baseY + (Math.random() - 0.5) * 0.03, h: (0.12 + Math.random() * 0.18) * (1 - li * 0.18), species: ['pine', 'oak', 'willow'][Math.floor(Math.random() * 3)], shade: 0.16 + li * 0.16, li });
        }
      }
      state.trees.sort((a, b) => a.li - b.li);
      state.rays = o.rays !== false;
    },
    tick(state, now, o, colors) {
      const acc = colors?.accent || '#3a5a3a';
      if (state.rays) {
        const grad = g.createLinearGradient(W() * 0.35, 0, W() * 0.55, H() * 0.75);
        grad.addColorStop(0, 'rgba(255,245,200,0.06)'); grad.addColorStop(1, 'transparent');
        g.fillStyle = grad; g.fillRect(0, 0, W(), H() * 0.75);
      }
      for (const t of state.trees) {
        const x = t.x * W(), y = t.y * H(), h = t.h * H();
        g.fillStyle = hexToRgba(acc, t.shade);
        if (t.species === 'pine') { g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - h * 0.32, y); g.lineTo(x + h * 0.32, y); g.closePath(); g.fill(); }
        else if (t.species === 'oak') { g.fillRect(x - h * 0.05, y - h * 0.5, h * 0.1, h * 0.5); g.beginPath(); g.ellipse(x, y - h * 0.7, h * 0.34, h * 0.4, 0, 0, Math.PI * 2); g.fill(); }
        else { g.fillRect(x - h * 0.04, y - h * 0.5, h * 0.08, h * 0.5); g.beginPath(); g.ellipse(x, y - h * 0.66, h * 0.3, h * 0.36, 0, 0, Math.PI * 2); g.fill(); }
      }
    }
  },

  /* Solar system: a warm sun at centre-left with eight planets on faint
     elliptical orbits. */
  solarSystem: {
    init(state) {
      state.planets = [
        { r: 0.1, size: 1.6, col: '#a8896a' }, { r: 0.15, size: 2.6, col: '#d8a86a' },
        { r: 0.21, size: 2.8, col: '#6a9ad8' }, { r: 0.27, size: 2.2, col: '#c96a4a' },
        { r: 0.36, size: 5.4, col: '#d8b48a' }, { r: 0.45, size: 4.8, col: '#e0c89a' },
        { r: 0.54, size: 3.6, col: '#8ad0e0' }, { r: 0.62, size: 3.4, col: '#5a7ad8' }
      ].map(p => ({ ...p, a: Math.random() * Math.PI * 2, sp: 0.3 / (0.5 + p.r * 4) }));
      state.sunGlow = softBlob(220, 'rgba(255,200,90,0.6)');
    },
    tick(state, now, o) {
      const cx = W() * 0.18, cy = H() * 0.5, scale = Math.min(W(), H()) * 1.1;
      g.drawImage(state.sunGlow, cx - 110, cy - 110);
      g.fillStyle = '#ffd060'; g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.fill();
      for (const p of state.planets) {
        const rx = p.r * scale, ry = p.r * scale * 0.55;
        g.strokeStyle = 'rgba(200,210,240,0.08)'; g.lineWidth = 0.6;
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
        p.a += (o.speed ?? 1) * p.sp * 0.016;
        const x = cx + Math.cos(p.a) * rx, y = cy + Math.sin(p.a) * ry;
        g.fillStyle = hexToRgba(p.col, 0.25); g.beginPath(); g.arc(x, y, p.size * 1.8, 0, Math.PI * 2); g.fill();
        g.fillStyle = p.col; g.beginPath(); g.arc(x, y, p.size, 0, Math.PI * 2); g.fill();
      }
    }
  },

  /* Clouds: kept as a renderer for back-compat (and the waves option) but no
     longer offered standalone — it moves to the Weather layer (V2 §8). */
  clouds: {
    init(state, o) {
      state.cloudSprites = [softBlob(260, 'rgba(255,255,255,0.10)'), softBlob(340, 'rgba(255,255,255,0.07)')];
      state.clouds = Array.from({ length: o.count || 4 }, (_, i) => ({ x: Math.random() * 1.4 - 0.2, y: 0.06 + Math.random() * 0.3, s: 0.7 + Math.random() * 0.9, v: 0.004 + Math.random() * 0.006, sp: i % 2 }));
    },
    tick(state, now, o) {
      for (const c of state.clouds) {
        c.x += c.v * (o.speed || 1) * 0.016;
        if (c.x > 1.25) c.x = -0.25;
        const sprite = state.cloudSprites[c.sp];
        const w = sprite.width * c.s;
        g.drawImage(sprite, c.x * W() - w / 2, c.y * H() - w / 4, w, w * 0.55);
      }
    }
  }
};

/** Sunset / sunrise share a sun disk at the horizon with a sky ramp driven by
    the sun-position slider (0 = night, 50 = golden hour, 100 = bright day). */
function sunScene(isSunset) {
  const palettes = isSunset
    ? { night: ['#0a0a1a', '#1a1535', '#3a2a50'], golden: ['#2a2050', '#8a3a6a', '#f0a64a'], day: ['#5a90d0', '#a7c8e8', '#ffe6b0'] }
    : { night: ['#15182a', '#2a2f4a', '#3f4668'], golden: ['#3a4a78', '#c9a0b8', '#f6d6a0'], day: ['#7fb0e0', '#cfe6f5', '#fff2d8'] };
  return {
    init(s) { s.glow = softBlob(300, isSunset ? 'rgba(245,150,80,0.55)' : 'rgba(255,225,170,0.55)'); },
    tick(state, now, o) {
      const pos = (o.sunPos ?? (isSunset ? 50 : 40)) / 100;
      const [top, mid, bottom] = palBlend(palettes.night, palettes.golden, palettes.day, pos);
      skyGradient(top, mid, bottom, 0.74);
      const horizonY = H() * 0.72;
      const sunY = horizonY - (pos - 0.5) * 2 * (H() * 0.6);
      const rad = 26 + pos * 22;
      const sx = W() / 2;
      g.drawImage(state.glow, sx - 150, sunY - 150);
      g.fillStyle = isSunset ? lerpHex('#ff7a3c', '#ffd070', pos) : lerpHex('#ffcaa0', '#fff0d0', pos);
      g.beginPath(); g.arc(sx, sunY, rad, 0, Math.PI * 2); g.fill();
    }
  };
}

/* ---------- public API ---------- */

export function initAtmosphere() {
  canvas = document.getElementById('atmosphere-canvas');
  g = canvas.getContext('2d');
  const resize = () => { canvas.width = Math.ceil(innerWidth / 2); canvas.height = Math.ceil(innerHeight / 2); };
  resize();
  addEventListener('resize', resize);
  document.addEventListener('click', (e) => {
    if (!layers.length) return;
    if (e.target.closest('.widget-card, .drawer, .dialog, button, input, a, .internal-view')) return;
    for (const a of layers) PRESETS[a.key]?.pointer?.(a.state, e.clientX / 2, e.clientY / 2);
  }, { passive: true });
}

/** Activate one or more atmospheres. `spec` may be a single {preset, options},
    an array of them, or null. Multiple atmospheres stack in array order. */
export function setAtmosphere(spec, colors) {
  if (!canvas) return;
  layers = [];
  g?.clearRect(0, 0, canvas.width, canvas.height);
  if (unsub) { unsub(); unsub = null; }
  if (reduced()) return;
  const specs = (Array.isArray(spec) ? spec : spec ? [spec] : []).filter(s => s && PRESETS[s.preset]);
  for (const sp of specs) {
    const state = {}, options = sp.options || {};
    PRESETS[sp.preset].init?.(state, options);
    layers.push({ key: sp.preset, state, options, colors });
  }
  if (!layers.length) return;
  unsub = loop.add((dt, now) => {
    if (!layers.length) { unsub?.(); unsub = null; return; }
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (const a of layers) PRESETS[a.key].tick(a.state, now, a.options, a.colors);
  });
}

/** Render a single frame immediately (editor previews, tests). */
export function tickOnce(now = performance.now()) {
  if (!layers.length || !g) return false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  for (const a of layers) PRESETS[a.key].tick(a.state, now, a.options, a.colors);
  return true;
}

/** Catalog for pickers/editors (Clouds is intentionally omitted — V2 §7). */
export const ATMOSPHERE_PRESETS = [
  { key: 'dayNight', name: 'Day / Night cycle' },
  { key: 'constellations', name: 'Constellations' },
  { key: 'sunset', name: 'Sunset' },
  { key: 'sunrise', name: 'Sunrise' },
  { key: 'waves', name: 'Waves' },
  { key: 'mountainRange', name: 'Mountain range' },
  { key: 'forest', name: 'Forest' },
  { key: 'solarSystem', name: 'Solar system' }
];

/** Per-atmosphere slider config (V2 §7): label, option key, range, tooltip. */
export const ATMOSPHERE_OPTIONS = {
  dayNight: { key: 'speed', label: 'Cycle speed', min: 0.1, max: 10, step: 0.1, def: 1, unit: '×', tip: 'How fast the sun and moon cross the sky.' },
  constellations: { key: 'speed', label: 'Rotation speed', min: 0, max: 3, step: 0.1, def: 1, unit: '×', tip: 'How slowly the whole starfield turns.' },
  sunset: { key: 'sunPos', label: 'Sun position', min: 0, max: 100, step: 1, def: 50, unit: '%', tip: '0 = night, 50 = golden hour at the horizon, 100 = bright day.' },
  sunrise: { key: 'sunPos', label: 'Sun position', min: 0, max: 100, step: 1, def: 40, unit: '%', tip: '0 = pre-dawn, 50 = the horizon, 100 = full daylight.' },
  waves: { key: 'energy', label: 'Wave size & energy', min: 0, max: 100, step: 1, def: 50, unit: '%', tip: 'Swell height, speed, and how many wave layers.' },
  mountainRange: { key: 'terrain', label: 'Terrain variation', min: 0, max: 100, step: 1, def: 50, unit: '%', tip: 'Rolling hills to sharp peaks with waterfalls and forest.' },
  forest: { key: 'density', label: 'Forest density', min: 0, max: 100, step: 1, def: 50, unit: '%', tip: 'Sparse meadow to dense old-growth.' },
  solarSystem: { key: 'speed', label: 'Orbit speed', min: 0, max: 3, step: 0.1, def: 1, unit: '×', tip: 'How fast the planets orbit the sun.' }
};
