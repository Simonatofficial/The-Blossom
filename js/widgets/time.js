/* Time widget (docs/05): the cozy heart of a Home page. External only.
   Day name, live time, date, and a freeform pinned note. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { el, field, seg, switchEl } from '../ui/components.js';

function weekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - start) / 86400000 + 1) / 7);
}

function fmtTime(d, cfg) {
  const opts = { hour: '2-digit', minute: '2-digit', hour12: cfg.h12 };
  if (cfg.seconds) opts.second = '2-digit';
  return d.toLocaleTimeString([], opts);
}

registry.register({
  type: 'time',
  name: 'Time',
  icon: 'clock',
  description: 'Day, time, and a pinned note',
  external: true, internal: false,
  defaultConfig: () => ({ h12: true, seconds: false, week: false, note: '' }),

  renderCard(host, widget, ctx) {
    const cfg = widget.config;
    host.innerHTML = '';
    const card = el(`<div class="time-widget">
      <div class="t-day"></div>
      <div class="t-time"></div>
      <div class="t-date"></div>
      <div class="t-note" contenteditable="true" data-ph="Pin a little note here…"></div>
    </div>`);
    host.appendChild(card);

    const tick = () => {
      if (!host.isConnected) { clearInterval(timer); return; }
      const now = new Date();
      card.querySelector('.t-day').textContent = now.toLocaleDateString([], { weekday: 'long' });
      card.querySelector('.t-time').textContent = fmtTime(now, cfg);
      card.querySelector('.t-date').textContent =
        now.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) +
        (cfg.week ? ` · week ${weekNumber(now)}` : '');
    };
    const timer = setInterval(tick, cfg.seconds ? 1000 : 5000);
    tick();

    const note = card.querySelector('.t-note');
    note.textContent = cfg.note || '';
    note.addEventListener('blur', () => {
      widget.config.note = note.textContent;
      store.put('widgets', widget);
    });
  },

  renderSettings(host, widget, ctx) {
    const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
    host.appendChild(field('Clock', seg(
      [{ value: true, label: '12h' }, { value: false, label: '24h' }],
      widget.config.h12, (v) => { widget.config.h12 = v; save(); })));
    const rows = el('<div class="col"></div>');
    rows.appendChild(el('<div class="row-between"><span>Show seconds</span></div>')).appendChild(
      switchEl(widget.config.seconds, (v) => { widget.config.seconds = v; save(); }));
    rows.appendChild(el('<div class="row-between"><span>Show week number</span></div>')).appendChild(
      switchEl(widget.config.week, (v) => { widget.config.week = v; save(); }));
    host.appendChild(rows);
  }
});
