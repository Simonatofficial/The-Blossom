/* DocumentShelf widget (docs/08 §6): imported handouts as Blobs with tags and
   a linked topic. Build-time decision (noted in docs): images open in the
   inline lightbox; PDFs open in a new tab from their Blob URL — no vendored
   PDF renderer (keeps the zero-dependency rule; both work fully offline). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, confirmDialog, promptText } from '../ui/components.js';
import { objectsOf, createObject, saveObject, fmtDate, todayStr } from './base.js';
import { topicsOf } from './notebook.js';

const urls = new Map();
function urlFor(obj) {
  if (!urls.has(obj.id)) urls.set(obj.id, URL.createObjectURL(obj.data.blob));
  return urls.get(obj.id);
}

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
    const render = () => {
      host.innerHTML = '';
      const topics = moduleTopics(widget);
      const docs = objectsOf(widget.id, 'doc').sort((a, b) => b.updatedAt - a.updatedAt);
      for (const doc of docs) {
        const isPdf = doc.data.blob.type === 'application/pdf';
        const li = el(`<div class="list-item" style="cursor:default">
          <span style="color:var(--accent)">${icon(isPdf ? 'note' : 'image', 18)}</span>
          <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
          <button class="btn-icon" title="Open">${icon('eye', 15)}</button>
          <button class="btn-icon" title="Tags">${icon('tag', 14)}</button>
          <button class="btn-icon" title="Topic">${icon('book-open', 14)}</button>
          <button class="btn-icon" title="Remove">${icon('trash', 14)}</button></div>`);
        li.querySelector('.li-title').textContent = doc.data.name;
        const topic = topics.find(t => t.id === doc.data.topicId);
        li.querySelector('.li-sub').textContent =
          [(doc.data.tags || []).map(t => `#${t}`).join(' '), topic ? `→ ${topic.name}` : null].filter(Boolean).join(' · ') || (isPdf ? 'PDF' : 'image');
        li.querySelector('[title="Open"]').onclick = () => {
          if (isPdf) { window.open(urlFor(doc), '_blank'); return; } // PDFs: new tab from the Blob URL
          const box = el(`<div class="gal-light"><img alt=""><div class="row" style="justify-content:center;margin-top:10px"><button class="btn btn-primary">Done</button></div></div>`);
          box.querySelector('img').src = urlFor(doc);
          box.querySelector('button').onclick = () => box.remove();
          host.appendChild(box);
        };
        li.querySelector('[title="Tags"]').onclick = async () => {
          const tags = await promptText({ title: 'Tags', label: 'Comma-separated', value: (doc.data.tags || []).join(', ') });
          if (tags != null) { doc.data.tags = tags.split(',').map(t => t.trim()).filter(Boolean); saveObject(doc); render(); }
        };
        li.querySelector('[title="Topic"]').onclick = (e) => {
          const sel = el('<select class="select" style="max-width:180px"></select>');
          sel.appendChild(new Option('No topic', ''));
          for (const t of topics) sel.appendChild(new Option(`${t.subject} › ${t.name}`, t.id));
          sel.value = doc.data.topicId || '';
          sel.onchange = () => { doc.data.topicId = sel.value || null; saveObject(doc); render(); };
          e.currentTarget.replaceWith(sel);
        };
        li.querySelector('[title="Remove"]').onclick = async () => {
          if (await confirmDialog({ title: `Remove “${doc.data.name}”?` })) {
            store.trash('objects', doc.id);
            render();
          }
        };
        host.appendChild(li);
      }
      if (!docs.length) host.appendChild(el('<p class="soft" style="text-align:center;padding:16px">A quiet shelf — add PDFs or images below.</p>'));

      const add = el(`<button class="btn-soft-wide" style="margin-top:10px">${icon('plus', 15)} Add documents</button>`);
      add.onclick = () => {
        const fileIn = el('<input type="file" accept="application/pdf,image/*" multiple class="hidden">');
        document.body.appendChild(fileIn);
        fileIn.onchange = () => {
          for (const f of fileIn.files) {
            createObject(widget.id, 'doc', { blob: f, name: f.name.replace(/\.\w+$/, ''), tags: [], topicId: null });
          }
          fileIn.remove();
          render();
          ctx.refreshCard(widget);
        };
        fileIn.click();
      };
      host.appendChild(add);
    };
    render();
  }
});
