/* Aspect tool (docs/17 §3.1): a self-contained flower for one of the five Aspects.
   External face — the aspect's flower (petals = attributes, sized by level), its current
   level, and recent growth. Internal view — the full flower, per-attribute XP bars, and the
   skills (stars) that feed each petal. It is its own XP track: it READS the growth ledger
   (js/core/growth.js) and renders; it needs no other tool present and works on any page.

   Rendering reuses the existing Flower Graph renderer (drawFlower) — no new renderer, per
   docs/17 §2. The bloom is drawn statically (reduced motion) to stay within the perf budget. */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';
import { events } from '../core/events.js';
import { drawFlower, hexA } from './flowergraph.js';
import { ASPECTS } from '../presets/aspects.js';
import { aspectState } from '../core/growth.js';

const LEVEL_FULL = 12; // an attribute/skill at this level fills its petal/star

/** Read the live theme colors the flower renderer expects. */
function flowerTheme(host) {
  const s = getComputedStyle(host);
  const v = (n, d) => (s.getPropertyValue(n).trim() || d);
  return { highlight: v('--highlight', '#caa6f0'), textSoft: v('--text-soft', '#9a93a8'), glow: v('--glow', hexA('#ffffff', 0.12)) };
}

/** The aspect this instance shows (defaults to the first if misconfigured). */
function aspectIdOf(widget) {
  const id = widget.config?.aspectId;
  return ASPECTS.some(a => a.id === id) ? id : ASPECTS[0].id;
}

const norm = (level) => Math.max(0.12, Math.min(1, level / LEVEL_FULL));

/** Draw one aspect's flower into a fresh canvas sized to `height`. Returns the canvas. */
function flowerCanvas(host, state, height, big) {
  const cv = el(`<canvas class="aspect-flower" style="display:block;width:100%;height:${height}px"></canvas>`);
  const paint = () => {
    const w = cv.clientWidth || host.clientWidth || 280;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(height * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, height);
    drawFlower(g, {
      cx: w / 2, cy: height / 2, radius: Math.min(w, height) / 2 - (big ? 30 : 18),
      petals: state.attributes.map(a => ({
        label: a.name, color: state.color,
        value01: norm(a.level),
        particles: a.skills.map(s => ({ value01: norm(s.level) }))
      })),
      t: 3, theme: flowerTheme(host), showLabels: big, reducedMotion: true
    });
  };
  // paint after layout so clientWidth is real
  requestAnimationFrame(paint);
  return { cv, paint };
}

/** Subscribe a redraw to growth changes; self-cleans when the host leaves the DOM. */
function liveRedraw(host, redraw) {
  const off = events.on('growth:changed', () => { if (host.isConnected) redraw(); else off(); });
}

registry.register({
  type: 'aspect',
  name: 'Aspect',
  icon: 'flower',
  description: 'One of your five life aspects, in bloom',
  category: 'Growth & Rewards',
  external: true, internal: true,
  keywords: ['aspect', 'flower', 'mental', 'physical', 'emotional', 'social', 'recreation', 'growth', 'blossom'],
  defaultConfig: () => ({ aspectId: 'mental' }),

  outputs: (widget) => [
    { key: 'level', name: 'Aspect level', dayKeyed: false, get: () => aspectState(aspectIdOf(widget))?.level || 1 }
  ],

  renderCard(host, widget) {
    const draw = () => {
      host.innerHTML = '';
      const st = aspectState(aspectIdOf(widget));
      if (!st) { host.appendChild(el('<p class="soft">Unknown aspect.</p>')); return; }
      host.appendChild(el(`<div class="row-between" style="margin-bottom:2px">
        <span class="row" style="gap:7px"><span style="color:${st.color}">${icon(st.icon, 16)}</span><span style="font-weight:600">${st.name}</span></span>
        <span class="chip" style="background:${hexA(st.color, 0.16)};color:${st.color}">Lv ${st.level}</span></div>`));
      const { cv } = flowerCanvas(host, st, 150, false);
      host.appendChild(cv);
      const recent = st.recent[0];
      const line = recent
        ? `+${recent.amount} to ${ASPECTS.find(a => a.id === st.id)?.attributes.find(x => x.id === recent.attrId)?.name || 'a petal'}`
        : 'Grows as you live — log a habit, finish a quest, study.';
      host.appendChild(el(`<p class="soft" style="font-size:0.78rem;text-align:center;margin-top:2px">${line}</p>`));
    };
    draw();
    liveRedraw(host, draw);
  },

  renderFull(host, widget) {
    const draw = () => {
      host.innerHTML = '';
      const st = aspectState(aspectIdOf(widget));
      if (!st) { host.appendChild(el('<p class="soft">Unknown aspect.</p>')); return; }
      host.appendChild(el(`<div class="row-between">
        <span class="row" style="gap:8px"><span style="color:${st.color}">${icon(st.icon, 20)}</span><span style="font-size:1.05rem;font-weight:600">${st.name}</span></span>
        <span class="chip" style="background:${hexA(st.color, 0.16)};color:${st.color}">Level ${st.level}</span></div>`));
      host.appendChild(el(`<p class="soft" style="font-size:0.84rem;margin:2px 0 6px">${st.blurb}</p>`));

      const { cv } = flowerCanvas(host, st, 280, true);
      host.appendChild(cv);

      // per-attribute (petal) XP bars + their skills (stars)
      const list = el('<div class="col" style="gap:10px;margin-top:8px"></div>');
      for (const a of st.attributes) {
        const pct = Math.round(a.pct * 100);
        const row = el(`<div class="aspect-attr">
          <div class="row-between" style="font-size:0.85rem">
            <span style="font-weight:600">${a.name}</span>
            <span class="soft">Lv ${a.level} · ${a.xp}/${a.need} XP</span>
          </div>
          <div class="sk-bar" style="margin:3px 0 4px"><span class="sk-fill" style="width:${pct}%;background:${st.color}"></span></div>
          <div class="row" style="gap:5px;flex-wrap:wrap"></div>
        </div>`);
        const stars = row.querySelector('.row');
        for (const s of a.skills) {
          const lit = s.level > 1;
          stars.appendChild(el(`<span class="chip" title="Level ${s.level}" style="font-size:0.7rem;${lit ? `background:${hexA(st.color, 0.16)};color:${st.color}` : 'opacity:0.65'}">${icon('star', 10)} ${s.name}${s.level > 1 ? ` ${s.level}` : ''}</span>`));
        }
        list.appendChild(row);
      }
      host.appendChild(list);
    };
    draw();
    liveRedraw(host, draw);
  },

  renderSettings(host, widget, ctx) {
    host.innerHTML = '';
    host.appendChild(el('<label class="field-label">Which aspect</label>'));
    const sel = el('<select class="input"></select>');
    for (const a of ASPECTS) {
      const o = el(`<option value="${a.id}">${a.name}</option>`);
      if (a.id === aspectIdOf(widget)) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => {
      widget.config.aspectId = sel.value;
      ctx.save?.();
      ctx.events?.emit('widget:changed', { widgetId: widget.id });
    };
    host.appendChild(sel);
    host.appendChild(el('<p class="soft" style="font-size:0.8rem;margin-top:8px">This flower reads your growth ledger — habits, quests, goals, and skills in this aspect’s module feed its petals.</p>'));
  }
});
