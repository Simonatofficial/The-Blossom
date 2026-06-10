/* Graph widget (docs/05): the visualization engine. Custom canvas renderers
   (no chart libs), theme-colored, animated draw-in, tap → tooltip → navigate.
   The Flower Graph geometry lives in flowergraph.js. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { loop } from '../fx/loop.js';
import { icon } from '../ui/icons.js';
import { el, field, seg, input } from '../ui/components.js';
import { todayStr, dateAdd, childWidgetsOf } from './base.js';
import * as values from '../core/values.js';
import { openLinkPicker } from '../ui/picker.js';
import { drawFlower, stemSvg, hexA } from './flowergraph.js';

const RANGES = { week: 7, month: 30, quarter: 90 };

function themeColors(host) {
  const s = getComputedStyle(host);
  const v = (n) => s.getPropertyValue(n).trim();
  return { accent: v('--accent'), highlight: v('--highlight'), success: v('--success'), warn: v('--warn'), textSoft: v('--text-soft'), border: v('--border') };
}

function seriesColor(i, theme, override) {
  if (override) return override;
  return [theme.accent, theme.highlight, theme.success, theme.warn][i % 4];
}

function newGraph(kind = 'line') {
  return { id: ulid(), kind, series: [], range: 'week', aggregate: 'raw', style: kind === 'flower' ? 'botanical' : 'plain' };
}

/** Sub-particles for a series whose source is a composite Skill (docs/05). */
function complexParticles(link) {
  const src = store.get('widgets', link.sourceWidgetId);
  if (src?.type !== 'skill') return null;
  const kids = childWidgetsOf(src.id).filter(w => w.type === 'skill');
  if (!kids.length) return null;
  const maxLevel = Math.max(1, ...kids.map(k => k.config.level || 1));
  return kids.map(k => ({ value01: (k.config.level || 1) / maxLevel, widgetId: k.id, label: k.name }));
}

function renderGraph(holder, widget, gdef, ctx, big) {
  holder.innerHTML = '';
  holder.classList.add('graph-holder');
  const theme = themeColors(holder);
  const W = Math.max(280, holder.clientWidth || (big ? 640 : 320));
  const H = gdef.kind === 'flower' ? Math.min(W, big ? 480 : 300) + (gdef.style === 'botanical' ? 70 : 0) : (big ? 280 : 190);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const canvas = el(`<canvas style="width:100%;height:${H}px"></canvas>`);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  holder.appendChild(canvas);

  const tip = el('<div class="graph-tip hidden"></div>');
  holder.appendChild(tip);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  let hits = [];
  let selected = null;

  // data
  const days = RANGES[gdef.range] || 7;
  const from = dateAdd(todayStr(), -(days - 1));
  const seriesData = gdef.series.map((s, i) => {
    const color = seriesColor(i, theme, s.color);
    const src = store.get('widgets', s.link.sourceWidgetId);
    const label = s.label || src?.name || '?';
    if (gdef.kind === 'flower' || gdef.kind === 'pie') {
      return { color, label, link: s.link, now: values.getValue(s.link) ?? 0, particles: gdef.kind === 'flower' ? complexParticles(s.link) : null };
    }
    let pts = values.getSeries(s.link, from, todayStr()).map(p => ({ ...p, value: p.value ?? 0 }));
    if (days > 14 && gdef.aggregate !== 'raw') {
      const weeks = [];
      for (let k = 0; k < pts.length; k += 7) {
        const chunk = pts.slice(k, k + 7);
        const sum = chunk.reduce((a, p) => a + p.value, 0);
        weeks.push({ date: chunk[0].date, value: gdef.aggregate === 'avg' ? sum / chunk.length : sum });
      }
      pts = weeks;
    }
    return { color, label, link: s.link, pts };
  });

  const flowerMax = Math.max(1, ...seriesData.map(s => s.now ?? 0));

  const draw = (now) => {
    const t = (now - start) / 1000;
    g.clearRect(0, 0, W, H);
    hits = [];

    if (!gdef.series.length) {
      g.fillStyle = theme.textSoft;
      g.font = '13px system-ui';
      g.textAlign = 'center';
      g.fillText('Add data to grow this graph', W / 2, H / 2);
      return false;
    }

    if (gdef.kind === 'flower') {
      const cx = W / 2;
      const flowerH = H - (gdef.style === 'botanical' ? 70 : 0);
      const cy = flowerH / 2 + 8;
      const radius = Math.min(W, flowerH) / 2 - (big ? 40 : 26);
      const res = drawFlower(g, {
        cx, cy, radius,
        petals: seriesData.map((s, i) => ({
          label: s.label, value01: (s.now ?? 0) / flowerMax, color: s.color,
          lifted: selected?.kind === 'petal' && selected.i === i,
          particles: s.particles
        })),
        t, theme, showLabels: W >= 480 || big, reducedMotion: reduced
      });
      hits = [
        ...res.petalHits.map((h, i) => ({ kind: 'petal', i, test: (x, y) => {
          const dx = x - cx, dy = y - cy;
          const r = Math.hypot(dx, dy);
          if (r > h.maxR + 4 || r < 6) return false;
          let da = Math.atan2(dy, dx) - h.angle;
          while (da > Math.PI) da -= 2 * Math.PI;
          while (da < -Math.PI) da += 2 * Math.PI;
          return Math.abs(da) < h.halfWidth;
        } })),
        ...res.particleHits.map(p => ({ kind: 'particle', i: p.petal, k: p.index, test: (x, y) => Math.hypot(x - p.x, y - p.y) < p.r }))
      ];
      return !reduced; // keep breathing
    }

    const pad = { l: 30, r: 10, t: 12, b: 20 };
    const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
    const allPts = seriesData.flatMap(s => s.pts || []);
    const maxV = Math.max(1, ...allPts.map(p => p.value));

    if (gdef.kind === 'pie') {
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 16;
      const total = Math.max(0.001, seriesData.reduce((a, s) => a + Math.max(0, s.now), 0));
      let a0 = -Math.PI / 2;
      const sweep = reduced ? 1 : Math.min(1, t / 0.5);
      seriesData.forEach((s, i) => {
        const frac = Math.max(0, s.now) / total;
        const a1 = a0 + frac * Math.PI * 2 * sweep;
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, R, a0, a1);
        g.closePath();
        g.fillStyle = hexA(s.color, selected?.i === i ? 1 : 0.85);
        g.fill();
        const mid = (a0 + a1) / 2;
        hits.push({ kind: 'slice', i, test: (x, y) => {
          const r = Math.hypot(x - cx, y - cy);
          if (r > R) return false;
          let a = Math.atan2(y - cy, x - cx);
          while (a < -Math.PI / 2) a += Math.PI * 2;
          return a >= a0r(i) && a < a1r(i);
        } });
        a0 = a1;
      });
      // recompute exact angles for hit-testing
      const bounds = [];
      let b0 = -Math.PI / 2;
      seriesData.forEach((s) => {
        const b1 = b0 + (Math.max(0, s.now) / total) * Math.PI * 2;
        bounds.push([b0, b1]);
        b0 = b1;
      });
      function a0r(i) { return bounds[i][0]; }
      function a1r(i) { return bounds[i][1]; }
      return !reduced && t < 0.55;
    }

    // axes: 3 hairline gridlines
    g.strokeStyle = theme.border;
    g.lineWidth = 1;
    g.fillStyle = theme.textSoft;
    g.font = '10px system-ui';
    for (let k = 0; k <= 2; k++) {
      const y = pad.t + (plotH * k) / 2;
      g.beginPath();
      g.moveTo(pad.l, y);
      g.lineTo(W - pad.r, y);
      g.globalAlpha = 0.5;
      g.stroke();
      g.globalAlpha = 1;
      g.textAlign = 'right';
      g.fillText(String(Math.round(maxV * (1 - k / 2))), pad.l - 4, y + 3);
    }

    const nPts = Math.max(1, (seriesData[0]?.pts || []).length);
    const xAt = (j) => pad.l + (nPts === 1 ? plotW / 2 : (j / (nPts - 1)) * plotW);

    if (gdef.kind === 'bar') {
      const bw = Math.min(26, (plotW / nPts) * 0.7 / seriesData.length);
      seriesData.forEach((s, i) => {
        (s.pts || []).forEach((p, j) => {
          const rise = reduced ? 1 : Math.min(1, Math.max(0, (t - j * 0.02) / 0.4));
          const h = (p.value / maxV) * plotH * rise;
          const x = xAt(j) - (bw * seriesData.length) / 2 + i * bw;
          g.fillStyle = hexA(s.color, selected?.i === i && selected?.j === j ? 1 : 0.8);
          g.beginPath();
          g.roundRect(x, pad.t + plotH - h, bw - 2, h, 3);
          g.fill();
          hits.push({ kind: 'pt', i, j, test: (px, py) => px >= x && px <= x + bw && py >= pad.t && py <= pad.t + plotH });
        });
      });
      return !reduced && t < 1;
    }

    // line (default)
    seriesData.forEach((s, i) => {
      const pts = s.pts || [];
      const prog = reduced ? 1 : Math.min(1, t / 0.4);
      g.strokeStyle = s.color;
      g.lineWidth = 2;
      g.beginPath();
      const upto = Math.max(1, Math.floor(pts.length * prog));
      pts.slice(0, upto).forEach((p, j) => {
        const x = xAt(j), y = pad.t + plotH - (p.value / maxV) * plotH;
        j ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
      if (prog >= 1) {
        pts.forEach((p, j) => {
          const x = xAt(j), y = pad.t + plotH - (p.value / maxV) * plotH;
          g.beginPath();
          g.arc(x, y, selected?.i === i && selected?.j === j ? 4 : 2.5, 0, Math.PI * 2);
          g.fillStyle = s.color;
          g.fill();
          hits.push({ kind: 'pt', i, j, test: (px, py) => Math.hypot(px - x, py - y) < 12 });
        });
      }
    });
    return !reduced && t < 0.5;
  };

  // animation loop: run while animating (and forever for breathing flowers)
  const unsub = loop.add((dt, now) => {
    if (!canvas.isConnected) { unsub(); return; }
    const keep = draw(now);
    if (!keep && gdef.kind !== 'flower') unsub();
  });
  // First paint now. In hidden documents rAF never fires, so paint the final
  // fully-bloomed state; when visible the loop animates the bloom from t=0.
  draw(document.hidden || reduced ? start + 10000 : performance.now());

  // tap → tooltip → tap again → navigate (app-wide pattern, docs/05)
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = hits.find(h => h.test(x, y));
    if (!hit) { selected = null; tip.classList.add('hidden'); return; }
    const s = seriesData[hit.i];
    const same = selected && selected.kind === hit.kind && selected.i === hit.i && selected.j === hit.j && selected.k === hit.k;
    if (same) {
      const target = hit.kind === 'particle' ? s.particles[hit.k].widgetId : s.link.sourceWidgetId;
      ctx.goWidget(target);
      return;
    }
    selected = hit;
    let text;
    if (hit.kind === 'particle') text = `${s.particles[hit.k].label}`;
    else if (hit.kind === 'pt') text = `${s.label} · ${s.pts[hit.j].date.slice(5)} — ${Math.round(s.pts[hit.j].value * 100) / 100}`;
    else text = `${s.label} — ${Math.round((s.now ?? 0) * 100) / 100}`;
    tip.textContent = text + '  ·  tap again to visit';
    tip.classList.remove('hidden');
    tip.style.left = `${Math.min(Math.max(8, x - 60), W - 140)}px`;
    tip.style.top = `${Math.max(4, y - 34)}px`;
  });

  if (gdef.kind === 'flower' && gdef.style === 'botanical') {
    const stemHost = el('<div class="fg-stem-host"></div>');
    stemHost.innerHTML = stemSvg(W, H, W / 2, H - 86, theme.success);
    holder.appendChild(stemHost);
  }
}

registry.register({
  type: 'graph',
  name: 'Graph',
  icon: 'bar-chart',
  description: 'Lines, bars, pies — and the Flower Graph',
  linkable: false,
  external: true, internal: true,
  defaultConfig: () => ({ graphs: [newGraph('line')] }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const wrap = el(`<div class="graph-stack ${widget.config.graphs.length > 2 ? 'grid' : ''}"></div>`);
    host.appendChild(wrap);
    for (const gdef of widget.config.graphs) {
      const holder = el('<div></div>');
      wrap.appendChild(holder);
      // setTimeout, not rAF: rAF never fires in hidden documents, and the
      // deferral only exists so the holder is attached for width measurement
      setTimeout(() => renderGraph(holder, widget, gdef, ctx, false), 0);
    }
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const save = () => store.put('widgets', widget);

    const renderAll = () => {
      host.innerHTML = '';
      for (const gdef of widget.config.graphs) {
        const panel = el('<div class="panel" style="padding:12px;margin-bottom:16px"></div>');
        const holder = el('<div></div>');
        panel.appendChild(holder);

        const controls = el('<div class="row" style="flex-wrap:wrap;margin-top:10px;gap:8px"></div>');
        controls.appendChild(seg(
          ['line', 'bar', 'pie', 'flower'].map(k => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })),
          gdef.kind, (v) => { gdef.kind = v; if (v === 'flower') gdef.style = gdef.style || 'botanical'; save(); renderAll(); }));
        if (gdef.kind !== 'flower' && gdef.kind !== 'pie') {
          controls.appendChild(seg(
            [{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }],
            gdef.range, (v) => { gdef.range = v; save(); renderAll(); }));
        }
        panel.appendChild(controls);

        const chips = el('<div class="row" style="flex-wrap:wrap;margin-top:10px;gap:6px"></div>');
        gdef.series.forEach((s, i) => {
          const src = store.get('widgets', s.link.sourceWidgetId);
          const chip = el(`<button class="chip" style="cursor:pointer;border-color:${seriesColor(i, themeColors(host), s.color)}">${src?.name || '?'} ×</button>`);
          chip.onclick = () => { gdef.series.splice(i, 1); save(); renderAll(); };
          chips.appendChild(chip);
        });
        const addData = el(`<button class="chip accent" style="cursor:pointer">${icon('plus', 11)} Add data</button>`);
        addData.onclick = () => openLinkPicker({
          consumerWidget: widget,
          onPick: (link) => { gdef.series.push({ link }); save(); renderAll(); }
        });
        chips.appendChild(addData);
        const removeG = el(`<button class="chip" style="cursor:pointer">${icon('trash', 11)} Remove graph</button>`);
        removeG.onclick = () => { widget.config.graphs = widget.config.graphs.filter(x => x.id !== gdef.id); save(); renderAll(); };
        chips.appendChild(removeG);
        panel.appendChild(chips);

        host.appendChild(panel);
        setTimeout(() => renderGraph(holder, widget, gdef, ctx, true), 0);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add a graph</button>`);
      add.onclick = () => { widget.config.graphs.push(newGraph('line')); save(); renderAll(); };
      host.appendChild(add);
    };
    renderAll();
  }
});
