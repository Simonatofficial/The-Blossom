/* Tracker widget (docs/05): daily values — count, measure, scale, boolean.
   Day-keyed trackerDay objects; each tracker is a value output. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg } from '../ui/components.js';
import { todayStr, dateAdd, dayObject, saveObject, fmtDate } from './base.js';

function readDay(widget, dateStr) {
  const obj = store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'trackerDay' && o.date === dateStr);
  return obj?.data.values || {};
}

function setValue(widget, trackerId, value, dateStr) {
  const obj = dayObject(widget.id, 'trackerDay', dateStr, { values: {} });
  obj.data.values[trackerId] = value;
  saveObject(obj);
}

function trackerRow(widget, t, dateStr, onChange) {
  const values = readDay(widget, dateStr);
  const v = values[t.id] ?? (t.type === 'bool' ? false : 0);
  const row = el(`<div class="tracker-row ${t.goal != null && Number(v) >= t.goal ? 'goal-met' : ''}">
    <span class="tr-name"></span><span class="tr-control row"></span></div>`);
  row.querySelector('.tr-name').textContent = t.name + (t.unit ? ` (${t.unit})` : '');
  const ctl = row.querySelector('.tr-control');

  if (t.type === 'count') {
    const step = (d) => { onChange(Math.max(0, Number(readDay(widget, dateStr)[t.id] || 0) + d)); };
    const minus = el('<button class="btn-icon">−</button>');
    const plus = el('<button class="btn-icon">+</button>');
    const num = el(`<span class="tr-value">${v}</span>`);
    minus.onclick = () => { step(-1); num.textContent = readDay(widget, dateStr)[t.id] || 0; };
    plus.onclick = () => { step(1); num.textContent = readDay(widget, dateStr)[t.id] || 0; };
    ctl.append(minus, num, plus);
  } else if (t.type === 'scale') {
    const max = t.max || 5;
    for (let i = 1; i <= max; i++) {
      const dot = el(`<button class="tr-dot ${i <= v ? 'on' : ''}" aria-label="${i}">${icon('flower', 13)}</button>`);
      dot.onclick = () => {
        onChange(i === Number(v) ? 0 : i);
        [...ctl.children].forEach((d, j) => d.classList.toggle('on', j < (i === Number(v) ? 0 : i)));
      };
      ctl.appendChild(dot);
    }
  } else if (t.type === 'bool') {
    const sw = el(`<button class="btn-icon" style="color:${v ? 'var(--success)' : 'var(--text-soft)'}">${icon(v ? 'check-circle' : 'circle', 20)}</button>`);
    sw.onclick = () => {
      const nv = !(readDay(widget, dateStr)[t.id] || false);
      onChange(nv);
      sw.style.color = nv ? 'var(--success)' : 'var(--text-soft)';
      sw.innerHTML = icon(nv ? 'check-circle' : 'circle', 20);
    };
    ctl.appendChild(sw);
  } else { // measure
    const num = el('<input class="input tr-measure" type="number" step="any">');
    num.value = v || '';
    num.addEventListener('change', () => onChange(Number(num.value) || 0));
    ctl.appendChild(num);
  }
  return row;
}

function sparkline(widget, t) {
  const c = el('<canvas class="tr-spark" width="560" height="80"></canvas>');
  const g = c.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const pts = [];
  for (let i = 29; i >= 0; i--) {
    pts.push(Number(readDay(widget, dateAdd(todayStr(), -i))[t.id] || 0));
  }
  const max = Math.max(1, ...pts);
  g.strokeStyle = accent;
  g.lineWidth = 2;
  g.beginPath();
  pts.forEach((p, i) => {
    const x = 6 + (i / 29) * 548;
    const y = 72 - (p / max) * 62;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.stroke();
  return c;
}

registry.register({
  type: 'tracker',
  name: 'Tracker',
  icon: 'activity',
  description: 'Track daily numbers, scales, and yes/nos',
  external: true, internal: true,
  defaultConfig: () => ({
    trackers: [
      { id: ulid(), name: 'Water', type: 'count', unit: 'cups', goal: 8 },
      { id: ulid(), name: 'Mood', type: 'scale', max: 5, goal: null }
    ]
  }),

  outputs: (widget) => (widget.config.trackers || []).map(t => ({
    key: t.id, name: t.name, dayKeyed: true,
    get: (d) => Number(readDay(widget, d || todayStr())[t.id] || 0)
  })),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const today = todayStr();
    for (const t of widget.config.trackers || []) {
      host.appendChild(trackerRow(widget, t, today, (v) => setValue(widget, t.id, v, today)));
    }
    if (!(widget.config.trackers || []).length) {
      host.appendChild(el('<p class="soft">Add trackers in this widget’s settings.</p>'));
    }
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    let date = todayStr();
    const nav = el(`<div class="row" style="justify-content:center;margin-bottom:14px">
      <button class="btn-icon">${icon('chevron-left', 18)}</button>
      <strong class="d-label" style="min-width:110px;text-align:center"></strong>
      <button class="btn-icon">${icon('chevron-right', 18)}</button></div>`);
    const dayHost = el('<div class="panel" style="padding:12px;margin-bottom:18px"></div>');
    const renderDay = () => {
      nav.querySelector('.d-label').textContent = date === todayStr() ? 'Today' : fmtDate(date);
      dayHost.innerHTML = '';
      for (const t of widget.config.trackers || []) {
        dayHost.appendChild(trackerRow(widget, t, date, (v) => setValue(widget, t.id, v, date)));
      }
    };
    nav.querySelectorAll('button')[0].onclick = () => { date = dateAdd(date, -1); renderDay(); };
    nav.querySelectorAll('button')[1].onclick = () => { if (date < todayStr()) { date = dateAdd(date, 1); renderDay(); } };
    renderDay();
    host.append(nav, dayHost);

    host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:8px">LAST 30 DAYS</h3>'));
    for (const t of widget.config.trackers || []) {
      const block = el('<div style="margin-bottom:14px"><div class="soft" style="font-size:0.82rem"></div></div>');
      block.querySelector('div').textContent = t.name;
      block.appendChild(sparkline(widget, t));
      host.appendChild(block);
    }
  },

  renderSettings(host, widget, ctx) {
    const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
    const list = el('<div></div>');

    const render = () => {
      list.innerHTML = '';
      for (const [i, t] of (widget.config.trackers || []).entries()) {
        const row = el(`<div class="panel" style="padding:10px;margin-bottom:8px">
          <div class="row"><input class="input t-name" style="flex:1"><button class="btn-icon">${icon('trash', 15)}</button></div>
          <div class="row" style="margin-top:8px;flex-wrap:wrap"><span class="t-type"></span>
          <input class="input t-unit" placeholder="unit" style="width:80px">
          <input class="input t-goal" type="number" placeholder="goal" style="width:80px"></div></div>`);
        const nameIn = row.querySelector('.t-name');
        nameIn.value = t.name;
        nameIn.addEventListener('change', () => { t.name = nameIn.value; save(); });
        row.querySelector('.btn-icon').onclick = () => { widget.config.trackers.splice(i, 1); save(); render(); };
        row.querySelector('.t-type').appendChild(seg([
          { value: 'count', label: 'Count' }, { value: 'measure', label: 'Measure' },
          { value: 'scale', label: 'Scale' }, { value: 'bool', label: 'Yes/no' }
        ], t.type, (v) => { t.type = v; save(); }));
        const unitIn = row.querySelector('.t-unit');
        unitIn.value = t.unit || '';
        unitIn.addEventListener('change', () => { t.unit = unitIn.value || null; save(); });
        const goalIn = row.querySelector('.t-goal');
        goalIn.value = t.goal ?? '';
        goalIn.addEventListener('change', () => { t.goal = goalIn.value === '' ? null : Number(goalIn.value); save(); });
        list.appendChild(row);
      }
    };
    render();
    host.appendChild(list);

    const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add tracker</button>`);
    add.onclick = () => {
      widget.config.trackers.push({ id: ulid(), name: 'New tracker', type: 'count', unit: null, goal: null });
      save();
      render();
    };
    host.appendChild(add);
  }
});
