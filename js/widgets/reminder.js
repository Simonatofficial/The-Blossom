/* Reminder widget (V2 §W-7): an alarm that tells you WHAT and WHEN, with context
   pulled from a linked widget. Reminders fire as in-app banners (Dismiss / Snooze
   10 min / Open [widget]) + a feed entry, and an OS notification when permission
   is granted. Lead notifications alert before the time (at time / 5 / 15 / 60 /
   1440 min). PWA honesty: they only fire while The Blossom is open. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { router } from '../core/router.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg, toast, openDrawer, confirmDialog } from '../ui/components.js';
import { objectsOf, createObject, saveObject, todayStr, dateAdd } from './base.js';
import { outputsOf } from '../core/values.js';
import { openNodePicker } from '../ui/picker.js';

let watcher = null;
const pad = (n) => String(n).padStart(2, '0');
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function to12h(hhmm) { if (!hhmm) return ''; let [h, m] = hhmm.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; }

const LEADS = [{ m: 0, label: 'At time' }, { m: 5, label: '5 min' }, { m: 15, label: '15 min' }, { m: 60, label: '1 hour' }, { m: 1440, label: '1 day' }];
function humanLead(m) { return m >= 1440 ? `${m / 1440} day` : m >= 60 ? `${m / 60} hour` : `${m} min`; }

function reminders(widget) { return objectsOf(widget.id, 'reminder').map(o => ({ id: o.id, ...o.data })); }
function remObj(widget, id) { return objectsOf(widget.id, 'reminder').find(o => o.id === id); }

/** Does a reminder occur on a given date? */
function occursOn(rem, dateStr) {
  const r = rem.recur || 'none';
  if (r === 'none') return (rem.date || todayStr()) === dateStr;
  if (r === 'daily') return true;
  if (r === 'weekly') return (rem.days || []).includes(new Date(dateStr + 'T12:00:00').getDay());
  if (r === 'everyN') { const base = new Date((rem.startDate || rem.date || dateStr) + 'T12:00:00'); const days = Math.round((new Date(dateStr + 'T12:00:00') - base) / 86400000); return days >= 0 && days % Math.max(1, rem.n || 1) === 0; }
  return false;
}
/** Linked-widget context line (§W-7). */
function linkedContext(w) {
  if (!w) return '';
  if (w.type === 'flashcards') { const n = objectsOf(w.id, 'flashcard').length; return `${w.name} · ${n} card${n === 1 ? '' : 's'}`; }
  if (w.type === 'quiz') { const last = objectsOf(w.id, 'quizResult').sort((a, b) => b.createdAt - a.createdAt)[0]; return last ? `${w.name} · last ${last.data.score}/${last.data.total}` : w.name; }
  const out = outputsOf(w)[0];
  const v = out ? out.get(out.dayKeyed ? todayStr() : undefined) : null;
  return v != null && v !== '' && v !== 0 ? `${w.name} · ${out.name} ${v}` : w.name;
}

function bannerHost() { let h = document.getElementById('alarm-banners'); if (!h) { h = el('<div id="alarm-banners"></div>'); document.body.appendChild(h); } return h; }
function fireReminder(widget, rem, leadMins) {
  const linked = rem.linkedWidgetId ? store.get('widgets', rem.linkedWidgetId) : null;
  const ctxStr = linkedContext(linked);
  const text = `${leadMins ? `${humanLead(leadMins)} until ` : ''}${rem.title}${ctxStr ? ` — ${ctxStr}` : ''}`;
  const b = el(`<div class="alarm-banner"><div class="ab-main"><strong class="ab-name"></strong><span class="ab-time soft"></span></div>
    <div class="ab-actions"><button class="btn ab-snz">Snooze 10</button>${linked ? '<button class="btn ab-open"></button>' : ''}<button class="btn btn-primary ab-x">Dismiss</button></div></div>`);
  b.querySelector('.ab-name').textContent = (leadMins ? `${humanLead(leadMins)} until ` : '') + rem.title;
  b.querySelector('.ab-time').textContent = `${to12h(rem.time)}${ctxStr ? ' · ' + ctxStr : ''}`;
  b.querySelector('.ab-snz').onclick = () => { const o = remObj(widget, rem.id); if (o) { o.data.snoozeUntil = Date.now() + 10 * 60000; saveObject(o); } b.remove(); toast('Snoozed 10 min', 'bell'); };
  if (linked) { const ob = b.querySelector('.ab-open'); ob.textContent = `Open ${linked.name}`; ob.onclick = () => { b.remove(); router.goWidget(linked.id); }; }
  b.querySelector('.ab-x').onclick = () => b.remove();
  bannerHost().appendChild(b);
  events.emit('notify', { category: 'reminder', text });
  try { if (window.Notification && Notification.permission === 'granted') new Notification(rem.title, { body: text }); } catch { /* ignore */ }
}

function ensureWatcher() {
  if (watcher) return;
  watcher = setInterval(() => {
    const now = new Date(); const hhmm = nowHHMM(); const today = todayStr();
    for (const w of store.all('widgets')) {
      if (w.type !== 'reminder') continue;
      for (const o of objectsOf(w.id, 'reminder')) {
        const rem = o.data;
        if (rem.snoozeUntil && Date.now() >= rem.snoozeUntil) { rem.snoozeUntil = null; saveObject(o); fireReminder(w, { id: o.id, ...rem }, 0); continue; }
        rem.fired = rem.fired || {};
        for (let off = 0; off <= 1; off++) {
          const occDate = dateAdd(today, off);
          if (!occursOn(rem, occDate)) continue;
          const [h, m] = (rem.time || '09:00').split(':').map(Number);
          const occ = new Date(occDate + 'T12:00:00'); occ.setHours(h, m, 0, 0);
          for (const lead of (rem.leads && rem.leads.length ? rem.leads : [0])) {
            const t = new Date(occ.getTime() - lead * 60000);
            if (`${pad(t.getFullYear())}` && todayStr(t) === today && `${pad(t.getHours())}:${pad(t.getMinutes())}` === hhmm) {
              const key = `${occDate}:${lead}`;
              if (!rem.fired[key]) { rem.fired[key] = true; saveObject(o); fireReminder(w, { id: o.id, ...rem }, lead); }
            }
          }
        }
        // prune old fired keys
        for (const k of Object.keys(rem.fired)) if (k.split(':')[0] < dateAdd(today, -2)) delete rem.fired[k];
      }
    }
  }, 20000);
}

/* ---------- create / edit ---------- */
function editReminder(widget, rem, done) {
  const isNew = !rem;
  const r = rem || { title: '', time: '09:00', recur: 'none', date: todayStr(), days: [], n: 2, startDate: todayStr(), leads: [0], linkedWidgetId: null, notes: '' };
  const d = openDrawer({ title: isNew ? 'New reminder' : 'Edit reminder', iconName: 'bell' });

  const title = input(r.title, 'What to do (e.g. Study Biology)'); d.body.appendChild(field('Title', title));
  const time = el('<input class="input" type="time">'); time.value = r.time; d.body.appendChild(field('Time', time));

  let recur = r.recur;
  d.body.appendChild(field('Repeat', seg([['none', 'On a date'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['everyN', 'Every N']].map(([v, l]) => ({ value: v, label: l })), recur, (v) => { recur = v; renderRecur(); })));
  const recurBox = el('<div></div>'); d.body.appendChild(recurBox);
  const dateIn = el('<input class="input" type="date">'); dateIn.value = r.date || todayStr();
  const dayChips = el('<div class="row" style="flex-wrap:wrap;gap:4px"></div>');
  const chosenDays = new Set(r.days || []);
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((nm, i) => { const c = el(`<button type="button" class="chip ${chosenDays.has(i) ? 'accent' : ''}">${nm}</button>`); c.onclick = () => { chosenDays.has(i) ? chosenDays.delete(i) : chosenDays.add(i); c.classList.toggle('accent'); }; dayChips.appendChild(c); });
  const nIn = input(r.n || 2, 'every N days'); nIn.type = 'number'; nIn.min = 1;
  const renderRecur = () => { recurBox.innerHTML = ''; if (recur === 'none') recurBox.appendChild(field('Date', dateIn)); else if (recur === 'weekly') recurBox.appendChild(field('Days', dayChips)); else if (recur === 'everyN') recurBox.appendChild(field('Every N days', nIn)); };
  renderRecur();

  const chosenLeads = new Set(r.leads && r.leads.length ? r.leads : [0]);
  const leadRow = el('<div class="row" style="flex-wrap:wrap;gap:6px"></div>');
  for (const L of LEADS) { const c = el(`<button type="button" class="chip ${chosenLeads.has(L.m) ? 'accent' : ''}">${L.label}</button>`); c.onclick = () => { chosenLeads.has(L.m) ? chosenLeads.delete(L.m) : chosenLeads.add(L.m); c.classList.toggle('accent'); }; leadRow.appendChild(c); }
  d.body.appendChild(field('Alert me', leadRow, 'Before the reminder fires.'));

  let linkedId = r.linkedWidgetId;
  const linkBtn = el(`<button class="btn-soft-wide"></button>`);
  const refreshLink = () => { const w = linkedId && store.get('widgets', linkedId); linkBtn.innerHTML = `${icon('link', 14)} ${w ? w.name : 'Link a widget (optional)'}`; };
  refreshLink();
  linkBtn.onclick = () => openNodePicker({ onPick: ({ kind, id }) => { if (kind !== 'widget') { toast('Pick a widget.', 'info'); return; } linkedId = id; refreshLink(); } });
  d.body.appendChild(field('Linked widget', linkBtn));
  const clearLink = el('<button class="chip" style="cursor:pointer;margin-top:4px">Clear link</button>'); clearLink.onclick = () => { linkedId = null; refreshLink(); };
  d.body.appendChild(clearLink);

  const notes = el('<textarea class="textarea" rows="2" placeholder="Notes (optional)"></textarea>'); notes.value = r.notes || ''; d.body.appendChild(field('Notes', notes));

  const save = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Save reminder</button>');
  save.onclick = () => {
    if (!title.value.trim()) { toast('Give it a title.', 'info'); return; }
    const data = { title: title.value.trim(), time: time.value || '09:00', recur, date: dateIn.value, days: [...chosenDays].sort(), n: Number(nIn.value) || 2, startDate: r.startDate || todayStr(), leads: [...chosenLeads].sort((a, b) => a - b), linkedWidgetId: linkedId, notes: notes.value.trim(), fired: {} };
    if (isNew) createObject(widget.id, 'reminder', data);
    else { const o = remObj(widget, rem.id); o.data = { ...o.data, ...data }; saveObject(o); }
    d.close(); done();
  };
  d.body.appendChild(save);
  if (!isNew) { const del = el(`<button class="btn" style="width:100%;margin-top:8px;color:var(--warn)">${icon('trash', 15)} Delete</button>`); del.onclick = async () => { if (await confirmDialog({ title: `Delete “${rem.title}”?` })) { store.trash('objects', rem.id); d.close(); done(); } }; d.body.appendChild(del); }
}

/* ---------- views ---------- */
function row(widget, rem, rerender) {
  const linked = rem.linkedWidgetId ? store.get('widgets', rem.linkedWidgetId) : null;
  const r = el(`<button class="list-item">${icon('bell', 15)}<span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><span class="rm-time soft"></span></button>`);
  r.querySelector('.li-title').textContent = rem.title;
  r.querySelector('.li-sub').textContent = linked ? `${linked.name}` : (rem.notes || '');
  r.querySelector('.rm-time').textContent = to12h(rem.time);
  r.onclick = () => editReminder(widget, rem, rerender);
  return r;
}

registry.register({
  type: 'reminder',
  name: 'Reminder',
  icon: 'bell',
  description: 'Time-based reminders with context from a linked widget',
  keywords: ['remind', 'alert', 'todo', 'due', 'notification', 'schedule'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget, ctx) {
    ensureWatcher();
    host.innerHTML = '';
    const today = todayStr(); const hhmm = nowHHMM();
    const up = reminders(widget).filter(r => occursOn(r, today) && r.time >= hhmm).sort((a, b) => a.time.localeCompare(b.time));
    if (!up.length) { host.appendChild(el('<p class="soft" style="font-size:0.86rem">No more reminders today. Tap to add one.</p>')); return; }
    const soon = up.filter(r => { const [h, m] = r.time.split(':').map(Number); const t = new Date(); const d = new Date(); d.setHours(h, m, 0, 0); return d - t <= 3600000 && d >= t; }).length;
    host.appendChild(el(`<div class="row-between" style="margin-bottom:4px"><span class="soft" style="font-size:0.8rem">Today</span>${soon ? `<span class="chip accent">${soon} within the hour</span>` : ''}</div>`));
    for (const r of up.slice(0, 4)) {
      const linked = r.linkedWidgetId ? store.get('widgets', r.linkedWidgetId) : null;
      host.appendChild(el(`<div class="row-between" style="padding:3px 0"><span style="font-size:0.9rem">${icon(linked ? registry.get(linked.type)?.icon || 'link' : 'bell', 13)} <span class="rm-t"></span></span><span class="soft" style="font-size:0.8rem">${to12h(r.time)}</span></div>`)).querySelector('.rm-t').textContent = r.title;
    }
  },

  renderFull(host, widget, ctx) {
    ensureWatcher();
    let tab = 'upcoming';
    const render = () => {
      host.innerHTML = '';
      const head = el(`<div class="row-between" style="margin-bottom:10px"><div class="seg rm-tabs"></div><button class="btn-icon rm-perm" title="Enable device notifications">${icon('bell', 16)}</button></div>`);
      for (const [k, l] of [['upcoming', 'Upcoming'], ['today', 'Today'], ['all', 'All']]) { const b = el(`<button type="button" class="${tab === k ? 'active' : ''}">${l}</button>`); b.onclick = () => { tab = k; render(); }; head.querySelector('.rm-tabs').appendChild(b); }
      head.querySelector('.rm-perm').onclick = () => { if (window.Notification) Notification.requestPermission().then(p => toast(p === 'granted' ? 'Device notifications on' : 'Staying in-app only', 'bell')); };
      host.appendChild(head);

      const all = reminders(widget);
      const today = todayStr(); const hhmm = nowHHMM();
      if (tab === 'upcoming') {
        const list = [];
        for (let off = 0; off <= 1; off++) { const ds = dateAdd(today, off); for (const r of all) if (occursOn(r, ds) && (off > 0 || r.time >= hhmm)) list.push({ r, ds }); }
        list.sort((a, b) => (a.ds + a.r.time).localeCompare(b.ds + b.r.time));
        if (!list.length) host.appendChild(el('<p class="soft" style="padding:16px;text-align:center">Nothing in the next 24 hours.</p>'));
        for (const { r, ds } of list) { const rr = row(widget, r, render); if (ds !== today) rr.querySelector('.rm-time').textContent += ' · tmrw'; host.appendChild(rr); }
      } else if (tab === 'today') {
        const list = all.filter(r => occursOn(r, today)).sort((a, b) => a.time.localeCompare(b.time));
        if (!list.length) host.appendChild(el('<p class="soft" style="padding:16px;text-align:center">No reminders today.</p>'));
        let lastHour = null;
        for (const r of list) { const hr = r.time.split(':')[0]; if (hr !== lastHour) { lastHour = hr; host.appendChild(el(`<h3 class="soft" style="font-size:0.74rem;margin:8px 0 4px">${to12h(hr + ':00').replace(':00', '')}</h3>`)); } host.appendChild(row(widget, r, render)); }
      } else {
        const list = all.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.time.localeCompare(b.time));
        if (!list.length) host.appendChild(el('<p class="soft" style="padding:16px;text-align:center">No reminders yet.</p>'));
        for (const r of list) host.appendChild(row(widget, r, render));
      }

      const add = el(`<button class="btn-soft-wide" style="margin-top:10px">${icon('plus', 15)} New reminder</button>`);
      add.onclick = () => editReminder(widget, null, render);
      host.appendChild(add);
    };
    render();
  }
});
