/* Atmosphere engine (docs/03): slow, reactive background scenes.
   Renders at half resolution and upscales (atmospheres are soft by nature);
   one atmosphere active at most; pauses via fx/loop when hidden.
   Color "shift" is painted as canvas tint overlays rather than mutating
   theme variables (decision noted in docs/03). */

import { loop } from './loop.js';

let canvas = null, g = null;
let active = null; // { key, state, options, colors }
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

/* ---------- presets ---------- */

const PRESETS = {
  dayNight: {
    init(state) { state.glow = softBlob(220, 'rgba(255,214,130,0.55)'); state.moonGlow = softBlob(170, 'rgba(190,205,255,0.4)'); },
    tick(state, now, o) {
      const speed = o.speed || 1;
      const dayFrac = ((now / 86400000 * speed) + (new Date().getHours() / 24)) % 1;
      const a = dayFrac * Math.PI * 2 - Math.PI / 2;
      const cx = W() / 2, cy = H() * 1.25, R = H() * 1.05;
      const sx = cx + Math.cos(a) * R, sy = cy + Math.sin(a) * R;
      const mx = cx + Math.cos(a + Math.PI) * R, my = cy + Math.sin(a + Math.PI) * R;
      const sunUp = Math.max(0, Math.min(1, (cy - sy) / (H() * 0.5)));
      const moonUp = Math.max(0, Math.min(1, (cy - my) / (H() * 0.5)));
      // warm/cool wash (brightness/temperature curve)
      if (sunUp > 0) { g.fillStyle = `rgba(255,214,130,${0.07 * sunUp})`; g.fillRect(0, 0, W(), H()); }
      if (moonUp > 0) { g.fillStyle = `rgba(30,45,95,${0.1 * moonUp})`; g.fillRect(0, 0, W(), H()); }
      if (sunUp > 0) {
        g.drawImage(state.glow, sx - 110, sy - 110);
        g.fillStyle = '#ffd882';
        g.beginPath(); g.arc(sx, sy, 26, 0, Math.PI * 2); g.fill();
      }
      if (moonUp > 0) {
        g.drawImage(state.moonGlow, mx - 85, my - 85);
        g.fillStyle = '#e8ecf8';
        g.beginPath(); g.arc(mx, my, 19, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(30,40,80,0.35)';
        g.beginPath(); g.arc(mx - 7, my - 4, 16, 0, Math.PI * 2); g.fill();
      }
    }
  },

  constellations: {
    init(state, o) {
      state.cons = [];
      const planets = o.variant === 'planets';
      state.planets = planets;
      if (planets) {
        state.bodies = Array.from({ length: 5 }, (_, i) => ({
          r: 36 + i * 26, size: 3 + Math.random() * 4,
          hue: ['#d8a85a', '#c97b5a', '#8fb7e8', '#b89ae0', '#9adbe8'][i],
          a: Math.random() * Math.PI * 2, speed: 0.12 / (1 + i * 0.6)
        }));
        return;
      }
      const n = 4 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) state.cons.push(makeCon());
      function makeCon() {
        const cx = Math.random() * 0.9 + 0.05, cy = Math.random() * 0.8 + 0.05;
        const count = 3 + Math.floor(Math.random() * 7);
        return {
          cx, cy, life: 0, ttl: 90 + Math.random() * 120, phase: Math.random() * 9,
          stars: Array.from({ length: count }, () => ({
            dx: (Math.random() - 0.5) * 150, dy: (Math.random() - 0.5) * 110,
            tw: Math.random() * Math.PI * 2, glowUntil: 0
          }))
        };
      }
      state.makeCon = makeCon;
    },
    tick(state, now, o) {
      if (state.planets) {
        const cx = W() * 0.78, cy = H() * 0.24;
        g.fillStyle = '#ffd882';
        g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
        for (const b of state.bodies) {
          b.a += (o.speed || 1) * b.speed * 0.016;
          g.strokeStyle = 'rgba(200,190,230,0.10)';
          g.beginPath(); g.ellipse(cx, cy, b.r, b.r * 0.45, 0.3, 0, Math.PI * 2); g.stroke();
          const x = cx + Math.cos(b.a) * b.r, y = cy + Math.sin(b.a) * b.r * 0.45 + Math.sin(0.3) * 4;
          g.fillStyle = b.hue;
          g.beginPath(); g.arc(x, y, b.size, 0, Math.PI * 2); g.fill();
        }
        return;
      }
      // faint cool wash that breathes with the brightest constellation (CR-4)
      const cool = 0.035 + 0.02 * Math.sin(now / 5200);
      g.fillStyle = `rgba(70,84,170,${cool})`;
      g.fillRect(0, 0, W(), H());
      for (const c of state.cons) {
        c.life += 0.016;
        if (c.life > c.ttl) Object.assign(c, state.makeCon());
        const fade = Math.min(1, c.life / 6, (c.ttl - c.life) / 6);
        const ox = Math.sin(now / 60000 + c.phase) * 10;
        const oy = Math.cos(now / 80000 + c.phase) * 10;
        const pts = c.stars.map(s => [c.cx * W() + s.dx + ox, c.cy * H() + s.dy + oy]);
        g.strokeStyle = `rgba(190,180,230,${0.10 * fade})`;
        g.lineWidth = 1;
        g.beginPath();
        pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
        g.stroke();
        c.stars.forEach((s, i) => {
          const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / 700 + s.tw * 5));
          const glow = now < s.glowUntil ? 2 : 1;
          g.fillStyle = `rgba(230,225,255,${Math.min(1, tw * fade * glow)})`;
          g.beginPath();
          g.arc(pts[i][0], pts[i][1], glow > 1 ? 2.6 : 1.6, 0, Math.PI * 2);
          g.fill();
        });
        c._pts = pts;
      }
    },
    // the one interactive atmosphere: tap a star → it glows (docs/03)
    pointer(state, x, y) {
      for (const c of state.cons || []) {
        for (const [i, p] of (c._pts || []).entries()) {
          if (Math.hypot(p[0] - x, p[1] - y) < 18) {
            c.stars[i].glowUntil = performance.now() + 2200;
            c.life = Math.min(c.life, c.ttl - 12); // keep it around a moment
          }
        }
      }
    }
  },

  sunset: { init(s) { s.glow = softBlob(360, 'rgba(242,150,90,0.5)'); }, tick: sunWash(true) },
  sunrise: { init(s) { s.glow = softBlob(360, 'rgba(255,220,160,0.5)'); }, tick: sunWash(false) },

  waves: {
    init(state, o) {
      state.bands = [0, 1, 2].map(i => ({ amp: 9 + i * 5, speed: (0.5 + i * 0.3), yoff: i * 14, alpha: 0.10 - i * 0.02 }));
      if (o.clouds) PRESETS.clouds.init(state, { count: 2 });
    },
    tick(state, now, o, colors) {
      if (o.clouds) PRESETS.clouds.tick(state, now, { speed: 0.4 }, colors);
      const base = H() - 46;
      const intensity = o.intensity ?? 1;
      // crest pulse: saturation gently swells with the swell (CR-4 coupling)
      const pulse = 1 + 0.2 * Math.sin(now / 2600);
      for (const b of state.bands) {
        g.fillStyle = hexToRgba(colors.accent, b.alpha * intensity * pulse);
        g.beginPath();
        g.moveTo(0, H());
        for (let x = 0; x <= W(); x += 14) {
          const y = base - b.yoff + Math.sin(x / 90 + now / 1000 * b.speed * (o.speed || 1)) * b.amp;
          g.lineTo(x, y);
        }
        g.lineTo(W(), H());
        g.closePath();
        g.fill();
      }
      // occasional foam shimmer at a crest
      if (Math.random() < 0.04) {
        const x = Math.random() * W();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath(); g.arc(x, base - 14 + Math.sin(x / 90 + now / 1000) * 9, 1.5, 0, Math.PI * 2); g.fill();
      }
    }
  },

  clouds: {
    init(state, o) {
      state.cloudSprites = [softBlob(260, 'rgba(255,255,255,0.10)'), softBlob(340, 'rgba(255,255,255,0.07)')];
      state.clouds = Array.from({ length: o.count || 4 }, (_, i) => ({
        x: Math.random() * 1.4 - 0.2, y: 0.06 + Math.random() * 0.3,
        s: 0.7 + Math.random() * 0.9, v: 0.004 + Math.random() * 0.006, sp: i % 2
      }));
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

function sunWash(isSunset) {
  return function (state, now, o, colors) {
    const period = 1200000 / (o.speed || 1); // ~20 min default
    const phase = 0.5 + 0.5 * Math.sin((now % period) / period * Math.PI * 2);
    const sy = H() - 24;
    const sx = W() * (isSunset ? 0.3 : 0.7);
    g.drawImage(state.glow, sx - 180, sy - 180);
    g.fillStyle = isSunset ? '#f2965a' : '#ffdca0';
    g.beginPath(); g.arc(sx, sy, 22, 0, Math.PI * 2); g.fill();
    const grad = g.createLinearGradient(0, H(), 0, 0);
    const a = 0.05 + phase * 0.07;
    grad.addColorStop(0, isSunset ? `rgba(242,130,80,${a})` : `rgba(255,225,170,${a})`);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.fillRect(0, 0, W(), H());
  };
}

function hexToRgba(hex, a) {
  if (!hex?.startsWith('#')) return `rgba(120,180,200,${a})`;
  const v = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`;
}

/* ---------- public API ---------- */

export function initAtmosphere() {
  canvas = document.getElementById('atmosphere-canvas');
  g = canvas.getContext('2d');
  const resize = () => { canvas.width = Math.ceil(innerWidth / 2); canvas.height = Math.ceil(innerHeight / 2); };
  resize();
  addEventListener('resize', resize);
  // forward taps to the interactive atmosphere (canvas itself ignores pointers)
  document.addEventListener('click', (e) => {
    if (!active || !PRESETS[active.key]?.pointer) return;
    if (e.target.closest('.widget-card, .drawer, .dialog, button, input, a, .internal-view')) return;
    PRESETS[active.key].pointer(active.state, e.clientX / 2, e.clientY / 2);
  }, { passive: true });
}

/** Activate an atmosphere ({preset, options} or null) with theme colors. */
export function setAtmosphere(spec, colors) {
  if (!canvas) return; // fx not initialized yet (early boot)
  active = null;
  g?.clearRect(0, 0, canvas.width, canvas.height);
  if (unsub) { unsub(); unsub = null; }
  if (!spec || !PRESETS[spec.preset] || reduced()) return;
  const state = {};
  const options = spec.options || {};
  PRESETS[spec.preset].init?.(state, options);
  active = { key: spec.preset, state, options, colors };
  unsub = loop.add((dt, now) => {
    if (!active) { unsub?.(); unsub = null; return; }
    g.clearRect(0, 0, canvas.width, canvas.height);
    PRESETS[active.key].tick(active.state, now, active.options, active.colors);
  });
}

/** Render a single frame immediately (editor previews, tests). */
export function tickOnce(now = performance.now()) {
  if (!active || !g) return false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  PRESETS[active.key].tick(active.state, now, active.options, active.colors);
  return true;
}

/** Catalog for pickers/editors. */
export const ATMOSPHERE_PRESETS = [
  { key: 'dayNight', name: 'Day / Night cycle' },
  { key: 'constellations', name: 'Constellations' },
  { key: 'sunset', name: 'Sunset' },
  { key: 'sunrise', name: 'Sunrise' },
  { key: 'waves', name: 'Waves' },
  { key: 'clouds', name: 'Clouds' }
];
