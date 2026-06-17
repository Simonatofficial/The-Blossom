/* SessionPlanner widget (V2 §13, Tabletop): forward-looking session prep — the
   counterpart to SessionLog. Each plan holds the session's goal, an ordered
   beat/scene checklist, planned encounters (with monsters pulled from the SRD
   or your bestiary), the NPCs and locations in play, and a "where this is going"
   threads section for foreshadowing and long-term direction. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, popMenu } from '../ui/components.js';
import { objectsOf, createObject, saveObject, todayStr, fmtDate } from './base.js';
import { openCompendiumPicker } from './tabletop-compendium.js';

const STATUS = { planned: 'Planned', ready: 'Ready', done: 'Run' };
const plans = (w) => objectsOf(w.id, 'sessionplan')
  .sort((a, b) => (a.data.date || '9999').localeCompare(b.data.date || '9999') || (a.data.num || 0) - (b.data.num || 0));

const FRESH = (n) => ({
  title: '', num: n, date: '', status: 'planned',
  goal: '', beats: [], encounters: [], npcs: '', locations: '', threads: '', secret: ''
});

registry.register({
  type: 'sessionplan',
  name: 'Session Planner',
  icon: 'calendar',
  description: 'Plan upcoming sessions — beats, encounters, and where the story is heading',
  keywords: ['session', 'plan', 'prep', 'campaign', 'beats', 'encounter', 'dm', 'tabletop', 'foreshadow'],
  category: 'Tabletop',
  external: true, internal: true,
  defaultConfig: () => ({}),

  outputs: (widget) => [{
    key: 'planned', name: 'Sessions planned', dayKeyed: false,
    get: () => plans(widget).filter(p => p.data.status !== 'done').length
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const upcoming = plans(widget).filter(p => p.data.status !== 'done');
    if (!upcoming.length) { host.appendChild(el('<span class="soft" style="font-size:0.84rem">No sessions planned yet.</span>')); return; }
    const next = upcoming[0].data;
    const beats = next.beats || [];
    const done = beats.filter(b => b.done).length;
    const card = el(`<div><div class="soft" style="font-size:0.78rem">Next up${next.date ? ' · ' + fmtDate(next.date) : ''}</div>
      <div style="font-weight:650;margin-top:2px"></div>
      <div class="soft" style="font-size:0.8rem;margin-top:2px">${beats.length ? `${done}/${beats.length} beats ready` : 'No beats yet'} · ${upcoming.length} upcoming</div></div>`);
    card.querySelector('div:nth-child(2)').textContent = next.title || `Session ${next.num || ''}`.trim() || 'Untitled session';
    host.appendChild(card);
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);

    const showList = () => {
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Session plans</h3><button class="btn btn-primary">${icon('plus', 15)} Plan</button></div>`);
      head.querySelector('button').onclick = () => {
        const next = (plans(widget).reduce((m, p) => Math.max(m, p.data.num || 0), 0)) + 1;
        const o = createObject(widget.id, 'sessionplan', FRESH(next));
        showPlan(o.id, true);
      };
      wrap.appendChild(head);
      const list = plans(widget);
      if (!list.length) { wrap.appendChild(el('<div class="empty-state">' + icon('calendar', 28) + '<p>Map out your next session — beats, monsters, and the threads you want to pull.</p></div>')); return; }
      for (const o of list) {
        const d = o.data, beats = d.beats || [];
        const done = beats.filter(b => b.done).length;
        const row = el(`<button class="list-item">
          <span class="chip sp-status"></span>
          <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
          <span class="soft" style="font-size:0.78rem"></span></button>`);
        const st = row.querySelector('.sp-status');
        st.textContent = STATUS[d.status] || 'Planned';
        st.classList.toggle('accent', d.status === 'ready');
        st.style.opacity = d.status === 'done' ? '0.55' : '';
        row.querySelector('.li-title').textContent = d.title || `Session ${d.num || ''}`.trim() || 'Untitled session';
        row.querySelector('.li-sub').textContent = d.goal?.slice(0, 70) || (beats[0]?.text ? `First beat: ${beats[0].text.slice(0, 50)}` : 'No goal set yet');
        row.querySelector('span:last-child').textContent = [d.date && fmtDate(d.date), beats.length && `${done}/${beats.length}`].filter(Boolean).join(' · ');
        row.onclick = () => showPlan(o.id);
        wrap.appendChild(row);
      }
    };

    const showPlan = (id, fresh = false) => {
      const o = store.get('objects', id);
      if (!o) return showList();
      const d = o.data;
      const save = () => saveObject(o);
      wrap.innerHTML = '';

      const head = el(`<div class="row" style="gap:8px;margin-bottom:8px">
        <button class="btn-icon" title="All plans">${icon('arrow-left', 17)}</button>
        <input class="input grow" placeholder="Session title" style="font-weight:650">
        <input class="input" type="date" style="width:150px">
        <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
      head.querySelector('[title="All plans"]').onclick = showList;
      const [titleIn, dateIn] = head.querySelectorAll('input');
      titleIn.value = d.title || ''; dateIn.value = d.date || '';
      titleIn.onchange = () => { d.title = titleIn.value; save(); };
      dateIn.onchange = () => { d.date = dateIn.value; save(); };
      head.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Duplicate', iconName: 'copy', fn: () => { const n = createObject(widget.id, 'sessionplan', structuredClone(d)); n.data.title = (d.title || 'Session') + ' copy'; n.data.num = null; saveObject(n); showPlan(n.id); } },
        { label: 'Delete plan', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: 'Delete this plan?', message: 'It rests in the trash for 30 days.' })) { store.trash('objects', o.id); toast('Plan filed away', 'leaf'); showList(); }
        } }
      ]);
      wrap.appendChild(head);

      // status segment
      const stRow = el('<div class="row" style="gap:5px;margin-bottom:10px"></div>');
      for (const [key, label] of Object.entries(STATUS)) {
        const b = el(`<button class="chip${d.status === key ? ' accent' : ''}">${label}</button>`);
        b.onclick = () => { d.status = key; save(); showPlan(id); };
        stRow.appendChild(b);
      }
      wrap.appendChild(stRow);

      // goal
      const goal = el('<div class="field"><label>The goal of this session</label><textarea class="input" rows="2" placeholder="What should happen? What is the hook and the intended ending?"></textarea></div>');
      goal.querySelector('textarea').value = d.goal || '';
      goal.querySelector('textarea').onchange = (e) => { d.goal = e.target.value; save(); };
      wrap.appendChild(goal);

      // beats — ordered checklist
      const beatSec = el(`<details class="wb-sec" open><summary>Beats &amp; scenes</summary><div class="wb-sec-body"><div class="sp-beats"></div></div></details>`);
      const beatList = beatSec.querySelector('.sp-beats');
      const drawBeats = () => {
        beatList.innerHTML = '';
        d.beats = d.beats || [];
        d.beats.forEach((b, i) => {
          const row = el(`<div class="sp-beat"><button class="sp-check${b.done ? ' on' : ''}" title="Mark ready">${b.done ? icon('check', 13) : ''}</button><input class="input grow" placeholder="A scene, reveal, or beat…"><button class="btn-icon sp-up" title="Move up">${icon('move', 13)}</button><button class="btn-icon sp-del" title="Remove">${icon('x', 13)}</button></div>`);
          const inp = row.querySelector('input');
          inp.value = b.text || '';
          inp.onchange = () => { b.text = inp.value; save(); };
          row.querySelector('.sp-check').onclick = () => { b.done = !b.done; save(); drawBeats(); };
          row.querySelector('.sp-up').onclick = () => { if (i > 0) { [d.beats[i - 1], d.beats[i]] = [d.beats[i], d.beats[i - 1]]; save(); drawBeats(); } };
          row.querySelector('.sp-del').onclick = () => { d.beats.splice(i, 1); save(); drawBeats(); };
          beatList.appendChild(row);
        });
        const add = el(`<button class="btn" style="width:100%">${icon('plus', 14)} Add beat</button>`);
        add.onclick = () => { d.beats.push({ text: '', done: false }); save(); drawBeats(); beatList.querySelector('.sp-beat:last-of-type input')?.focus(); };
        beatList.appendChild(add);
      };
      drawBeats();
      wrap.appendChild(beatSec);

      // planned encounters
      const encSec = el(`<details class="wb-sec" open><summary>Planned encounters</summary><div class="wb-sec-body"><div class="sp-encs"></div></div></details>`);
      const encList = encSec.querySelector('.sp-encs');
      const drawEncs = () => {
        encList.innerHTML = '';
        d.encounters = d.encounters || [];
        d.encounters.forEach((en, i) => {
          const card = el(`<div class="dnd-box" style="margin-bottom:6px">
            <div class="row" style="gap:6px"><button class="sp-check${en.done ? ' on' : ''}" title="Mark ready">${en.done ? icon('check', 13) : ''}</button><input class="input grow" style="font-weight:600" placeholder="Encounter name (Ambush at the bridge)"><button class="btn-icon" title="Remove">${icon('x', 13)}</button></div>
            <div class="row" style="gap:6px;margin-top:5px"><input class="input grow sp-mon" placeholder="Monsters (2 goblins, 1 bugbear)"><button class="btn-icon sp-addmon" title="Add monster from SRD">${icon('plus', 14)}</button></div>
            <textarea class="input" rows="2" placeholder="Tactics, terrain, treasure, twist…" style="margin-top:5px"></textarea></div>`);
          const [nameIn, monIn] = card.querySelectorAll('input');
          const ta = card.querySelector('textarea');
          nameIn.value = en.name || ''; monIn.value = en.monsters || ''; ta.value = en.notes || '';
          nameIn.onchange = () => { en.name = nameIn.value; save(); };
          monIn.onchange = () => { en.monsters = monIn.value; save(); };
          ta.onchange = () => { en.notes = ta.value; save(); };
          card.querySelector('.sp-check').onclick = () => { en.done = !en.done; save(); drawEncs(); };
          card.querySelector('[title="Remove"]').onclick = () => { d.encounters.splice(i, 1); save(); drawEncs(); };
          card.querySelector('.sp-addmon').onclick = () => openCompendiumPicker({
            title: 'Add a monster', category: 'monsters',
            onPick: (m) => { en.monsters = en.monsters ? `${en.monsters}, ${m.name}` : m.name; monIn.value = en.monsters; save(); toast(`${m.name} added (CR ${m.cr}).`, 'shield'); }
          });
          encList.appendChild(card);
        });
        const add = el(`<button class="btn" style="width:100%">${icon('plus', 14)} Add encounter</button>`);
        add.onclick = () => { d.encounters.push({ name: '', monsters: '', notes: '', done: false }); save(); drawEncs(); };
        encList.appendChild(add);
      };
      drawEncs();
      wrap.appendChild(encSec);

      // who & where
      const duo = el('<div class="dnd-duo"></div>');
      for (const [label, key, ph] of [['NPCs in play', 'npcs', 'Who shows up'], ['Locations', 'locations', 'Where it happens']]) {
        const f = el(`<div class="field"><label>${label}</label><textarea class="input" rows="2" placeholder="${ph}"></textarea></div>`);
        f.querySelector('textarea').value = d[key] || '';
        f.querySelector('textarea').onchange = (e) => { d[key] = e.target.value; save(); };
        duo.appendChild(f);
      }
      wrap.appendChild(duo);

      // forward-looking threads
      const threads = el('<div class="field"><label>Where this is going (threads &amp; foreshadowing)</label><textarea class="input" rows="3" placeholder="Long-term plots to seed, clues to drop, consequences building toward later sessions…"></textarea></div>');
      threads.querySelector('textarea').value = d.threads || '';
      threads.querySelector('textarea').onchange = (e) => { d.threads = e.target.value; save(); };
      wrap.appendChild(threads);

      // dm secret
      const secret = el('<div class="field"><label>DM-only notes</label><textarea class="input" rows="2" style="border-color:var(--accent)" placeholder="Twists the players shouldn\'t see yet."></textarea></div>');
      secret.querySelector('textarea').value = d.secret || '';
      secret.querySelector('textarea').onchange = (e) => { d.secret = e.target.value; save(); };
      wrap.appendChild(secret);

      if (fresh) setTimeout(() => titleIn.focus(), 120);
    };

    showList();
  }
});
