/* LoreWiki widget (docs/08 §5): a wiki of lore articles — categories, tags,
   [[wikilinks]] with a picker, backlinks on every article, and orphan/broken
   link lists for gardening. Articles are rich-text objects on this widget. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, input, popMenu } from '../ui/components.js';
import { objectsOf, createObject, saveObject, fmtDate, todayStr } from './base.js';
import { watchWikilinks, wireWikilinks, linkedRefs, openEntryPicker, openEntry, onWbOpen } from './wb-shared.js';

const DEFAULT_CATS = ['History', 'Religion', 'Magic', 'Cultures', 'Creatures', 'Items', 'Languages', 'Cosmology', 'Places'];

const articles = (w) => objectsOf(w.id, 'article');

function plain(html) {
  const t = document.createElement('div');
  t.innerHTML = html || '';
  return t.textContent.replace(/\s+/g, ' ').trim();
}

registry.register({
  type: 'lorewiki',
  name: 'Lore Wiki',
  icon: 'book-open',
  description: 'A linked wiki of your world’s lore',
  keywords: ['world', 'lore', 'wiki', 'articles', 'history'],
  external: true, internal: true,
  defaultConfig: () => ({ categories: [...DEFAULT_CATS] }),

  outputs: (widget) => [{
    key: 'articles', name: 'Article count', dayKeyed: false,
    get: () => articles(widget).length
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const arts = articles(widget);
    const counts = {};
    for (const a of arts) counts[a.data.category || 'Uncategorized'] = (counts[a.data.category || 'Uncategorized'] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    host.appendChild(el(`<div class="row" style="justify-content:space-between">
      <div><div style="font-size:1.6rem;font-weight:650">${arts.length}</div><div class="soft" style="font-size:0.78rem">article${arts.length === 1 ? '' : 's'}</div></div>
      <div class="row" style="flex-wrap:wrap;gap:4px;justify-content:flex-end">${top.map(([c, n]) => `<span class="chip">${c} · ${n}</span>`).join('')}</div>
    </div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);
    let catFilter = null, query = '';

    /* the wiki is one view with two modes: index ⇄ article */
    const showIndex = () => {
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="gap:8px;margin-bottom:10px"><input class="input grow" placeholder="Search lore…"><button class="btn btn-primary">${icon('plus', 15)} Article</button></div>`);
      const [search, addBtn] = head.children;
      search.value = query;
      search.oninput = () => { query = search.value; renderList(); };
      addBtn.onclick = async () => {
        const a = createObject(widget.id, 'article', { title: 'New article', category: catFilter || widget.config.categories[0], tags: [], html: '', updated: todayStr() });
        showArticle(a.id, true);
      };
      wrap.appendChild(head);

      const cats = el('<div class="row" style="flex-wrap:wrap;gap:4px;margin-bottom:10px"></div>');
      const catChip = (label, val) => {
        const c = el(`<button class="chip ${catFilter === val ? 'accent' : ''}">${label}</button>`);
        c.onclick = () => { catFilter = catFilter === val ? null : val; showIndex(); };
        cats.appendChild(c);
      };
      catChip('All', null);
      for (const c of widget.config.categories) catChip(c, c);
      const addCat = el(`<button class="chip">${icon('plus', 11)}</button>`);
      addCat.onclick = async () => {
        const { promptText } = await import('../ui/components.js');
        const name = await promptText({ title: 'New category', label: 'Name' });
        if (name && !widget.config.categories.includes(name)) {
          widget.config.categories.push(name);
          store.put('widgets', widget);
          showIndex();
        }
      };
      cats.appendChild(addCat);
      wrap.appendChild(cats);

      const list = el('<div></div>');
      wrap.appendChild(list);
      const renderList = () => {
        list.innerHTML = '';
        const q = query.trim().toLowerCase();
        const arts = articles(widget)
          .filter(a => !catFilter || a.data.category === catFilter)
          .filter(a => !q || a.data.title.toLowerCase().includes(q) || plain(a.data.html).toLowerCase().includes(q) || (a.data.tags || []).some(t => t.toLowerCase().includes(q)))
          .sort((a, b) => a.data.title.localeCompare(b.data.title));
        if (!arts.length) {
          list.appendChild(el('<div class="empty-state" style="padding:30px 10px">' + icon('book-open', 28) + '<p>No lore yet — every world starts with one story.</p></div>'));
        }
        for (const a of arts) {
          const li = el(`<button class="list-item"><span style="color:var(--accent)">${icon('book-open', 16)}</span>
            <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
            <span class="chip"></span></button>`);
          li.querySelector('.li-title').textContent = a.data.title;
          li.querySelector('.li-sub').textContent = plain(a.data.html).slice(0, 90) || 'Empty page';
          li.querySelector('.chip').textContent = a.data.category || '—';
          li.onclick = () => showArticle(a.id);
          list.appendChild(li);
        }
        // gardening: orphans + broken links (docs/08 §5)
        const all = articles(widget);
        const inbound = new Set();
        const broken = [];
        for (const a of all) {
          for (const ref of linkedRefs(a.data.html)) {
            if (store.get('objects', ref)) inbound.add(ref);
            else broken.push(a);
          }
        }
        const orphans = all.filter(a => !inbound.has(a.id));
        if (all.length > 1 && (orphans.length || broken.length)) {
          const g = el('<div class="panel" style="padding:10px 12px;margin-top:14px"><h3 class="soft" style="font-size:0.72rem;letter-spacing:0.06em;margin-bottom:6px">GARDENING</h3><div class="g-rows soft" style="font-size:0.82rem"></div></div>');
          const rows = g.querySelector('.g-rows');
          if (orphans.length) rows.appendChild(el(`<div>${orphans.length} orphan article${orphans.length === 1 ? '' : 's'} (nothing links here): ${orphans.slice(0, 5).map(a => a.data.title).join(', ')}${orphans.length > 5 ? '…' : ''}</div>`));
          if (broken.length) rows.appendChild(el(`<div>Broken links inside: ${[...new Set(broken.map(a => a.data.title))].slice(0, 5).join(', ')}</div>`));
          list.appendChild(g);
        }
      };
      renderList();
    };

    const showArticle = (id, startEditing = false) => {
      const a = store.get('objects', id);
      if (!a) return showIndex();
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="gap:6px;margin-bottom:8px">
        <button class="btn-icon" title="All articles">${icon('arrow-left', 17)}</button>
        <input class="input grow lw-title" style="font-weight:650">
        <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
      head.querySelector('[title="All articles"]').onclick = () => { commit(); showIndex(); };
      const titleIn = head.querySelector('.lw-title');
      titleIn.value = a.data.title;
      titleIn.onchange = () => { a.data.title = titleIn.value.trim() || 'Untitled'; commit(); };
      head.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Delete article', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: `Delete “${a.data.title}”?`, message: 'It rests in the trash for 30 days.' })) {
            store.trash('objects', a.id);
            toast('Article composted', 'leaf');
            showIndex();
          }
        } }
      ]);
      wrap.appendChild(head);

      const meta = el('<div class="row" style="gap:6px;margin-bottom:10px;flex-wrap:wrap"><select class="select" style="width:auto;padding:5px 9px;font-size:0.82rem"></select><input class="input grow" placeholder="tags, comma separated" style="padding:5px 9px;font-size:0.82rem"></div>');
      const [catSel, tagsIn] = meta.children;
      for (const c of widget.config.categories) catSel.appendChild(new Option(c, c));
      if (a.data.category && !widget.config.categories.includes(a.data.category)) catSel.appendChild(new Option(a.data.category, a.data.category));
      catSel.value = a.data.category || widget.config.categories[0];
      catSel.onchange = () => { a.data.category = catSel.value; commit(); };
      tagsIn.value = (a.data.tags || []).join(', ');
      tagsIn.onchange = () => { a.data.tags = tagsIn.value.split(',').map(t => t.trim()).filter(Boolean); commit(); };
      wrap.appendChild(meta);

      const bar = el(`<div class="note-toolbar" style="margin-bottom:0">
        <button class="btn-icon" title="Bold"><b>B</b></button>
        <button class="btn-icon" title="Italic"><i>I</i></button>
        <button class="btn-icon" title="Heading"><b>H</b></button>
        <button class="btn-icon" title="List">${icon('list', 14)}</button>
        <button class="btn-icon" title="Link an entry ([[ also works)">${icon('link', 14)}</button>
      </div>`);
      const editor = el('<div class="note-editor lw-editor" spellcheck="true"></div>');
      editor.contentEditable = 'true';
      editor.innerHTML = a.data.html || '';
      const exec = (cmd, val = null) => { editor.focus(); document.execCommand(cmd, false, val); save(); };
      const btns = bar.querySelectorAll('button');
      btns.forEach(b => b.onmousedown = (e) => e.preventDefault());
      btns[0].onclick = () => exec('bold');
      btns[1].onclick = () => exec('italic');
      btns[2].onclick = () => exec('formatBlock', '<h3>');
      btns[3].onclick = () => exec('insertUnorderedList');
      btns[4].onclick = () => openEntryPicker(widget, { onPick: (e2) => {
        exec('insertHTML', `<a class="wlink" data-kind="${e2.kind}" data-ref="${e2.id}" contenteditable="false">${e2.label}</a>&nbsp;`);
      } });
      let saveTimer = null;
      const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(commit, 400); };
      editor.addEventListener('input', save);
      watchWikilinks(editor, widget, save);
      wireWikilinks(editor, ctx);
      wrap.append(bar, editor);

      function commit() {
        a.data.html = editor.innerHTML;
        a.data.updated = todayStr();
        saveObject(a);
      }

      // backlinks: every article/civ/character whose text links here
      const back = el('<div class="dsec" style="margin-top:14px"><h3>Backlinks</h3><div class="bl"></div></div>');
      const bl = back.querySelector('.bl');
      let any = false;
      for (const other of articles(widget)) {
        if (other.id === a.id || !linkedRefs(other.data.html).includes(a.id)) continue;
        any = true;
        const li = el(`<button class="list-item">${icon('arrow-left', 14)}<span class="li-main"><span class="li-title"></span></span></button>`);
        li.querySelector('.li-title').textContent = other.data.title;
        li.onclick = () => { commit(); showArticle(other.id); };
        bl.appendChild(li);
      }
      for (const o of store.all('objects')) {
        if ((o.kind === 'civ' || o.kind === 'wchar') && linkedRefs(o.data.notes).includes(a.id)) {
          any = true;
          const li = el(`<button class="list-item">${icon('arrow-left', 14)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${o.kind === 'civ' ? 'civilization' : 'character'}</span></span></button>`);
          li.querySelector('.li-title').textContent = o.data.name;
          li.onclick = () => openEntry({ kind: o.kind === 'civ' ? 'civ' : 'char', id: o.id }, ctx);
          bl.appendChild(li);
        }
      }
      if (!any) bl.appendChild(el('<p class="soft" style="font-size:0.82rem">Nothing links here yet. Type [[ in any article to weave one in.</p>'));
      wrap.appendChild(back);
      wrap.appendChild(el(`<p class="soft" style="font-size:0.74rem;margin-top:8px">Last tended ${fmtDate(a.data.updated || todayStr())}</p>`));
      if (startEditing) setTimeout(() => { titleIn.focus(); titleIn.select(); }, 100);
    };

    // deep-open from pins / pickers (wb-shared openEntry)
    onWbOpen(widget, wrap, (e) => showArticle(e.id)); // wikilinks within the wiki
    if (widget.config.pendingOpen) {
      const id = widget.config.pendingOpen;
      delete widget.config.pendingOpen;
      store.put('widgets', widget);
      showArticle(id);
    } else showIndex();
  }
});
