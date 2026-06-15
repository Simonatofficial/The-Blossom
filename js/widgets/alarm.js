/* Alarm widget (docs/05 + V2 §12a). Alarms (12h only), multiple simultaneous
   timers, and a stopwatch — managed in the internal view; the card shows the
   next alarm, running timers, and the stopwatch. Profiles bundle sound/volume/
   fade/vibrate + optional pre-alarm and post-alarm "are you awake?" checks.
   Alarms fire as in-app notifications (name · +5 / +10 / Dismiss). PWA honesty:
   they only ring while The Blossom is open. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg, toast, popMenu, confirmDialog } from '../ui/components.js';
import { todayStr, dayObject, saveObject } from './base.js';

let watcher = null;
const stopwatches = new Map(); // widgetId -> { running, base, startedAt, laps }
const timerRuns = new Map();   // runId -> { widgetId, name, endAt, profileId }

const pad = (n) => String(n).padStart(2, '0');
function to12h(hhmm) { if (!hhmm) return ''; let [h, m] = hhmm.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; }
function minsUntil(hhmm) { const now = new Date(); const [h, m] = hhmm.split(':').map(Number); let t = new Date(now); t.setHours(h, m, 0, 0); if (t <= now) t.setDate(t.getDate() + 1); return Math.round((t - now) / 60000); }
function profileOf(widget, id) { return (widget.config.profiles || []).find(p => p.id === id) || null; }

function chime(profile) {
  const vol = profile ? (profile.volume ?? 80) / 100 : 0.12;
  const loops = profile?.loop ? 3 : 1;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    for (let k = 0; k < loops; k++) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g).connect(ac.destination); o.frequency.value = 740;
      const t0 = ac.currentTime + k * 1.6, fade = (profile?.fadeIn || 0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.01, vol * 0.5), t0 + (fade ? Math.min(fade, 1.2) : 0.03));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
      o.start(t0); o.stop(t0 + 1.5);
    }
  } catch { /* audio blocked until interaction */ }
  if (profile?.vibrate && profile.vibrate !== 'off') navigator.vibrate?.({ soft: 80, medium: [120, 60, 120], strong: [200, 80, 200, 80, 200] }[profile.vibrate] || 80);
}

function bannerHost() { let h = document.getElementById('alarm-banners'); if (!h) { h = el('<div id="alarm-banners"></div>'); document.body.appendChild(h); } return h; }
function fireAlarm(widget, alarm) {
  const profile = profileOf(widget, alarm.profileId);
  chime(profile);
  const b = el(`<div class="alarm-banner"><div class="ab-main"><strong class="ab-name"></strong><span class="ab-time soft"></span></div>
    <div class="ab-actions"><button class="btn ab5">+5</button><button class="btn ab10">+10</button><button class="btn btn-primary ab-x">Dismiss</button></div></div>`);
  b.querySelector('.ab-name').textContent = alarm.name || 'Alarm';
  b.querySelector('.ab-time').textContent = to12h(alarm.time);
  const snooze = (mins) => { alarm.snoozeAt = Date.now() + mins * 60000; store.put('widgets', widget); b.remove(); toast(`Snoozed ${mins} min`, 'bell'); };
  b.querySelector('.ab5').onclick = () => snooze(5);
  b.querySelector('.ab10').onclick = () => snooze(10);
  b.querySelector('.ab-x').onclick = () => {
    b.remove();
    if (profile?.post?.after) setTimeout(() => { if (confirm('Are you awake?')) return; fireAlarm(widget, { ...alarm, name: (alarm.name || 'Alarm') + ' (still asleep?)' }); }, profile.post.after * 60000);
  };
  bannerHost().appendChild(b);
}

function dayMatch(a, dow, today) {
  if (a.everyN) { const base = new Date((a.startDate || today) + 'T12:00:00'); const days = Math.round((new Date(today + 'T12:00:00') - base) / 86400000); return days >= 0 && days % a.everyN === 0; }
  if (a.days?.length) return a.days.includes(dow);
  return true; // no days set → every day
}

function ensureWatcher() {
  if (watcher) return;
  watcher = setInterval(() => {
    const now = new Date(); const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`; const today = todayStr(); const dow = now.getDay();
    for (const w of store.all('widgets')) {
      if (w.type !== 'alarm') continue;
      for (const a of (w.config.alarms || [])) {
        if (a.snoozeAt && Date.now() >= a.snoozeAt) { a.snoozeAt = null; store.put('widgets', w); fireAlarm(w, a); continue; }
        if (!a.on) continue;
        const profile = profileOf(w, a.profileId);
        if (profile?.pre?.min) { // pre-alarm
          const [h, m] = a.time.split(':').map(Number); const pre = new Date(now); pre.setHours(h, m - profile.pre.min, 0, 0);
          const preHHMM = `${pad(pre.getHours())}:${pad(pre.getMinutes())}`;
          if (preHHMM === hhmm && dayMatch(a, dow, today) && a.preFired !== today) { a.preFired = today; store.put('widgets', w); chime({ ...profile, volume: profile.pre.volume ?? profile.volume }); toast(`${a.name || 'Alarm'} in ${profile.pre.min} min`, 'bell'); }
        }
        if (a.time === hhmm && dayMatch(a, dow, today) && a.lastFired !== today + hhmm) { a.lastFired = today + hhmm; store.put('widgets', w); fireAlarm(w, a); }
      }
    }
    // timers
    for (const [runId, t] of [...timerRuns]) if (Date.now() >= t.endAt) { timerRuns.delete(runId); const w = store.get('widgets', t.widgetId); fireTimer(w, t); }
  }, 5000);
}
function fireTimer(widget, t) { const profile = profileOf(widget, t.profileId); chime(profile); const b = el(`<div class="alarm-banner"><div class="ab-main"><strong></strong><span class="soft">Timer finished</span></div><div class="ab-actions"><button class="btn btn-primary">OK</button></div></div>`); b.querySelector('strong').textContent = t.name || 'Timer'; b.querySelector('button').onclick = () => b.remove(); bannerHost().appendChild(b); }

/* ---------- card ---------- */
function nextAlarm(widget) {
  const on = (widget.config.alarms || []).filter(a => a.on);
  if (!on.length) return null;
  return on.map(a => ({ a, mins: minsUntil(a.time) })).sort((x, y) => x.mins - y.mins)[0];
}

registry.register({
  type: 'alarm',
  name: 'Alarm',
  icon: 'timer',
  description: 'Alarms, timers & a stopwatch',
  external: true, internal: true,
  defaultConfig: () => ({ alarms: [], timers: [], profiles: [{ id: 'default', name: 'Default', color: '#a78bfa', volume: 80, fadeIn: 0, vibrate: 'soft', loop: false }], pomo: { work: 25, rest: 5 } }),

  outputs: (widget) => [{ key: 'pomodoros', name: 'Pomodoro sessions', dayKeyed: true, get: (d) => store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'pomoDay' && o.date === (d || todayStr()))?.data.count || 0 }],

  renderCard(host, widget, ctx) {
    ensureWatcher();
    host.innerHTML = '';
    const next = nextAlarm(widget);
    const runs = [...timerRuns.values()].filter(t => t.widgetId === widget.id);
    const sw = stopwatches.get(widget.id);
    const card = el('<div class="alarm-card"></div>');
    card.appendChild(el(`<div class="row-between"><span class="soft" style="font-size:0.82rem">${(widget.config.alarms || []).length} alarm${(widget.config.alarms || []).length === 1 ? '' : 's'}</span><span class="chip">${icon('plus', 11)} manage</span></div>`));
    if (next) card.appendChild(el(`<div class="al-next"><strong style="font-size:1.3rem">${to12h(next.a.time)}</strong> <span class="soft">${next.a.name || ''} · in ${next.mins < 60 ? next.mins + 'm' : Math.round(next.mins / 60) + 'h'}</span></div>`));
    else card.appendChild(el('<p class="soft" style="font-size:0.86rem;margin-top:6px">No alarms set — tap to add one.</p>'));
    if (runs.length) { const r = runs.sort((a, b) => a.endAt - b.endAt)[0]; card.appendChild(el(`<div class="soft" style="font-size:0.82rem;margin-top:4px">${icon('timer', 11)} ${runs.length} timer${runs.length === 1 ? '' : 's'} · next ${Math.ceil((r.endAt - Date.now()) / 60000)}m</div>`)); }
    if (sw?.running) card.appendChild(el('<div class="soft" style="font-size:0.82rem;margin-top:4px">⏱ stopwatch running</div>'));
    host.appendChild(card);
  },

  renderFull(host, widget, ctx) {
    ensureWatcher();
    const save = () => store.put('widgets', widget);
    let tab = 'alarms';
    host.innerHTML = '';
    const tabsEl = el('<div class="seg" style="margin-bottom:12px"></div>');
    const body = el('<div></div>');
    host.append(tabsEl, body);
    const buildTabs = () => { tabsEl.innerHTML = ''; for (const [t, l] of [['alarms', 'Alarms'], ['timers', 'Timers'], ['stopwatch', 'Stopwatch'], ['profiles', 'Profiles']]) { const b = el(`<button type="button" class="${tab === t ? 'active' : ''}">${l}</button>`); b.onclick = () => { tab = t; buildTabs(); render(); }; tabsEl.appendChild(b); } };

    const render = () => {
      body.innerHTML = '';
      if (tab === 'alarms') renderAlarms();
      else if (tab === 'timers') renderTimers();
      else if (tab === 'stopwatch') renderStopwatch();
      else renderProfiles();
    };

    const renderAlarms = () => {
      for (const [i, a] of (widget.config.alarms || []).entries()) {
        const profile = profileOf(widget, a.profileId);
        const row = el(`<div class="panel" style="padding:10px;margin-bottom:8px">
          <div class="row-between"><strong style="font-size:1.15rem">${to12h(a.time)}</strong>
            <label class="switch"><input type="checkbox" ${a.on ? 'checked' : ''}><span class="knob"></span></label></div>
          <div class="soft" style="font-size:0.8rem;margin-top:4px">${a.name || 'Alarm'}${a.everyN ? ` · every ${a.everyN}d` : a.days?.length ? ' · ' + a.days.map(d => 'SMTWTFS'[d]).join('') : ' · every day'}${profile ? ` · ${profile.name}` : ''}</div>
          <div class="row" style="gap:6px;margin-top:6px"></div></div>`);
        row.querySelector('input').onchange = (e) => { a.on = e.target.checked; save(); };
        const acts = row.querySelector('.row');
        const days = el('<div class="row" style="flex-wrap:wrap;gap:4px;flex:1"></div>');
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((n, di) => { const b = el(`<button class="chip ${a.days?.includes(di) ? 'accent' : ''}" style="cursor:pointer;padding:2px 7px">${n}</button>`); b.onclick = () => { a.days = a.days || []; a.days.includes(di) ? a.days = a.days.filter(x => x !== di) : a.days.push(di); a.everyN = null; save(); render(); }; days.appendChild(b); });
        acts.appendChild(days);
        const prof = el('<select class="select" style="max-width:120px"></select>'); for (const p of widget.config.profiles) prof.appendChild(new Option(p.name, p.id)); prof.value = a.profileId || ''; prof.onchange = () => { a.profileId = prof.value; save(); render(); };
        acts.appendChild(prof);
        const del = el(`<button class="btn-icon">${icon('trash', 14)}</button>`); del.onclick = () => { widget.config.alarms.splice(i, 1); save(); render(); }; acts.appendChild(del);
        body.appendChild(row);
      }
      const add = el(`<div class="row" style="gap:6px;margin-top:6px"><input class="input" type="time" style="flex:1"><input class="input" placeholder="name" style="flex:1"><button class="btn">${icon('plus', 14)} Add</button></div>`);
      add.querySelector('.btn').onclick = () => { const [t, n] = add.querySelectorAll('input'); if (!t.value) return; widget.config.alarms.push({ id: ulid(), time: t.value, name: n.value, days: [], everyN: null, on: true, profileId: widget.config.profiles[0]?.id }); save(); render(); };
      body.appendChild(add);
    };

    const renderTimers = () => {
      for (const [runId, t] of [...timerRuns].filter(([, x]) => x.widgetId === widget.id)) {
        const left = Math.max(0, t.endAt - Date.now());
        const row = el(`<div class="panel row-between" style="padding:10px;margin-bottom:8px"><span></span><strong class="t-left" style="font-variant-numeric:tabular-nums"></strong><button class="btn-icon">${icon('x', 14)}</button></div>`);
        row.querySelector('span').textContent = t.name || 'Timer';
        const lbl = row.querySelector('.t-left');
        const tick = setInterval(() => { if (!lbl.isConnected || !timerRuns.has(runId)) { clearInterval(tick); return; } const l = Math.max(0, t.endAt - Date.now()); lbl.textContent = `${pad(Math.floor(l / 3600000))}:${pad(Math.floor(l % 3600000 / 60000))}:${pad(Math.floor(l % 60000 / 1000))}`; }, 250);
        lbl.textContent = `${pad(Math.floor(left / 3600000))}:${pad(Math.floor(left % 3600000 / 60000))}:${pad(Math.floor(left % 60000 / 1000))}`;
        row.querySelector('.btn-icon').onclick = () => { timerRuns.delete(runId); render(); };
        body.appendChild(row);
      }
      const add = el(`<div class="panel" style="padding:10px"><div class="row" style="gap:6px"><input class="input t-h" type="number" min="0" placeholder="h" style="width:56px"><input class="input t-m" type="number" min="0" placeholder="m" style="width:56px"><input class="input t-s" type="number" min="0" placeholder="s" style="width:56px"><input class="input t-n" placeholder="name" style="flex:1"></div><button class="btn btn-primary" style="width:100%;margin-top:8px">${icon('timer', 14)} Start timer</button></div>`);
      add.querySelector('.btn').onclick = () => { const h = +add.querySelector('.t-h').value || 0, m = +add.querySelector('.t-m').value || 0, s = +add.querySelector('.t-s').value || 0; const sec = h * 3600 + m * 60 + s; if (!sec) { toast('Set a duration.', 'info'); return; } timerRuns.set(ulid(), { widgetId: widget.id, name: add.querySelector('.t-n').value, endAt: Date.now() + sec * 1000, profileId: widget.config.profiles[0]?.id }); render(); };
      body.appendChild(add);
      // pomodoro quick-start (keeps the value output alive)
      const pomo = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('clock', 14)} Pomodoro ${widget.config.pomo.work}m</button>`);
      pomo.onclick = () => { timerRuns.set(ulid(), { widgetId: widget.id, name: 'Focus', endAt: Date.now() + widget.config.pomo.work * 60000, profileId: widget.config.profiles[0]?.id }); const obj = dayObject(widget.id, 'pomoDay', todayStr(), { count: 0 }); obj.data.count += 1; saveObject(obj); render(); };
      body.appendChild(pomo);
    };

    const renderStopwatch = () => {
      const sw = stopwatches.get(widget.id) || { running: false, base: 0, startedAt: 0, laps: [] };
      stopwatches.set(widget.id, sw);
      const disp = el('<div class="sw-display" style="font-size:2.4rem;text-align:center;font-variant-numeric:tabular-nums;margin:10px 0"></div>');
      const elapsed = () => sw.base + (sw.running ? Date.now() - sw.startedAt : 0);
      const fmt = (ms) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms % 60000 / 1000))}.${pad(Math.floor(ms % 1000 / 10))}`;
      const paint = () => disp.textContent = fmt(elapsed());
      paint();
      const tick = setInterval(() => { if (!disp.isConnected) { clearInterval(tick); return; } if (sw.running) paint(); }, 50);
      const controls = el('<div class="row" style="gap:8px;justify-content:center"></div>');
      const mk = (label, fn) => { const b = el(`<button class="btn">${label}</button>`); b.onclick = fn; return b; };
      const startStop = mk(sw.running ? 'Stop' : 'Start', () => { if (sw.running) { sw.base = elapsed(); sw.running = false; } else { sw.startedAt = Date.now(); sw.running = true; } render(); });
      controls.append(startStop, mk('Lap', () => { if (sw.running) { sw.laps.unshift(elapsed()); render(); } }), mk('Reset', () => { stopwatches.set(widget.id, { running: false, base: 0, startedAt: 0, laps: [] }); render(); }));
      const laps = el('<div style="margin-top:14px"></div>');
      sw.laps.forEach((l, i) => laps.appendChild(el(`<div class="row-between" style="padding:4px 0;border-bottom:1px solid var(--border)"><span class="soft">Lap ${sw.laps.length - i}</span><span style="font-variant-numeric:tabular-nums">${fmt(l)}</span></div>`)));
      body.append(disp, controls, laps);
    };

    const renderProfiles = () => {
      for (const p of widget.config.profiles) {
        const row = el(`<div class="panel" style="padding:10px;margin-bottom:8px"></div>`);
        const head = el(`<div class="row-between"><input class="input" style="flex:1;font-weight:600"><button class="btn-icon p-del">${icon('trash', 14)}</button></div>`);
        head.querySelector('input').value = p.name; head.querySelector('input').addEventListener('change', (e) => { p.name = e.target.value; save(); });
        head.querySelector('.p-del').onclick = () => { if (widget.config.profiles.length <= 1) { toast('Keep at least one profile.', 'info'); return; } widget.config.profiles = widget.config.profiles.filter(x => x.id !== p.id); save(); render(); };
        row.appendChild(head);
        row.appendChild(field('Volume', (() => { const r = input(p.volume ?? 80); r.type = 'range'; r.min = 0; r.max = 100; r.addEventListener('input', () => { p.volume = +r.value; save(); }); return r; })()));
        row.appendChild(field('Fade-in (s)', seg([0, 5, 15, 30, 60].map(v => ({ value: v, label: v ? v + 's' : 'Off' })), p.fadeIn || 0, (v) => { p.fadeIn = v; save(); })));
        row.appendChild(field('Vibrate', seg([['off', 'Off'], ['soft', 'Soft'], ['medium', 'Medium'], ['strong', 'Strong']].map(([v, l]) => ({ value: v, label: l })), p.vibrate || 'soft', (v) => { p.vibrate = v; save(); })));
        const loopChip = el(`<button class="chip ${p.loop ? 'accent' : ''}" style="cursor:pointer">Loop sound</button>`); loopChip.onclick = () => { p.loop = !p.loop; loopChip.classList.toggle('accent'); save(); }; row.appendChild(loopChip);
        body.appendChild(row);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 14)} New profile</button>`);
      add.onclick = () => { widget.config.profiles.push({ id: ulid(), name: 'Profile ' + (widget.config.profiles.length + 1), color: '#7cc4ff', volume: 80, fadeIn: 0, vibrate: 'soft', loop: false }); save(); render(); };
      body.appendChild(add);
      body.appendChild(el('<p class="soft" style="font-size:0.8rem;margin-top:10px">Honest note: as a web app, alarms ring only while The Blossom is open. For wake-ups, your phone’s clock is the safer gardener.</p>'));
    };

    buildTabs(); render();
  }
});
