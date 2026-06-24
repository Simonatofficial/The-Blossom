/* Skill widget (docs/05 + docs/07): XP from linked values and nested widgets,
   finalized at day rollover. Nested Skills feed their parent on level-up with
   per-layer decay. Level curve: xpToNext(level) = 50 × level^1.4 (round 10). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { wallet } from '../core/wallet.js';
import { icon } from '../ui/icons.js';
import { el, field, input } from '../ui/components.js';
import { todayStr, dateAdd, childWidgetsOf, bloomBurst, fmtDate } from './base.js';
import * as values from '../core/values.js';
import * as q from './questops.js';
import { openWidgetGallery } from '../ui/picker.js';

export function xpToNext(level) {
  return Math.max(10, Math.round((50 * Math.pow(level, 1.4)) / 10) * 10);
}

function st(widget) {
  const c = widget.config;
  c.level = c.level || 1;
  c.xp = c.xp || 0;
  c.log = c.log || [];
  return c;
}

/** XP accrued for a date from links + nested non-skill widgets (1 point = 1 XP). */
function xpFor(widget, dateStr) {
  let sum = 0;
  for (const link of (widget.links || [])) {
    const v = values.getValue(link, dateStr);
    if (v != null) sum += v;
  }
  for (const child of childWidgetsOf(widget.id)) {
    if (child.type === 'skill') continue; // skills feed via level-ups only (docs/07)
    const out = values.outputsOf(child).find(o => o.dayKeyed);
    if (out) {
      try { sum += out.get(dateStr) || 0; } catch { /* quiet */ }
    }
  }
  return Math.max(0, Math.round(sum));
}

/** Grant XP now (used by rollover + child level-ups), handling level-ups. */
export function grantXp(widget, amount, ctx, reason = '') {
  if (!amount) return;
  const c = st(widget);
  c.xp += Math.round(amount);
  // V3 growth (docs/17 §3): direct XP grants feed Mental → Learning 1:1, tagged with the
  // skill's name (a star). Child-levelup propagation is excluded so XP isn't double-counted.
  if (reason !== 'child-levelup') events.emit('growth:emit', { widget, action: { kind: 'xp', amount: Math.round(amount), skill: widget.name } });
  let leveled = false;
  while (c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level += 1;
    leveled = true;
    const coins = 20 * Math.ceil(c.level * 0.5);
    wallet.add(coins, `skill:${widget.id}`);
    c.log.unshift({ level: c.level, date: todayStr(), coins });
    c.log = c.log.slice(0, 30);
    ctx?.toast?.(`${widget.name} reached level ${c.level} · +${coins}c`, 'sparkles');
    events.emit('notify', { category: 'levelup', text: `${widget.name} reached level ${c.level} · +${coins}c` });
    // one step of parent propagation per level-up event (docs/07)
    const parent = widget.parentWidgetId && store.get('widgets', widget.parentWidgetId);
    if (parent?.type === 'skill') {
      grantXp(parent, c.level * 10 * 0.5, ctx, 'child-levelup');
    }
  }
  store.put('widgets', widget);
  ctx?.events?.emit('widget:changed', { widgetId: widget.id });
  return leveled;
}

registry.register({
  type: 'skill',
  name: 'Skill',
  icon: 'sparkles',
  description: 'Level up from your linked efforts',
  container: true, linkable: true,
  external: true, internal: true,
  defaultConfig: () => ({ level: 1, xp: 0, log: [] }),

  outputs: (widget) => [
    { key: 'level', name: 'Level', dayKeyed: false, get: () => st(widget).level },
    { key: 'xpToday', name: 'XP today', dayKeyed: true, get: (d) => xpFor(widget, d || todayStr()) }
  ],

  // V3 growth (docs/17 §3): granted XP feeds Learning 1:1, tagged with the skill name.
  grows: (before, after, action) => (action?.kind === 'xp' && action.amount > 0
    ? [{ attribute: 'learning', amount: action.amount, skill: action.skill }] : []),

  onDayRolled(widget, ctx, info) {
    if (!info?.from) return;
    const c = st(widget);
    if (c.lastFinalized === info.from) return;
    c.lastFinalized = info.from;
    const leveled = grantXp(widget, xpFor(widget, info.from), ctx, 'finalize');
    if (!leveled) store.put('widgets', widget);
  },

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const c = st(widget);
    const pending = xpFor(widget, todayStr());
    const need = xpToNext(c.level);
    const pct = Math.min(100, (c.xp / need) * 100);
    const pendPct = Math.min(100 - pct, (pending / need) * 100);
    host.appendChild(el(`<div class="skill-widget">
      <div class="row">
        <span class="sk-badge">${c.level}</span>
        <div class="grow">
          <div class="sk-bar"><span class="sk-fill" style="width:${pct}%"></span><span class="sk-pend" style="left:${pct}%;width:${pendPct}%"></span></div>
          <div class="row-between" style="margin-top:3px">
            <span class="soft" style="font-size:0.76rem">${c.xp} / ${need} XP</span>
            <span class="soft" style="font-size:0.76rem">+${pending} XP today</span>
          </div>
        </div>
      </div>
    </div>`));

    // V2 §24d: nested Habit/Quest/Routine items as a compact, completable
    // checklist — finish them here and the Skill's XP grows without opening it.
    const today = todayStr();
    const todo = childWidgetsOf(widget.id).filter(c => ['habit', 'quest', 'routine'].includes(c.type) && !Array.isArray(c.config.steps) && q.scheduledOn(c, today));
    if (todo.length) {
      const list = el('<div class="sk-todo" style="margin-top:10px"></div>');
      for (const c of todo) {
        const reps = c.config.reps || 1, done = q.repsDone(c, today), complete = done >= reps;
        const row = el(`<div class="row-between sk-todo-row">
          <span class="row" style="gap:8px;min-width:0"><button class="btn-icon sk-chk" style="color:${complete ? 'var(--success)' : 'var(--text-soft)'}">${icon(complete ? 'check-circle' : 'circle', 18)}</button><span class="sk-todo-name"></span></span></div>`);
        row.querySelector('.sk-todo-name').textContent = c.name + (reps > 1 ? ` (${done}/${reps})` : '');
        row.querySelector('.sk-chk').onclick = () => {
          const r = complete ? q.addRep(c, -reps, today) : q.addRep(c, reps - done, today);
          if (r.completedNow) bloomBurst(row.querySelector('.sk-chk'));
          ctx.refreshCard(widget);
        };
        list.appendChild(row);
      }
      host.appendChild(list);
    }
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const c = st(widget);

    // XP history sparkline (last 30 days)
    const canvas = el('<canvas width="660" height="90" style="width:100%;height:60px"></canvas>');
    const g = canvas.getContext('2d');
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const pts = [];
    for (let i = 29; i >= 0; i--) pts.push(xpFor(widget, dateAdd(todayStr(), -i)));
    const max = Math.max(1, ...pts);
    g.fillStyle = accent;
    pts.forEach((p, i) => {
      const h = (p / max) * 70;
      g.globalAlpha = 0.35 + 0.65 * (p / max);
      g.fillRect(8 + i * 21.5, 80 - h, 14, h);
    });
    host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:6px">XP — LAST 30 DAYS</h3>'));
    host.appendChild(canvas);

    // sources
    const src = el('<div style="margin-top:16px"></div>');
    src.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:6px">XP SOURCES TODAY</h3>'));
    for (const link of (widget.links || [])) {
      const w = store.get('widgets', link.sourceWidgetId);
      const v = values.getValue(link, todayStr());
      src.appendChild(el(`<div class="list-item" style="cursor:default">${icon('link', 14)}<span class="li-main"><span class="li-title">${w?.name || '?'} · ${link.output}</span></span><span class="chip accent">+${Math.round(v || 0)}</span></div>`));
    }
    for (const child of childWidgetsOf(widget.id)) {
      if (child.type === 'skill') continue;
      const out = values.outputsOf(child).find(o => o.dayKeyed);
      const v = out ? out.get(todayStr()) : 0;
      src.appendChild(el(`<div class="list-item" style="cursor:default">${icon('grid', 14)}<span class="li-main"><span class="li-title">${child.name}</span></span><span class="chip accent">+${Math.round(v || 0)}</span></div>`));
    }
    if (!(widget.links || []).length && !childWidgetsOf(widget.id).length) {
      src.appendChild(el('<p class="soft" style="font-size:0.85rem">Link a tracker or nest a quest to feed this skill — settings → Linked values.</p>'));
    }
    host.appendChild(src);

    // nested widgets (sub-skills and anything else)
    const kidHost = el('<div style="margin-top:16px"></div>');
    kidHost.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:6px">INSIDE THIS SKILL</h3>'));
    const grid = el('<div class="col"></div>');
    for (const child of childWidgetsOf(widget.id)) grid.appendChild(ctx.renderWidgetCard(child));
    kidHost.appendChild(grid);
    const add = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('plus', 15)} Nest a widget</button>`);
    add.onclick = () => openWidgetGallery({
      parentWidgetId: widget.id,
      onCreated: (w) => { grid.appendChild(ctx.renderWidgetCard(w)); }
    });
    kidHost.appendChild(add);
    host.appendChild(kidHost);

    // level-up log
    if (c.log.length) {
      const logHost = el('<div style="margin-top:16px"></div>');
      logHost.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:6px">LEVEL-UPS</h3>'));
      for (const entry of c.log.slice(0, 10)) {
        logHost.appendChild(el(`<div class="list-item" style="cursor:default">${icon('sparkles', 14)}<span class="li-main"><span class="li-title">Level ${entry.level}</span><span class="li-sub">${fmtDate(entry.date)} · +${entry.coins}c</span></span></div>`));
      }
      host.appendChild(logHost);
    }
  },

  renderSettings(host, widget) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">1 linked value point = 1 XP (adjust with each link’s transform). XP commits at day’s end; nested skills feed this one when they level up.</p>'));
  }
});
