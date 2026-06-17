/* Particle engine (docs/03): one engine, two layers — background behind the
   UI, pointer FX above it. Pooled, pre-rasterized sprites, hard caps,
   auto-degrade, reduced-motion → zero particles. Driven by fx/loop.js. */

import { loop } from './loop.js';

const BG_CAP = 150;
const FX_CAP = 120;
/** Max stacked background particle layers. Counts scale to the BG_CAP budget,
    so more layers stay within the performance budget (each just gets fewer). */
export const MAX_BG_LAYERS = 6;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- sprite rasterization (no per-frame fillText/shadows) ---- */

const SPRITES = {
  petal(g, s, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(s / 2, s * 0.08);
    g.bezierCurveTo(s * 0.95, s * 0.3, s * 0.85, s * 0.8, s / 2, s * 0.95);
    g.bezierCurveTo(s * 0.15, s * 0.8, s * 0.05, s * 0.3, s / 2, s * 0.08);
    g.fill();
  },
  leaf(g, s, color) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(s / 2, s / 2, s * 0.46, s * 0.22, Math.PI / 4, 0, Math.PI * 2);
    g.fill();
  },
  star(g, s, color) {
    g.fillStyle = color;
    g.beginPath();
    const c = s / 2;
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.16 : s * 0.48;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      i ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  },
  dot(g, s, color) {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  },
  bubble(g, s, color) {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, s * 0.06);
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.38, s * 0.38, s * 0.1, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
  },
  drop(g, s, color) {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, s * 0.08);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s / 2, s * 0.1);
    g.lineTo(s / 2, s * 0.9);
    g.stroke();
  },
  wisp(g, s, color) {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.6, color.replace(/[\d.]+\)$/, '0.12)'));
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(s / 2, s / 2, s * 0.48, s * 0.3, 0, 0, Math.PI * 2);
    g.fill();
  },
  heart(g, s, color) {
    g.fillStyle = color;
    g.beginPath();
    const c = s / 2;
    g.moveTo(c, s * 0.85);
    g.bezierCurveTo(s * 0.05, s * 0.5, s * 0.2, s * 0.12, c, s * 0.35);
    g.bezierCurveTo(s * 0.8, s * 0.12, s * 0.95, s * 0.5, c, s * 0.85);
    g.fill();
  },
  streak(g, s, color) {
    const grad = g.createLinearGradient(0, s / 2, s, s / 2);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, color);
    g.strokeStyle = grad;
    g.lineWidth = Math.max(1, s * 0.07);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.05, s * 0.55);
    g.lineTo(s * 0.95, s * 0.45);
    g.stroke();
  },
  ring(g, s, color) {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, s * 0.07);
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    g.stroke();
  },
  // V2 §6: a dandelion seed — slim teardrop body, thin stem, tiny pappus burst
  // at the top. Pale and unmistakably NOT a star.
  dandelion(g, s, color) {
    const c = s / 2;
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineCap = 'round';
    // stem
    g.lineWidth = Math.max(1, s * 0.05);
    g.beginPath();
    g.moveTo(c, s * 0.42);
    g.lineTo(c, s * 0.9);
    g.stroke();
    // teardrop seed at the bottom of the stem
    g.beginPath();
    g.moveTo(c, s * 0.66);
    g.quadraticCurveTo(c + s * 0.09, s * 0.82, c, s * 0.95);
    g.quadraticCurveTo(c - s * 0.09, s * 0.82, c, s * 0.66);
    g.fill();
    // pappus burst (fine radiating filaments) at the top
    g.lineWidth = Math.max(0.6, s * 0.025);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.34;
      g.beginPath();
      g.moveTo(c, s * 0.42);
      g.lineTo(c + Math.cos(a) * s * 0.3, s * 0.42 + Math.sin(a) * s * 0.3);
      g.stroke();
    }
  }
};

/** Sprite ids for editors/pickers. */
export const SPRITE_NAMES = Object.keys(SPRITES);

/* ---- colour helpers (V2 §6: per-particle gradient / hue variation) ---- */

/** Parse '#rrggbb' or 'rgb(a)(…)' to [r,g,b,a]. */
function parseColor(col) {
  if (typeof col !== 'string') return [255, 255, 255, 1];
  if (col[0] === '#') {
    const h = col.slice(1);
    const n = h.length === 3
      ? h.split('').map(c => parseInt(c + c, 16))
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return [n[0], n[1], n[2], 1];
  }
  const m = col.match(/rgba?\(([^)]+)\)/i);
  if (m) { const p = m[1].split(',').map(s => parseFloat(s)); return [p[0], p[1], p[2], p[3] ?? 1]; }
  return [255, 255, 255, 1];
}
const toRgba = ([r, g, b, a]) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Mix two colours by t (0→1). */
function mixColor(a, b, t) {
  const x = parseColor(a), y = parseColor(b);
  return toRgba([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t, x[3] + (y[3] - x[3]) * t]);
}

/** Rotate a colour's hue by `deg` degrees (keeps alpha). */
function rotateHue(col, deg) {
  let [r, g, b, a] = parseColor(col);
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (h + deg / 360 + 1) % 1;
  const hue2 = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return toRgba([hue2(p, q, h + 1 / 3) * 255, hue2(p, q, h) * 255, hue2(p, q, h - 1 / 3) * 255, a]);
}

/** Build the list of colour variants for a def (gradient spread, hue jitter,
    or a single solid colour). */
function colorVariants(def, baseColor) {
  const base = def.color || baseColor;
  if (def.gradient?.length >= 2) {
    return [0, 0.34, 0.67, 1].map(t => mixColor(def.gradient[0], def.gradient[1], t));
  }
  if (def.hueJitter) {
    return [-1, -0.4, 0.3, 1].map(f => rotateHue(base, f * def.hueJitter));
  }
  return [base];
}

/* image sources (V2 §6): data-URL images load once and re-rasterize on ready. */
const imageCache = new Map();
function getImage(url) {
  let img = imageCache.get(url);
  if (!img) { img = new Image(); img.src = url; imageCache.set(url, img); }
  return img;
}

function rasterize(shape, size, color) {
  const mono = shape.kind === 'char' && /^[01\s]+$/.test(shape.value || ''); // binary rain → monospace
  const steps = [0.7, 1, 1.4].map(f => {
    const s = Math.max(4, Math.round(size * f));
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    if (shape.kind === 'sprite' && SPRITES[shape.value]) {
      SPRITES[shape.value](g, s, color);
    } else if (shape.kind === 'image' && shape.value) {
      const img = getImage(shape.value);
      if (img.complete && img.naturalWidth) {
        const r = Math.min(s / img.naturalWidth, s / img.naturalHeight);
        const w = img.naturalWidth * r, h = img.naturalHeight * r;
        g.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      } // else blank until loaded; setDef re-rasterizes on ready
    } else {
      const chars = shape.value || '✦';
      const ch = mono ? chars[Math.floor(Math.random() * chars.length)] : chars;
      g.font = `${Math.round(s * 0.85)}px ${mono ? 'ui-monospace, monospace' : 'system-ui'}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = color;
      g.fillText(ch, s / 2, s / 2);
    }
    return c;
  });
  return steps;
}

/** Build the sprite variants for a def: every shape × every colour variant.
    A particle picks one variant index, giving cheap per-particle variety
    (emoji-alongside-vector, gradient spread, hue jitter) at no per-frame cost. */
function buildVariants(def, baseColor) {
  const shapes = def.shapes?.length ? def.shapes : [def.shape];
  const colors = colorVariants(def, baseColor);
  const out = [];
  for (const sh of shapes) for (const col of colors) out.push(rasterize(sh, def.size || 16, col));
  return out;
}

/* ---- one pooled layer ---- */

export class Layer {
  constructor(canvas, cap) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.cap = cap;
    this.pool = [];
    this.live = 0;
    this.def = null;
    this.variants = null;
    this.spawnAcc = 0;
    this.degrade = Number(localStorage.getItem('blossom:fxDegrade') || 1);
    this.slowFrames = 0;
    this.resize();
  }

  resize() {
    this.canvas.width = innerWidth;
    this.canvas.height = innerHeight;
  }

  setDef(def, color) {
    this.def = def;
    this.live = 0;
    this.spawnAcc = 0;
    if (!def) { this.g.clearRect(0, 0, this.canvas.width, this.canvas.height); return; }
    const tint = color || this.tint;
    this.variants = buildVariants(def, tint);
    // image sources load async — re-rasterize once each becomes ready
    for (const sh of (def.shapes?.length ? def.shapes : [def.shape])) {
      if (sh?.kind === 'image' && sh.value) {
        const img = getImage(sh.value);
        if (!img.complete) img.addEventListener('load', () => { if (this.def === def) this.variants = buildVariants(def, tint); }, { once: true });
      }
    }
    const cap = Math.min(this.cap, Math.round((def.maxCount || 60) * this.degrade));
    this.pool = Array.from({ length: cap }, () => ({ alive: false }));
    // Pre-distribute the starting population across the screen so continuous
    // streams (falling leaves/petals, rising bubbles) flow steadily from the
    // first frame, instead of arriving as one synchronized wave that empties and
    // then refills in batches.
    if (def.continuous !== false) {
      for (let i = 0; i < cap; i++) {
        const p = this.spawnOne();
        if (p) { p.x = Math.random() * this.canvas.width; p.y = Math.random() * this.canvas.height; }
      }
    }
  }

  spawnOne(atX = null, atY = null) {
    const d = this.def;
    const p = this.pool.find(q => !q.alive);
    if (!p) return null;
    const W = this.canvas.width, H = this.canvas.height;
    const rnd = (v, varr) => v * (1 + (Math.random() * 2 - 1) * (varr || 0));
    let x, y;
    if (atX != null) {
      x = atX; y = atY;
    } else if (d.spawn?.xRange || d.spawn?.yRange) {
      // V2 §6 spawn model: a box (or inscribed ellipse) inside the X/Y range,
      // shrunk toward its centre by `spread` (1 = full range, 0 = a point).
      const xr = d.spawn.xRange || [0, 1], yr = d.spawn.yRange || [0, 0];
      const spread = d.spawn.spread ?? 1;
      const cx = (xr[0] + xr[1]) / 2, cy = (yr[0] + yr[1]) / 2;
      const hw = (xr[1] - xr[0]) / 2 * spread, hh = (yr[1] - yr[0]) / 2 * spread;
      if (d.spawn.shape === 'radial') {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
        x = (cx + Math.cos(a) * hw * r) * W;
        y = (cy + Math.sin(a) * hh * r) * H;
      } else {
        x = (cx + (Math.random() * 2 - 1) * hw) * W;
        y = (cy + (Math.random() * 2 - 1) * hh) * H;
      }
    } else {
      const area = d.spawn?.area || 'random';
      if (area === 'top') { x = Math.random() * W; y = -20; }
      else if (area === 'bottom') { x = Math.random() * W; y = H + 20; }
      else if (area === 'left') { x = -20; y = Math.random() * H; }
      else if (area === 'right') { x = W + 20; y = Math.random() * H; }
      else if (area === 'center' || area === 'middle') {
        const r = (d.spawn?.radius ?? 0.3) * Math.min(W, H);
        const a = Math.random() * Math.PI * 2;
        x = (d.spawn?.x ?? 0.5) * W + Math.cos(a) * r * Math.random();
        y = (d.spawn?.y ?? 0.5) * H + Math.sin(a) * r * Math.random();
      } else { x = Math.random() * W; y = Math.random() * H; }
    }

    const speed = rnd((d.speed || 1) * 28, d.speedVar || 0.3);
    let dir;
    if (d.behavior === 'flow' || (d.flowAngle != null && !['orbit', 'drift', 'random', 'bounce', 'swim'].includes(d.behavior))) {
      const a = (d.flowAngle || 0) * Math.PI / 180;
      dir = [Math.cos(a), Math.sin(a)];
    } else {
      dir = {
        fallDown: [0, 1], floatUp: [0, -1], flowLeft: [-1, 0], flowRight: [1, 0],
        flowDiagonal: [0.7, 0.7], drift: [0, 0], random: [Math.random() * 2 - 1, Math.random() * 2 - 1],
        orbit: [0, 0], bounce: [Math.random() * 2 - 1, Math.random() * 2 - 1],
        swim: [Math.random() * 2 - 1, Math.random() * 2 - 1]
      }[d.behavior] || [0, 1];
    }
    // optional spawn-angle spread: jitter the launch direction (degrees)
    if (d.spawnAngleSpread) {
      const j = (Math.random() * 2 - 1) * d.spawnAngleSpread * Math.PI / 180;
      const ca = Math.cos(j), sa = Math.sin(j);
      dir = [dir[0] * ca - dir[1] * sa, dir[0] * sa + dir[1] * ca];
    }

    const baseAngle = (d.angle || 0) * Math.PI / 180;
    Object.assign(p, {
      alive: true, x, y,
      vx: dir[0] * speed, vy: dir[1] * speed,
      svx: dir[0] * speed, svy: dir[1] * speed, swimT: 0, // swim targets
      size: Math.max(0.2, rnd(1, d.sizeVar || 0.3)),
      rot: d.angle != null ? baseAngle : Math.random() * Math.PI * 2,
      spin: (d.rotation?.spin || 0) * (Math.random() - 0.5) * 4,
      sway: d.rotation?.sway || 0,
      vi: this.variants?.length ? Math.floor(Math.random() * this.variants.length) : 0,
      popped: false,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      ttl: typeof d.lifetime === 'number' ? d.lifetime * (0.6 + Math.random() * 0.8) : null,
      orbitR: 30 + Math.random() * 120,
      orbitA: Math.random() * Math.PI * 2,
      cx: x, cy: y
    });
    this.live++;
    return p;
  }

  tick(dt, now, clear = true) {
    const d = this.def;
    const { g, canvas } = this;
    if (clear) g.clearRect(0, 0, canvas.width, canvas.height);
    if (!d || reduced()) return false;

    // keep background density topped up
    if (d.continuous !== false) {
      const target = Math.min(this.pool.length, Math.round((d.maxCount || 60) * this.degrade));
      this.spawnAcc += dt * Math.max(4, target / 4);
      while (this.spawnAcc > 1 && this.live < target) { this.spawnAcc -= 1; this.spawnOne(); }
    }

    const effects = d.effects || [];
    const tw = effects.includes('twinkle');
    const pulseGrow = effects.includes('pulseGrow');
    const pulseShrink = effects.includes('pulseShrink');
    const grow = effects.includes('grow');                              // legacy age-based (pointer FX)
    const shrink = effects.includes('shrink') || effects.includes('pop');
    const canPop = effects.includes('pop');
    // V2 §6 twinkle: faster, stronger (0.2→1.0). Period configurable.
    const twPeriod = d.twinkle?.period || 0.6;
    const twMin = d.twinkle?.min ?? 0.2, twMax = d.twinkle?.max ?? 1.0;
    const twW = (Math.PI * 2) / twPeriod;
    const variants = this.variants || [];

    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.ttl && p.age > p.ttl) { p.alive = false; this.live--; continue; }

      if (d.behavior === 'orbit') {
        p.orbitA += dt * (d.speed || 1) * 0.6;
        p.x = p.cx + Math.cos(p.orbitA) * p.orbitR;
        p.y = p.cy + Math.sin(p.orbitA) * p.orbitR * 0.5;
      } else if (d.behavior === 'drift') {
        const da = d.driftAmp ?? 1; // Stars use a low amp for a subtler drift (V2 §6)
        p.x += Math.sin(now / 1700 + p.phase) * 12 * da * dt;
        p.y += Math.cos(now / 2300 + p.phase) * 8 * da * dt;
      } else if (d.behavior === 'swim') {
        // glide mostly side-to-side: commit to a horizontal heading for a few
        // seconds (usually reversing), with a gentle vertical wander + bob, so
        // fish look like they're swimming around rather than drifting randomly.
        p.swimT -= dt;
        if (p.swimT <= 0) {
          p.swimT = 1.6 + Math.random() * 2.6;
          const sp = (d.speed || 1) * 28;
          const goRight = (Math.random() < 0.75) ? (p.vx < 0) : (p.vx >= 0); // usually turn around
          p.svx = (goRight ? 1 : -1) * sp * (0.7 + Math.random() * 0.6);
          p.svy = (Math.random() * 2 - 1) * sp * 0.28;
        }
        p.vx += (p.svx - p.vx) * Math.min(1, dt * 1.8);
        p.vy += (p.svy - p.vy) * Math.min(1, dt * 1.8);
        p.x += p.vx * dt;
        p.y += (p.vy + Math.sin(now / 600 + p.phase) * 7) * dt; // gentle bob
        const m = 24; // stay on screen and turn at the edges
        if (p.x < m) { p.x = m; p.vx = Math.abs(p.vx); p.svx = Math.abs(p.svx); }
        else if (p.x > canvas.width - m) { p.x = canvas.width - m; p.vx = -Math.abs(p.vx); p.svx = -Math.abs(p.svx); }
        if (p.y < m) { p.y = m; p.vy = Math.abs(p.vy); p.svy = Math.abs(p.svy); }
        else if (p.y > canvas.height - m) { p.y = canvas.height - m; p.vy = -Math.abs(p.vy); p.svy = -Math.abs(p.svy); }
        p.faceLeft = p.vx < 0;
      } else {
        if (p.sway) p.x += Math.sin(now / 800 + p.phase) * p.sway * 26 * dt; // sway = horizontal drift
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (d.behavior === 'bounce') {
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        }
      }
      p.rot += p.spin * dt;

      // offscreen despawn (cheap bounds math)
      if (p.x < -80 || p.x > canvas.width + 80 || p.y < -80 || p.y > canvas.height + 80) {
        if (!p.ttl) { p.alive = false; this.live--; continue; }
      }

      // bubble-style pop: a brief shrink+fade at a random mid-flight moment
      if (p.popped) {
        p.popT += dt;
        if (p.popT > 0.12) { p.alive = false; this.live--; continue; }
      } else if (canPop && Math.random() < dt * (d.popRate ?? 0.06)) {
        p.popped = true; p.popT = 0;
      }

      let alpha = 1;
      if (tw) alpha = twMin + (twMax - twMin) * (0.5 + 0.5 * Math.sin(now / 1000 * twW + p.phase * 7));
      if (p.ttl) alpha *= Math.min(1, (p.ttl - p.age) / (p.ttl * 0.4));
      let scale = p.size;
      if (pulseGrow) scale *= 1 + 0.5 * (0.5 + 0.5 * Math.sin(now / 1000 * 5.2 + p.phase));   // 1.0→1.5×
      if (pulseShrink) scale *= 1 - 0.5 * (0.5 + 0.5 * Math.sin(now / 1000 * 5.2 + p.phase));  // 1.0→0.5×
      if (grow) scale *= 0.5 + Math.min(1, p.age / (p.ttl || 2)) * 0.9;
      if (shrink && p.ttl) scale *= Math.max(0.1, 1 - p.age / p.ttl * 0.6);
      if (p.popped) { const k = Math.max(0, 1 - p.popT / 0.12); alpha *= k; scale *= k; }

      g.globalAlpha = Math.max(0, Math.min(1, alpha));

      // tapered comet/shooting-star trail behind the head, along velocity
      if (d.trail) {
        const len = d.trail.len || (d.size || 16) * 3;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const ux = -p.vx / sp, uy = -p.vy / sp;          // backwards
        const tx = p.x + ux * len, ty = p.y + uy * len;
        const w = (d.trail.width || (d.size || 12) * 0.45) * Math.min(1.4, scale);
        const grad = g.createLinearGradient(p.x, p.y, tx, ty);
        grad.addColorStop(0, d.trail.head || '#ffffff');
        if (d.trail.mid) grad.addColorStop(0.45, d.trail.mid);
        grad.addColorStop(1, 'transparent');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(p.x - uy * w, p.y + ux * w);
        g.lineTo(p.x + uy * w, p.y - ux * w);
        g.lineTo(tx, ty);
        g.closePath();
        g.fill();
      }

      const variant = variants[p.vi] || variants[0];
      const sprite = variant && variant[scale < 0.85 ? 0 : scale > 1.2 ? 2 : 1];
      if (sprite) {
        g.save();
        g.translate(p.x, p.y);
        if (d.behavior === 'swim') { if (!p.faceLeft) g.scale(-1, 1); } // emoji faces left; flip to face travel direction
        else if (d.angle != null || p.spin) g.rotate(p.rot);
        g.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        g.restore();
      }
    }
    g.globalAlpha = 1;
    return this.live > 0 || d.continuous !== false;
  }
}

/* ---- public API ----
   CR-7: the background is up to MAX_BG_LAYERS emitters ("particle layers")
   sharing ONE canvas, one rAF, and one 150-particle budget — per-layer counts
   scale down proportionally when the combined total would exceed the cap. */

let bgCanvas = null, bgList = [], fx = null;
let unsubLoop = null;
let lastColor = '#ffffff';

function ensureLoop() {
  if (unsubLoop) return;
  let slow = 0;
  unsubLoop = loop.add((dt, now) => {
    const t0 = performance.now();
    let a = false;
    if (bgCanvas && bgList.length) {
      bgCanvas.getContext('2d').clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      for (const l of bgList) a = l.tick(dt, now, false) || a; // first = back
    }
    const b = fx?.tick(dt, now);
    // auto-degrade: >20ms for 60 consecutive frames → halve counts (docs/03)
    if (performance.now() - t0 > 20) { if (++slow >= 60) { degrade(); slow = 0; } }
    else slow = 0;
    if (!a && !b && !bgList.some(l => l.def) && !fx?.def) { unsubLoop(); unsubLoop = null; }
  });
}

function degrade() {
  const level = Math.max(0.25, Number(localStorage.getItem('blossom:fxDegrade') || 1) / 2);
  localStorage.setItem('blossom:fxDegrade', String(level));
  for (const l of bgList) {
    l.degrade = level;
    if (l.def) l.setDef(l.def, l.tint || lastColor);
  }
}

export function initParticles() {
  bgCanvas = document.getElementById('particle-canvas');
  bgCanvas.width = innerWidth;
  bgCanvas.height = innerHeight;
  fx = new Layer(document.getElementById('fx-canvas'), FX_CAP);
  fx.def = null;
  addEventListener('resize', () => {
    bgCanvas.width = innerWidth;
    bgCanvas.height = innerHeight;
    fx.resize();
  });

  // pointer FX: click burst + distance-throttled drag trail (docs/03)
  let lastX = 0, lastY = 0, down = false;
  document.addEventListener('pointerdown', (e) => {
    down = true;
    lastX = e.clientX; lastY = e.clientY;
    if (!fx.fxDef || reduced()) return;
    const burst = 5 + Math.floor(Math.random() * 8);
    for (let i = 0; i < burst; i++) {
      const p = fx.spawnOne(e.clientX + (Math.random() - 0.5) * 14, e.clientY + (Math.random() - 0.5) * 14);
      if (p) { p.vx = (Math.random() - 0.5) * 90; p.vy = (Math.random() - 0.5) * 90 - 20; }
    }
    ensureLoop();
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (!down || !fx.fxDef || reduced()) return;
    if (Math.hypot(e.clientX - lastX, e.clientY - lastY) < 34) return;
    lastX = e.clientX; lastY = e.clientY;
    fx.spawnOne(e.clientX, e.clientY);
    ensureLoop();
  }, { passive: true });
  document.addEventListener('pointerup', () => { down = false; }, { passive: true });
}

/** Apply the background particle layers (array of defs, single def, or null).
    Counts scale so the combined total never exceeds the global cap (CR-7). */
export function setBackground(defs, color) {
  lastColor = color || lastColor;
  if (!bgCanvas) return;
  const list = (Array.isArray(defs) ? defs : defs ? [defs] : []).filter(Boolean).slice(0, MAX_BG_LAYERS);
  const total = list.reduce((n, d) => n + (d.maxCount || 60), 0);
  const scale = total > BG_CAP ? BG_CAP / total : 1;
  bgList = list.map(d => {
    const layer = new Layer(bgCanvas, BG_CAP);
    layer.tint = d.color || lastColor;
    layer.setDef({ ...d, maxCount: Math.max(1, Math.round((d.maxCount || 60) * scale)) }, layer.tint);
    return layer;
  });
  if (!bgList.length) bgCanvas.getContext('2d').clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  else ensureLoop();
}

/** Live background pool sizes per layer (dev/test introspection). */
export function bgPoolSizes() { return bgList.map(l => l.pool.length); }

/** Apply the pointer-FX definition (null to clear). */
export function setPointerFx(def, color) {
  if (!fx) return;
  fx.fxDef = def;
  if (def) {
    fx.def = { ...def, continuous: false, lifetime: def.lifetime || 1.1 };
    fx.setDef(fx.def, color || lastColor);
    fx.def.continuous = false;
  } else fx.setDef(null);
}
