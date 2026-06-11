/* World Characters widget (docs/08 §5): card grid + deep profile — portrait,
   essence line, personality, dated history (feeds the Timeline), relationships,
   affiliations, goals/secrets, freeform notes with [[wikilinks]]. The same
   profile widget the D&D DM module will share for NPCs. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, popMenu, promptText } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { watchWikilinks, wireWikilinks, openEntryPicker, openEntry, onWbOpen, resolveEntry, fmtWorldYear, siblingWidgets } from './wb-shared.js';

const chars = (w) => objectsOf(w.id, 'wchar');
const PERSONALITY = [['traits', 'Traits'], ['ideals', 'Ideals'], ['bonds', 'Bonds'], ['flaws', 'Flaws']];

function initialOf(name) { return (name || '?').trim().charAt(0).toUpperCase() || '?'; }

registry.register({
  type: 'worldchars',
  name: 'Characters',
  icon: 'users',
  description: 'The people of your world — profiles, relationships, histories',
  keywords: ['world', 'character', 'npc', 'people', 'profile'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  outputs: (widget) => [{
    key: 'characters', name: 'Character count', dayKeyed: false,
    get: () => chars(widget).length
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const list = chars(widget);
    const grid = el('<div class="row" style="flex-wrap:wrap;gap:6px"></div>');
    for (const c of list.slice(0, 8)) {
      grid.appendChild(el(`<span class="wc-mini" title="${c.data.name}">${initialOf(c.data.name)}</span>`));
    }
    if (!list.length) grid.appendChild(el('<span class="soft" style="font-size:0.84rem">No one lives here yet.</span>'));
    else if (list.length > 8) grid.appendChild(el(`<span class="soft" style="font-size:0.8rem;align-self:center">+${list.length - 8}</span>`));
    host.appendChild(grid);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);

    const showGrid = () => {
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="gap:8px;margin-bottom:12px"><input class="input grow" placeholder="Find someone…"><button class="btn btn-primary">${icon('plus', 15)} Character</button></div>`);
      const [search, add] = head.children;
      add.onclick = () => {
        const c = createObject(widget.id, 'wchar', {
          name: 'New character', essence: '', traits: '', ideals: '', bonds: '', flaws: '',
          history: [], relationships: [], affiliations: [], goals: '', secrets: '', notes: ''
        });
        showProfile(c.id, true);
      };
      wrap.appendChild(head);
      const grid = el('<div class="wc-grid"></div>');
      wrap.appendChild(grid);
      const render = () => {
        grid.innerHTML = '';
        const q = search.value.trim().toLowerCase();
        const list = chars(widget)
          .filter(c => !q || c.data.name.toLowerCase().includes(q) || (c.data.essence || '').toLowerCase().includes(q))
          .sort((a, b) => a.data.name.localeCompare(b.data.name));
        if (!list.length) grid.appendChild(el('<div class="empty-state" style="grid-column:1/-1">' + icon('users', 28) + '<p>Empty stage. Who steps into the light first?</p></div>'));
        for (const c of list) {
          const card = el(`<button class="wc-card"><span class="wc-portrait"></span><span class="wc-name"></span><span class="wc-essence soft"></span></button>`);
          card.querySelector('.wc-portrait').textContent = initialOf(c.data.name);
          card.querySelector('.wc-name').textContent = c.data.name;
          card.querySelector('.wc-essence').textContent = c.data.essence || '…';
          card.onclick = () => showProfile(c.id);
          grid.appendChild(card);
        }
      };
      search.oninput = render;
      render();
    };

    const showProfile = (id, fresh = false) => {
      const c = store.get('objects', id);
      if (!c) return showGrid();
      wrap.innerHTML = '';
      const save = () => saveObject(c);

      const head = el(`<div class="row" style="gap:8px;margin-bottom:4px">
        <button class="btn-icon" title="All characters">${icon('arrow-left', 17)}</button>
        <span class="wc-portrait" style="width:44px;height:44px;font-size:1.2rem">${initialOf(c.data.name)}</span>
        <div class="grow"><input class="input" style="font-weight:650"><input class="input" placeholder="essence — one line that captures them" style="margin-top:4px;font-size:0.84rem;padding:5px 10px"></div>
        <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
      head.querySelector('[title="All characters"]').onclick = showGrid;
      const [nameIn, essIn] = head.querySelectorAll('input');
      nameIn.value = c.data.name;
      essIn.value = c.data.essence || '';
      nameIn.onchange = () => { c.data.name = nameIn.value.trim() || 'Unnamed'; save(); head.querySelector('.wc-portrait').textContent = initialOf(c.data.name); };
      essIn.onchange = () => { c.data.essence = essIn.value; save(); };
      head.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Delete character', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: `Delete “${c.data.name}”?`, message: 'They rest in the trash for 30 days.' })) {
            store.trash('objects', c.id);
            toast('Gone from the stage', 'leaf');
            showGrid();
          }
        } }
      ]);
      wrap.appendChild(head);

      // every section optional + collapsible (docs/08: three fields or fifty)
      const section = (title, build, openByDefault = false) => {
        const sec = el(`<details class="wb-sec" ${openByDefault ? 'open' : ''}><summary>${title}</summary><div class="wb-sec-body"></div></details>`);
        build(sec.querySelector('.wb-sec-body'));
        wrap.appendChild(sec);
      };

      section('Personality', (body) => {
        for (const [key, label] of PERSONALITY) {
          const f = el(`<div class="field"><label>${label}</label><textarea class="input" rows="2"></textarea></div>`);
          const ta = f.querySelector('textarea');
          ta.value = c.data[key] || '';
          ta.onchange = () => { c.data[key] = ta.value; save(); };
          body.appendChild(f);
        }
      }, !!(c.data.traits || c.data.ideals));

      section('History (feeds the Timeline)', (body) => {
        const list = el('<div></div>');
        body.appendChild(list);
        const cal = timelineCalendar(widget);
        const render = () => {
          list.innerHTML = '';
          for (const [i, ev] of (c.data.history || []).slice().sort((a, b) => a.year - b.year).entries()) {
            const row = el(`<div class="list-item" style="cursor:default"><span class="chip"></span><span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><button class="btn-icon">${icon('x', 13)}</button></div>`);
            row.querySelector('.chip').textContent = fmtWorldYear(ev.year, cal);
            row.querySelector('.li-title').textContent = ev.title;
            row.querySelector('.li-sub').textContent = ev.text || '';
            row.querySelector('button').onclick = () => { c.data.history.splice(c.data.history.indexOf(ev), 1); save(); render(); };
            list.appendChild(row);
          }
        };
        render();
        const addRow = el('<div class="row" style="gap:6px;margin-top:6px"><input class="input" type="number" placeholder="Year" style="width:90px"><input class="input grow" placeholder="What happened?"><button class="btn">${plus}</button></div>'.replace('${plus}', icon('plus', 14)));
        const [yIn, tIn, addB] = addRow.children;
        addB.onclick = () => {
          if (!tIn.value.trim() || yIn.value === '') return;
          c.data.history = c.data.history || [];
          c.data.history.push({ year: Number(yIn.value), title: tIn.value.trim(), text: '', category: 'characters' });
          tIn.value = '';
          save();
          render();
        };
        body.appendChild(addRow);
      }, !!(c.data.history || []).length);

      section('Relationships & affiliations', (body) => {
        const chips = el('<div class="row" style="flex-wrap:wrap;gap:5px"></div>');
        body.appendChild(chips);
        const render = () => {
          chips.innerHTML = '';
          for (const rel of (c.data.relationships || [])) {
            const target = resolveEntry(rel.ref);
            const chip = el(`<button class="chip accent" title="Open">${icon('link', 11)}<span></span> ×</button>`);
            chip.querySelector('span').textContent = `${target?.label || '?'}${rel.label ? ` · ${rel.label}` : ''}`;
            chip.onclick = async (e2) => {
              popMenu(e2.currentTarget, [
                { label: 'Open', iconName: 'arrow-right', fn: () => openEntry(rel.ref, ctx) },
                { label: 'Remove', iconName: 'x', danger: true, fn: () => { c.data.relationships.splice(c.data.relationships.indexOf(rel), 1); save(); render(); } }
              ]);
            };
            chips.appendChild(chip);
          }
          const add = el(`<button class="chip">${icon('plus', 11)} Relate</button>`);
          add.onclick = () => openEntryPicker(widget, { kinds: ['char', 'civ'], title: 'Relate to…', onPick: async (e2) => {
            const label = await promptText({ title: 'How are they connected?', label: 'e.g. rival, mother, sworn to', confirmText: 'Add' });
            c.data.relationships = c.data.relationships || [];
            c.data.relationships.push({ ref: { kind: e2.kind, id: e2.id }, label: label || '' });
            save();
            render();
          } });
          chips.appendChild(add);
        };
        render();
      }, !!(c.data.relationships || []).length);

      section('Goals & secrets', (body) => {
        for (const [key, label] of [['goals', 'Goals'], ['secrets', 'Secrets (collapsed eyes only)']]) {
          const f = el(`<div class="field"><label>${label}</label><textarea class="input" rows="2"></textarea></div>`);
          const ta = f.querySelector('textarea');
          ta.value = c.data[key] || '';
          ta.onchange = () => { c.data[key] = ta.value; save(); };
          body.appendChild(f);
        }
      }, !!(c.data.goals || c.data.secrets));

      section('Notes', (body) => {
        const editor = el('<div class="note-editor" style="min-height:90px" spellcheck="true"></div>');
        editor.contentEditable = 'true';
        editor.innerHTML = c.data.notes || '';
        let t = null;
        editor.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { c.data.notes = editor.innerHTML; save(); }, 400); });
        watchWikilinks(editor, widget, () => { c.data.notes = editor.innerHTML; save(); });
        wireWikilinks(editor, ctx);
        body.appendChild(editor);
        body.appendChild(el('<p class="soft" style="font-size:0.74rem;margin-top:4px">Type [[ to weave in lore, places, or people.</p>'));
      }, !!c.data.notes);

      if (fresh) setTimeout(() => { nameIn.focus(); nameIn.select(); }, 100);
    };

    onWbOpen(widget, wrap, (e) => showProfile(e.id));
    if (widget.config.pendingOpen) {
      const id = widget.config.pendingOpen;
      delete widget.config.pendingOpen;
      store.put('widgets', widget);
      showProfile(id);
    } else showGrid();
  }
});

/** Borrow the sibling Timeline's calendar so years read in-world. */
function timelineCalendar(widget) {
  const tl = siblingWidgets(widget, ['wtimeline'])[0];
  return tl?.config || null;
}
