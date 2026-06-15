/* Overview widget (V2 §W-3): a day-by-day activity dashboard. For a chosen day
   it shows what happened across the linked widgets and acts as a launchpad —
   tapping an item navigates to that widget. Rich providers for Flashcard / Quiz /
   Notebook; a generic provider reads any widget's day-keyed outputs (Skill,
   Habit, Quest, Counter, Tracker, Health, …). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, seg, toast } from '../ui/components.js';
import { objectsOf, todayStr, dateAdd, fmtDate } from './base.js';
import { outputsOf } from '../core/values.js';
import { topicsOf } from './notebook.js';
import { openNodePicker } from '../ui/picker.js';

function linkedWidgets(widget) { return (widget.config.items || []).map(it => store.get('widgets', it.widgetId)).filter(Boolean); }

/** Activity items for one widget on one day: [{ icon, label, sub }]. */
function activityFor(w, dateStr) {
  if (w.type === 'flashcards') {
    const day = store.all('objects').find(o => o.widgetId === w.id && o.kind === 'studyDay' && o.date === dateStr);
    return day?.data.reviews ? [{ icon: 'layers', label: `${day.data.reviews} card${day.data.reviews === 1 ? '' : 's'} reviewed`, sub: 'Flashcards' }] : [];
  }
  if (w.type === 'quiz') {
    return objectsOf(w.id, 'quizResult').filter(r => r.date === dateStr).map(r => ({
      icon: 'check-square', label: `${r.data.score}/${r.data.total} (${Math.round(r.data.score / r.data.total * 100)}%)`,
      sub: `Quiz${r.data.timeMs ? ` · ${Math.round(r.data.timeMs / 1000)}s` : ''}`
    }));
  }
  if (w.type === 'notebook') {
    const tmap = new Map(topicsOf(w).map(t => [t.id, t]));
    return objectsOf(w.id, 'topicNote').filter(n => n.data.editedAt && todayStr(new Date(n.data.editedAt)) === dateStr)
      .map(n => { const t = tmap.get(n.data.topicId); return { icon: 'note', label: `Edited ${t?.name || 'a topic'}`, sub: t ? `${t.className} › ${t.unitName}` : 'Notebook' }; });
  }
  // generic: any non-zero day-keyed output
  return outputsOf(w).filter(o => o.dayKeyed).map(o => { const v = o.get(dateStr); return v ? { icon: registry.get(w.type)?.icon || 'circle', label: `${o.name}: ${v}`, sub: w.name } : null; }).filter(Boolean);
}

function dayLabel(dateStr) {
  const t = todayStr();
  if (dateStr === t) return 'Today';
  if (dateStr === dateAdd(t, -1)) return 'Yesterday';
  if (dateStr === dateAdd(t, 1)) return 'Tomorrow';
  return fmtDate(dateStr);
}

registry.register({
  type: 'overview',
  name: 'Overview',
  icon: 'grid',
  description: 'A day-by-day activity dashboard across your widgets',
  external: true, internal: true,
  defaultConfig: () => ({ items: [], showEmpty: false }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const ws = linkedWidgets(widget);
    if (!ws.length) { host.appendChild(el('<p class="soft" style="font-size:0.86rem">Tap to add widgets to this dashboard.</p>')); return; }
    const today = todayStr();
    const count = ws.reduce((a, w) => a + activityFor(w, today).length, 0);
    const card = el(`<div class="ov-today">
      <div class="row-between"><strong></strong><span class="chip ${count ? 'accent' : ''}">${count} update${count === 1 ? '' : 's'}</span></div>
      <button class="btn-soft-wide" style="margin-top:8px">${icon('arrow-right', 14)} View today</button></div>`);
    card.querySelector('strong').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    card.querySelector('button').onclick = () => ctx.openInternal(widget);
    host.appendChild(card);
  },

  renderFull(host, widget, ctx) {
    let date = todayStr();
    const render = () => {
      host.innerHTML = '';
      const ws = linkedWidgets(widget);

      const nav = el(`<div class="ov-datenav row-between">
        <button class="btn-icon ov-prev" title="Previous day">${icon('chevron-left', 18)}</button>
        <strong class="ov-date"></strong>
        <button class="btn-icon ov-next" title="Next day">${icon('chevron-right', 18)}</button></div>`);
      nav.querySelector('.ov-date').textContent = dayLabel(date);
      nav.querySelector('.ov-prev').onclick = () => { date = dateAdd(date, -1); render(); };
      nav.querySelector('.ov-next').onclick = () => { date = dateAdd(date, 1); render(); };
      host.appendChild(nav);

      if (!ws.length) { host.appendChild(el('<p class="soft" style="text-align:center;padding:24px">Link widgets in settings to see their daily activity.</p>')); return; }

      for (const w of ws) {
        const def = registry.get(w.type);
        const items = activityFor(w, date);
        if (!items.length && !widget.config.showEmpty) continue;
        const panel = el('<div class="panel ov-panel" style="padding:12px;margin-bottom:10px"></div>');
        panel.appendChild(el(`<div class="row" style="gap:6px;margin-bottom:6px">${icon(def?.icon || 'circle', 15)}<strong class="ov-wname"></strong></div>`)).querySelector('.ov-wname').textContent = w.name;
        if (!items.length) panel.appendChild(el('<p class="soft" style="font-size:0.82rem">No activity.</p>'));
        for (const it of items) {
          const row = el(`<button class="list-item">${icon(it.icon || 'circle', 15)}<span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>${icon('chevron-right', 14)}</button>`);
          row.querySelector('.li-title').textContent = it.label;
          row.querySelector('.li-sub').textContent = it.sub || '';
          row.onclick = () => ctx.goWidget(w.id); // navigate to the source widget (back returns here)
          panel.appendChild(row);
        }
        host.appendChild(panel);
      }
    };
    render();
  },

  renderSettings(host, widget, ctx) {
    const render = () => {
      host.innerHTML = '';
      host.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:8px">Pick widgets to pull daily activity from.</p>'));
      const items = widget.config.items || (widget.config.items = []);
      for (const it of items) {
        const w = store.get('widgets', it.widgetId);
        const row = el(`<div class="row-between sn-src-row"><span class="sn-src-name" style="overflow:hidden;text-overflow:ellipsis"></span><button class="btn-icon sn-rm">${icon('x', 14)}</button></div>`);
        row.querySelector('.sn-src-name').textContent = w ? w.name : '(missing widget)';
        row.querySelector('.sn-rm').onclick = () => { widget.config.items = items.filter(x => x.widgetId !== it.widgetId); store.put('widgets', widget); ctx.refreshCard?.(widget); render(); };
        host.appendChild(row);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add a widget</button>`);
      add.onclick = () => openNodePicker({ onPick: ({ kind, id }) => {
        const w = store.get('widgets', id);
        if (kind !== 'widget' || !w) { toast('Pick a widget.', 'info'); return; }
        if (items.some(x => x.widgetId === id)) { toast('Already added.', 'info'); return; }
        widget.config.items = [...items, { widgetId: id }]; store.put('widgets', widget); ctx.refreshCard?.(widget); render();
      } });
      host.appendChild(add);
      host.appendChild(el('<div style="margin-top:12px"></div>')).appendChild(
        (() => { const f = el('<label class="soft" style="font-size:0.8rem;display:block;margin-bottom:4px">Days with no activity</label>'); return f; })());
      host.appendChild(seg([{ value: 'hide', label: 'Hide empty' }, { value: 'show', label: 'Show empty' }], widget.config.showEmpty ? 'show' : 'hide', (v) => { widget.config.showEmpty = v === 'show'; store.put('widgets', widget); }));
    };
    render();
  }
});
