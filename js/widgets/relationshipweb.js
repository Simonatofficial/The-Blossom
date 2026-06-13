/* RelationshipWeb widget (docs/08 §3): the module's characters (shared
   worldchars objects) drawn as a force-directed node graph on canvas. Edges
   come from each character's relationships. Tap a node to open that character.
   The simulation runs a bounded number of ticks then rests (perf budget); it
   re-heats on drag, tap, or resize, and never runs while the tab is hidden. */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';
import { siblingWidgets, openEntry } from './wb-shared.js';
import { objectsOf } from './base.js';

const MAX_NODES = 60;

/** Gather characters + undirected relationship edges across the module. */
function graphOf(widget) {
  const nodes = [];
  const seen = new Set();
  for (const w of siblingWidgets(widget, ['worldchars'])) {
    for (const o of objectsOf(w.id, 'wchar')) {
      if (seen.has(o.id) || nodes.length >= MAX_NODES) continue;
      seen.add(o.id);
      nodes.push({ id: o.id, name: o.data.name || 'Unnamed', rels: o.data.relationships || [] });
    }
  }
  const idset = new Set(nodes.map(n => n.id));
  const edges = [];
  const ekey = new Set();
  for (const n of nodes) {
    for (const rel of n.rels) {
      const tid = rel.ref?.kind === 'char' ? rel.ref.id : null;
      if (!tid || !idset.has(tid) || tid === n.id) continue;
      const key = [n.id, tid].sort().join('|');
      if (ekey.has(key)) continue;
      ekey.add(key);
      edges.push({ a: n.id, b: tid, label: rel.label || '' });
    }
  }
  for (const n of nodes) n.degree = edges.filter(e => e.a === n.id || e.b === n.id).length;
  return { nodes, edges };
}

registry.register({
  type: 'relationshipweb',
  name: 'Relationship Web',
  icon: 'link',
  description: 'Your characters as a living web of relationships — tap a node to open them',
  keywords: ['relationship', 'web', 'graph', 'npc', 'social', 'network', 'dm'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget) {
    host.innerHTML = '';
    const { nodes, edges } = graphOf(widget);
    if (!nodes.length) { host.appendChild(el('<span class="soft" style="font-size:0.84rem">No characters to connect yet.</span>')); return; }
    host.appendChild(el(`<div class="soft" style="font-size:0.86rem">${icon('link', 13)} ${nodes.length} characters · ${edges.length} ties — open to explore the web</div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const wrap = el('<div class="rweb-wrap"></div>');
    const canvas = el('<canvas class="rweb-canvas"></canvas>');
    wrap.appendChild(canvas);
    host.appendChild(wrap);

    const { nodes, edges } = graphOf(widget);
    if (!nodes.length) {
      host.innerHTML = '';
      host.appendChild(el('<div class="empty-state">' + icon('link', 28) + '<p>No characters yet. Add some on the NPCs page and relate them — the web grows itself.</p></div>'));
      return;
    }

    const ctxc = canvas.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const col = (n, fb) => (css.getPropertyValue(n).trim() || fb);
    const C = { accent: col('--accent', '#c98bdb'), text: col('--text', '#f0e9f5'), soft: col('--text-soft', '#b6a9c4'), surface: col('--surface', '#2a2235'), border: col('--border', '#473b56') };

    let W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    // seed positions on a circle
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      n.x = 200 + Math.cos(a) * 120; n.y = 200 + Math.sin(a) * 120; n.vx = 0; n.vy = 0;
    });

    const resize = () => {
      W = wrap.clientWidth || 320; H = Math.max(320, Math.min(560, W * 0.8));
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctxc.setTransform(dpr, 0, 0, dpr, 0, 0);
      heat = Math.max(heat, 200);
    };

    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let heat = 320, raf = 0, dragging = null;

    const tick = () => {
      raf = 0;
      if (!canvas.isConnected) return;
      if (!document.hidden && heat > 0) {
        step();
        heat--;
      }
      paint();
      if (canvas.isConnected && (heat > 0 || dragging)) raf = requestAnimationFrame(tick);
    };
    // reduced motion: no decorative settling animation — the layout is solved
    // synchronously and just repainted; dragging still repositions live.
    const kick = () => { if (reduced) { paint(); return; } if (!raf) raf = requestAnimationFrame(tick); };

    const step = () => {
      const cx = W / 2, cy = H / 2;
      for (const n of nodes) {
        if (n === dragging) continue;
        // centering
        n.vx += (cx - n.x) * 0.002; n.vy += (cy - n.y) * 0.002;
        // repulsion
        for (const m of nodes) {
          if (m === n) continue;
          let dx = n.x - m.x, dy = n.y - m.y;
          let d2 = dx * dx + dy * dy || 0.01;
          if (d2 < 40000) { const f = 1400 / d2; n.vx += dx * f * 0.02; n.vy += dy * f * 0.02; }
        }
      }
      // springs
      for (const e of edges) {
        const a = byId[e.a], b = byId[e.b];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (d - 120) * 0.01;
        const fx = dx / d * f, fy = dy / d * f;
        if (a !== dragging) { a.vx += fx; a.vy += fy; }
        if (b !== dragging) { b.vx -= fx; b.vy -= fy; }
      }
      for (const n of nodes) {
        if (n === dragging) continue;
        n.vx *= 0.86; n.vy *= 0.86;
        n.x += Math.max(-8, Math.min(8, n.vx)); n.y += Math.max(-8, Math.min(8, n.vy));
        n.x = Math.max(28, Math.min(W - 28, n.x)); n.y = Math.max(28, Math.min(H - 28, n.y));
      }
    };

    const radiusOf = (n) => 16 + Math.min(10, n.degree * 2);

    const paint = () => {
      ctxc.clearRect(0, 0, W, H);
      // edges
      ctxc.lineWidth = 1.5; ctxc.strokeStyle = C.border;
      for (const e of edges) {
        const a = byId[e.a], b = byId[e.b];
        if (!a || !b) continue;
        ctxc.beginPath(); ctxc.moveTo(a.x, a.y); ctxc.lineTo(b.x, b.y); ctxc.stroke();
      }
      // nodes
      for (const n of nodes) {
        const r = radiusOf(n);
        ctxc.beginPath(); ctxc.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctxc.fillStyle = C.surface; ctxc.fill();
        ctxc.lineWidth = 2; ctxc.strokeStyle = C.accent; ctxc.stroke();
        ctxc.fillStyle = C.text; ctxc.font = '600 13px system-ui, sans-serif';
        ctxc.textAlign = 'center'; ctxc.textBaseline = 'middle';
        ctxc.fillText((n.name || '?').charAt(0).toUpperCase(), n.x, n.y);
        ctxc.fillStyle = C.soft; ctxc.font = '11px system-ui, sans-serif';
        const label = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name;
        ctxc.fillText(label, n.x, n.y + r + 9);
      }
    };

    // pointer: drag a node, or tap to open
    const at = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
      let hit = null;
      for (const n of nodes) { if (Math.hypot(px - n.x, py - n.y) <= radiusOf(n) + 4) hit = n; }
      return { px, py, hit };
    };
    let downAt = null, moved = false;
    canvas.addEventListener('pointerdown', (ev) => {
      const { px, py, hit } = at(ev);
      downAt = { px, py, t: Date.now() }; moved = false;
      if (hit) { dragging = hit; canvas.setPointerCapture(ev.pointerId); kick(); }
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      const { px, py } = at(ev);
      if (downAt && Math.hypot(px - downAt.px, py - downAt.py) > 5) moved = true;
      dragging.x = px; dragging.y = py; dragging.vx = dragging.vy = 0;
      heat = Math.max(heat, 60); kick();
    });
    canvas.addEventListener('pointerup', (ev) => {
      const wasDragging = dragging;
      dragging = null;
      const { hit } = at(ev);
      if (wasDragging && !moved && hit) openEntry({ kind: 'char', id: hit.id }, ctx);
      heat = Math.max(heat, 120); kick();
    });

    const ro = new ResizeObserver(() => { resize(); kick(); });
    ro.observe(wrap);
    resize();
    if (reduced) for (let i = 0; i < 240; i++) step(); // solve the layout up front
    kick();

    host.appendChild(el('<p class="soft" style="font-size:0.74rem;margin-top:8px;text-align:center">Drag to rearrange · tap a character to open them</p>'));
  }
});
