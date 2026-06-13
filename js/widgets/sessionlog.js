/* SessionLog widget (docs/08 §3): one object per game session — date,
   attendance, prep notes (pre), recap (post), loot/XP awarded, and a
   "what the players don't know yet" section kept for the DM's eyes. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, popMenu, promptText } from '../ui/components.js';
import { objectsOf, createObject, saveObject, todayStr, fmtDate } from './base.js';

const sessions = (w) => objectsOf(w.id, 'session').sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''));
const FRESH = () => ({ date: todayStr(), title: '', attendance: [], prep: '', recap: '', loot: '', xp: '', secret: '' });

registry.register({
  type: 'sessionlog',
  name: 'Session Log',
  icon: 'book',
  description: 'A record of every session — prep, recap, loot, XP, and DM secrets',
  keywords: ['session', 'log', 'recap', 'campaign', 'journal', 'dm', 'notes'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  outputs: (widget) => [{
    key: 'sessions', name: 'Sessions played', dayKeyed: false,
    get: () => sessions(widget).length
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const list = sessions(widget);
    if (!list.length) { host.appendChild(el('<span class="soft" style="font-size:0.84rem">No sessions logged.</span>')); return; }
    const latest = list[0];
    const card = el(`<div><div class="soft" style="font-size:0.78rem"></div><div style="font-weight:600;margin-top:2px"></div></div>`);
    card.querySelector('.soft').textContent = `Latest · ${fmtDate(latest.data.date)} · ${list.length} session${list.length > 1 ? 's' : ''}`;
    card.querySelector('div:last-child').textContent = latest.data.title || latest.data.recap?.slice(0, 60) || 'Untitled session';
    host.appendChild(card);
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);

    const showList = () => {
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Sessions</h3><button class="btn btn-primary">${icon('plus', 15)} Session</button></div>`);
      head.querySelector('button').onclick = () => { const o = createObject(widget.id, 'session', FRESH()); showSession(o.id, true); };
      wrap.appendChild(head);
      const list = sessions(widget);
      if (!list.length) { wrap.appendChild(el('<div class="empty-state">' + icon('book', 28) + '<p>The chronicle begins with your first session.</p></div>')); return; }
      for (const o of list) {
        const row = el(`<button class="list-item"><span class="chip"></span><span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><span class="soft" style="font-size:0.78rem"></span></button>`);
        row.querySelector('.chip').textContent = fmtDate(o.data.date);
        row.querySelector('.li-title').textContent = o.data.title || 'Untitled session';
        row.querySelector('.li-sub').textContent = (o.data.recap || o.data.prep || '').slice(0, 70) || 'No notes yet';
        if (o.data.xp) row.querySelector('span:last-child').textContent = `${o.data.xp} XP`;
        row.onclick = () => showSession(o.id);
        wrap.appendChild(row);
      }
    };

    const showSession = (id, fresh = false) => {
      const o = store.get('objects', id);
      if (!o) return showList();
      const d = o.data;
      const save = () => saveObject(o);
      wrap.innerHTML = '';

      const head = el(`<div class="row" style="gap:8px;margin-bottom:8px">
        <button class="btn-icon" title="All sessions">${icon('arrow-left', 17)}</button>
        <input class="input grow" placeholder="Session title" style="font-weight:650">
        <input class="input" type="date" style="width:150px">
        <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
      head.querySelector('[title="All sessions"]').onclick = showList;
      const [titleIn, dateIn] = head.querySelectorAll('input');
      titleIn.value = d.title || ''; dateIn.value = d.date;
      titleIn.onchange = () => { d.title = titleIn.value; save(); };
      dateIn.onchange = () => { d.date = dateIn.value || todayStr(); save(); };
      head.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Delete session', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: 'Delete this session?', message: 'It rests in the trash for 30 days.' })) { store.trash('objects', o.id); toast('Logged away', 'leaf'); showList(); }
        } }
      ]);
      wrap.appendChild(head);

      // attendance chips
      const attSec = el(`<div class="dnd-box" style="margin-bottom:8px"><span class="soft">Attendance</span><div class="row" style="flex-wrap:wrap;gap:5px;margin-top:6px"></div></div>`);
      const attRow = attSec.querySelector('.row');
      const drawAtt = () => {
        attRow.innerHTML = '';
        for (const a of d.attendance) {
          const chip = el(`<button class="chip${a.present ? ' accent' : ''}"></button>`);
          chip.textContent = `${a.present ? '✓ ' : '○ '}${a.name}`;
          chip.onclick = () => { a.present = !a.present; save(); drawAtt(); };
          chip.oncontextmenu = (e) => { e.preventDefault(); d.attendance.splice(d.attendance.indexOf(a), 1); save(); drawAtt(); };
          attRow.appendChild(chip);
        }
        const add = el(`<button class="chip">${icon('plus', 11)} Player</button>`);
        add.onclick = async () => { const name = await promptText({ title: 'Add player', label: 'Player name', confirmText: 'Add' }); if (name) { d.attendance.push({ name: name.trim(), present: true }); save(); drawAtt(); } };
        attRow.appendChild(add);
      };
      drawAtt();
      wrap.appendChild(attSec);

      const area = (label, key, rows = 3, dmEyes = false) => {
        const f = el(`<div class="field"><label>${label}</label><textarea class="input" rows="${rows}"${dmEyes ? ' style="border-color:var(--accent)"' : ''}></textarea></div>`);
        const ta = f.querySelector('textarea');
        ta.value = d[key] || '';
        ta.onchange = () => { d[key] = ta.value; save(); };
        wrap.appendChild(f);
      };
      area('Prep (before)', 'prep', 4);
      area('Recap (after)', 'recap', 4);
      const duo = el('<div class="dnd-duo"></div>');
      for (const [label, key] of [['Loot awarded', 'loot'], ['XP awarded', 'xp']]) {
        const f = el(`<div class="field"><label>${label}</label><input class="input"></div>`);
        const inp = f.querySelector('input');
        inp.value = d[key] || '';
        inp.onchange = () => { d[key] = inp.value; save(); };
        duo.appendChild(f);
      }
      wrap.appendChild(duo);
      area("What the players don't know yet (DM eyes)", 'secret', 3, true);

      if (fresh) setTimeout(() => titleIn.focus(), 120);
    };

    showList();
  }
});
