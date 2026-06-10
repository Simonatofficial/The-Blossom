/* Particle engine (docs/03): one engine, two layers — background behind the
   UI, pointer FX above it. Pooled, pre-rasterized sprites, hard caps,
   auto-degrade, reduced-motion → zero particles. Driven by fx/loop.js. */

import { loop } from './loop.js';

const BG_CAP = 150;
const FX_CAP = 120;

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
  }
};

/** Sprite ids for editors/pickers. */
export const SPRITE_NAMES = Object.keys(SPRITES);

function rasterize(shape, size, color) {
  const steps = [0.7, 1, 1.4].map(f => {
    const s = Math.max(4, Math.round(size * f));
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    if (shape.kind === 'sprite' && SPRITES[shape.value]) {
      SPRITES[shape.value](g, s, color);
    } else {
      g.font = `${Math.round(s * 0.85)}px system-ui`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = color;
      g.fillText(shape.value || '✦', s / 2, s / 2);
    }
    return c;
  });
  return steps;
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
    this.sprites = null;
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
    this.sprites = rasterize(def.shape, def.size || 16, color);
    const cap = Math.min(this.cap, Math.round((def.maxCount || 60) * this.degrade));
    this.pool = Array.from({ length: cap }, () => ({ alive: false }));
  }

  spawnOne(atX = null, atY = null) {
    const d = this.def;
    const p = this.pool.find(q => !q.alive);
    if (!p) return null;
    const W = this.canvas.width, H = this.canvas.height;
    const rnd = (v, varr) => v * (1 + (Math.random() * 2 - 1) * (varr || 0));
    const area = d.spawn?.area || 'random';
    let x, y;
    if (atX != null) { x = atX; y = atY; }
    else if (area === 'top') { x = Math.random() * W; y = -20; }
    else if (area === 'bottom') { x = Math.random() * W; y = H + 20; }
    else if (area === 'left') { x = -20; y = Math.random() * H; }
    else if (area === 'right') { x = W + 20; y = Math.random() * H; }
    else if (area === 'center' || area === 'middle') {
      const r = (d.spawn?.radius ?? 0.3) * Math.min(W, H);
      const a = Math.random() * Math.PI * 2;
      x = (d.spawn?.x ?? 0.5) * W + Math.cos(a) * r * Math.random();
      y = (d.spawn?.y ?? 0.5) * H + Math.sin(a) * r * Math.random();
    } else { x = Math.random() * W; y = Math.random() * H; }

    const speed = rnd((d.speed || 1) * 28, d.speedVar || 0.3);
    const dir = {
      fallDown: [0, 1], floatUp: [0, -1], flowLeft: [-1, 0], flowRight: [1, 0],
      flowDiagonal: [0.7, 0.7], drift: [0, 0], random: [Math.random() * 2 - 1, Math.random() * 2 - 1],
      orbit: [0, 0], bounce: [Math.random() * 2 - 1, Math.random() * 2 - 1]
    }[d.behavior] || [0, 1];

    Object.assign(p, {
      alive: true, x, y,
      vx: dir[0] * speed, vy: dir[1] * speed,
      size: Math.max(0.2, rnd(1, d.sizeVar || 0.3)),
      rot: Math.random() * Math.PI * 2,
      spin: (d.rotation?.spin || 0) * (Math.random() - 0.5) * 4,
      sway: d.rotation?.sway || 0,
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

  tick(dt, now) {
    const d = this.def;
    const { g, canvas } = this;
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!d || reduced()) return false;

    // keep background density topped up
    if (d.continuous !== false) {
      const target = Math.min(this.pool.length, Math.round((d.maxCount || 60) * this.degrade));
      this.spawnAcc += dt * Math.max(4, target / 4);
      while (this.spawnAcc > 1 && this.live < target) { this.spawnAcc -= 1; this.spawnOne(); }
    }

    const effects = d.effects || [];
    const tw = effects.includes('twinkle');
    const grow = effects.includes('grow');
    const shrink = effects.includes('shrink') || effects.includes('pop');

    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.ttl && p.age > p.ttl) { p.alive = false; this.live--; continue; }

      if (d.behavior === 'orbit') {
        p.orbitA += dt * (d.speed || 1) * 0.6;
        p.x = p.cx + Math.cos(p.orbitA) * p.orbitR;
        p.y = p.cy + Math.sin(p.orbitA) * p.orbitR * 0.5;
      } else if (d.behavior === 'drift') {
        p.x += Math.sin(now / 1700 + p.phase) * 12 * dt;
        p.y += Math.cos(now / 2300 + p.phase) * 8 * dt;
      } else {
        if (p.sway) p.x += Math.sin(now / 800 + p.phase) * p.sway * 26 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (d.behavior === 'bounce') {
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        }
      }
      p.rot += p.spin * dt;

      // offscreen despawn (cheap bounds math)
      if (p.x < -60 || p.x > canvas.width + 60 || p.y < -60 || p.y > canvas.height + 60) {
        if (!p.ttl) { p.alive = false; this.live--; continue; }
      }

      let alpha = 1;
      if (tw) alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 350 + p.phase * 7));
      if (p.ttl) alpha *= Math.min(1, (p.ttl - p.age) / (p.ttl * 0.4));
      let scale = p.size;
      if (grow) scale *= 0.5 + Math.min(1, p.age / (p.ttl || 2)) * 0.9;
      if (shrink && p.ttl) scale *= Math.max(0.1, 1 - p.age / p.ttl * 0.6);

      const sprite = this.sprites[scale < 0.85 ? 0 : scale > 1.2 ? 2 : 1];
      g.globalAlpha = Math.max(0, Math.min(1, alpha));
      g.save();
      g.translate(p.x, p.y);
      if (p.spin || p.sway) g.rotate(p.rot);
      g.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      g.restore();
    }
    g.globalAlpha = 1;
    return this.live > 0 || d.continuous !== false;
  }
}

/* ---- public API ---- */

let bg = null, fx = null;
let unsubLoop = null;
let lastColor = '#ffffff';

function ensureLoop() {
  if (unsubLoop) return;
  let frames = 0, slow = 0;
  unsubLoop = loop.add((dt, now) => {
    const t0 = performance.now();
    const a = bg?.tick(dt, now);
    const b = fx?.tick(dt, now);
    // auto-degrade: >20ms for 60 consecutive frames → halve counts (docs/03)
    if (performance.now() - t0 > 20) { if (++slow >= 60) { degrade(); slow = 0; } }
    else slow = 0;
    if (!a && !b && !bg?.def && !fx?.def) { unsubLoop(); unsubLoop = null; }
  });
}

function degrade() {
  const level = Math.max(0.25, Number(localStorage.getItem('blossom:fxDegrade') || 1) / 2);
  localStorage.setItem('blossom:fxDegrade', String(level));
  if (bg) { bg.degrade = level; if (bg.def) bg.setDef(bg.def, lastColor); }
}

export function initParticles() {
  bg = new Layer(document.getElementById('particle-canvas'), BG_CAP);
  fx = new Layer(document.getElementById('fx-canvas'), FX_CAP);
  fx.def = null;
  addEventListener('resize', () => { bg.resize(); fx.resize(); });

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

/** Apply the background particle definition (null to clear). */
export function setBackground(def, color) {
  lastColor = color || lastColor;
  bg?.setDef(def, lastColor);
  if (def) ensureLoop();
}

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
