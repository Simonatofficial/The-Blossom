/* Journal widget (docs/05): date strip + entries. An entry is a nested widget
   (Notes to write, Canvas to draw, anything). "Inspire me" pulls from the
   prompt pools in presets/prompts.js. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast } from '../ui/components.js';
import { todayStr, dateAdd, fmtDate, childWidgetsOf } from './base.js';
import { openWidgetGallery } from '../ui/picker.js';
import { PROMPTS } from '../presets/prompts.js';

function entries(widget) { return widget.config.entries || (widget.config.entries = []); }

function entriesOn(widget, dateStr) {
  return entries(widget).filter(e => e.date === dateStr);
}

function entryStreak(widget) {
  let streak = 0;
  let d = todayStr();
  if (!entriesOn(widget, d).length) d = dateAdd(d, -1); // today doesn't break it yet
  while (entriesOn(widget, d).length && streak < 3650) {
    streak++;
    d = dateAdd(d, -1);
  }
  return streak;
}

registry.register({
  type: 'journal',
  name: 'Journal',
  icon: 'book',
  description: 'Daily entries — write, draw, reflect',
  container: true,
  external: true, internal: true,
  defaultConfig: () => ({ entries: [] }),

  outputs: (widget) => [
    { key: 'entriesToday', name: 'Entries written', dayKeyed: true, get: (d) => entriesOn(widget, d || todayStr()).length },
    { key: 'entryStreak', name: 'Entry streak', dayKeyed: false, get: () => entryStreak(widget) }
  ],

  renderCard(host, widget) {
    host.innerHTML = '';
    const n = entriesOn(widget, todayStr()).length;
    host.appendChild(el(`<div class="journal-card">
      <div class="j-state">${n ? `${n} ${n === 1 ? 'entry' : 'entries'} today ${icon('check', 13)}` : 'No entry yet today'}</div>
      <div class="row" style="margin-top:4px"><span class="chip">${icon('leaf', 11)} ${entryStreak(widget)}</span></div>
    </div>`));
  },

  renderFull(host, widget, ctx) {
    let selected = todayStr();
    let weekStart = dateAdd(selected, -new Date(selected + 'T12:00:00').getDay());
    host.innerHTML = '';

    const strip = el(`<div class="j-strip">
      <button class="btn-icon">${icon('chevron-left', 16)}</button>
      <div class="j-days row grow" style="justify-content:space-between"></div>
      <button class="btn-icon">${icon('chevron-right', 16)}</button></div>`);
    const dayList = el('<div class="j-entries" style="margin-top:14px"></div>');

    const renderStrip = () => {
      const days = strip.querySelector('.j-days');
      days.innerHTML = '';
      for (let i = 0; i < 7; i++) {
        const ds = dateAdd(weekStart, i);
        const d = new Date(ds + 'T12:00:00');
        const has = entriesOn(widget, ds).length > 0;
        const b = el(`<button class="j-day ${ds === selected ? 'sel' : ''} ${ds === todayStr() ? 'today' : ''}">
          <span class="j-dw">${d.toLocaleDateString([], { weekday: 'narrow' })}</span>
          <span class="j-dn">${d.getDate()}</span>
          <span class="j-dot" style="${has ? '' : 'opacity:0'}"></span></button>`);
        b.onclick = () => { selected = ds; renderStrip(); renderDay(); };
        days.appendChild(b);
      }
    };
    strip.querySelectorAll(':scope > .btn-icon')[0].onclick = () => { weekStart = dateAdd(weekStart, -7); renderStrip(); };
    strip.querySelectorAll(':scope > .btn-icon')[1].onclick = () => { weekStart = dateAdd(weekStart, 7); renderStrip(); };

    const renderDay = () => {
      dayList.innerHTML = '';
      const dayEntries = entriesOn(widget, selected);
      for (const entry of dayEntries) {
        const child = store.get('widgets', entry.widgetId);
        if (!child) continue;
        dayList.appendChild(ctx.renderWidgetCard(child));
      }
      if (!dayEntries.length) {
        dayList.appendChild(el(`<p class="soft" style="text-align:center;padding:18px 0">${selected === todayStr() ? 'Today is unwritten.' : 'This day is quiet.'}</p>`));
      }
      const row = el('<div class="row" style="margin-top:10px"></div>');
      const add = el(`<button class="btn grow">${icon('plus', 15)} Add entry</button>`);
      add.onclick = () => openWidgetGallery({
        parentWidgetId: widget.id,
        onCreated: (child) => {
          entries(widget).push({ widgetId: child.id, date: selected });
          store.put('widgets', widget);
          renderStrip();
          renderDay();
          ctx.openInternal(child);
        }
      });
      const inspire = el(`<button class="btn">${icon('wand', 15)} Inspire me</button>`);
      inspire.onclick = () => showPrompt();
      row.append(add, inspire);
      dayList.appendChild(row);
    };

    const promptHost = el('<div></div>');
    const showPrompt = () => {
      const pools = ['write', 'draw', 'pause'];
      const pool = pools[Math.floor(Math.random() * pools.length)];
      const text = PROMPTS[pool][Math.floor(Math.random() * PROMPTS[pool].length)];
      promptHost.innerHTML = '';
      const card = el(`<div class="panel" style="padding:14px;margin-top:12px">
        <div class="row"><span class="chip accent">${pool}</span><span class="grow"></span>
        <button class="btn-icon" title="Another">${icon('refresh', 14)}</button>
        <button class="btn-icon" title="Close">${icon('x', 14)}</button></div>
        <p style="margin-top:8px"></p></div>`);
      card.querySelector('p').textContent = text;
      card.querySelector('[title="Another"]').onclick = showPrompt;
      card.querySelector('[title="Close"]').onclick = () => { promptHost.innerHTML = ''; };
      promptHost.appendChild(card);
    };

    renderStrip();
    renderDay();
    host.append(strip, dayList, promptHost);
  }
});
