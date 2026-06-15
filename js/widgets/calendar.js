/* Calendar widget (docs/05 + V2 §12c): month / week / day views with full local
   events (title, start+end time, recurrence, colour, location, notes) plus the
   auto-populated dated things from the module (quests, habits, routines, journal,
   goal milestones). Offline-only — never embeds an external calendar. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg, promptText, confirmDialog, openDrawer, toast } from '../ui/components.js';
import { todayStr, dateAdd, fmtDate, createObject, saveObject, objectsOf } from './base.js';
import * as q from './questops.js';

const COLORS = ['#a78bfa', '#7cc4ff', '#9be3b4', '#ffd28a', '#f6a5c0', '#e0b3ff'];
const KIND_ICON = { quest: 'flag', habit: 'cosmos', routine: 'repeat', journal: 'book', milestone: 'target', event: 'calendar' };

function moduleWidgets(widget) {
  const mod = store.all('modules').find(m => m.pages.some(pid => store.get('pages', pid)?.widgets.includes(widget.id)));
  if (!mod) return [];
  return mod.pages.flatMap(pid => (store.get('pages', pid)?.widgets || [])).map(id => store.get('widgets', id)).filter(Boolean);
}

/** Auto-populated (read-only) items from sibling widgets on a date. */
function autoItemsOn(widget, dateStr) {
  const items = [];
  for (const w of moduleWidgets(widget)) {
    if (w.id === widget.id) continue;
    if ((w.type === 'quest' || w.type === 'habit') && q.scheduledOn(w, dateStr)) items.push({ kind: w.type, label: w.name, widgetId: w.id, done: q.repsDone(w, dateStr) >= (w.config.reps || 1) });
    if (w.type === 'journal' && (w.config.entries || []).some(e => e.date === dateStr)) items.push({ kind: 'journal', label: `${w.name} entry`, widgetId: w.id });
    if (w.type === 'goal') for (const m of (w.config.milestones || [])) if (m.date === dateStr) items.push({ kind: 'milestone', label: `${m.name} (${w.name})`, widgetId: w.id });
  }
  return items;
}

function occursOn(ev, ds) {
  const d = ev.data;
  if (ds < d.date) return false;
  if (d.recurrence === 'daily') return true;
  if (d.recurrence === 'weekly') return new Date(ds + 'T12:00:00').getDay() === new Date(d.date + 'T12:00:00').getDay();
  if (d.recurrence === 'monthly') return Number(ds.slice(8)) === Number(d.date.slice(8));
  return ds === d.date;
}
function eventsOn(widget, ds) { return objectsOf(widget.id, 'event').filter(ev => occursOn(ev, ds)).map(ev => ({ ...ev.data, objectId: ev.id })).sort((a, b) => (a.start || '99') < (b.start || '99') ? -1 : 1); }
const minutes = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/* ---------- month grid ---------- */
function monthGrid(widget, year, month, { compact, onPick, selected }) {
  const grid = el(`<div class="cal-grid ${compact ? 'compact' : ''}"></div>`);
  for (const d of ['S', 'M', 'T', 'W', 'T', 'F', 'S']) grid.appendChild(el(`<span class="cal-h">${d}</span>`));
  const first = new Date(year, month, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = todayStr(d);
    const cell = el(`<button class="cal-cell ${d.getMonth() === month ? '' : 'dim'} ${ds === todayStr() ? 'today' : ''} ${ds === selected ? 'sel' : ''}">
      <span class="cal-n">${d.getDate()}</span><span class="cal-chips"></span></button>`);
    const chipHost = cell.querySelector('.cal-chips');
    const evs = eventsOn(widget, ds), autos = autoItemsOn(widget, ds);
    if (compact) {
      for (const e of [...evs, ...autos].slice(0, 3)) chipHost.appendChild(el(`<i class="cal-dot" style="background:${e.color || 'var(--accent)'}"></i>`));
    } else {
      for (const e of evs.slice(0, 3)) { const c = el('<span class="cal-chip"></span>'); c.style.background = e.color || 'var(--accent)'; c.textContent = e.title; chipHost.appendChild(c); }
      if (autos.length) chipHost.appendChild(el(`<span class="cal-chip auto">+${autos.length}</span>`));
    }
    cell.onclick = () => onPick?.(ds);
    grid.appendChild(cell);
  }
  return grid;
}

/* ---------- time grid (week = 7 cols, day = 1 col) ---------- */
function timeGrid(widget, dates, { onSlot, onEvent }) {
  const HH = 38; // px per hour
  const wrap = el('<div class="cal-tg"></div>');
  const gutter = el('<div class="cal-tg-gutter"></div>');
  for (let h = 0; h < 24; h++) gutter.appendChild(el(`<div class="cal-tg-hour" style="height:${HH}px">${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}</div>`));
  const cols = el(`<div class="cal-tg-cols" style="grid-template-columns:repeat(${dates.length},1fr)"></div>`);
  for (const ds of dates) {
    const col = el(`<div class="cal-tg-col" style="height:${HH * 24}px"></div>`);
    if (dates.length > 1) col.appendChild(el(`<div class="cal-tg-dayhead ${ds === todayStr() ? 'today' : ''}">${new Date(ds + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</div>`));
    col.onclick = (e) => { if (e.target === col) { const y = e.offsetY; onSlot(ds, Math.max(0, Math.min(23, Math.floor(y / HH)))); } };
    for (const ev of eventsOn(widget, ds)) {
      const top = (minutes(ev.start) / 60) * HH, h = Math.max(18, ((minutes(ev.end) - minutes(ev.start)) / 60) * HH || HH * 0.8);
      const block = el(`<div class="cal-ev" style="top:${top}px;height:${h}px;background:${ev.color || 'var(--accent)'}"><span></span></div>`);
      block.querySelector('span').textContent = `${ev.start || ''} ${ev.title}`.trim();
      block.onclick = (e) => { e.stopPropagation(); onEvent(ev.objectId); };
      col.appendChild(block);
    }
    cols.appendChild(col);
  }
  wrap.append(gutter, cols);
  return wrap;
}

/* ---------- event editor ---------- */
function editEvent(widget, objectId, date, after) {
  const ev = objectId ? store.get('objects', objectId) : null;
  const d = ev ? { ...ev.data } : { title: '', date: date || todayStr(), start: '', end: '', recurrence: 'none', color: COLORS[0], note: '', location: '' };
  const drawer = openDrawer({ title: objectId ? 'Edit event' : 'New event', iconName: 'calendar' });
  const titleIn = input(d.title, 'Title');
  const dateIn = input(d.date); dateIn.type = 'date';
  const startIn = input(d.start); startIn.type = 'time';
  const endIn = input(d.end); endIn.type = 'time';
  const locIn = input(d.location || '', 'Location (optional)');
  const noteIn = el('<textarea class="textarea" rows="2" placeholder="Notes"></textarea>'); noteIn.value = d.note || '';
  drawer.body.append(field('Title', titleIn), field('Date', dateIn));
  const times = el('<div class="row" style="gap:8px"></div>'); times.append(field('Start', startIn), field('End', endIn)); drawer.body.appendChild(times);
  drawer.body.appendChild(field('Repeat', seg([['none', 'None'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, l]) => ({ value: v, label: l })), d.recurrence, (v) => d.recurrence = v)));
  const sw = el('<div class="row" style="gap:6px;margin-bottom:12px"></div>');
  for (const c of COLORS) { const b = el(`<button class="cal-swatch ${c === d.color ? 'on' : ''}" style="background:${c}"></button>`); b.onclick = () => { d.color = c; sw.querySelectorAll('.cal-swatch').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; sw.appendChild(b); }
  drawer.body.append(field('Colour', sw), field('Location', locIn), field('Notes', noteIn));
  const save = el(`<button class="btn btn-primary" style="width:100%">${icon('check', 15)} Save</button>`);
  save.onclick = () => {
    if (!titleIn.value.trim()) { toast('Give the event a title.', 'info'); return; }
    const data = { title: titleIn.value.trim(), date: dateIn.value || todayStr(), start: startIn.value, end: endIn.value, recurrence: d.recurrence, color: d.color, note: noteIn.value, location: locIn.value };
    if (ev) { ev.data = data; ev.date = data.date; saveObject(ev); } else createObject(widget.id, 'event', data, data.date);
    drawer.close(); after();
  };
  drawer.body.appendChild(save);
  if (objectId) { const del = el(`<button class="btn" style="width:100%;margin-top:8px;color:var(--warn)">${icon('trash', 15)} Delete</button>`); del.onclick = async () => { if (await confirmDialog({ title: 'Delete event?' })) { store.trash('objects', objectId); drawer.close(); after(); } }; drawer.body.appendChild(del); }
}

registry.register({
  type: 'calendar',
  name: 'Calendar',
  icon: 'calendar',
  description: 'Month, week & day views with events and recurrence',
  external: true, internal: true,
  defaultConfig: () => ({ view: 'month' }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const now = new Date();
    host.appendChild(el(`<div class="soft" style="text-align:center;font-size:0.82rem;margin-bottom:4px">${now.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>`));
    host.appendChild(monthGrid(widget, now.getFullYear(), now.getMonth(), { compact: true, onPick: () => ctx.openInternal(widget) }));
  },

  renderFull(host, widget, ctx) {
    let cursor = new Date(); cursor.setHours(12, 0, 0, 0);
    let selected = todayStr();
    let view = widget.config.view || 'month';
    host.innerHTML = '';

    const head = el(`<div class="row" style="margin-bottom:10px;gap:6px">
      <button class="btn-icon cal-prev">${icon('chevron-left', 18)}</button>
      <strong class="cal-title grow" style="text-align:center"></strong>
      <button class="btn-icon cal-next">${icon('chevron-right', 18)}</button></div>`);
    const viewSeg = el('<div style="margin-bottom:10px"></div>');
    viewSeg.appendChild(seg([['month', 'Month'], ['week', 'Week'], ['day', 'Day']].map(([v, l]) => ({ value: v, label: l })), view, (v) => { view = v; widget.config.view = v; store.put('widgets', widget); render(); }));
    const bodyHost = el('<div></div>');
    const after = () => render();

    const render = () => {
      bodyHost.innerHTML = '';
      const y = cursor.getFullYear(), m = cursor.getMonth();
      if (view === 'month') {
        head.querySelector('.cal-title').textContent = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });
        bodyHost.appendChild(monthGrid(widget, y, m, { selected, onPick: (ds) => { selected = ds; cursor = new Date(ds + 'T12:00:00'); view = 'day'; widget.config.view = 'day'; store.put('widgets', widget); render(); } }));
        bodyHost.appendChild(agenda(selected));
      } else if (view === 'week') {
        const ws = new Date(cursor); ws.setDate(ws.getDate() - ws.getDay());
        const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return todayStr(d); });
        head.querySelector('.cal-title').textContent = `Week of ${fmtDate(dates[0])}`;
        bodyHost.appendChild(timeGrid(widget, dates, { onSlot: (ds, h) => editEvent(widget, null, ds, after), onEvent: (id) => editEvent(widget, id, null, after) }));
      } else {
        head.querySelector('.cal-title').textContent = todayStr() === todayStr(cursor) && cursor.toDateString() === new Date().toDateString() ? 'Today' : cursor.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
        const ds = todayStr(cursor);
        bodyHost.appendChild(timeGrid(widget, [ds], { onSlot: () => editEvent(widget, null, ds, after), onEvent: (id) => editEvent(widget, id, null, after) }));
        bodyHost.appendChild(agenda(ds));
      }
    };

    const agenda = (ds) => {
      const wrap = el('<div style="margin-top:14px"></div>');
      const autos = autoItemsOn(widget, ds);
      if (autos.length) {
        wrap.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin-bottom:6px">FROM YOUR MODULE</h3>'));
        for (const it of autos) { const r = el(`<button class="list-item"><span style="color:var(--accent)">${icon(KIND_ICON[it.kind] || 'circle', 16)}</span><span class="li-main"><span class="li-title"></span></span>${it.done ? icon('check', 14) : ''}</button>`); r.querySelector('.li-title').textContent = it.label; if (it.widgetId) r.onclick = () => ctx.goWidget(it.widgetId); wrap.appendChild(r); }
      }
      const add = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('plus', 15)} Add event</button>`);
      add.onclick = () => editEvent(widget, null, ds, after);
      wrap.appendChild(add);
      return wrap;
    };

    const shift = (dir) => { if (view === 'month') cursor.setMonth(cursor.getMonth() + dir); else if (view === 'week') cursor.setDate(cursor.getDate() + dir * 7); else cursor.setDate(cursor.getDate() + dir); selected = todayStr(cursor); render(); };
    head.querySelector('.cal-prev').onclick = () => shift(-1);
    head.querySelector('.cal-next').onclick = () => shift(1);

    host.append(head, viewSeg, bodyHost);
    render();
  }
});
