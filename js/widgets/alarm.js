/* Alarm / Timer widget (docs/05): alarms, countdown timers, pomodoro mode
   whose session count is a value output. PWA honesty: alarms only fire while
   the app is open — said plainly in settings copy. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input, toast } from '../ui/components.js';
import { todayStr, dayObject, saveObject } from './base.js';

let watcher = null;
const timers = new Map(); // widgetId -> { end, label, interval }

function chime(label) {
  try {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const gain = ac.createGain();
    o.connect(gain).connect(ac.destination);
    o.frequency.value = 740;
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.4);
    o.start();
    o.stop(ac.currentTime + 1.5);
  } catch { /* audio blocked until interaction */ }
  if (Notification?.permission === 'granted') new Notification('The Blossom', { body: label });
  toast(label, 'bell');
}

function ensureWatcher() {
  if (watcher) return;
  watcher = setInterval(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    for (const w of store.all('widgets')) {
      if (w.type !== 'alarm') continue;
      for (const a of (w.config.alarms || [])) {
        if (!a.on || a.time !== hhmm) continue;
        if (a.days?.length && !a.days.includes(now.getDay())) continue;
        if (a.lastFired === todayStr() + hhmm) continue;
        a.lastFired = todayStr() + hhmm;
        store.put('widgets', w);
        chime(a.label || 'Alarm');
      }
    }
  }, 20000);
}

registry.register({
  type: 'alarm',
  name: 'Alarm / Timer',
  icon: 'timer',
  description: 'Alarms, countdowns, pomodoro',
  external: true, internal: false,
  defaultConfig: () => ({ alarms: [], pomo: { work: 25, rest: 5, running: false } }),

  outputs: (widget) => [{
    key: 'pomodoros', name: 'Pomodoro sessions', dayKeyed: true,
    get: (d) => {
      const obj = store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'pomoDay' && o.date === (d || todayStr()));
      return obj?.data.count || 0;
    }
  }],

  renderCard(host, widget, ctx) {
    ensureWatcher();
    host.innerHTML = '';
    const cfg = widget.config;

    // --- alarms ---
    const alarmsEl = el('<div class="al-list"></div>');
    const renderAlarms = () => {
      alarmsEl.innerHTML = '';
      for (const [i, a] of (cfg.alarms || []).entries()) {
        const row = el(`<div class="row" style="padding:5px 0">
          <strong style="font-variant-numeric:tabular-nums">${a.time}</strong>
          <span class="soft grow" style="font-size:0.82rem">${a.label || ''}${a.days?.length ? ' · ' + a.days.map(d => 'SMTWTFS'[d]).join('') : ''}</span>
          <label class="switch"><input type="checkbox" ${a.on ? 'checked' : ''}><span class="knob"></span></label>
          <button class="btn-icon">${icon('x', 13)}</button></div>`);
        row.querySelector('input[type=checkbox]').onchange = (e) => { a.on = e.target.checked; store.put('widgets', widget); };
        row.querySelector('.btn-icon').onclick = () => { cfg.alarms.splice(i, 1); store.put('widgets', widget); renderAlarms(); };
        alarmsEl.appendChild(row);
      }
    };
    renderAlarms();
    const addAlarm = el(`<div class="row" style="margin:4px 0 10px"><input class="input" type="time" style="flex:1"><input class="input" placeholder="label" style="flex:1"><button class="btn">${icon('plus', 14)}</button></div>`);
    addAlarm.querySelector('.btn').onclick = () => {
      const [t, l] = addAlarm.querySelectorAll('input');
      if (!t.value) return;
      cfg.alarms.push({ id: ulid(), time: t.value, label: l.value, days: [], on: true });
      store.put('widgets', widget);
      if (Notification && Notification.permission === 'default') Notification.requestPermission();
      renderAlarms();
    };

    // --- countdown timer ---
    const timerEl = el(`<div class="row" style="margin-bottom:10px">
      <input class="input" type="number" placeholder="min" style="width:80px">
      <button class="btn grow">${icon('timer', 14)} Start timer</button>
      <strong class="t-left" style="font-variant-numeric:tabular-nums;min-width:54px;text-align:right"></strong></div>`);
    const leftEl = timerEl.querySelector('.t-left');
    const tickTimer = () => {
      const t = timers.get(widget.id);
      if (!t) { leftEl.textContent = ''; return; }
      const left = Math.max(0, t.end - Date.now());
      leftEl.textContent = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
      if (left <= 0) {
        clearInterval(t.interval);
        timers.delete(widget.id);
        chime(t.label);
        if (t.pomo) onPomoEnd();
      }
    };
    timerEl.querySelector('.btn').onclick = () => {
      const mins = Number(timerEl.querySelector('input').value);
      if (!mins) return;
      startTimer(mins, 'Timer finished — gently.', false);
    };
    const startTimer = (mins, label, pomo) => {
      const prev = timers.get(widget.id);
      if (prev) clearInterval(prev.interval);
      const t = { end: Date.now() + mins * 60000, label, pomo, interval: setInterval(tickTimer, 500) };
      timers.set(widget.id, t);
      tickTimer();
    };

    // --- pomodoro ---
    const pomoEl = el(`<div class="row">
      <span class="chip">${icon('clock', 11)} pomodoro</span>
      <span class="soft" style="font-size:0.8rem">${cfg.pomo.work}m + ${cfg.pomo.rest}m</span>
      <span class="grow"></span>
      <span class="chip accent p-count"></span>
      <button class="btn p-go">Focus</button></div>`);
    const countChip = pomoEl.querySelector('.p-count');
    const showCount = () => {
      const obj = store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'pomoDay' && o.date === todayStr());
      countChip.textContent = `${obj?.data.count || 0} today`;
    };
    showCount();
    let inWork = true;
    const onPomoEnd = () => {
      if (inWork) {
        const obj = dayObject(widget.id, 'pomoDay', todayStr(), { count: 0 });
        obj.data.count += 1;
        saveObject(obj);
        showCount();
        inWork = false;
        startTimer(cfg.pomo.rest, 'Break over — back when ready.', true);
      } else {
        inWork = true;
        startTimer(cfg.pomo.work, 'Focus block done — take your break.', true);
      }
    };
    pomoEl.querySelector('.p-go').onclick = () => { inWork = true; startTimer(cfg.pomo.work, 'Focus block done — take your break.', true); };

    host.append(alarmsEl, addAlarm, timerEl, pomoEl);
  },

  renderSettings(host, widget, ctx) {
    const cfg = widget.config;
    const w = input(String(cfg.pomo.work)); w.type = 'number';
    w.addEventListener('change', () => { cfg.pomo.work = Number(w.value) || 25; store.put('widgets', widget); });
    host.appendChild(field('Pomodoro focus (minutes)', w));
    const r = input(String(cfg.pomo.rest)); r.type = 'number';
    r.addEventListener('change', () => { cfg.pomo.rest = Number(r.value) || 5; store.put('widgets', widget); });
    host.appendChild(field('Pomodoro break (minutes)', r));
    host.appendChild(el('<p class="soft" style="font-size:0.8rem">Honest note: as a web app, alarms and timers only ring while The Blossom is open. For wake-up alarms, your phone’s clock is the safer gardener.</p>'));
  }
});
