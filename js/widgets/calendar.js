/* Calendar widget (docs/05): a from-scratch month calendar that auto-populates
   from every dated thing in its module (quests, habits, routines, journal
   entries, goal milestones) plus manual events. Offline rule: never embeds
   external calendars; theming honored via CSS variables. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, field, input, promptText, confirmDialog, popMenu } from '../ui/components.js';
import { todayStr, dateAdd, fmtDate, createObject, saveObject, objectsOf } from './base.js';
import * as q from './questops.js';

function moduleWidgets(widget) {
  const mod = store.all('modules').find(m =>
    m.pages.some(pid => store.get('pages', pid)?.widgets.includes(widget.id)));
  if (!mod) return [];
  const out = [];
  for (const pid of mod.pages) {
    const page = store.get('pages', pid);
    if (!page) continue;
    for (const wid of page.widgets) {
      const w = store.get('widgets', wid);
      if (w) out.push(w);
    }
  }
  return out;
}

/** Everything happening on a date (docs/05 auto-populate list). */
function itemsOn(widget, dateStr) {
  const items = [];
  for (const w of moduleWidgets(widget)) {
    if (w.id === widget.id) continue;
    if ((w.type === 'quest' || w.type === 'habit') && q.scheduledOn(w, dateStr)) {
      items.push({ kind: w.type, label: w.name, widgetId: w.id, done: q.repsDone(w, dateStr) >= (w.config.reps || 1) });
    }
    if (w.type === 'routine') {
      const c = w.config.cadence;
      const d = new Date(dateStr + 'T12:00:00');
      if (c === 'daily' || (c === 'weekly' && d.getDay() === 0) || (c === 'monthly' && d.getDate() === 1)) {
        items.push({ kind: 'routine', label: w.name, widgetId: w.id });
      }
    }
    if (w.type === 'journal' && (w.config.entries || []).some(e => e.date === dateStr)) {
      items.push({ kind: 'journal', label: `${w.name} entry`, widgetId: w.id });
    }
    if (w.type === 'goal') {
      for (const m of (w.config.milestones || [])) {
        if (m.date === dateStr) items.push({ kind: 'milestone', label: `${m.name} (${w.name})`, widgetId: w.id });
      }
    }
  }
  for (const ev of objectsOf(widget.id, 'event')) {
    if (ev.date === dateStr) items.push({ kind: 'event', label: ev.data.title, time: ev.data.time, note: ev.data.note, objectId: ev.id });
  }
  return items;
}

const KIND_ICON = { quest: 'flag', habit: 'cosmos', routine: 'repeat', journal: 'book', milestone: 'target', event: 'calendar' };

function monthGrid(widget, year, month, { compact, onPick, selected }) {
  const grid = el(`<div class="cal-grid ${compact ? 'compact' : ''}"></div>`);
  for (const d of ['S', 'M', 'T', 'W', 'T', 'F', 'S']) {
    grid.appendChild(el(`<span class="cal-h">${d}</span>`));
  }
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = todayStr(d);
    const inMonth = d.getMonth() === month;
    const cell = el(`<button class="cal-cell ${inMonth ? '' : 'dim'} ${ds === todayStr() ? 'today' : ''} ${ds === selected ? 'sel' : ''}">
      <span class="cal-n">${d.getDate()}</span><span class="cal-dots"></span></button>`);
    const dots = itemsOn(widget, ds).slice(0, compact ? 3 : 4);
    for (const it of dots) {
      cell.querySelector('.cal-dots').appendChild(el(`<i class="cal-dot ${it.kind === 'event' ? 'ev' : ''}"></i>`));
    }
    cell.onclick = () => onPick?.(ds);
    grid.appendChild(cell);
  }
  return grid;
}

registry.register({
  type: 'calendar',
  name: 'Calendar',
  icon: 'calendar',
  description: 'Everything dated, gathered in one month view',
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const now = new Date();
    host.appendChild(el(`<div class="soft" style="text-align:center;font-size:0.82rem;margin-bottom:4px">${now.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>`));
    host.appendChild(monthGrid(widget, now.getFullYear(), now.getMonth(), {
      compact: true,
      onPick: () => ctx.openInternal(widget)
    }));
  },

  renderFull(host, widget, ctx) {
    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let selected = todayStr();
    host.innerHTML = '';

    const head = el(`<div class="row" style="justify-content:center;margin-bottom:10px">
      <button class="btn-icon">${icon('chevron-left', 18)}</button>
      <strong style="min-width:170px;text-align:center" class="cal-title"></strong>
      <button class="btn-icon">${icon('chevron-right', 18)}</button></div>`);
    const gridHost = el('<div></div>');
    const agenda = el('<div style="margin-top:16px"></div>');

    const renderGrid = () => {
      head.querySelector('.cal-title').textContent =
        new Date(year, month, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
      gridHost.innerHTML = '';
      gridHost.appendChild(monthGrid(widget, year, month, {
        compact: false, selected,
        onPick: (ds) => { selected = ds; renderGrid(); renderAgenda(); }
      }));
    };
    const renderAgenda = () => {
      agenda.innerHTML = '';
      agenda.appendChild(el(`<h3 class="soft" style="font-size:0.8rem;margin-bottom:8px">${selected === todayStr() ? 'TODAY' : fmtDate(selected).toUpperCase()}</h3>`));
      const items = itemsOn(widget, selected).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
      for (const it of items) {
        const row = el(`<button class="list-item">
          <span style="color:var(--accent)">${icon(KIND_ICON[it.kind], 16)}</span>
          <span class="li-main"><span class="li-title"></span>${it.note ? '<span class="li-sub"></span>' : ''}</span>
          ${it.time ? `<span class="soft">${it.time}</span>` : ''}
          ${it.done ? icon('check', 14) : ''}</button>`);
        row.querySelector('.li-title').textContent = it.label;
        if (it.note) row.querySelector('.li-sub').textContent = it.note;
        if (it.widgetId) row.onclick = () => ctx.goWidget(it.widgetId);
        else if (it.objectId) row.onclick = (e) => popMenu(row, [
          { label: 'Rename', iconName: 'edit', fn: async () => {
            const obj = store.get('objects', it.objectId);
            const title = await promptText({ title: 'Rename event', value: obj.data.title });
            if (title) { obj.data.title = title; saveObject(obj); renderAgenda(); }
          } },
          { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
            if (await confirmDialog({ title: `Delete “${it.label}”?` })) {
              store.trash('objects', it.objectId);
              renderGrid();
              renderAgenda();
            }
          } }
        ]);
        agenda.appendChild(row);
      }
      if (!items.length) agenda.appendChild(el('<p class="soft" style="padding:8px 2px">A quiet day.</p>'));

      const add = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('plus', 15)} Add event</button>`);
      add.onclick = () => addEventForm();
      agenda.appendChild(add);
    };

    const addEventForm = () => {
      agenda.querySelector('.cal-add-form')?.remove();
      const form = el(`<div class="panel cal-add-form" style="padding:12px;margin-top:8px">
        <input class="input" placeholder="Event title" style="margin-bottom:8px">
        <div class="row"><input class="input" type="time" style="flex:1">
        <button class="btn btn-primary">Add</button></div></div>`);
      const [titleIn, timeIn] = form.querySelectorAll('input');
      form.querySelector('.btn-primary').onclick = () => {
        if (!titleIn.value.trim()) return;
        createObject(widget.id, 'event', { title: titleIn.value.trim(), time: timeIn.value || null, note: '' }, selected);
        renderGrid();
        renderAgenda();
      };
      agenda.appendChild(form);
      titleIn.focus();
    };

    head.querySelectorAll('button')[0].onclick = () => { month--; if (month < 0) { month = 11; year--; } renderGrid(); };
    head.querySelectorAll('button')[1].onclick = () => { month++; if (month > 11) { month = 0; year++; } renderGrid(); };

    renderGrid();
    renderAgenda();
    host.append(head, gridHost, agenda);
  }
});
