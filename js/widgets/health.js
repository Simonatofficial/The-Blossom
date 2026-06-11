/* Health widget (docs/05 + docs/07): a vine that leafs out as today's quests
   complete. max = Σ required reps; +1 per rep; pays out at rollover by %.
   Never red — an empty vine, never an angry bar. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { wallet } from '../core/wallet.js';
import { icon } from '../ui/icons.js';
import { el, toast } from '../ui/components.js';
import { todayStr, dateAdd, childWidgetsOf, bloomBurst, fmtDate } from './base.js';
import * as q from './questops.js';

/** Contained + linked quest-like widgets. */
function questsOf(widget) {
  const out = childWidgetsOf(widget.id).filter(w => w.type === 'quest' || w.type === 'habit');
  for (const link of (widget.links || [])) {
    const w = store.get('widgets', link.sourceWidgetId);
    if (w && (w.type === 'quest' || w.type === 'habit') && !out.some(x => x.id === w.id)) out.push(w);
  }
  return out;
}

function healthOn(widget, dateStr) {
  let max = 0, cur = 0;
  for (const w of questsOf(widget)) {
    if (!q.scheduledOn(w, dateStr)) continue;
    const reps = w.config.reps || 1;
    max += reps;
    cur += Math.min(reps, q.repsDone(w, dateStr));
  }
  return { cur, max, pct: max ? cur / max : 0 };
}

registry.register({
  type: 'health',
  name: 'Health',
  icon: 'heart',
  description: 'A vine that thrives on completed quests',
  container: true, linkable: true,
  external: true, internal: true,
  defaultConfig: () => ({ state: {} }),

  outputs: (widget) => [
    { key: 'health', name: 'Health', dayKeyed: true, get: (d) => healthOn(widget, d || todayStr()).cur },
    { key: 'healthPct', name: 'Health %', dayKeyed: true, get: (d) => Math.round(healthOn(widget, d || todayStr()).pct * 100) }
  ],

  onDayRolled(widget, ctx, info) {
    if (!info?.from) return;
    widget.config.state = widget.config.state || {};
    if (widget.config.state.lastPaid === info.from) return;
    widget.config.state.lastPaid = info.from;
    const { max, pct } = healthOn(widget, info.from);
    const coins = Math.round(max * pct * 2); // docs/07: maxHealth × pct × 2
    if (coins) wallet.add(coins, `health:${widget.id}`);
    store.put('widgets', widget);
  },

  renderCard(host, widget) {
    host.innerHTML = '';
    const { cur, max, pct } = healthOn(widget, todayStr());
    const leaves = 7;
    let leafHtml = '';
    for (let i = 0; i < leaves; i++) {
      const on = pct > (i + 0.5) / leaves;
      leafHtml += `<span class="hv-leaf ${on ? 'on' : ''}" style="transform:translateY(${i % 2 ? '-6px' : '4px'}) rotate(${i % 2 ? -30 : 150}deg)">${icon('leaf', 13)}</span>`;
    }
    host.appendChild(el(`<div class="health-widget">
      <div class="hv-track"><div class="hv-fill" style="width:${Math.round(pct * 100)}%"></div>
        <div class="hv-leaves">${leafHtml}</div></div>
      <div class="soft" style="text-align:center;font-size:0.82rem;margin-top:6px">${cur} / ${max || '—'}</div>
    </div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const list = el('<div></div>');
    const renderList = () => {
      list.innerHTML = '';
      list.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:6px">TODAY</h3>'));
      const today = todayStr();
      for (const w of questsOf(widget)) {
        const scheduled = q.scheduledOn(w, today);
        const reps = w.config.reps || 1;
        const done = q.repsDone(w, today);
        const row = el(`<button class="list-item" ${scheduled ? '' : 'style="opacity:0.5"'}>
          <span style="color:${done >= reps ? 'var(--success)' : 'var(--text-soft)'}">${icon(done >= reps ? 'check-circle' : 'circle', 17)}</span>
          <span class="li-main"><span class="li-title"></span></span>
          <span class="soft">${done}/${reps}</span></button>`);
        row.querySelector('.li-title').textContent = w.name;
        row.onclick = () => {
          if (!scheduled || done >= reps) return;
          const res = q.addRep(w, 1);
          if (res.completedNow) { bloomBurst(row); toast(`${w.name} complete · +${res.coins}c`, 'flag'); }
          renderList();
        };
        list.appendChild(row);
      }
      if (!questsOf(widget).length) {
        list.appendChild(el('<p class="soft">Nest or link Quests to grow this vine (settings → Linked values).</p>'));
      }
    };
    renderList();
    host.appendChild(list);

    // history: last 30 days heat
    const hist = el('<div style="margin-top:18px"></div>');
    hist.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:8px">LAST 30 DAYS</h3>'));
    const heat = el('<div class="heatmap" style="grid-template-columns:repeat(10,1fr)"></div>');
    for (let i = 29; i >= 0; i--) {
      const ds = dateAdd(todayStr(), -i);
      const { pct, max } = healthOn(widget, ds);
      const cell = el('<span class="heat-cell"></span>');
      if (max) cell.style.background = `color-mix(in srgb, var(--success) ${10 + pct * 80}%, transparent)`;
      cell.title = `${fmtDate(ds)} — ${Math.round(pct * 100)}%`;
      heat.appendChild(cell);
    }
    hist.appendChild(heat);
    host.appendChild(hist);
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Max health = today’s required reps across nested and linked quests. Health pays out coins at day’s end, proportional to how full the vine grew.</p>'));
  }
});
