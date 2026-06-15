/* Tracker widget (docs/05 + V2 §22): starts empty; the user adds tracked items.
   Types: Count · Measure · Scale (user max 2–100) · Yes/No (multi-item) · Timer ·
   Text Note. Units always show beside numeric values. The internal view holds a
   history graph with Days/Weeks/Months, a "days tracked" stat, and a goal ring.
   Day-keyed `trackerDay` objects; each item is a value output. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg, promptText } from '../ui/components.js';
import { todayStr, dateAdd, dayObject, saveObject, fmtDate } from './base.js';

/* ---------- data ---------- */

function readDay(widget, dateStr) {
  const obj = store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'trackerDay' && o.date === dateStr);
  return obj?.data.values || {};
}
function rawValue(widget, t, dateStr) { return readDay(widget, dateStr)[t.id]; }
function setValue(widget, itemId, value, dateStr) {
  const obj = dayObject(widget.id, 'trackerDay', dateStr, { values: {} });
  obj.data.values[itemId] = value;
  saveObject(obj);
}
function isTracked(widget, t, dateStr) { return t.id in readDay(widget, dateStr); }

/** A single numeric reading for graphs / outputs / goal rings. */
function itemNumeric(widget, t, dateStr) {
  const v = rawValue(widget, t, dateStr);
  if (v == null) return 0;
  if (t.type === 'yesno') {
    if (typeof v === 'boolean') return v ? 100 : 0; // legacy single bool
    const items = t.items || [];
    if (!items.length) return 0;
    const done = items.filter(it => v[it.id]).length;
    return Math.round((done / items.length) * 100);
  }
  if (t.type === 'bool') return v ? 100 : 0;
  if (t.type === 'timer') return Math.round(((v.sec || 0) / 60) * 10) / 10; // minutes
  if (t.type === 'text') return v && String(v).trim() ? 1 : 0;
  return Number(v) || 0;
}

function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function timerElapsed(v) {
  if (!v) return 0;
  return (v.sec || 0) + (v.runningSince ? (Date.now() - v.runningSince) / 1000 : 0);
}

/* ---------- small parts ---------- */

/** A compact SVG progress ring (0–100%) with the percent in the middle. */
function goalRing(pct) {
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 10, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  const w = el(`<svg class="tr-ring" viewBox="0 0 26 26" width="26" height="26" aria-label="${pct}% of goal">
    <circle cx="13" cy="13" r="${r}" fill="none" stroke="var(--border)" stroke-width="3"></circle>
    <circle cx="13" cy="13" r="${r}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 13 13)"></circle>
    <text x="13" y="16" text-anchor="middle" font-size="8" fill="var(--text-soft)">${pct}</text></svg>`);
  return w;
}

/** Render one tracked item's interactive UI into `host`. `after` is called after
    any change so callers (the internal view) can refresh derived UI. */
function addItemUI(host, widget, t, dateStr, ctx, after = () => {}) {
  const commit = (v) => { setValue(widget, t.id, v, dateStr); after(); };

  // Yes/No renders a labelled checkbox per sub-item; everything else is one row.
  if (t.type === 'yesno') {
    const raw = rawValue(widget, t, dateStr);
    const state = typeof raw === 'boolean' ? null : (raw || {});
    const items = t.items?.length ? t.items : [{ id: t.id + '_a', label: t.name }];
    const group = el('<div class="tr-yesno"></div>');
    if (t.items?.length > 1) group.appendChild(el(`<div class="tr-group-name soft"></div>`)).textContent = t.name;
    for (const it of items) {
      const on = typeof raw === 'boolean' ? raw : !!state[it.id];
      const row = el(`<div class="tracker-row"><span class="tr-name"></span>
        <button class="btn-icon tr-check" style="color:${on ? 'var(--success)' : 'var(--text-soft)'}">${icon(on ? 'check-circle' : 'circle', 20)}</button></div>`);
      row.querySelector('.tr-name').textContent = it.label;
      row.querySelector('.tr-check').onclick = () => {
        const cur = rawValue(widget, t, dateStr);
        const next = (typeof cur === 'boolean' || cur == null) ? {} : { ...cur };
        next[it.id] = !next[it.id];
        commit(next);
      };
      group.appendChild(row);
    }
    host.appendChild(group);
    return;
  }

  const row = el(`<div class="tracker-row ${t.goal != null && itemNumeric(widget, t, dateStr) >= t.goal ? 'goal-met' : ''}">
    <span class="tr-name"></span><span class="tr-control row"></span></div>`);
  row.querySelector('.tr-name').textContent = t.name;
  const ctl = row.querySelector('.tr-control');
  const v = rawValue(widget, t, dateStr);

  if (t.type === 'count') {
    const num = el(`<span class="tr-value"></span>`);
    const unit = t.unit ? ` ${t.unit}` : '';
    const paint = () => { num.textContent = (Number(rawValue(widget, t, dateStr)) || 0) + unit; };
    const minus = el('<button class="btn-icon">−</button>');
    const plus = el('<button class="btn-icon">+</button>');
    minus.onclick = () => { commit(Math.max(0, (Number(rawValue(widget, t, dateStr)) || 0) - 1)); paint(); refreshRing(); };
    plus.onclick = () => { commit((Number(rawValue(widget, t, dateStr)) || 0) + 1); paint(); refreshRing(); };
    paint();
    ctl.append(minus, num, plus);
    let ringEl = null;
    const refreshRing = () => {
      if (t.goal == null) return;
      const fresh = goalRing(((Number(rawValue(widget, t, dateStr)) || 0) / t.goal) * 100);
      ringEl ? ringEl.replaceWith(fresh) : ctl.appendChild(fresh);
      ringEl = fresh;
    };
    refreshRing();
  } else if (t.type === 'measure') {
    const numIn = el('<input class="input tr-measure" type="number" step="any">');
    numIn.value = v ?? '';
    numIn.addEventListener('change', () => commit(numIn.value === '' ? 0 : Number(numIn.value)));
    ctl.append(numIn);
    if (t.unit) ctl.appendChild(el(`<span class="tr-unit"></span>`)).textContent = t.unit;
  } else if (t.type === 'scale') {
    const max = Math.max(2, Math.min(100, t.max || 10));
    const cur = Number(v) || 0;
    if (max <= 10) {
      for (let i = 1; i <= max; i++) {
        const dot = el(`<button class="tr-dot ${i <= cur ? 'on' : ''}" aria-label="${i}">${icon('flower', 13)}</button>`);
        dot.onclick = () => { const nv = i === cur ? 0 : i; commit(nv); };
        ctl.appendChild(dot);
      }
    } else {
      const range = el(`<input type="range" min="0" max="${max}" value="${cur}" class="tr-range">`);
      const lbl = el(`<span class="tr-value">${cur}/${max}</span>`);
      range.addEventListener('input', () => { lbl.textContent = `${range.value}/${max}`; });
      range.addEventListener('change', () => commit(Number(range.value)));
      ctl.append(range, lbl);
    }
  } else if (t.type === 'timer') {
    const disp = el(`<span class="tr-value tr-timer no-open"></span>`);
    const paint = () => { disp.textContent = fmtDuration(timerElapsed(rawValue(widget, t, dateStr))); };
    const btn = el(`<button class="btn-icon"></button>`);
    const isRun = () => !!rawValue(widget, t, dateStr)?.runningSince;
    const paintBtn = () => { btn.innerHTML = icon(isRun() ? 'pause' : 'play', 18); btn.style.color = isRun() ? 'var(--highlight)' : 'var(--text-soft)'; };
    btn.onclick = () => {
      const cur = rawValue(widget, t, dateStr) || { sec: 0, runningSince: null };
      const next = cur.runningSince
        ? { sec: (cur.sec || 0) + (Date.now() - cur.runningSince) / 1000, runningSince: null }
        : { sec: cur.sec || 0, runningSince: Date.now() };
      commit(next); paint(); paintBtn();
    };
    paint(); paintBtn();
    ctl.append(disp, btn);
    // live tick that cleans itself up once the element leaves the DOM
    const tick = setInterval(() => { if (!disp.isConnected) { clearInterval(tick); return; } if (isRun()) paint(); }, 1000);
  } else if (t.type === 'text') {
    const txt = el('<span class="tr-note no-open"></span>');
    txt.textContent = (v && String(v)) || '—';
    const edit = el(`<button class="btn-icon">${icon('edit', 15)}</button>`);
    const ask = async () => {
      const nv = await promptText({ title: t.name, label: 'Today’s note', value: v || '', confirmText: 'Save' });
      if (nv != null) commit(nv);
    };
    edit.onclick = ask;
    ctl.append(txt, edit);
  }
  host.appendChild(row);
}

/* ---------- internal history graph (V2 §22) ---------- */

const PERIODS = { days: { label: 'Days', n: 30, span: 1 }, weeks: { label: 'Weeks', n: 12, span: 7 }, months: { label: 'Months', n: 12 } };

function aggregate(widget, t, from, to) {
  // sum for Count; average of tracked days otherwise
  let sum = 0, tracked = 0;
  for (let d = from; d <= to; d = dateAdd(d, 1)) {
    if (!isTracked(widget, t, d)) continue;
    tracked++; sum += itemNumeric(widget, t, d);
  }
  if (!tracked) return 0;
  return t.type === 'count' ? sum : Math.round((sum / tracked) * 10) / 10;
}

function buildSeries(widget, t, periodKey) {
  const p = PERIODS[periodKey];
  const labels = [], vals = [];
  const today = todayStr();
  if (periodKey === 'days') {
    for (let i = p.n - 1; i >= 0; i--) {
      const d = dateAdd(today, -i);
      labels.push(d.slice(8)); vals.push(itemNumeric(widget, t, d));
    }
  } else if (periodKey === 'weeks') {
    for (let i = p.n - 1; i >= 0; i--) {
      const end = dateAdd(today, -i * 7), start = dateAdd(end, -6);
      labels.push(fmtDate(start)); vals.push(aggregate(widget, t, start, end));
    }
  } else {
    const base = new Date(today + 'T12:00:00');
    for (let i = p.n - 1; i >= 0; i--) {
      const dt = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const start = todayStr(dt), end = todayStr(new Date(dt.getFullYear(), dt.getMonth() + 1, 0));
      labels.push(dt.toLocaleDateString(undefined, { month: 'short' }));
      vals.push(aggregate(widget, t, start, end > today ? today : end));
    }
  }
  return { labels, vals };
}

function barCanvas(series, unitLabel) {
  const c = el('<canvas class="tr-graph" width="600" height="180"></canvas>');
  const g = c.getContext('2d');
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const accent = css('--accent'), soft = css('--text-soft'), border = css('--border');
  const W = 600, H = 180, padL = 34, padB = 22, padT = 10;
  const { labels, vals } = series;
  const max = Math.max(1, ...vals);
  g.clearRect(0, 0, W, H);
  // baseline + max gridline
  g.strokeStyle = border; g.lineWidth = 1;
  g.beginPath(); g.moveTo(padL, H - padB); g.lineTo(W - 6, H - padB); g.stroke();
  g.fillStyle = soft; g.font = '10px sans-serif'; g.textAlign = 'right';
  g.fillText(String(Math.round(max)), padL - 4, padT + 8);
  g.fillText('0', padL - 4, H - padB);
  const n = vals.length, gap = 2;
  const bw = (W - padL - 8 - gap * n) / n;
  for (let i = 0; i < n; i++) {
    const x = padL + i * (bw + gap), h = (vals[i] / max) * (H - padB - padT);
    g.fillStyle = vals[i] > 0 ? accent : border;
    g.fillRect(x, H - padB - h, bw, h);
    if (n <= 16 && i % Math.ceil(n / 16) === 0) {
      g.fillStyle = soft; g.font = '9px sans-serif'; g.textAlign = 'center';
      g.fillText(labels[i], x + bw / 2, H - padB + 11);
    }
  }
  return c;
}

function renderGraph(host, widget) {
  host.innerHTML = '';
  const items = widget.config.trackers || [];
  if (!items.length) return;
  let pick = items[0].id, period = 'days';

  const controls = el('<div class="tr-graph-controls row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"></div>');
  const sel = el('<select class="select" style="flex:1;min-width:120px"></select>');
  for (const t of items) sel.appendChild(new Option(t.name, t.id));
  const segHost = el('<span></span>');
  controls.append(sel, segHost);
  const body = el('<div></div>');
  host.append(controls, body);

  const draw = () => {
    const t = items.find(x => x.id === pick) || items[0];
    body.innerHTML = '';
    body.appendChild(barCanvas(buildSeries(widget, t, period), t.unit));
    // stats
    const p = PERIODS.days;
    let tracked = 0;
    for (let i = 0; i < p.n; i++) if (isTracked(widget, t, dateAdd(todayStr(), -i))) tracked++;
    const stats = el('<div class="tr-stats row" style="gap:14px;align-items:center;margin-top:10px;flex-wrap:wrap"></div>');
    stats.appendChild(el(`<span class="chip">Tracked ${tracked} of the last 30 days</span>`));
    if (t.goal != null && (t.type === 'count' || t.type === 'measure' || t.type === 'scale')) {
      const ringWrap = el('<span class="row" style="gap:6px;align-items:center"></span>');
      ringWrap.appendChild(goalRing((itemNumeric(widget, t, todayStr()) / t.goal) * 100));
      ringWrap.appendChild(el(`<span class="soft" style="font-size:0.8rem">of today’s goal (${t.goal}${t.unit ? ' ' + t.unit : ''})</span>`));
      stats.appendChild(ringWrap);
    }
    body.appendChild(stats);
  };
  sel.onchange = () => { pick = sel.value; draw(); };
  segHost.appendChild(seg(Object.entries(PERIODS).map(([value, p]) => ({ value, label: p.label })), period, (v) => { period = v; draw(); }));
  draw();
}

/* ---------- widget ---------- */

registry.register({
  type: 'tracker',
  name: 'Tracker',
  icon: 'activity',
  description: 'Track counts, measures, scales, yes/no, timers',
  external: true, internal: true,
  defaultConfig: () => ({ trackers: [] }), // V2 §22: starts empty

  outputs: (widget) => (widget.config.trackers || []).map(t => ({
    key: t.id, name: t.name, dayKeyed: true,
    get: (d) => itemNumeric(widget, t, d || todayStr())
  })),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const today = todayStr();
    const items = widget.config.trackers || [];
    if (!items.length) {
      const empty = el('<div class="tr-empty"><p class="soft" style="margin-bottom:8px">Nothing tracked yet.</p></div>');
      const add = el(`<button class="btn">${icon('plus', 14)} Track something</button>`);
      add.onclick = () => ctx.openWidgetSettings(widget);
      empty.appendChild(add);
      host.appendChild(empty);
      return;
    }
    for (const t of items) addItemUI(host, widget, t, today, ctx);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    let date = todayStr();
    const nav = el(`<div class="row" style="justify-content:center;margin-bottom:14px">
      <button class="btn-icon">${icon('chevron-left', 18)}</button>
      <strong class="d-label" style="min-width:110px;text-align:center"></strong>
      <button class="btn-icon">${icon('chevron-right', 18)}</button></div>`);
    const dayHost = el('<div class="panel" style="padding:12px;margin-bottom:18px"></div>');
    const items = widget.config.trackers || [];
    const renderDay = () => {
      nav.querySelector('.d-label').textContent = date === todayStr() ? 'Today' : fmtDate(date);
      dayHost.innerHTML = '';
      if (!items.length) { dayHost.appendChild(el('<p class="soft">Add a tracked item in this widget’s ··· → Edit.</p>')); return; }
      for (const t of items) addItemUI(dayHost, widget, t, date, ctx, () => { renderDay(); renderGraph(graphHost, widget); });
    };
    nav.querySelectorAll('button')[0].onclick = () => { date = dateAdd(date, -1); renderDay(); };
    nav.querySelectorAll('button')[1].onclick = () => { if (date < todayStr()) { date = dateAdd(date, 1); renderDay(); } };
    renderDay();
    host.append(nav, dayHost);

    if (items.length) {
      host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:8px">HISTORY</h3>'));
      const graphHost = el('<div class="panel" style="padding:12px"></div>');
      host.appendChild(graphHost);
      renderGraph(graphHost, widget);
    }
  },

  renderSettings(host, widget, ctx) {
    const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
    const list = el('<div></div>');

    const render = () => {
      list.innerHTML = '';
      for (const [i, t] of (widget.config.trackers || []).entries()) {
        const row = el(`<div class="panel" style="padding:10px;margin-bottom:8px">
          <div class="row"><input class="input t-name" style="flex:1"><button class="btn-icon t-del">${icon('trash', 15)}</button></div>
          <div class="t-type" style="margin-top:8px"></div>
          <div class="t-opts row" style="margin-top:8px;flex-wrap:wrap;gap:6px"></div></div>`);
        const nameIn = row.querySelector('.t-name');
        nameIn.value = t.name;
        nameIn.addEventListener('change', () => { t.name = nameIn.value; save(); });
        row.querySelector('.t-del').onclick = () => { widget.config.trackers.splice(i, 1); save(); render(); };
        row.querySelector('.t-type').appendChild(seg([
          { value: 'count', label: 'Count' }, { value: 'measure', label: 'Measure' },
          { value: 'scale', label: 'Scale' }, { value: 'yesno', label: 'Yes/No' },
          { value: 'timer', label: 'Timer' }, { value: 'text', label: 'Text' }
        ], t.type === 'bool' ? 'yesno' : t.type, (v) => {
          t.type = v;
          if (v === 'yesno' && !t.items?.length) t.items = [{ id: ulid(), label: t.name }];
          if (v === 'scale' && t.max == null) t.max = 10;
          save(); render();
        }));
        const opts = row.querySelector('.t-opts');
        if (t.type === 'count' || t.type === 'measure') {
          const unitIn = input(t.unit || '', 'unit (cups, kg…)'); unitIn.style.width = '120px';
          unitIn.addEventListener('change', () => { t.unit = unitIn.value || null; save(); });
          opts.appendChild(unitIn);
        }
        if (t.type === 'count' || t.type === 'measure' || t.type === 'scale') {
          const goalIn = input(t.goal ?? '', 'goal'); goalIn.type = 'number'; goalIn.style.width = '90px';
          goalIn.addEventListener('change', () => { t.goal = goalIn.value === '' ? null : Number(goalIn.value); save(); });
          opts.appendChild(goalIn);
        }
        if (t.type === 'scale') {
          const maxIn = input(t.max || 10, 'max'); maxIn.type = 'number'; maxIn.min = 2; maxIn.max = 100; maxIn.style.width = '80px';
          maxIn.addEventListener('change', () => { t.max = Math.max(2, Math.min(100, Number(maxIn.value) || 10)); save(); });
          opts.appendChild(field('Scale max', maxIn));
        }
        if (t.type === 'yesno') opts.appendChild(yesnoEditor(t, save));
        list.appendChild(row);
      }
    };
    render();
    host.appendChild(list);

    const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add tracked item</button>`);
    add.onclick = () => {
      widget.config.trackers = widget.config.trackers || [];
      widget.config.trackers.push({ id: ulid(), name: 'New item', type: 'count', unit: null, goal: null });
      save();
      render();
    };
    host.appendChild(add);
  }
});

/** Editor for a Yes/No item's labelled sub-items. */
function yesnoEditor(t, save) {
  t.items = t.items?.length ? t.items : [{ id: ulid(), label: t.name }];
  const wrap = el('<div class="tr-yesno-editor" style="width:100%"><div class="yn-list"></div></div>');
  const listEl = wrap.querySelector('.yn-list');
  const render = () => {
    listEl.innerHTML = '';
    for (const [i, it] of t.items.entries()) {
      const r = el(`<div class="row" style="margin-bottom:6px"><input class="input" style="flex:1"><button class="btn-icon">${icon('trash', 14)}</button></div>`);
      const inp = r.querySelector('input');
      inp.value = it.label;
      inp.addEventListener('change', () => { it.label = inp.value; save(); });
      r.querySelector('.btn-icon').onclick = () => { if (t.items.length > 1) { t.items.splice(i, 1); save(); render(); } };
      listEl.appendChild(r);
    }
  };
  render();
  const add = el(`<button class="btn" style="width:100%">${icon('plus', 13)} Add yes/no item</button>`);
  add.onclick = () => { t.items.push({ id: ulid(), label: 'Item' }); save(); render(); };
  wrap.appendChild(add);
  return wrap;
}
