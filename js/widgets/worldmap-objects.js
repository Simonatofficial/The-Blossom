/* WorldMap interactive objects (CR-14): the pointer tool's selection layer
   (hit testing, move/scale/rotate handles, Edit/duplicate/delete action bar),
   feature-stamp drawing (built-in glyphs + My Stamps), and the map flavor of
   text boxes — zoom-band visibility and curve-along-an-arc labels. */

import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, openPopover } from '../ui/components.js';
import { saveObject, createObject } from './base.js';
import { TextLayer } from './infcanvas-text.js';
import { getStamp, drawStampAt, openStampPicker } from './wb-stamps.js';
import { drawPin } from './worldmap-pins.js';

/* ---------- built-in feature glyphs (vector, theme-free) ---------- */

export const GLYPHS = {
  mountain: (g, s) => { g.beginPath(); g.moveTo(-s, s * 0.6); g.lineTo(0, -s * 0.8); g.lineTo(s, s * 0.6); g.closePath(); g.fillStyle = '#6e6a64'; g.fill(); g.beginPath(); g.moveTo(-s * 0.25, -s * 0.25); g.lineTo(0, -s * 0.8); g.lineTo(s * 0.25, -s * 0.25); g.closePath(); g.fillStyle = '#e8e6e2'; g.fill(); },
  trees: (g, s) => { g.fillStyle = '#3c6138'; for (const [dx, dy, k] of [[-0.5, 0.3, 0.7], [0.45, 0.15, 0.85], [0, -0.3, 1]]) { g.beginPath(); g.moveTo(dx * s - s * 0.45 * k, dy * s + s * 0.5 * k); g.lineTo(dx * s, dy * s - s * 0.7 * k); g.lineTo(dx * s + s * 0.45 * k, dy * s + s * 0.5 * k); g.closePath(); g.fill(); } },
  city: (g, s) => { g.fillStyle = '#9b8d76'; g.fillRect(-s * 0.8, -s * 0.3, s * 0.5, s * 0.9); g.fillRect(-s * 0.2, -s * 0.7, s * 0.45, s * 1.3); g.fillRect(s * 0.35, -s * 0.1, s * 0.45, s * 0.7); g.fillStyle = '#5d564a'; g.fillRect(-s * 0.2, -s * 0.7, s * 0.45, s * 0.2); },
  tower: (g, s) => { g.fillStyle = '#8b8680'; g.fillRect(-s * 0.22, -s * 0.8, s * 0.44, s * 1.5); g.beginPath(); g.moveTo(-s * 0.35, -s * 0.8); g.lineTo(0, -s * 1.15); g.lineTo(s * 0.35, -s * 0.8); g.closePath(); g.fillStyle = '#7a4a44'; g.fill(); },
  port: (g, s) => { g.strokeStyle = '#5d564a'; g.lineWidth = s * 0.18; g.beginPath(); g.arc(0, -s * 0.1, s * 0.55, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); g.beginPath(); g.moveTo(0, -s * 0.75); g.lineTo(0, s * 0.45); g.stroke(); g.beginPath(); g.arc(0, -s * 0.75, s * 0.16, 0, Math.PI * 2); g.stroke(); },
  village: (g, s) => { g.fillStyle = '#a8906a'; g.fillRect(-s * 0.55, -s * 0.05, s * 1.1, s * 0.6); g.beginPath(); g.moveTo(-s * 0.7, -s * 0.05); g.lineTo(0, -s * 0.65); g.lineTo(s * 0.7, -s * 0.05); g.closePath(); g.fillStyle = '#7a4a44'; g.fill(); }
};

/** Draw one placed feature (glyph or My Stamp) at its world anchor. */
export function drawFeature(g, surf, o, accent = null) {
  const [sx, sy] = surf.toScreen(o.data.x, o.data.y);
  const s = o.data.size * surf.scale();
  if (s < 3 || s > 900 || sx < -s || sy < -s || sx > surf.canvas.width + s || sy > surf.canvas.height + s) return;
  g.save();
  g.translate(sx, sy);
  if (o.data.rot) g.rotate(o.data.rot);
  if (o.data.stampId) {
    const stamp = getStamp(o.data.stampId);
    if (stamp) drawStampAt(g, stamp, s, accent);
  } else {
    GLYPHS[o.data.glyph]?.(g, s / 2);
  }
  g.restore();
}

export function featureName(o) {
  if (o.data.stampId) return getStamp(o.data.stampId)?.name || 'Stamp';
  return o.data.glyph || 'Feature';
}

/* ---------- the pointer tool (default tool, CR-14 §3) ---------- */

const HANDLE = 20; // screen px

export class PointerCtl {
  /**
   * @param {{surf, widget, box: HTMLElement,
   *          stamps: () => object[], pins: () => object[],
   *          editPin: (o) => void, openRef: (o) => void,
   *          onChange: () => void}} opts
   */
  constructor(opts) {
    Object.assign(this, opts);
    this.sel = null;   // selected object record
    this.hover = null;
    this.drag = null;
    this.panFrom = null;
    this.bar = null;
  }

  kindOf(o) { return o.kind === 'pin' ? 'pin' : 'stamp'; }

  screenSize(o) {
    return this.kindOf(o) === 'pin' ? (o.data.size || 24) : o.data.size * this.surf.scale();
  }

  anchor(o) {
    const [sx, sy] = this.surf.toScreen(o.data.x, o.data.y);
    return this.kindOf(o) === 'pin' ? [sx, sy - (o.data.size || 24) * 0.62] : [sx, sy];
  }

  hit(px, py) {
    let best = null, bd = Infinity;
    for (const o of [...this.pins(), ...this.stamps()]) {
      const [ax, ay] = this.anchor(o);
      const r = Math.max(16, this.screenSize(o) * 0.55);
      const d = Math.hypot(px - ax, py - ay);
      if (d < r && d < bd) { bd = d; best = o; }
    }
    return best;
  }

  handleAt(px, py) {
    if (!this.sel) return null;
    const [ax, ay] = this.anchor(this.sel);
    const r = Math.max(18, this.screenSize(this.sel) * 0.62);
    if (Math.hypot(px - (ax + r), py - (ay + r)) < HANDLE) return 'scale';
    if (this.kindOf(this.sel) === 'stamp' && Math.hypot(px - ax, py - (ay - r - 22)) < HANDLE) return 'rotate';
    return null;
  }

  /** @returns {boolean} true when the pointer tool consumed the down. */
  down(wx, wy, px, py) {
    const h = this.handleAt(px, py);
    if (h) {
      const o = this.sel;
      const [ax, ay] = this.anchor(o);
      this.drag = { kind: h, o, ax, ay, size0: o.data.size, rot0: o.data.rot || 0, start: [px, py] };
      return true;
    }
    const o = this.hit(px, py);
    if (o) {
      this.select(o);
      this.drag = { kind: 'move', o, orig: { x: o.data.x, y: o.data.y }, start: [wx, wy], moved: false };
      return true;
    }
    this.select(null);
    this.panFrom = [px, py]; // empty drag pans — a pointer is for USING the map
    return true;
  }

  move(wx, wy, px, py) {
    const d = this.drag;
    if (this.panFrom) {
      const s = this.surf.scale();
      this.surf.view.cx -= (px - this.panFrom[0]) / s;
      this.surf.view.cy -= (py - this.panFrom[1]) / s;
      this.panFrom = [px, py];
      this.surf.cb.onViewChange?.(this.surf.view);
      this.surf.render();
      return;
    }
    if (!d) return;
    if (d.kind === 'move') {
      d.o.data.x = d.orig.x + (wx - d.start[0]);
      d.o.data.y = d.orig.y + (wy - d.start[1]);
      d.moved = true;
    } else if (d.kind === 'scale') {
      const r0 = Math.max(8, Math.hypot(d.start[0] - d.ax, d.start[1] - d.ay));
      const f = Math.hypot(px - d.ax, py - d.ay) / r0;
      if (this.kindOf(d.o) === 'pin') d.o.data.size = Math.max(10, Math.min(120, d.size0 * f));
      else d.o.data.size = Math.max(2 / this.surf.scale(), d.size0 * f);
    } else if (d.kind === 'rotate') {
      d.o.data.rot = d.rot0 + Math.atan2(py - d.ay, px - d.ax) + Math.PI / 2;
    }
    this.positionBar();
    this.surf.render();
  }

  up() {
    this.panFrom = null;
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    saveObject(d.o);
    this.onChange();
  }

  setHover(px, py) {
    const o = this.drag || this.panFrom ? null : this.hit(px, py);
    if (o !== this.hover) {
      this.hover = o;
      this.surf.canvas.style.cursor = o ? 'pointer' : '';
      this.surf.render();
    }
  }

  select(o) {
    if (this.sel === o) return;
    this.sel = o;
    this.bar?.remove();
    this.bar = null;
    if (o) this.openBar(o);
    this.surf.render();
  }

  deselect() { this.select(null); }

  /* ---- floating action bar: Edit · Open · Duplicate · Delete ---- */

  openBar(o) {
    const bar = this.bar = el('<div class="ic-tbar wm-actionbar"></div>');
    const chip = el('<span class="chip" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>');
    chip.textContent = o.kind === 'pin' ? (o.data.name || 'Pin') : featureName(o);
    bar.appendChild(chip);
    const btn = (ic, title, fn) => {
      const b = el(`<button class="btn-icon" title="${title}">${icon(ic, 14)}</button>`);
      b.onpointerdown = (e) => e.stopPropagation();
      b.onclick = (e) => { e.stopPropagation(); fn(e); };
      bar.appendChild(b);
    };
    btn('edit', 'Edit', (e) => {
      if (o.kind === 'pin') this.editPin(o);
      else this.editStamp(o, e.currentTarget);
    });
    if (o.kind === 'pin' && o.data.ref) btn('arrow-right', 'Open linked entry', () => this.openRef(o));
    btn('copy', 'Duplicate', () => {
      const data = structuredClone(o.data);
      data.x += 30 / this.surf.scale();
      data.y += 30 / this.surf.scale();
      const dup = createObject(this.widget.id, o.kind, data);
      this.select(dup);
      this.onChange();
    });
    btn('trash', 'Delete', () => {
      store.del('objects', o.id);
      this.select(null);
      this.onChange();
    });
    this.box.appendChild(bar);
    this.positionBar();
  }

  positionBar() {
    if (!this.bar || !this.sel) return;
    const [ax, ay] = this.anchor(this.sel);
    const r = this.surf.canvas.getBoundingClientRect();
    const k = r.width / this.surf.canvas.width;
    const top = ay * k - Math.max(20, this.screenSize(this.sel) * 0.62 * k) - this.bar.offsetHeight - 12;
    this.bar.style.left = `${Math.max(4, Math.min(ax * k - this.bar.offsetWidth / 2, r.width - this.bar.offsetWidth - 4))}px`;
    this.bar.style.top = `${Math.max(4, top)}px`;
  }

  editStamp(o, anchorEl) {
    const pop = openPopover(anchorEl, { title: 'Feature', width: 240 });
    const sizeRow = el(`<div class="ic-frow"><span>Size</span><input type="range" class="range" min="8" max="400" style="width:120px"></div>`);
    const sl = sizeRow.querySelector('input');
    sl.value = Math.min(400, o.data.size * this.surf.scale());
    sl.oninput = () => { o.data.size = Number(sl.value) / this.surf.scale(); saveObject(o); this.surf.render(); this.positionBar(); };
    pop.body.appendChild(sizeRow);
    const swap = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px;margin-top:6px">${icon('sparkles', 13)} Swap symbol…</button>`);
    swap.onclick = (e) => openStampPicker(e.currentTarget, { title: 'Swap to', onPick: (s) => {
      o.data.stampId = s.id;
      delete o.data.glyph;
      saveObject(o);
      pop.close();
      this.surf.render();
      this.bar?.remove();
      this.openBar(o); // refresh the name chip
    } });
    pop.body.appendChild(swap);
    if (o.data.rot) {
      const reset = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px;margin-top:6px">${icon('refresh', 13)} Reset rotation</button>`);
      reset.onclick = () => { o.data.rot = 0; saveObject(o); pop.close(); this.surf.render(); };
      pop.body.appendChild(reset);
    }
  }

  /* ---- overlay chrome ---- */

  drawOverlay(g) {
    if (this.hover && this.hover !== this.sel) {
      const [ax, ay] = this.anchor(this.hover);
      const r = Math.max(16, this.screenSize(this.hover) * 0.62);
      g.save();
      g.beginPath();
      g.arc(ax, ay, r + 3, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
    }
    const o = this.sel;
    if (!o) return;
    if (!store.get('objects', o.id)) { this.select(null); return; } // deleted elsewhere
    const [ax, ay] = this.anchor(o);
    const r = Math.max(18, this.screenSize(o) * 0.62);
    g.save();
    g.beginPath();
    g.arc(ax, ay, r + 4, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 2;
    g.setLineDash([5, 5]);
    g.lineDashOffset = (performance.now() / 60) % 10;
    g.stroke();
    g.setLineDash([]);
    // scale handle (bottom-right) + rotate knob (stamps only, top)
    g.fillStyle = 'rgba(40,40,48,0.9)';
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.rect(ax + r - 5, ay + r - 5, 10, 10);
    g.fill();
    g.stroke();
    if (this.kindOf(o) === 'stamp') {
      g.beginPath();
      g.arc(ax, ay - r - 22, 6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(ax, ay - r - 16);
      g.lineTo(ax, ay - r - 4);
      g.stroke();
    }
    g.restore();
  }
}

/* ---------- map text boxes: zoom-band visibility + curved labels ---------- */

export class MapTextLayer extends TextLayer {
  /** Map boxes hide outside their visibility band; curved ones render on canvas. */
  hideBox(o, fsPx) {
    const v = o.data.vis;
    if (v && (fsPx < (v.min ?? 0) || fsPx > (v.max ?? 1e9))) return true;
    if (o.data.curve && this.sel !== o.id) return true; // drawn in drawCurved
    return false;
  }

  /** Curved labels (plain text along an arc) — called from the map overlay. */
  drawCurved(g) {
    const s = this.surf.scale();
    for (const o of this.boxes()) {
      const c = o.data.curve;
      if (!c || this.sel === o.id) continue;
      const fs = o.data.size * s;
      const v = o.data.vis;
      if (fs < 3 || (v && (fs < (v.min ?? 0) || fs > (v.max ?? 1e9)))) continue;
      const layer = this.doc.layer(o.data.layerId);
      if (!layer?.visible) continue;
      const tmp = document.createElement('div');
      tmp.innerHTML = o.data.html || '';
      const text = tmp.textContent.trim();
      if (!text) continue;
      const [sx, sy] = this.surf.toScreen(o.data.x + o.data.w / 2, o.data.y);
      g.save();
      g.font = `600 ${fs}px system-ui`;
      g.fillStyle = o.data.color || '#f4efe6';
      g.strokeStyle = 'rgba(20,24,30,0.55)';
      g.lineWidth = Math.max(2, fs / 7);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const width = g.measureText(text).width;
      const radius = Math.max(width * 0.7, width * 60 / Math.abs(c));
      const dir = Math.sign(c);
      const total = width / radius;
      let a = -total / 2;
      const cy = sy + dir * radius;
      for (const ch of [...text]) {
        const cw = g.measureText(ch).width;
        a += (cw / 2) / radius;
        const x = sx + Math.sin(a) * radius;
        const y = cy - dir * Math.cos(a) * radius;
        g.save();
        g.translate(x, y);
        g.rotate(dir * a);
        g.strokeText(ch, 0, 0);
        g.fillText(ch, 0, 0);
        g.restore();
        a += (cw / 2) / radius;
      }
      g.restore();
    }
  }

  openBar(id) {
    super.openBar(id);
    const o = store.get('objects', id);
    if (!o || !this.bar) return;
    const prop = (fn) => {
      const before = this.snap(id);
      fn(store.get('objects', id).data);
      store.put('objects', store.get('objects', id));
      this.commitChange(id, before, this.snap(id));
      this.sync();
      this.surf.render?.();
    };
    const btn = (html, title, fn) => {
      const b = el(`<button class="btn-icon" title="${title}">${html}</button>`);
      b.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); };
      b.onclick = (e) => { e.stopPropagation(); fn(e); };
      this.bar.appendChild(b);
    };
    btn(icon('waves', 14), 'Curve along an arc', (e) => {
      const pop = openPopover(e.currentTarget, { title: 'Curve', width: 220 });
      const row = el('<div class="ic-frow"><span>Bend</span><input type="range" class="range" min="-100" max="100" style="width:120px"></div>');
      const sl = row.querySelector('input');
      sl.value = o.data.curve || 0;
      sl.onchange = () => prop(d => { d.curve = Number(sl.value) || 0; });
      pop.body.appendChild(row);
      pop.body.appendChild(el('<p class="soft" style="font-size:0.74rem;margin:6px 0 0">0 is straight. Curved labels show their text bent over the map.</p>'));
    });
    btn(icon('eye', 14), 'Visible at which zooms', (e) => {
      const pop = openPopover(e.currentTarget, { title: 'Show this label…', width: 240 });
      const v = o.data.vis || { min: 9, max: 110 };
      const mk = (label, key) => {
        const row = el(`<div class="ic-frow"><span>${label}</span><input class="input" type="number" min="1" max="2400" style="width:70px;padding:4px 8px"></div>`);
        const inp = row.querySelector('input');
        inp.value = v[key];
        inp.onchange = () => prop(d => { d.vis = { ...(d.vis || v), [key]: Number(inp.value) || v[key] }; });
        pop.body.appendChild(row);
      };
      mk('From (px)', 'min');
      mk('To (px)', 'max');
      pop.body.appendChild(el('<p class="soft" style="font-size:0.74rem;margin:6px 0 0">The label shows while its on-screen size sits in this range — big names far out, small names close in.</p>'));
    });
  }
}
