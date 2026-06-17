/* Homebrew Workshop widget (docs/14 §B): create custom books and fill them with
   homebrew content of any category. Everything created here merges into the
   Compendium and every SRD picker. Books can be shared as Blossom codes. */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el, toast, popMenu, openPanel, confirmDialog, promptText, input } from '../ui/components.js';
import {
  allBooks, getBook, createBook, saveBook, deleteBook, bookSource,
  entriesOf, createEntry, saveEntry, deleteEntry, shareBook, importBook
} from './homebrew-store.js';
import { FORMS, CATEGORY_LABELS, buildEntry, entryToRaw } from './homebrew-forms.js';
import { entryDetail, entrySubtitle } from './tabletop-compendium.js';

const COLORS = ['#c78bb0', '#8bb0c7', '#8bc79a', '#c7b88b', '#b08bc7', '#c78b8b'];

registry.register({
  type: 'homebrew',
  name: 'Homebrew Workshop',
  icon: 'book',
  description: 'Create custom books — spells, monsters, items, races, classes & more',
  keywords: ['homebrew', 'custom', 'book', 'dnd', 'd&d', 'create', 'spell', 'monster', 'tabletop'],
  category: 'Tabletop',
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host) {
    host.innerHTML = '';
    const books = allBooks();
    const entries = entriesOf().length;
    host.appendChild(el(`<div class="row" style="gap:8px;align-items:center">
      <span style="color:var(--accent)">${icon('book', 22)}</span>
      <div><div style="font-weight:650">Homebrew Workshop</div>
      <div class="soft" style="font-size:0.8rem">${books.length} book${books.length === 1 ? '' : 's'} · ${entries} entr${entries === 1 ? 'y' : 'ies'}</div></div></div>`));
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);

    const showBooks = () => {
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Your books</h3>
        <div class="row" style="gap:6px"><button class="btn d-import">${icon('code', 14)} Import</button><button class="btn btn-primary d-new">${icon('plus', 15)} Book</button></div></div>`);
      head.querySelector('.d-new').onclick = () => { const b = createBook({ color: COLORS[allBooks().length % COLORS.length] }); showBook(b.id, true); };
      head.querySelector('.d-import').onclick = importFlow;
      wrap.appendChild(head);

      const books = allBooks();
      if (!books.length) { wrap.appendChild(el('<div class="empty-state">' + icon('book', 28) + '<p>Make your first book, then fill it with custom spells, monsters, items — anything.</p></div>')); return; }
      for (const b of books) {
        const count = entriesOf(b.id).length;
        const row = el(`<button class="list-item"><span class="hb-dot" style="background:${b.color || 'var(--accent)'}"></span>
          <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
          <span class="soft" style="font-size:0.78rem">${count} entr${count === 1 ? 'y' : 'ies'}</span></button>`);
        row.querySelector('.li-title').textContent = b.name;
        row.querySelector('.li-sub').textContent = bookSource(b) + (b.author ? ` · ${b.author}` : '');
        row.onclick = () => showBook(b.id);
        wrap.appendChild(row);
      }
    };

    const importFlow = async () => {
      const code = await promptText({ title: 'Import a homebrew book', label: 'Paste the book code', placeholder: 'BLSM1.obj.…', confirmText: 'Import' });
      if (!code) return;
      try { const r = await importBook(code); toast(`Imported “${r.book.name}” (${r.count} entr${r.count === 1 ? 'y' : 'ies'}).`, 'book'); showBooks(); }
      catch (e) { toast(e.message || 'That code could not be read.', 'book'); }
    };

    const showBook = (id, fresh = false) => {
      const b = getBook(id);
      if (!b) return showBooks();
      wrap.innerHTML = '';

      const head = el(`<div class="row" style="gap:8px;margin-bottom:8px;align-items:center">
        <button class="btn-icon" title="All books">${icon('arrow-left', 17)}</button>
        <span class="hb-dot" style="background:${b.color || 'var(--accent)'}"></span>
        <input class="input grow b-name" style="font-weight:650" placeholder="Book name">
        <input class="input b-abbr" style="width:64px" placeholder="ABBR">
        <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
      head.querySelector('[title="All books"]').onclick = showBooks;
      const nameIn = head.querySelector('.b-name'), abbrIn = head.querySelector('.b-abbr');
      nameIn.value = b.name || ''; abbrIn.value = b.abbrev || '';
      nameIn.onchange = () => saveBook(id, { name: nameIn.value.trim() || 'Untitled book' });
      abbrIn.onchange = () => saveBook(id, { abbrev: abbrIn.value.trim() });
      head.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Recolor', iconName: 'sparkles', fn: () => { const next = COLORS[(COLORS.indexOf(b.color) + 1) % COLORS.length]; saveBook(id, { color: next }); showBook(id); } },
        { label: 'Set author', iconName: 'edit', fn: async () => { const a = await promptText({ title: 'Author', label: 'Author name', value: b.author || '', confirmText: 'Save' }); if (a !== null) { saveBook(id, { author: a.trim() }); showBook(id); } } },
        { label: 'Share book (copy code)', iconName: 'code', fn: async () => { const code = await shareBook(id); if (code) { try { await navigator.clipboard.writeText(code); toast('Book code copied — share it anywhere.', 'code'); } catch { toast('Could not copy automatically.', 'code'); } } } },
        'sep',
        { label: 'Delete book', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${b.name}”?`, message: 'The book and its entries rest in the trash for 30 days.' })) { deleteBook(id); toast('Book filed away', 'leaf'); showBooks(); } } }
      ]);
      wrap.appendChild(head);

      const desc = el('<textarea class="input" rows="2" placeholder="What is this book about?" style="margin-bottom:10px"></textarea>');
      desc.value = b.description || '';
      desc.onchange = () => saveBook(id, { description: desc.value });
      wrap.appendChild(desc);

      const addRow = el(`<div class="row" style="margin-bottom:10px"><button class="btn btn-primary" style="width:100%">${icon('plus', 14)} Add entry</button></div>`);
      addRow.querySelector('button').onclick = (e) => popMenu(e.currentTarget, Object.keys(CATEGORY_LABELS).map(cat => ({
        label: CATEGORY_LABELS[cat], iconName: 'plus', fn: () => openEntryEditor({ bookId: id, category: cat, onSaved: () => showBook(id) })
      })));
      wrap.appendChild(addRow);

      const list = el('<div class="cmp-list"></div>');
      wrap.appendChild(list);
      const entries = entriesOf(id);
      if (!entries.length) list.appendChild(el('<p class="soft" style="font-size:0.85rem;padding:6px">No entries yet — add your first above.</p>'));
      let openId = null;
      for (const o of entries) {
        const shaped = { ...o.data.entry, kind: catKind(o.data.category), _cat: o.data.category, homebrew: true, source: bookSource(b) };
        const row = el(`<div class="cmp-row"><button class="list-item cmp-head" style="width:100%;text-align:left;cursor:pointer">
          <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
          <span class="cmp-tag">${CATEGORY_LABELS[o.data.category] || ''}</span>
          <button class="btn-icon hb-edit" title="Edit">${icon('edit', 13)}</button>
          <button class="btn-icon hb-del" title="Delete">${icon('trash', 13)}</button></button>
          <div class="cmp-body" style="display:none"></div></div>`);
        row.querySelector('.li-title').textContent = o.data.entry.name || 'Unnamed';
        row.querySelector('.li-sub').textContent = entrySubtitle(shaped);
        const body = row.querySelector('.cmp-body');
        row.querySelector('.cmp-head').onclick = (ev) => {
          if (ev.target.closest('.hb-edit, .hb-del')) return;
          const isOpen = openId === o.id; openId = isOpen ? null : o.id;
          list.querySelectorAll('.cmp-body').forEach(x => { x.style.display = 'none'; x.innerHTML = ''; });
          if (!isOpen) { body.appendChild(entryDetail(shaped)); body.style.display = ''; }
        };
        row.querySelector('.hb-edit').onclick = () => openEntryEditor({ bookId: id, category: o.data.category, entryId: o.id, entry: o.data.entry, onSaved: () => showBook(id) });
        row.querySelector('.hb-del').onclick = async () => { if (await confirmDialog({ title: 'Delete this entry?', message: 'It rests in the trash for 30 days.' })) { deleteEntry(o.id); showBook(id); } };
        list.appendChild(row);
      }

      if (fresh) setTimeout(() => nameIn.select(), 120);
    };

    showBooks();
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Homebrew you create here appears in the Compendium and in every “SRD” picker across the Tabletop widgets, tagged with its book. Share a book to hand all its contents to someone else as a Blossom code.</p>'));
  }
});

const KINDS = { spells: 'spell', monsters: 'monster', classes: 'class', races: 'race', backgrounds: 'background', feats: 'feat', weapons: 'weapon', armor: 'armor', gear: 'gear', items: 'magicitem', rules: 'rule', conditions: 'condition' };
const catKind = (c) => KINDS[c] || 'rule';

/* ---------- field-driven entry editor ---------- */

function openEntryEditor({ bookId, category, entryId = null, entry = null, onSaved }) {
  const d = openPanel({ title: `${entryId ? 'Edit' : 'New'} ${CATEGORY_LABELS[category]}`, iconName: 'book' });
  const raw = entryToRaw(category, entry || {});
  const fields = FORMS[category];

  for (const f of fields) {
    if (f.type === 'abilities') {
      d.body.appendChild(el(`<label class="hb-flabel">${f.label}</label>`));
      const grid = el('<div class="hb-abil"></div>');
      for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
        const cell = el(`<div><span>${k.toUpperCase()}</span><input class="input" type="number" min="1" max="30"></div>`);
        const inp = cell.querySelector('input');
        inp.value = raw[k] ?? 10;
        inp.oninput = () => { raw[k] = Number(inp.value) || 10; };
        grid.appendChild(cell);
      }
      d.body.appendChild(grid);
      continue;
    }
    d.body.appendChild(el(`<label class="hb-flabel">${f.label}</label>`));
    let ctrl;
    if (f.type === 'textarea' || f.type === 'lines') {
      ctrl = el(`<textarea class="input" rows="${f.type === 'lines' ? 4 : 5}"></textarea>`);
      ctrl.value = raw[f.key] || '';
      ctrl.oninput = () => { raw[f.key] = ctrl.value; };
    } else if (f.type === 'bool') {
      ctrl = el('<label class="row" style="gap:8px;align-items:center;font-size:0.88rem"><input type="checkbox"> Yes</label>');
      ctrl.querySelector('input').checked = !!raw[f.key];
      ctrl.querySelector('input').onchange = (e) => { raw[f.key] = e.target.checked; };
    } else if (f.type === 'select') {
      ctrl = el('<select class="select"></select>');
      ctrl.appendChild(new Option('—', ''));
      for (const o of f.options) ctrl.appendChild(new Option(o, o));
      ctrl.value = raw[f.key] || '';
      ctrl.onchange = () => { raw[f.key] = ctrl.value; };
    } else {
      ctrl = input(raw[f.key] ?? '', f.ph || '');
      if (f.type === 'num') ctrl.type = 'number';
      ctrl.oninput = () => { raw[f.key] = ctrl.value; };
    }
    ctrl.classList.add('hb-field');
    d.body.appendChild(ctrl);
  }

  const save = el(`<button class="btn btn-primary" style="width:100%;margin-top:14px">${icon('check', 15)} Save entry</button>`);
  save.onclick = () => {
    const built = buildEntry(category, raw);
    if (!built.name) { toast('Give it a name first.', 'book'); return; }
    if (entryId) saveEntry(entryId, category, built);
    else createEntry(bookId, category, built);
    d.close();
    onSaved?.();
  };
  d.body.appendChild(save);
  setTimeout(() => d.body.querySelector('input, textarea, select')?.focus(), 150);
}
