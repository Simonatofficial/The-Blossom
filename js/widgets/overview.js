/* Overview widget (V2 §24): a stats dashboard built from any linked widgets.
   Card = a responsive grid of stat blocks (widget · key stat); tap a block to
   visit that widget. Full view = a larger dashboard with every stat and a
   sparkline per day-keyed output. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast } from '../ui/components.js';
import { outputsOf } from '../core/values.js';
import { statsFor, keyStat, fmtStat, sparkline } from './widget-stats.js';
import { openNodePicker } from '../ui/picker.js';

function linkedWidgets(widget) { return (widget.config.items || []).map(it => store.get('widgets', it.widgetId)).filter(Boolean); }

function statBlock(w, stat, ctx, big) {
  const def = registry.get(w.type);
  const b = el(`<button class="ov-block ${big ? 'big' : ''}">
    <span class="ov-val"></span><span class="ov-label"></span></button>`);
  b.querySelector('.ov-val').textContent = fmtStat(stat);
  b.querySelector('.ov-label').innerHTML = `${icon(def?.icon || 'circle', 11)} <span></span>`;
  b.querySelector('.ov-label span').textContent = `${w.name}${stat ? ' · ' + stat.label : ''}`;
  b.onclick = () => ctx.goWidget(w.id);
  return b;
}

registry.register({
  type: 'overview',
  name: 'Overview',
  icon: 'grid',
  description: 'A stats dashboard from any widgets',
  external: true, internal: true,
  defaultConfig: () => ({ items: [] }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const ws = linkedWidgets(widget);
    if (!ws.length) { host.appendChild(el('<p class="soft" style="font-size:0.86rem">Tap to add widgets to this dashboard.</p>')); return; }
    const grid = el('<div class="ov-grid"></div>');
    for (const w of ws) grid.appendChild(statBlock(w, keyStat(w), ctx, false));
    host.appendChild(grid);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const render = () => {
      host.innerHTML = '';
      const ws = linkedWidgets(widget);
      if (!ws.length) host.appendChild(el('<p class="soft">Link some widgets to build your dashboard.</p>'));
      for (const w of ws) {
        const def = registry.get(w.type);
        const panel = el('<div class="panel" style="padding:12px;margin-bottom:12px"></div>');
        const head = el(`<div class="row-between" style="margin-bottom:8px"><span class="row" style="gap:6px">${icon(def?.icon || 'circle', 15)}<strong class="ov-wname"></strong></span><button class="btn-icon ov-del">${icon('x', 14)}</button></div>`);
        head.querySelector('.ov-wname').textContent = w.name;
        head.querySelector('.ov-del').onclick = () => { widget.config.items = widget.config.items.filter(it => it.widgetId !== w.id); store.put('widgets', widget); render(); };
        panel.appendChild(head);
        const blocks = el('<div class="ov-grid"></div>');
        const stats = statsFor(w);
        if (!stats.length) blocks.appendChild(el('<span class="soft" style="font-size:0.82rem">No stats exposed.</span>'));
        for (const s of stats) blocks.appendChild(statBlock(w, s, ctx, true));
        panel.appendChild(blocks);
        const dayOut = outputsOf(w).find(o => o.dayKeyed);
        if (dayOut) panel.appendChild(sparkline(w, dayOut.key, 14));
        host.appendChild(panel);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add a widget</button>`);
      add.onclick = () => openNodePicker({ onPick: ({ kind, id }) => {
        const w = store.get('widgets', id);
        if (kind !== 'widget' || !w) { toast('Pick a widget.', 'info'); return; }
        if ((widget.config.items || []).some(it => it.widgetId === id)) { toast('Already on the dashboard.', 'info'); return; }
        widget.config.items = [...(widget.config.items || []), { widgetId: id }];
        store.put('widgets', widget); render();
      } });
      host.appendChild(add);
    };
    render();
  }
});
