/* Notebook widget (docs/08 §6 — Study Guide): a two-level organizer
   (subjects → topics) of rich notes. The "Key term" highlight marks
   term — definition pairs that the flashcard generator harvests. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, promptText, confirmDialog, emptyState } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';

function subjects(widget) { return widget.config.subjects || (widget.config.subjects = []); }

/** The note object for a topic (created on demand). */
export function topicNote(widget, topicId) {
  return objectsOf(widget.id, 'topicNote').find(o => o.data.topicId === topicId) ||
    createObject(widget.id, 'topicNote', { topicId, html: '' });
}

/** All topics across a module's notebooks — used by generators and the shelf. */
export function topicsOf(notebookWidget) {
  return subjects(notebookWidget).flatMap(s => s.topics.map(t => ({ ...t, subject: s.name })));
}

/* compact rich editor (subset of the Notes toolbar + the Key term mark) */
function mountEditor(host, obj) {
  const bar = el('<div class="note-toolbar"></div>');
  const editor = el('<div class="note-editor" style="min-height:30vh;padding-bottom:10vh" spellcheck="true"></div>');
  editor.contentEditable = 'true';
  editor.innerHTML = obj.data.html || '';
  let timer = null;
  editor.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { obj.data.html = editor.innerHTML; saveObject(obj); }, 400);
  });
  const exec = (cmd, val = null) => { editor.focus(); document.execCommand(cmd, false, val); editor.dispatchEvent(new Event('input')); };
  const tb = (html, title, fn) => {
    const b = el(`<button class="btn-icon" title="${title}">${html}</button>`);
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = fn;
    return b;
  };
  bar.append(
    tb('<b>H</b>', 'Heading', () => exec('formatBlock', '<h2>')),
    tb('<b>B</b>', 'Bold', () => exec('bold')),
    tb('<i>I</i>', 'Italic', () => exec('italic')),
    tb(icon('list', 15), 'List', () => exec('insertUnorderedList')),
    tb(icon('key', 15), 'Key term (term — definition)', () => {
      // wrap the selection in the key-term mark the generator scans for
      const sel = String(getSelection());
      if (!sel.trim()) return;
      exec('insertHTML', `<mark class="key-term">${sel}</mark>&nbsp;`);
    }),
    tb(icon('minus', 15), 'Divider', () => exec('insertHorizontalRule'))
  );
  host.append(bar, editor);
}

registry.register({
  type: 'notebook',
  name: 'Notebook',
  icon: 'book-open',
  description: 'Subjects → topics → rich study notes',
  keywords: ['study', 'school', 'subject', 'topic', 'class'],
  external: true, internal: true,
  defaultConfig: () => ({ subjects: [] }),

  outputs: (widget) => [{
    key: 'topics', name: 'Topics', dayKeyed: false,
    get: () => subjects(widget).reduce((a, s) => a + s.topics.length, 0)
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const subs = subjects(widget);
    if (!subs.length) {
      host.appendChild(el('<p class="soft">Tap to plant your first subject.</p>'));
      return;
    }
    for (const s of subs.slice(0, 4)) {
      host.appendChild(el(`<div class="row-between" style="padding:4px 0">
        <span style="font-size:0.92rem">${icon('folder', 14)} <span class="nb-s"></span></span>
        <span class="soft" style="font-size:0.78rem">${s.topics.length} topic${s.topics.length === 1 ? '' : 's'}</span></div>`))
        .querySelector('.nb-s').textContent = s.name;
    }
  },

  renderFull(host, widget, ctx) {
    let view = { subject: null, topic: null };

    const render = () => {
      host.innerHTML = '';
      const save = () => store.put('widgets', widget);

      if (view.topic) { // ---- topic note editor ----
        const back = el(`<button class="btn btn-ghost" style="margin-bottom:8px">${icon('arrow-left', 14)} ${view.subject.name}</button>`);
        back.onclick = () => { view.topic = null; render(); };
        host.appendChild(back);
        host.appendChild(el(`<h2 style="margin-bottom:10px">${view.topic.name}</h2>`));
        mountEditor(host, topicNote(widget, view.topic.id));
        host.appendChild(el('<p class="soft" style="font-size:0.76rem;margin-top:8px">Mark “term — definition” lines with the key icon; the flashcard generator gathers them.</p>'));
        return;
      }

      if (view.subject) { // ---- topics of a subject ----
        const back = el(`<button class="btn btn-ghost" style="margin-bottom:8px">${icon('arrow-left', 14)} Subjects</button>`);
        back.onclick = () => { view.subject = null; render(); };
        host.appendChild(back);
        host.appendChild(el(`<h2 style="margin-bottom:10px">${view.subject.name}</h2>`));
        for (const t of view.subject.topics) {
          const note = objectsOf(widget.id, 'topicNote').find(o => o.data.topicId === t.id);
          const terms = (note?.data.html.match(/key-term/g) || []).length;
          const li = el(`<button class="list-item">${icon('note', 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${terms} key term${terms === 1 ? '' : 's'}</span></span><span class="btn-icon t-menu">${icon('more', 14)}</span></button>`);
          li.querySelector('.li-title').textContent = t.name;
          li.onclick = (e) => { if (e.target.closest('.t-menu')) return; view.topic = t; render(); };
          li.querySelector('.t-menu').addEventListener('click', (e) => {
            e.stopPropagation();
            popMenu(e.currentTarget, [
              { label: 'Rename', iconName: 'edit', fn: async () => {
                const name = await promptText({ title: 'Rename topic', value: t.name });
                if (name) { t.name = name; save(); render(); }
              } },
              { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
                if (await confirmDialog({ title: `Delete “${t.name}”?` })) {
                  view.subject.topics = view.subject.topics.filter(x => x.id !== t.id);
                  save();
                  render();
                }
              } }
            ]);
          });
          host.appendChild(li);
        }
        const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add topic</button>`);
        add.onclick = async () => {
          const name = await promptText({ title: 'New topic', label: 'Topic', placeholder: 'Photosynthesis' });
          if (name) { view.subject.topics.push({ id: ulid(), name }); save(); render(); }
        };
        host.appendChild(add);
        return;
      }

      // ---- subjects ----
      if (!subjects(widget).length) {
        host.appendChild(emptyState('book-open', 'A fresh notebook. Add your first subject?'));
      }
      for (const s of subjects(widget)) {
        const li = el(`<button class="list-item">${icon('folder', 18)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${s.topics.length} topic${s.topics.length === 1 ? '' : 's'}</span></span><span class="btn-icon s-menu">${icon('more', 14)}</span></button>`);
        li.querySelector('.li-title').textContent = s.name;
        li.onclick = (e) => { if (e.target.closest('.s-menu')) return; view.subject = s; render(); };
        li.querySelector('.s-menu').addEventListener('click', (e) => {
          e.stopPropagation();
          popMenu(e.currentTarget, [
            { label: 'Rename', iconName: 'edit', fn: async () => {
              const name = await promptText({ title: 'Rename subject', value: s.name });
              if (name) { s.name = name; save(); render(); }
            } },
            { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
              if (await confirmDialog({ title: `Delete “${s.name}”?`, message: 'Its topics and notes go to the trash.' })) {
                widget.config.subjects = subjects(widget).filter(x => x.id !== s.id);
                save();
                render();
              }
            } }
          ]);
        });
        host.appendChild(li);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add subject</button>`);
      add.onclick = async () => {
        const name = await promptText({ title: 'New subject', label: 'Subject', placeholder: 'Biology' });
        if (name) { subjects(widget).push({ id: ulid(), name, topics: [] }); save(); render(); }
      };
      host.appendChild(add);
    };

    render();
  }
});
