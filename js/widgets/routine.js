/* Routine widget (docs/05): a named, ordered checklist bundling Quests +
   Habits. Ticking a row completes a rep on the underlying widget — single
   source of truth, the routine never duplicates state. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, field, seg } from '../ui/components.js';
import { todayStr, bloomBurst } from './base.js';
import * as q from './questops.js';
import { openLinkPicker } from '../ui/picker.js';

function items(widget) {
  return (widget.config.items || []).map(id => store.get('widgets', id)).filter(w => w && (w.type === 'quest' || w.type === 'habit'));
}

function pct(widget) {
  const list = items(widget);
  if (!list.length) return 0;
  const sum = list.reduce((acc, w) => acc + q.completionPct(w, todayStr()), 0);
  return Math.round(sum / list.length);
}

function ring(p, size = 44) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="r-ring">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="3"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="3"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="var(--text)" font-size="11">${p}%</text>
  </svg>`;
}

registry.register({
  type: 'routine',
  name: 'Routine',
  icon: 'repeat',
  description: 'Bundle quests into a one-tap checklist',
  external: true, internal: false,
  defaultConfig: () => ({ items: [], cadence: 'daily', time: 'morning', expanded: false }),

  outputs: (widget) => [{
    key: 'routineCompletionPct', name: 'Completion %', dayKeyed: true,
    get: (d) => {
      const list = items(widget);
      if (!list.length) return 0;
      const date = d || todayStr();
      return Math.round(list.reduce((acc, w) => acc + q.completionPct(w, date), 0) / list.length);
    }
  }],

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const card = el(`<div class="routine-widget">
      <div class="row r-head" style="cursor:pointer">
        <span class="r-ring-host">${ring(pct(widget))}</span>
        <div class="grow">
          <div class="soft" style="font-size:0.8rem">${{ daily: 'Every day', weekly: 'Every week', monthly: 'Every month' }[widget.config.cadence] || ''}${widget.config.time ? ` · ${widget.config.time}` : ''}</div>
        </div>
        <span class="r-chevron">${icon(widget.config.expanded ? 'chevron-up' : 'chevron-down', 16)}</span>
      </div>
      <div class="r-items ${widget.config.expanded ? '' : 'hidden'}"></div>
    </div>`);

    const itemsHost = card.querySelector('.r-items');
    const renderItems = () => {
      itemsHost.innerHTML = '';
      for (const w of items(widget)) {
        const done = q.repsDone(w, todayStr());
        const reps = w.config.reps || 1;
        const complete = done >= reps;
        const row = el(`<button class="r-item ${complete ? 'done' : ''}">
          <span style="color:${complete ? 'var(--success)' : 'var(--text-soft)'}">${icon(complete ? 'check-circle' : 'circle', 18)}</span>
          <span class="li-main"><span class="li-title"></span></span>
          <span class="soft">${done}/${reps}</span></button>`);
        row.querySelector('.li-title').textContent = w.name;
        row.onclick = () => {
          if (q.repsDone(w, todayStr()) >= reps) return;
          const res = q.addRep(w, 1);
          if (res.completedNow) {
            bloomBurst(row);
            ctx.toast(`${w.name} complete · +${res.coins}c`, 'flag');
          }
          renderItems();
          card.querySelector('.r-ring-host').innerHTML = ring(pct(widget));
        };
        itemsHost.appendChild(row);
      }
      if (!items(widget).length) {
        itemsHost.appendChild(el('<p class="soft" style="padding:8px 4px">Add quests in this widget’s settings.</p>'));
      }
    };
    renderItems();

    card.querySelector('.r-head').onclick = () => {
      widget.config.expanded = !widget.config.expanded;
      store.put('widgets', widget);
      itemsHost.classList.toggle('hidden', !widget.config.expanded);
      card.querySelector('.r-chevron').innerHTML = icon(widget.config.expanded ? 'chevron-up' : 'chevron-down', 16);
    };
    host.appendChild(card);
  },

  renderSettings(host, widget, ctx) {
    const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
    host.appendChild(field('Cadence', seg([
      { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }
    ], widget.config.cadence, (v) => { widget.config.cadence = v; save(); })));

    host.appendChild(field('Time of day', seg([
      { value: 'morning', label: 'Morning' }, { value: 'midday', label: 'Midday' }, { value: 'evening', label: 'Evening' }
    ], widget.config.time, (v) => { widget.config.time = v; save(); })));

    const list = el('<div></div>');
    const render = () => {
      list.innerHTML = '';
      for (const [i, w] of items(widget).entries()) {
        const row = el(`<div class="list-item" style="cursor:default"><span class="li-main"><span class="li-title"></span></span>
          <button class="btn-icon">${icon('x', 14)}</button></div>`);
        row.querySelector('.li-title').textContent = w.name;
        row.querySelector('button').onclick = () => { widget.config.items.splice(i, 1); save(); render(); };
        list.appendChild(row);
      }
    };
    render();
    host.appendChild(field('Quests in this routine', list));

    const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add a quest</button>`);
    add.onclick = () => {
      // reuse the link picker to navigate to a quest/habit, then keep its id
      openLinkPicker({
        consumerWidget: widget,
        onPick: (link) => {
          const src = store.get('widgets', link.sourceWidgetId);
          if (!src || (src.type !== 'quest' && src.type !== 'habit')) {
            ctx.toast('Routines hold Quests and Habits.', 'info');
            return;
          }
          if (!widget.config.items.includes(src.id)) widget.config.items.push(src.id);
          save();
          render();
        }
      });
    };
    host.appendChild(add);
  }
});
