/* DocumentShelf widget (docs/08 §6): imported handouts as Blobs with tags and
   a linked topic. Build-time decision (noted in docs): images open in the
   inline lightbox; PDFs open in a new tab from their Blob URL — no vendored
   PDF renderer (keeps the zero-dependency rule; both work fully offline). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, confirmDialog, promptText, popMenu, toast } from '../ui/components.js';
import { objectsOf, createObject, saveObject, fmtDate, todayStr } from './base.js';
import { topicsOf } from './notebook.js';

const urls = new Map();
function urlFor(obj) {
  if (!urls.has(obj.id)) urls.set(obj.id, URL.createObjectURL(obj.data.blob));
  return urls.get(obj.id);
}

/* V2 §25: Library groups — named, infinitely-nestable folders (flat parentId
   list, null = root shelf). Docs carry a groupId. */
function groups(widget) { return widget.config.groups || (widget.config.groups = []); }
function childGroups(widget, parentId) { return groups(widget).filter(g => (g.parentId || null) === (parentId || null)); }
function descGroupIds(widget, id) { const out = [id]; const walk = (p) => { for (const g of groups(widget)) if (g.parentId === p) { out.push(g.id); walk(g.id); } }; walk(id); return out; }

function moduleTopics(widget) {
  const mod = store.all('modules').find(m => m.pages.some(p => store.get('pages', p)?.widgets.includes(widget.id)));
  if (!mod) return [];
  return mod.pages.flatMap(pid => (store.get('pages', pid)?.widgets || []))
    .map(id => store.get('widgets', id))
    .filter(w => w?.type === 'notebook')
    .flatMap(nb => topicsOf(nb));
}

registry.register({
  type: 'docshelf',
  name: 'Library',
  icon: 'archive',
  description: 'Handouts and documents beside your notes',
  keywords: ['study', 'pdf', 'documents', 'handouts', 'files'],
  external: true, internal: true,

  renderCard(host, widget) {
    host.innerHTML = '';
    const docs = objectsOf(widget.id, 'doc');
    if (!docs.length) {
      host.appendChild(el('<p class="soft">Tap to shelve your first document.</p>'));
      return;
    }
    host.appendChild(el(`<div class="row-between"><span style="font-size:0.92rem">${docs.length} document${docs.length === 1 ? '' : 's'}</span><span class="soft" style="font-size:0.78rem">latest: ${fmtDate(todayStr(new Date(Math.max(...docs.map(d => d.updatedAt)))))}</span></div>`));
  },

  renderFull(host, widget, ctx) {
    const save = () => store.put('widgets', widget);
    let parentId = null; // current folder (null = root)
    let query = '';

    const docRow = (doc, showFolder) => {
      const topics = moduleTopics(widget);
      const isPdf = doc.data.blob.type === 'application/pdf';
      const li = el(`<div class="list-item" style="cursor:default">
        <span style="color:var(--accent)">${icon(isPdf ? 'note' : 'image', 18)}</span>
        <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
        <button class="btn-icon" title="Open">${icon('eye', 15)}</button>
        <button class="btn-icon" title="More">${icon('more', 14)}</button></div>`);
      li.querySelector('.li-title').textContent = doc.data.name;
      const topic = topics.find(t => t.id === doc.data.topicId);
      const folder = showFolder ? groups(widget).find(g => g.id === doc.data.groupId)?.name : null;
      li.querySelector('.li-sub').textContent =
        [folder ? `📁 ${folder}` : null, (doc.data.tags || []).map(t => `#${t}`).join(' '), topic ? `→ ${topic.name}` : null].filter(Boolean).join(' · ') || (isPdf ? 'PDF' : 'image');
      li.querySelector('[title="Open"]').onclick = () => {
        if (isPdf) { window.open(urlFor(doc), '_blank'); return; }
        const box = el(`<div class="gal-light"><img alt=""><div class="row" style="justify-content:center;margin-top:10px"><button class="btn btn-primary">Done</button></div></div>`);
        box.querySelector('img').src = urlFor(doc);
        box.querySelector('button').onclick = () => box.remove();
        host.appendChild(box);
      };
      li.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Tags', iconName: 'tag', fn: async () => { const tags = await promptText({ title: 'Tags', label: 'Comma-separated', value: (doc.data.tags || []).join(', ') }); if (tags != null) { doc.data.tags = tags.split(',').map(t => t.trim()).filter(Boolean); saveObject(doc); render(); } } },
        { label: 'Set topic', iconName: 'book-open', fn: async () => { const topics2 = moduleTopics(widget); const names = ['(none)', ...topics2.map(t => `${t.subject} › ${t.name}`)]; const pick = await promptText({ title: 'Topic id', label: `Type a number 0–${topics2.length}: ${names.map((n, i) => `${i}=${n}`).join('  ')}` }); const idx = Number(pick); if (!Number.isNaN(idx)) { doc.data.topicId = idx === 0 ? null : topics2[idx - 1]?.id || null; saveObject(doc); render(); } } },
        { label: 'Move to folder', iconName: 'folder', fn: (ev) => moveMenu(ev?.currentTarget || li, doc) },
        { label: 'Remove', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Remove “${doc.data.name}”?` })) { store.trash('objects', doc.id); render(); } } }
      ]);
      return li;
    };

    const moveMenu = (anchor, doc) => {
      const items = [{ label: 'Root shelf', iconName: 'archive', fn: () => { doc.data.groupId = null; saveObject(doc); render(); } }];
      for (const g of groups(widget)) items.push({ label: g.name, iconName: 'folder', fn: () => { doc.data.groupId = g.id; saveObject(doc); render(); } });
      popMenu(anchor, items);
    };

    host.innerHTML = '';
    const search = el('<input class="input" type="search" placeholder="Search all documents…" style="margin-bottom:10px">');
    const results = el('<div></div>');
    host.append(search, results);
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render(); });

    const render = () => {
      host = results; // route appends below into the results container
      host.innerHTML = '';
      const allDocs = objectsOf(widget.id, 'doc');

      if (query) {
        const hits = allDocs.filter(d => `${d.data.name} ${(d.data.tags || []).join(' ')}`.toLowerCase().includes(query)).sort((a, b) => b.updatedAt - a.updatedAt);
        if (!hits.length) host.appendChild(el('<p class="soft" style="padding:10px">No documents match.</p>'));
        for (const doc of hits) host.appendChild(docRow(doc, true));
        return;
      }

      if (parentId) {
        const g = groups(widget).find(x => x.id === parentId);
        const back = el(`<button class="btn btn-ghost" style="margin-bottom:8px">${icon('arrow-left', 14)} Back</button>`);
        back.onclick = () => { const cur = groups(widget).find(x => x.id === parentId); parentId = cur?.parentId || null; render(); };
        host.appendChild(back);
        host.appendChild(el('<h2 style="margin-bottom:10px"></h2>')).textContent = g?.name || 'Folder';
      }

      // subfolders
      for (const g of childGroups(widget, parentId)) {
        const ids = descGroupIds(widget, g.id);
        const count = allDocs.filter(d => ids.includes(d.data.groupId)).length;
        const li = el(`<button class="list-item">${icon('folder', 18)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${count} document${count === 1 ? '' : 's'} · ${childGroups(widget, g.id).length} folders</span></span><span class="btn-icon g-menu">${icon('more', 14)}</span></button>`);
        li.querySelector('.li-title').textContent = g.name;
        li.onclick = (e) => { if (e.target.closest('.g-menu')) return; parentId = g.id; render(); };
        li.querySelector('.g-menu').addEventListener('click', (e) => { e.stopPropagation(); popMenu(e.currentTarget, [
          { label: 'Rename', iconName: 'edit', fn: async () => { const n = await promptText({ title: 'Rename folder', value: g.name }); if (n) { g.name = n; save(); render(); } } },
          { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${g.name}”?`, message: 'Documents inside move to the parent shelf.' })) { const ids = descGroupIds(widget, g.id); for (const d of allDocs) if (ids.includes(d.data.groupId)) { d.data.groupId = g.parentId || null; saveObject(d); } widget.config.groups = groups(widget).filter(x => !ids.includes(x.id)); save(); render(); } } }
        ]); });
        host.appendChild(li);
      }

      // docs directly in this folder
      const here = allDocs.filter(d => (d.data.groupId || null) === (parentId || null)).sort((a, b) => b.updatedAt - a.updatedAt);
      for (const doc of here) host.appendChild(docRow(doc, false));
      if (!childGroups(widget, parentId).length && !here.length) host.appendChild(el('<p class="soft" style="text-align:center;padding:16px">A quiet shelf — add folders or documents below.</p>'));

      const addFolder = el(`<button class="btn-soft-wide" style="margin-top:10px">${icon('folder', 15)} New ${parentId ? 'subfolder' : 'folder'}</button>`);
      addFolder.onclick = async () => { const n = await promptText({ title: 'New folder', label: 'Folder name', placeholder: 'Handouts' }); if (n) { groups(widget).push({ id: ulid(), name: n, parentId: parentId || null }); save(); render(); } };
      host.appendChild(addFolder);

      const add = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('plus', 15)} Add documents${parentId ? ' here' : ''}</button>`);
      add.onclick = () => {
        const fileIn = el('<input type="file" accept="application/pdf,image/*" multiple class="hidden">');
        document.body.appendChild(fileIn);
        fileIn.onchange = () => {
          for (const f of fileIn.files) createObject(widget.id, 'doc', { blob: f, name: f.name.replace(/\.\w+$/, ''), tags: [], topicId: null, groupId: parentId || null });
          fileIn.remove(); render(); ctx.refreshCard(widget);
        };
        fileIn.click();
      };
      host.appendChild(add);
    };
    render();
  }
});
