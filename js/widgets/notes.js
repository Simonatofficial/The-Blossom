/* Notes widget (docs/05): rich text editor — contenteditable + custom toolbar,
   no libraries. Infinitely nestable: any widget can be embedded as a block.
   Images are embedded as downscaled data URLs so notes survive export intact
   (decision noted in docs/05). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, popMenu } from '../ui/components.js';
import { objectsOf, createObject, saveObject, childWidgetsOf, fmtDate, todayStr } from './base.js';
import { openNodePicker, openWidgetGallery } from '../ui/picker.js';

function noteObject(widget) {
  return objectsOf(widget.id, 'note')[0] ||
    createObject(widget.id, 'note', { html: '', lastOpened: null });
}

function previewText(html) {
  const t = document.createElement('div');
  t.innerHTML = html || '';
  t.querySelectorAll('.embed-widget').forEach(e => e.replaceWith(' ⬡ widget '));
  return t.textContent.replace(/\s+/g, ' ').trim();
}

function cleanHtml(editor) {
  const clone = editor.cloneNode(true);
  clone.querySelectorAll('.embed-widget').forEach(e => { e.innerHTML = ''; });
  // persist checkbox state into the markup
  clone.querySelectorAll('input[type="checkbox"]').forEach((c, i) => {
    const live = editor.querySelectorAll('input[type="checkbox"]')[i];
    if (live?.checked) c.setAttribute('checked', '');
    else c.removeAttribute('checked');
  });
  return clone.innerHTML;
}

registry.register({
  type: 'notes',
  name: 'Notes',
  icon: 'note',
  description: 'Rich text, images, links, nested widgets',
  container: true,
  external: true, internal: true,

  outputs: (widget) => [{
    key: 'words', name: 'Word count', dayKeyed: false,
    get: () => previewText(noteObject(widget).data.html).split(/\s+/).filter(Boolean).length
  }],

  renderCard(host, widget) {
    const obj = noteObject(widget);
    host.innerHTML = '';
    const card = el(`<div class="notes-card-preview">
      <div class="n-date"></div>
      <div class="n-preview"></div>
    </div>`);
    card.querySelector('.n-date').textContent = obj.data.lastOpened
      ? `Last opened ${fmtDate(obj.data.lastOpened)}`
      : 'A fresh page';
    card.querySelector('.n-preview').textContent = previewText(obj.data.html) || 'Tap to begin writing…';
    host.appendChild(card);
  },

  renderFull(host, widget, ctx) {
    const obj = noteObject(widget);
    obj.data.lastOpened = todayStr();
    store.put('objects', obj);

    host.innerHTML = '';
    const bar = el('<div class="note-toolbar"></div>');
    const editor = el('<div class="note-editor" spellcheck="true"></div>');
    editor.contentEditable = 'true';
    editor.innerHTML = obj.data.html || '';

    const save = () => { obj.data.html = cleanHtml(editor); saveObject(obj); };
    let saveTimer = null;
    editor.addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); });
    editor.addEventListener('change', save, true); // checkboxes

    const exec = (cmd, val = null) => { editor.focus(); document.execCommand(cmd, false, val); save(); };
    const tb = (html, title, fn) => {
      const b = el(`<button class="btn-icon" title="${title}">${html}</button>`);
      b.onmousedown = (e) => e.preventDefault(); // keep selection
      b.onclick = fn;
      return b;
    };
    const sep = () => el('<span class="sep"></span>');

    bar.append(
      tb('<b>T</b>', 'Title', (e) => popMenu(e.currentTarget, [
        { label: 'Title', fn: () => exec('formatBlock', '<h1>') },
        { label: 'Heading', fn: () => exec('formatBlock', '<h2>') },
        { label: 'Subheading', fn: () => exec('formatBlock', '<h3>') },
        { label: 'Body', fn: () => exec('formatBlock', '<p>') }
      ])),
      tb('<b>B</b>', 'Bold', () => exec('bold')),
      tb('<i>I</i>', 'Italic', () => exec('italic')),
      tb('<u>U</u>', 'Underline', () => exec('underline')),
      tb('A↕', 'Text size', (e) => popMenu(e.currentTarget, [
        { label: 'Small', fn: () => exec('fontSize', '2') },
        { label: 'Normal', fn: () => exec('fontSize', '3') },
        { label: 'Large', fn: () => exec('fontSize', '5') }
      ])),
      tb(icon('droplet', 15), 'Text color', (e) => colorMenu(e.currentTarget, (c) => exec('foreColor', c))),
      tb(icon('edit', 15), 'Highlight', (e) => colorMenu(e.currentTarget, (c) => exec('hiliteColor', c))),
      sep(),
      tb(icon('list', 15), 'Bulleted list', () => exec('insertUnorderedList')),
      tb('1.', 'Numbered list', () => exec('insertOrderedList')),
      tb(icon('check-square', 15), 'Checkbox', () =>
        exec('insertHTML', '<div class="check-line"><input type="checkbox"><span>&nbsp;</span></div>')),
      tb(icon('chevron-down', 15), 'Collapsible section', () =>
        exec('insertHTML', '<details open><summary>Section</summary><div>…</div></details><p></p>')),
      tb(icon('minus', 15), 'Divider', () => exec('insertHorizontalRule')),
      sep(),
      tb(icon('image', 15), 'Insert image', () => pickImage(exec)),
      tb(icon('link', 15), 'Link to…', () => openNodePicker({
        onPick: ({ kind, id, label }) => exec('insertHTML',
          `<a class="nlink" data-kind="${kind}" data-id="${id}" contenteditable="false">${label}</a>&nbsp;`)
      })),
      tb(icon('grid', 15), 'Insert widget', () => openWidgetGallery({
        parentWidgetId: widget.id,
        onCreated: (child) => {
          exec('insertHTML', `<div class="embed-widget" data-wid="${child.id}" contenteditable="false"></div><p></p>`);
          mountEmbeds(editor, ctx);
          save();
        }
      }))
    );

    // navigate via note links (docs/05)
    editor.addEventListener('click', (e) => {
      const link = e.target.closest('.nlink');
      if (!link) return;
      e.preventDefault();
      const { kind, id } = link.dataset;
      if (kind === 'module') ctx.navigate(id);
      else if (kind === 'page') {
        const mod = store.all('modules').find(m => m.pages.includes(id));
        if (mod) ctx.navigate(mod.id, id);
      } else if (kind === 'widget') ctx.goWidget(id);
    });

    host.append(bar, editor);
    mountEmbeds(editor, ctx);
  },

  renderSettings(host, widget) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Notes save as you write. Embedded widgets are real widgets — they keep working anywhere.</p>'));
  }
});

function colorMenu(anchor, apply) {
  const styles = getComputedStyle(document.documentElement);
  const palette = ['--accent', '--highlight', '--success', '--warn', '--text-soft', '--text']
    .map(v => styles.getPropertyValue(v).trim());
  const items = palette.map(c => ({ label: c, fn: () => apply(c) }));
  // simple swatch menu
  const menu = document.createElement('div');
  popMenu(anchor, items.map((it, i) => ({
    label: ['Accent', 'Highlight', 'Success', 'Warm', 'Soft', 'Ink'][i],
    fn: it.fn
  })));
}

function pickImage(exec) {
  const fileIn = el('<input type="file" accept="image/*" class="hidden">');
  document.body.appendChild(fileIn);
  fileIn.onchange = () => {
    const file = fileIn.files[0];
    fileIn.remove();
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      exec('insertImage', canvas.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };
  fileIn.click();
}

/** Render embedded child widgets into their placeholders. */
function mountEmbeds(editor, ctx) {
  for (const ph of editor.querySelectorAll('.embed-widget')) {
    const child = store.get('widgets', ph.dataset.wid);
    if (!child) { ph.remove(); continue; }
    ph.innerHTML = '';
    ph.appendChild(ctx.renderWidgetCard(child));
  }
}
