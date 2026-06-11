/* CivProfile widget (docs/08 §5): structured civilization profiles — identity,
   government (ruler links), society/economy/military/religion, a relations
   matrix vs other civs, and dated history that feeds the Timeline. Sections
   collapse; everything optional — a village can be three fields. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, popMenu, seg } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { watchWikilinks, wireWikilinks, openEntryPicker, openEntry, onWbOpen, resolveEntry, fmtWorldYear, siblingWidgets } from './wb-shared.js';

const civs = (w) => objectsOf(w.id, 'civ');
const KINDS = ['Kingdom', 'Empire', 'City', 'Village', 'Tribe', 'Order'];
const STANCES = ['ally', 'neutral', 'rival', 'war'];
const STANCE_COLOR = { ally: 'var(--success)', neutral: 'var(--text-soft)', rival: 'var(--highlight)', war: 'var(--warn)' };
const PROSE = [['society', 'Society', 'population, classes, culture'], ['economy', 'Economy', 'exports, imports, currency'], ['military', 'Military', 'forces, doctrine, fortifications'], ['religion', 'Religion', 'faiths, temples — type [[ to link lore']];

registry.register({
  type: 'civprofile',
  name: 'Civilizations',
  icon: 'shield',
  description: 'Kingdoms, cities and tribes with relations and history',
  keywords: ['world', 'civilization', 'kingdom', 'faction', 'city'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  outputs: (widget) => [{
    key: 'civs', name: 'Civilization count', dayKeyed: false,
    get: () => civs(widget).length
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const list = civs(widget);
    if (!list.length) {
      host.appendChild(el('<p class="soft" style="font-size:0.84rem">No banners raised yet.</p>'));
      return;
    }
    const rows = el('<div></div>');
    for (const c of list.slice(0, 4)) {
      rows.appendChild(el(`<div class="row" style="justify-content:space-between;padding:3px 0"><span style="font-weight:600;font-size:0.9rem">${c.data.name}</span><span class="chip">${c.data.kind || '—'}</span></div>`));
    }
    if (list.length > 4) rows.appendChild(el(`<div class="soft" style="font-size:0.78rem">+${list.length - 4} more</div>`));
    host.appendChild(rows);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);

    const showList = () => {
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="gap:8px;margin-bottom:12px"><span class="grow"></span><button class="btn btn-primary">${icon('plus', 15)} Civilization</button></div>`);
      head.querySelector('button').onclick = () => {
        const c = createObject(widget.id, 'civ', {
          name: 'New civilization', kind: 'Kingdom', motto: '', rulers: [],
          society: '', economy: '', military: '', religion: '',
          relations: [], history: [], notes: ''
        });
        showCiv(c.id, true);
      };
      wrap.appendChild(head);
      const list = el('<div></div>');
      wrap.appendChild(list);
      const all = civs(widget).sort((a, b) => a.data.name.localeCompare(b.data.name));
      if (!all.length) list.appendChild(el('<div class="empty-state">' + icon('shield', 28) + '<p>No nations yet — raise the first banner.</p></div>'));
      for (const c of all) {
        const li = el(`<button class="list-item"><span style="color:var(--accent)">${icon('shield', 16)}</span>
          <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><span class="chip"></span></button>`);
        li.querySelector('.li-title').textContent = c.data.name;
        li.querySelector('.li-sub').textContent = c.data.motto || '';
        li.querySelector('.chip').textContent = c.data.kind || '—';
        li.onclick = () => showCiv(c.id);
        list.appendChild(li);
      }
    };

    const showCiv = (id, fresh = false) => {
      const c = store.get('objects', id);
      if (!c) return showList();
      wrap.innerHTML = '';
      const save = () => saveObject(c);

      const head = el(`<div class="row" style="gap:8px;margin-bottom:6px">
        <button class="btn-icon" title="All civilizations">${icon('arrow-left', 17)}</button>
        <div class="grow"><input class="input" style="font-weight:650"><input class="input" placeholder="motto" style="margin-top:4px;font-size:0.84rem;padding:5px 10px"></div>
        <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
      head.querySelector('[title="All civilizations"]').onclick = showList;
      const [nameIn, mottoIn] = head.querySelectorAll('input');
      nameIn.value = c.data.name;
      mottoIn.value = c.data.motto || '';
      nameIn.onchange = () => { c.data.name = nameIn.value.trim() || 'Unnamed'; save(); };
      mottoIn.onchange = () => { c.data.motto = mottoIn.value; save(); };
      head.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Delete civilization', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: `Let “${c.data.name}” fall?`, message: 'It rests in the trash for 30 days.' })) {
            store.trash('objects', c.id);
            toast('A nation fades into legend', 'leaf');
            showList();
          }
        } }
      ]);
      wrap.appendChild(head);

      wrap.appendChild(el('<div class="field" style="margin-bottom:4px"><label>Scale & type</label></div>'))
        .appendChild(seg(KINDS.map(k => ({ value: k, label: k })), c.data.kind || 'Kingdom', (v) => { c.data.kind = v; save(); }));

      const section = (title, build, open = false) => {
        const sec = el(`<details class="wb-sec" ${open ? 'open' : ''}><summary>${title}</summary><div class="wb-sec-body"></div></details>`);
        build(sec.querySelector('.wb-sec-body'));
        wrap.appendChild(sec);
      };

      section('Government', (body) => {
        const chips = el('<div class="row" style="flex-wrap:wrap;gap:5px"></div>');
        body.appendChild(el('<div class="field"><label>Rulers</label></div>')).appendChild(chips);
        const render = () => {
          chips.innerHTML = '';
          for (const ref of (c.data.rulers || [])) {
            const entry = resolveEntry(ref);
            const chip = el(`<button class="chip accent">${icon('user', 11)}<span></span> ×</button>`);
            chip.querySelector('span').textContent = entry?.label || '?';
            chip.onclick = (e2) => popMenu(e2.currentTarget, [
              { label: 'Open', iconName: 'arrow-right', fn: () => openEntry(ref, ctx) },
              { label: 'Remove', iconName: 'x', danger: true, fn: () => { c.data.rulers.splice(c.data.rulers.indexOf(ref), 1); save(); render(); } }
            ]);
            chips.appendChild(chip);
          }
          const add = el(`<button class="chip">${icon('plus', 11)} Crown someone</button>`);
          add.onclick = () => openEntryPicker(widget, { kinds: ['char'], title: 'Who rules?', onPick: (e2) => {
            c.data.rulers = c.data.rulers || [];
            c.data.rulers.push({ kind: 'char', id: e2.id });
            save();
            render();
          } });
          chips.appendChild(add);
        };
        render();
      }, !!(c.data.rulers || []).length);

      for (const [key, label, hint] of PROSE) {
        section(label, (body) => {
          const editor = el(`<div class="note-editor" style="min-height:70px" data-ph="${hint}" spellcheck="true"></div>`);
          editor.contentEditable = 'true';
          editor.innerHTML = c.data[key] || '';
          let t = null;
          editor.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { c.data[key] = editor.innerHTML; save(); }, 400); });
          watchWikilinks(editor, widget, () => { c.data[key] = editor.innerHTML; save(); });
          wireWikilinks(editor, ctx);
          body.appendChild(editor);
        }, !!c.data[key]);
      }

      section('Relations', (body) => {
        const others = civs(widget).filter(o => o.id !== c.id);
        if (!others.length) {
          body.appendChild(el('<p class="soft" style="font-size:0.84rem">Relations appear once another civilization exists.</p>'));
          return;
        }
        for (const other of others) {
          const rel = (c.data.relations || []).find(r => r.id === other.id);
          const row = el(`<div class="row" style="justify-content:space-between;padding:4px 0"><span style="font-size:0.9rem">${other.data.name}</span><button class="chip"></button></div>`);
          const chip = row.querySelector('.chip');
          const paint = (stance) => {
            chip.textContent = stance;
            chip.style.color = STANCE_COLOR[stance];
            chip.style.borderColor = STANCE_COLOR[stance];
          };
          paint(rel?.stance || 'neutral');
          chip.onclick = () => {
            const cur = (c.data.relations || []).find(r => r.id === other.id);
            const next = STANCES[(STANCES.indexOf(cur?.stance || 'neutral') + 1) % STANCES.length];
            c.data.relations = (c.data.relations || []).filter(r => r.id !== other.id);
            c.data.relations.push({ id: other.id, stance: next });
            // stances mirror — both courts hear the same news
            const theirs = (other.data.relations || []).filter(r => r.id !== c.id);
            theirs.push({ id: c.id, stance: next });
            other.data.relations = theirs;
            saveObject(other);
            save();
            paint(next);
          };
          body.appendChild(row);
        }
      }, !!(c.data.relations || []).length);

      section('History (feeds the Timeline)', (body) => {
        const cal = siblingWidgets(widget, ['wtimeline'])[0]?.config || null;
        const list = el('<div></div>');
        body.appendChild(list);
        const render = () => {
          list.innerHTML = '';
          for (const ev of (c.data.history || []).slice().sort((a, b) => a.year - b.year)) {
            const row = el(`<div class="list-item" style="cursor:default"><span class="chip"></span><span class="li-main"><span class="li-title"></span></span><button class="btn-icon">${icon('x', 13)}</button></div>`);
            row.querySelector('.chip').textContent = fmtWorldYear(ev.year, cal);
            row.querySelector('.li-title').textContent = ev.title;
            row.querySelector('button').onclick = () => { c.data.history.splice(c.data.history.indexOf(ev), 1); save(); render(); };
            list.appendChild(row);
          }
        };
        render();
        const addRow = el(`<div class="row" style="gap:6px;margin-top:6px"><input class="input" type="number" placeholder="Year" style="width:90px"><input class="input grow" placeholder="What happened?"><button class="btn">${icon('plus', 14)}</button></div>`);
        const [yIn, tIn, addB] = addRow.children;
        addB.onclick = () => {
          if (!tIn.value.trim() || yIn.value === '') return;
          c.data.history = c.data.history || [];
          c.data.history.push({ year: Number(yIn.value), title: tIn.value.trim(), text: '', category: 'civilizations' });
          tIn.value = '';
          save();
          render();
        };
        body.appendChild(addRow);
      }, !!(c.data.history || []).length);

      if (fresh) setTimeout(() => { nameIn.focus(); nameIn.select(); }, 100);
    };

    onWbOpen(widget, wrap, (e) => showCiv(e.id));
    if (widget.config.pendingOpen) {
      const id = widget.config.pendingOpen;
      delete widget.config.pendingOpen;
      store.put('widgets', widget);
      showCiv(id);
    } else showList();
  }
});
