/* Hub widget (V2 §24): a container that shows its nested widgets as a tidy
   mini-page. Card = a summary row per child (icon · name · key stat) plus a
   combined XP bar across nested Skill/Characteristic widgets. Full view = all
   nested widgets, fully interactive. The "organisation for long lists" widget. */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';
import { childWidgetsOf } from './base.js';
import { openWidgetGallery } from '../ui/picker.js';
import { keyStat, fmtStat } from './widget-stats.js';
import { xpToNext } from './skill.js';

/** Combined progress across nested Skill/Characteristic widgets. */
function aggregateXp(widget) {
  const kids = childWidgetsOf(widget.id).filter(w => w.type === 'skill' || w.type === 'characteristic');
  if (!kids.length) return null;
  let levels = 0, frac = 0, n = 0;
  for (const k of kids) {
    levels += k.config.level || 1;
    if (k.type === 'skill') { frac += Math.min(1, (k.config.xp || 0) / xpToNext(k.config.level || 1)); n++; }
  }
  return { levels, pct: n ? (frac / n) * 100 : 0, count: kids.length };
}

registry.register({
  type: 'hub',
  name: 'Hub',
  icon: 'layers',
  description: 'A dashboard that groups other widgets',
  container: true, external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const kids = childWidgetsOf(widget.id);
    if (!kids.length) {
      host.appendChild(el('<p class="soft" style="font-size:0.86rem">Empty hub — tap to add widgets.</p>'));
      return;
    }
    const agg = aggregateXp(widget);
    if (agg) {
      host.appendChild(el(`<div class="hub-agg">
        <div class="row-between"><span class="soft" style="font-size:0.76rem">Combined level ${agg.levels}</span><span class="soft" style="font-size:0.76rem">${agg.count} skill${agg.count === 1 ? '' : 's'}</span></div>
        <div class="sk-bar" style="margin-top:4px"><span class="sk-fill" style="width:${agg.pct}%"></span></div></div>`));
    }
    const list = el('<div class="hub-list" style="margin-top:8px"></div>');
    for (const k of kids) {
      const def = registry.get(k.type);
      const stat = keyStat(k);
      const row = el(`<div class="hub-row row-between">
        <span class="row" style="gap:8px;min-width:0"><span class="hub-ic">${icon(def?.icon || 'circle', 15)}</span><span class="hub-name"></span></span>
        <span class="chip hub-stat"></span></div>`);
      row.querySelector('.hub-name').textContent = k.name;
      row.querySelector('.hub-stat').textContent = stat ? `${stat.label}: ${fmtStat(stat)}` : (def?.name || k.type);
      list.appendChild(row);
    }
    host.appendChild(list);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const grid = el('<div class="col"></div>');
    const renderKids = () => {
      grid.innerHTML = '';
      const kids = childWidgetsOf(widget.id);
      if (!kids.length) grid.appendChild(el('<p class="soft">This hub is empty. Add a widget below.</p>'));
      for (const k of kids) grid.appendChild(ctx.renderWidgetCard(k));
    };
    renderKids();
    host.appendChild(grid);
    const add = el(`<button class="btn-soft-wide" style="margin-top:12px">${icon('plus', 15)} Add a widget to this hub</button>`);
    add.onclick = () => openWidgetGallery({ parentWidgetId: widget.id, onCreated: renderKids });
    host.appendChild(add);
  }
});
