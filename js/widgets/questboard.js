/* Quest Board widget (V2 §24): gathers what needs doing TODAY from linked
   Quests, Habits, and Routines into one prioritised checklist. Items are
   completable inline — no need to open each source widget. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast } from '../ui/components.js';
import { todayStr } from './base.js';
import * as values from '../core/values.js';
import * as q from './questops.js';
import { openNodePicker } from '../ui/picker.js';

function sources(widget) { return (widget.config.sources || []).map(id => store.get('widgets', id)).filter(Boolean); }

/** Today's actionable state for a source widget, or null if nothing's due. */
function itemFor(w) {
  const today = todayStr();
  if (w.type === 'habit' || w.type === 'quest' || w.type === 'routine') {
    if (w.config.reps != null || w.type !== 'routine') {
      if (!q.scheduledOn(w, today)) return null;
      const reps = w.config.reps || 1, done = q.repsDone(w, today);
      return { widget: w, checkable: true, done, reps, complete: done >= reps };
    }
  }
  const out = values.outputsOf(w).find(o => o.key === 'completionPct');
  if (out) { let pct = 0; try { pct = out.get(today) || 0; } catch { /* quiet */ } return { widget: w, checkable: false, pct, complete: pct >= 100 }; }
  return null;
}

function todaysItems(widget) {
  return sources(widget).map(itemFor).filter(Boolean);
}

function toggle(item) {
  const w = item.widget;
  if (item.complete) q.addRep(w, -(item.reps), todayStr());
  else q.addRep(w, item.reps - item.done, todayStr());
}

function itemRow(item, onChange) {
  const w = item.widget;
  const def = registry.get(w.type);
  const row = el(`<div class="qb-row row-between">
    <span class="row" style="gap:8px;min-width:0">
      <button class="btn-icon qb-check" style="color:${item.complete ? 'var(--success)' : 'var(--text-soft)'}">${icon(item.complete ? 'check-circle' : 'circle', 19)}</button>
      <span class="qb-name"></span></span>
    <span class="chip soft">${def?.name || w.type}</span></div>`);
  row.querySelector('.qb-name').textContent = w.name + (item.checkable && item.reps > 1 ? ` (${item.done}/${item.reps})` : '');
  const check = row.querySelector('.qb-check');
  if (item.checkable) check.onclick = () => { toggle(item); onChange(); };
  else { check.innerHTML = icon(item.complete ? 'check-circle' : 'circle', 19); check.disabled = true; check.style.opacity = '0.6'; }
  return row;
}

registry.register({
  type: 'questboard',
  name: 'Quest Board',
  icon: 'list',
  description: 'Today’s tasks across all your linked widgets',
  external: true, internal: true,
  defaultConfig: () => ({ sources: [] }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    if (!(widget.config.sources || []).length) {
      host.appendChild(el('<p class="soft" style="font-size:0.86rem">Tap to link Quests, Habits, or Routines.</p>'));
      return;
    }
    const items = todaysItems(widget);
    const pending = items.filter(i => !i.complete);
    host.appendChild(el(`<div class="qb-head soft" style="font-size:0.82rem;margin-bottom:6px">${pending.length ? `${pending.length} to do today` : 'All done for today 🌸'}</div>`));
    const list = el('<div class="qb-list"></div>');
    const ordered = [...pending, ...items.filter(i => i.complete)].slice(0, 5);
    for (const item of ordered) list.appendChild(itemRow(item, () => ctx.refreshCard(widget)));
    host.appendChild(list);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const render = () => {
      host.innerHTML = '';
      const items = todaysItems(widget);
      const pending = items.filter(i => !i.complete), done = items.filter(i => i.complete);
      if (!items.length) host.appendChild(el('<p class="soft">No items due today from the linked widgets.</p>'));
      if (pending.length) {
        host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:4px 0 6px">TO DO TODAY</h3>'));
        const list = el('<div class="panel" style="padding:8px 12px;margin-bottom:14px"></div>');
        for (const item of pending) list.appendChild(itemRow(item, render));
        host.appendChild(list);
      }
      if (done.length) {
        host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:4px 0 6px">DONE</h3>'));
        const list = el('<div class="panel" style="padding:8px 12px;margin-bottom:14px"></div>');
        for (const item of done) list.appendChild(itemRow(item, render));
        host.appendChild(list);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Link a Quest, Habit, or Routine</button>`);
      add.onclick = () => openNodePicker({ onPick: ({ kind, id }) => {
        const w = store.get('widgets', id);
        if (kind !== 'widget' || !w) { toast('Pick a widget.', 'info'); return; }
        if (!itemFor(w)) { toast('That widget has nothing to track here.', 'info'); return; }
        widget.config.sources = [...new Set([...(widget.config.sources || []), id])];
        store.put('widgets', widget); render();
      } });
      host.appendChild(add);
      if ((widget.config.sources || []).length) {
        const manage = el('<div style="margin-top:12px"></div>');
        manage.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin-bottom:6px">SOURCES</h3>'));
        for (const w of sources(widget)) {
          const r = el(`<div class="row-between" style="margin-bottom:4px"><span class="qb-name"></span><button class="btn-icon">${icon('x', 14)}</button></div>`);
          r.querySelector('.qb-name').textContent = w.name;
          r.querySelector('.btn-icon').onclick = () => { widget.config.sources = widget.config.sources.filter(id => id !== w.id); store.put('widgets', widget); render(); };
          manage.appendChild(r);
        }
        host.appendChild(manage);
      }
    };
    render();
  }
});
