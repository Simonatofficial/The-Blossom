/* Weather / screen effects (docs/13 §8): a decorative layer that sits ABOVE the
   atmosphere but BELOW widget cards (background canvas), plus a foreground canvas
   over everything that is pointer-events:none so the UI stays fully interactive.
   Interactive elements (icicles, droplets, clouds, s'mores) are hit-tested from a
   document-level click instead of capturing pointers. One effect at a time;
   driven by fx/loop, pauses when hidden, off entirely under reduced-motion. */

import { loop } from './loop.js';
import { store } from '../core/store.js';
import { events } from '../core/events.js';

let bg = null, fg = null, gb = null, gf = null, overlay = null;
let active = [];   // [{ key, state }] — multiple effects can run at once (V2 §8)
let intensity = 0.5;
let unsub = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const W = () => bg.width, H = () => bg.height;
const rnd = (a, b) => a + Math.random() * (b - a);

function makeCanvas(id, z) {
  const c = document.createElement('canvas');
  c.id = id;
  c.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;
  document.body.appendChild(c);
  return c;
}

/* ---------- effects ---------- */

const EFFECTS = {
  /* SNOW — falling flakes (bg) + icicles growing from the top edge (fg). */
  snow: {
    init(s) {
      s.flakes = Array.from({ length: Math.round(40 + intensity * 120) }, () => ({ x: Math.random() * W(), y: Math.random() * H(), r: rnd(0.8, 2.2), vy: rnd(20, 55), vx: rnd(-8, 8), ph: Math.random() * 9 }));
      s.icicles = Array.from({ length: Math.round(4 + intensity * 8) }, () => ({ x: rnd(0.03, 0.97) * W(), w: rnd(7, 16), len: rnd(8, 30), grow: rnd(2, 6), max: rnd(40, 120), shards: null }));
    },
    tickBg(g, s, dt, now) {
      g.fillStyle = '#eef4ff';
      for (const f of s.flakes) {
        f.y += f.vy * dt; f.x += (f.vx + Math.sin(now / 900 + f.ph) * 10) * dt;
        if (f.y > H() + 5) { f.y = -5; f.x = Math.random() * W(); }
        g.globalAlpha = 0.8; g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    },
    tickFg(g, s, dt, now) {
      for (const ic of s.icicles) {
        if (ic.shards) {
          let alive = false;
          for (const p of ic.shards) {
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 280 * dt; p.life -= dt;
            if (p.life > 0) { alive = true; g.globalAlpha = Math.max(0, p.life / (p.max || 1)); g.fillStyle = '#dcebff'; g.fillRect(p.x, p.y, p.sz, p.sz); }
          }
          g.globalAlpha = 1;
          if (!alive && now > ic.regrow) { ic.shards = null; ic.len = 4; }
          continue;
        }
        ic.len = Math.min(ic.max, ic.len + ic.grow * (0.4 + intensity) * dt * 6);
        const grad = g.createLinearGradient(ic.x, 0, ic.x, ic.len);
        grad.addColorStop(0, 'rgba(210,230,255,0.7)'); grad.addColorStop(1, 'rgba(180,210,255,0.15)');
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(ic.x - ic.w / 2, 0); g.lineTo(ic.x + ic.w / 2, 0); g.lineTo(ic.x, ic.len); g.closePath(); g.fill();
      }
    },
    pointer(s, x, y, now) {
      for (const ic of s.icicles) {
        if (ic.shards) continue;
        const hw = Math.max(ic.w, 20); // generous tap target around the icicle
        if (x > ic.x - hw && x < ic.x + hw && y < ic.len + 28) {
          // a clearly visible shatter burst that falls and fades on screen
          ic.shards = Array.from({ length: 22 }, () => ({ x: ic.x + rnd(-ic.w, ic.w), y: ic.len * Math.random(), vx: rnd(-160, 160), vy: rnd(-80, 50), sz: rnd(2, 6), life: rnd(0.5, 1.0), max: 1.0 }));
          ic.regrow = now + rnd(10000, 40000);
          return true;
        }
      }
      return false;
    }
  },

  /* RAIN — angled streaks (bg) + droplets that gather on the glass and run when
     tapped (fg). */
  rain: {
    init(s) {
      // Spawn all streaks from the top edge only, with a left overhang large enough
      // that diagonal drift covers the top-left corner evenly (no left-edge cluster).
      s.spawn = (r) => {
        r.x = Math.random() * (W() + H() * 0.22) - H() * 0.22;
        r.y = -r.len;
      };
      s.streaks = Array.from({ length: Math.round(60 + intensity * 160) }, () => { const r = { len: rnd(10, 26), v: rnd(550, 900) }; s.spawn(r); r.y = Math.random() * H(); return r; });
      s.drops = [];
      s.acc = 0;
    },
    tickBg(g, s, dt) {
      g.strokeStyle = 'rgba(170,195,235,0.5)'; g.lineWidth = 1.3;
      for (const r of s.streaks) {
        r.y += r.v * dt; r.x += r.v * 0.18 * dt;
        if (r.y > H() || r.x - r.len > W()) s.spawn(r);
        g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x - r.len * 0.18, r.y - r.len); g.stroke();
      }
    },
    tickFg(g, s, dt) {
      s.acc += dt * (0.18 + intensity * 0.95);
      if (s.acc > 1 && s.drops.length < 26) { s.acc = 0; s.drops.push({ x: Math.random() * W(), y: rnd(0.1, 0.85) * H(), r: rnd(2.5, 5.5), run: false, v: 0, age: 0, ttl: rnd(7, 14) }); }
      for (const d of s.drops) {
        d.age += dt;
        if (!d.run && d.age > d.ttl) d.run = true; // self-clear after a while so droplets don't pile up
        if (d.run) { d.v += 600 * dt; d.y += d.v * dt; d.r *= 0.992; }
        g.fillStyle = `rgba(200,220,250,${d.run ? 0.16 : 0.3})`;
        g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.26)'; g.beginPath(); g.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.28, 0, Math.PI * 2); g.fill();
      }
      s.drops = s.drops.filter(d => d.y < H() + 10 && d.r > 1);
    },
    pointer(s, x, y) {
      // bigger tap radius so droplets are easy to pop, even over a widget below
      let hit = false;
      for (const d of s.drops) if (!d.run && Math.hypot(d.x - x, d.y - y) < d.r + 16) { d.run = true; hit = true; }
      return hit;
    }
  },

  /* CLOUDS — soft cumulus drifting across the sky; tap one to puff it apart.
     The cloud "type" (white peaceful → dark stormy) tracks intensity. */
  clouds: {
    noWidgetOverlap: true, // a tap that lands on a widget belongs to the widget, not the cloud
    init(s) {
      function makeCloud(top) { return { x: Math.random() * 1.3 - 0.15, y: top ? rnd(0, 0.12) : rnd(0.05, 0.4), scale: rnd(0.7, 1.5), v: rnd(0.01, 0.03), puffs: Array.from({ length: 5 }, () => ({ dx: rnd(-0.6, 0.6), dy: rnd(-0.2, 0.2), r: rnd(0.4, 1) })) }; }
      s.clouds = Array.from({ length: 5 }, () => makeCloud(false));   // drift behind widgets
      s.fgClouds = Array.from({ length: 3 }, () => makeCloud(true));  // pass in front, top only
      s.makeCloud = makeCloud;
    },
    tickBg(g, s, dt) {
      const dark = intensity; // 0 white → 1 stormy
      const col = `rgba(${Math.round(255 - dark * 130)},${Math.round(255 - dark * 130)},${Math.round(255 - dark * 110)},0.5)`;
      for (const c of s.clouds) {
        c.x += c.v * dt;
        if (c.x > 1.2) Object.assign(c, s.makeCloud(), { x: -0.2 });
        const cx = c.x * W(), cy = c.y * H(), base = 38 * c.scale;
        g.fillStyle = col;
        for (const p of c.puffs) { g.beginPath(); g.arc(cx + p.dx * base * 1.6, cy + p.dy * base, p.r * base, 0, Math.PI * 2); g.fill(); }
        c._box = [cx - base * 1.8, cy - base, base * 3.6, base * 2];
      }
    },
    tickFg(g, s, dt) {
      // clouds that pass IN FRONT of widgets, but only across the very top of the
      // screen so they never cover content the user is working with.
      g.fillStyle = `rgba(255,255,255,${0.2 - intensity * 0.05})`;
      for (const c of s.fgClouds) {
        c.x += c.v * 0.8 * dt;
        if (c.x > 1.25) Object.assign(c, s.makeCloud(true), { x: -0.2 });
        const cx = c.x * W(), cy = c.y * H() + 6, base = 30 * c.scale;
        for (const p of c.puffs) { g.beginPath(); g.arc(cx + p.dx * base * 1.6, cy + Math.min(p.dy * base, base * 0.3), p.r * base, 0, Math.PI * 2); g.fill(); }
      }
    },
    pointer(s, x, y) {
      for (let i = s.clouds.length - 1; i >= 0; i--) {
        const b = s.clouds[i]._box;
        if (b && x > b[0] && x < b[0] + b[2] && y > b[1] && y < b[1] + b[3]) {
          const c = s.clouds.splice(i, 1)[0];
          for (let k = 0; k < 4; k++) s.clouds.push({ ...s.makeCloud(), x: c.x + rnd(-0.05, 0.05), y: c.y + rnd(-0.05, 0.05), scale: c.scale * 0.5, v: c.v * rnd(1.2, 2) });
          return true;
        }
      }
      return false;
    }
  },

  /* WIND — horizontal streaks (bg) + faint passing gusts (fg). Widgets get a
     gentle CSS wobble via body.wx-wind (amplitude scales with intensity). */
  wind: {
    init(s) { s.streaks = Array.from({ length: Math.round(14 + intensity * 30) }, () => ({ x: Math.random() * W(), y: Math.random() * H(), len: rnd(40, 160), v: rnd(300, 700) * (0.5 + intensity), a: rnd(0.05, 0.2) })); },
    tickBg(g, s, dt) {
      g.lineCap = 'round';
      for (const w of s.streaks) {
        w.x += w.v * dt;
        if (w.x - w.len > W()) { w.x = -w.len; w.y = Math.random() * H(); }
        g.strokeStyle = `rgba(255,255,255,${w.a})`; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(w.x, w.y); g.lineTo(w.x - w.len, w.y); g.stroke();
      }
    },
    tickFg() {}
  },

  /* FIRE — a flame sim at bottom-centre with rising embers (bg), a warm glow at
     the bottom edge (CSS), and s'mores that cook over time; tap a cooked one to
     eat it (fg). */
  fire: {
    init(s) {
      s.parts = [];
      const n = 6;
      s.smores = Array.from({ length: n }, (_, i) => makeSmore(i, n));
      s.acc = 0;
      function makeSmore(i, n) { return { x: 0.5 + (i - (n - 1) / 2) * (0.78 / (n - 1)), cook: 0, eaten: false, born: 0 }; }
      s.makeSmore = makeSmore;
    },
    tickBg(g, s, dt, now) {
      // a calm, cohesive campfire: fewer, softer particles, denser in the centre
      // so it reads as one natural flame (not scattered). Slider drives height.
      const base = H() - 4, size = 0.85 + intensity * 0.7, tall = 0.6 + intensity * 1.4;
      const cx = W() / 2, halfW = W() * (0.2 + intensity * 0.12);
      s.acc += dt * (38 + intensity * 78);
      while (s.acc > 1) {
        s.acc -= 1;
        const off = (Math.random() + Math.random() - 1) * halfW; // triangular → denser centre
        s.parts.push({ x: cx + off, y: base, vx: rnd(-7, 7), vy: rnd(-118, -150) * tall, life: rnd(0.6, 1.1), max: 1.1, ember: Math.random() < 0.05 });
      }
      for (const p of s.parts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 24 * dt; p.life -= dt;
        const t = 1 - p.life / p.max; // 0 hot → 1 cool
        if (p.ember) { g.fillStyle = `rgba(255,${180 - t * 120 | 0},80,${Math.max(0, p.life)})`; g.fillRect(p.x, p.y, 2, 2); }
        else { const col = t < 0.4 ? `rgba(255,236,140,${0.7 * p.life})` : t < 0.7 ? `rgba(255,150,50,${0.6 * p.life})` : `rgba(120,90,90,${0.3 * p.life})`; g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, (7 + t * 8) * size, 0, Math.PI * 2); g.fill(); }
      }
      s.parts = s.parts.filter(p => p.life > 0);
    },
    tickFg(g, s, dt, now) {
      const speed = (0.4 + intensity) * 0.05;
      const baseY = H() - 58; // sit low near the bottom; sticks reach down into the fire
      for (const sm of s.smores) {
        if (sm.eaten) { if (now > sm.born) { sm.eaten = false; sm.cook = 0; sm.x = 0.11 + Math.random() * 0.78; } else continue; }
        sm.cook = Math.min(1, sm.cook + dt * speed);
        const x = sm.x * W();
        g.strokeStyle = '#7a5230'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, H()); g.lineTo(x, baseY); g.stroke(); // stick down to the bottom edge
        const r = parseInt(248 - sm.cook * 22), gg = parseInt(236 - sm.cook * 66), b = parseInt(200 - sm.cook * 120); // pale → golden (never dark brown)
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.beginPath(); g.roundRect ? g.roundRect(x - 11, baseY - 20, 22, 22, 5) : g.rect(x - 11, baseY - 20, 22, 22); g.fill();
        if (sm.cook >= 1) { g.fillStyle = `rgba(255,240,180,${0.4 + 0.4 * Math.sin(now / 200)})`; g.beginPath(); g.arc(x, baseY - 9, 4, 0, Math.PI * 2); g.fill(); }
        sm._box = [x - 20, baseY - 30, 40, 46]; // generous tap target (tappable over widgets via the hit-test)
      }
    },
    pointer(s, x, y, now) {
      for (const sm of s.smores) if (!sm.eaten && sm.cook >= 1 && sm._box && x > sm._box[0] && x < sm._box[0] + sm._box[2] && y > sm._box[1] && y < sm._box[1] + sm._box[3]) { sm.eaten = true; sm.born = now + 2000; return true; }
      return false;
    }
  }
};

/* ---------- public API ---------- */

export function initWeather() {
  if (bg) return;
  bg = makeCanvas('weather-bg', 1);
  fg = makeCanvas('weather-fg', 150);
  gb = bg.getContext('2d'); gf = fg.getContext('2d');
  overlay = document.createElement('div'); overlay.id = 'weather-fx'; document.body.appendChild(overlay);
  const resize = () => { for (const c of [bg, fg]) { c.width = innerWidth; c.height = innerHeight; } for (const a of active) EFFECTS[a.key].init(a.state); };
  resize();
  addEventListener('resize', resize);
  document.addEventListener('click', (e) => {
    if (!active.length) return;
    // Let genuine overlay UI (modals, menus, the FAB) keep their taps. Otherwise
    // the weather element wins ONLY when the tap actually lands on an effect's
    // hitbox — so you can pop a droplet or eat a s'more even with a widget below.
    if (e.target.closest('.drawer, .dialog, .menu, .popover, [role="dialog"], #fab-root')) return;
    const overWidget = !!e.target.closest('.widget-card, .internal-view');
    let handled = false;
    for (const a of active) {
      const ef = EFFECTS[a.key];
      if (!ef.pointer) continue;
      if (ef.noWidgetOverlap && overWidget) continue; // clouds only react below widgets
      if (ef.pointer(a.state, e.clientX, e.clientY, performance.now())) handled = true;
    }
    if (handled) { e.stopPropagation(); e.preventDefault(); }
  }, { capture: true });
  events.on('weather:changed', setWeather);
  setWeather();
}

/** Read meta.settings.fx and activate/deactivate the chosen weather effect. */
export function setWeather() {
  if (!bg) return;
  const fx = store.getMeta('settings', {})?.fx || {};
  const wx = fx.weather || {};
  intensity = wx.intensity ?? 0.5;
  for (const k of Object.keys(EFFECTS)) document.body.classList.toggle(`wx-${k}`, false);
  // Tilt scales with intensity so the slider visibly changes lean, stays subtle throughout.
  document.documentElement.style.setProperty('--wx-wob', `${0.2 + intensity * 1.3}deg`);
  gb?.clearRect(0, 0, W(), H()); gf?.clearRect(0, 0, W(), H());
  active = [];
  if (unsub) { unsub(); unsub = null; }
  // selected effects: new multi list (activeEffects) with back-compat for the
  // old single activeEffect field.
  let keys = Array.isArray(wx.activeEffects) ? wx.activeEffects : (wx.activeEffect ? [wx.activeEffect] : []);
  keys = keys.filter(k => EFFECTS[k]);
  if (!fx.weatherEnabled || !keys.length || reduced()) return;
  for (const key of keys) {
    document.body.classList.add(`wx-${key}`);
    const state = {};
    EFFECTS[key].init(state);
    active.push({ key, state });
  }
  unsub = loop.add((dt, now) => {
    if (!active.length) { unsub?.(); unsub = null; return; }
    gb.clearRect(0, 0, W(), H()); gf.clearRect(0, 0, W(), H());
    for (const a of active) EFFECTS[a.key].tickBg?.(gb, a.state, dt, now); // all backgrounds first
    for (const a of active) EFFECTS[a.key].tickFg?.(gf, a.state, dt, now); // then all foregrounds
  });
}

/** Draw a few frames immediately (for verification while the loop is asleep). */
export function weatherTickOnce(frames = 8) {
  if (!active.length) return false;
  for (let i = 0; i < frames; i++) {
    gb.clearRect(0, 0, W(), H()); gf.clearRect(0, 0, W(), H());
    for (const a of active) EFFECTS[a.key].tickBg?.(gb, a.state, 0.016, 1000 + i * 16);
    for (const a of active) EFFECTS[a.key].tickFg?.(gf, a.state, 0.016, 1000 + i * 16);
  }
  return true;
}

/** The selectable weather effects (for the settings picker). */
export const WEATHER_EFFECTS = [
  { key: 'snow', name: 'Snow' }, { key: 'rain', name: 'Rain' }, { key: 'clouds', name: 'Clouds' },
  { key: 'wind', name: 'Wind' }, { key: 'fire', name: 'Fire' }
];
