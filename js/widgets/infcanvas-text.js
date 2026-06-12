/* Infinite Canvas text boxes (docs/12 §3): real objects on a layer — moved,
   resized, and re-edited on double-tap forever; rasterized only on export.
   Rendering is DOM (crisp at any zoom, free rich text); each box tracks the
   world transform every frame. Edits/moves/deletes are 'tbox' history steps. */

import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';
import { objectsOf, createObject } from './base.js';

const FONT = "system-ui, 'Segoe UI', sans-serif";

export class TextLayer {
  /**
   * @param {HTMLElement} hostBox the .ic-canvasbox wrapper
   * @param {object} surf InfiniteSurface
   * @param {object} doc RasterDoc (history + layer meta)
   * @param {object} widget owning widget (objects live under it)
   * @param {() => object} getState current brush state (color for new boxes)
   */
  constructor(hostBox, surf, doc, widget, getState) {
    this.surf = surf;
    this.doc = doc;
    this.widget = widget;
    this.getState = getState;
    this.layerEl = el('<div class="ic-textlayer"></div>');
    hostBox.appendChild(this.layerEl);
    this.els = new Map(); // objectId -> box element
    this.sel = null;
    this.toolActive = false;
    doc.io.applyTbox = (id, data) => this.applyTbox(id, data);
    for (const o of objectsOf(widget.id, 'tbox')) this.mount(o);
    this.sync();
  }

  boxes() { return objectsOf(this.widget.id, 'tbox'); }

  setToolActive(on) {
    this.toolActive = on;
    this.layerEl.classList.toggle('on', on);
    if (!on) this.select(null);
  }

  /* ---------- world-anchored layout ---------- */

  sync() {
    const s = this.surf.scale();
    for (const [id, box] of this.els) {
      const o = store.get('objects', id);
      if (!o) { box.remove(); this.els.delete(id); continue; }
      const layer = this.doc.layer(o.data.layerId);
      const [px, py] = this.surf.toScreen(o.data.x, o.data.y);
      const w = o.data.w * s, fs = o.data.size * s;
      const r = this.surf.canvas.getBoundingClientRect();
      const k = r.width / this.surf.canvas.width; // backing px -> CSS px
      const hidden = !layer || !layer.visible || fs * k < 3 || fs * k > 2400 ||
        px * k > r.width + 600 || py * k > r.height + 600 || px < -((w + 600) / k) || py * k < -600 ||
        !!this.hideBox?.(o, fs * k); // subclass hook (map zoom-band visibility, curves)
      box.style.display = hidden ? 'none' : '';
      if (hidden) continue;
      box.style.left = `${px * k}px`;
      box.style.top = `${py * k}px`;
      box.style.width = `${w * k}px`;
      box.style.opacity = layer.opacity ?? 1;
      const c = box.querySelector('.ic-tbox-content');
      c.style.fontSize = `${fs * k}px`;
      c.style.color = o.data.color;
      c.style.textAlign = o.data.align || 'left';
    }
  }

  /* ---------- create / select / edit ---------- */

  /** Text-tool tap on empty canvas: place a box with cozy defaults. */
  createAt(wx, wy) {
    const s = this.surf.scale();
    const o = createObject(this.widget.id, 'tbox', {
      layerId: this.doc.active().id,
      x: wx, y: wy, w: 240 / s, size: 20 / s,
      color: this.getState().color, align: 'left', html: ''
    });
    this.doc.push({ kind: 'tbox', id: o.id, before: null, after: structuredClone(o.data) });
    this.mount(o);
    this.sync();
    this.select(o.id);
    this.edit(o.id);
  }

  mount(o) {
    if (this.els.has(o.id)) return;
    const box = el(`<div class="ic-tbox" data-id="${o.id}">
      <div class="ic-tbox-content" spellcheck="false"></div>
      <span class="ic-tbox-grip g-w" title="Width"></span>
      <span class="ic-tbox-grip g-s" title="Text size"></span>
    </div>`);
    box.querySelector('.ic-tbox-content').innerHTML = o.data.html || '';
    this.layerEl.appendChild(box);
    this.els.set(o.id, box);
    this.wire(box, o.id);
  }

  select(id) {
    if (this.sel && this.sel !== id) {
      const prev = this.els.get(this.sel);
      if (prev) {
        prev.classList.remove('sel');
        this.endEdit(this.sel);
      }
      this.bar?.remove();
      this.bar = null;
    }
    this.sel = id;
    if (!id) return;
    const box = this.els.get(id);
    box.classList.add('sel');
    this.openBar(id);
  }

  edit(id) {
    const box = this.els.get(id);
    const c = box.querySelector('.ic-tbox-content');
    this.editStart = this.snap(id);
    c.contentEditable = 'true';
    box.classList.add('editing');
    setTimeout(() => c.focus(), 0);
  }

  endEdit(id) {
    const box = this.els.get(id);
    if (!box?.classList.contains('editing')) return;
    box.classList.remove('editing'); // guard first — toggling contentEditable re-fires blur
    const c = box.querySelector('.ic-tbox-content');
    c.contentEditable = 'false';
    const o = store.get('objects', id);
    if (!o) return;
    o.data.html = c.innerHTML;
    if (!c.textContent.trim() && !c.querySelector('img')) {
      // empty boxes evaporate (their creation step stays undoable)
      this.commitChange(id, this.editStart, null);
      return;
    }
    store.put('objects', o);
    this.commitChange(id, this.editStart, this.snap(id));
  }

  snap(id) {
    const o = store.get('objects', id);
    return o ? structuredClone(o.data) : null;
  }

  /** Push a tbox history step if the data actually changed. */
  commitChange(id, before, after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    if (after === null) this.applyTbox(id, null);
    this.doc.push({ kind: 'tbox', id, before, after });
  }

  /** History (undo/redo) hands back a snapshot — or null for "gone". */
  applyTbox(id, data) {
    let o = store.get('objects', id);
    if (data === null) {
      if (o) store.del('objects', o.id);
      this.els.get(id)?.remove();
      this.els.delete(id);
      if (this.sel === id) { this.sel = null; this.bar?.remove(); this.bar = null; }
      return;
    }
    if (!o) {
      o = store.put('objects', { id, widgetId: this.widget.id, kind: 'tbox', date: null, data });
      this.mount(o);
    } else {
      o.data = data;
      store.put('objects', o);
      this.els.get(id)?.querySelector('.ic-tbox-content')?.replaceChildren();
      if (this.els.get(id)) this.els.get(id).querySelector('.ic-tbox-content').innerHTML = data.html || '';
    }
    this.sync();
  }

  /* ---------- pointer wiring: tap select, drag move, grips, dbl-tap edit ---------- */

  wire(box, id) {
    const content = box.querySelector('.ic-tbox-content');
    let lastTap = 0;

    box.addEventListener('pointerdown', (e) => {
      if (!this.toolActive) return;
      e.stopPropagation();
      if (box.classList.contains('editing')) return; // native text caret
      this.select(id);
      const grip = e.target.closest('.ic-tbox-grip');
      const o = store.get('objects', id);
      const before = this.snap(id);
      const s = this.surf.scale();
      const r = this.surf.canvas.getBoundingClientRect();
      const k = this.surf.canvas.width / r.width; // CSS px -> backing px
      const start = [e.clientX, e.clientY];
      const orig = { x: o.data.x, y: o.data.y, w: o.data.w, size: o.data.size };
      let moved = false;
      const onMove = (ev) => {
        const dx = (ev.clientX - start[0]) * k / s, dy = (ev.clientY - start[1]) * k / s;
        if (Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) > 4) moved = true;
        if (!grip) { o.data.x = orig.x + dx; o.data.y = orig.y + dy; }
        else if (grip.classList.contains('g-w')) o.data.w = Math.max(40 / s, orig.w + dx);
        else o.data.size = Math.max(4 / s, orig.size + dy);
        this.sync();
      };
      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (moved) {
          store.put('objects', o);
          this.commitChange(id, before, this.snap(id));
        } else if (!grip) {
          const now = performance.now();
          if (now - lastTap < 420) this.edit(id); // double-tap → re-edit, forever
          lastTap = now;
        }
        this.positionBar();
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    content.addEventListener('blur', () => this.endEdit(id));
    content.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); content.blur(); }
    });
  }

  /* ---------- formatting bar (Notes-style: B/I/U, size, color, align) ---------- */

  openBar(id) {
    this.bar?.remove();
    const o = store.get('objects', id);
    if (!o) return;
    const bar = this.bar = el('<div class="ic-tbar"></div>');
    const exec = (cmd) => {
      const c = this.els.get(id).querySelector('.ic-tbox-content');
      if (!this.els.get(id).classList.contains('editing')) this.edit(id);
      setTimeout(() => { c.focus(); document.execCommand(cmd); }, 0);
    };
    const btn = (html, title, fn) => {
      const b = el(`<button class="btn-icon" title="${title}">${html}</button>`);
      b.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); };
      b.onclick = (e) => { e.stopPropagation(); fn(); };
      bar.appendChild(b);
      return b;
    };
    const prop = (fn) => {
      const before = this.snap(id);
      fn(store.get('objects', id).data);
      store.put('objects', store.get('objects', id));
      this.commitChange(id, before, this.snap(id));
      this.sync();
    };
    btn('<b>B</b>', 'Bold', () => exec('bold'));
    btn('<i>I</i>', 'Italic', () => exec('italic'));
    btn('<u>U</u>', 'Underline', () => exec('underline'));
    btn('A−', 'Smaller', () => prop(d => { d.size = Math.max(2 / this.surf.scale(), d.size / 1.2); }));
    btn('A+', 'Bigger', () => prop(d => { d.size = d.size * 1.2; }));
    btn(`<span class="ic-dot" style="width:14px;height:14px"></span>`, 'Use current color', () =>
      prop(d => { d.color = this.getState().color; }));
    bar.querySelector('.ic-dot').style.background = this.getState().color;
    const aligns = ['left', 'center', 'right'];
    btn(icon('list', 14), 'Alignment', () =>
      prop(d => { d.align = aligns[(aligns.indexOf(d.align || 'left') + 1) % 3]; }));
    btn(icon('check', 14), 'Done', () => this.select(null));
    btn(icon('trash', 14), 'Delete', () => {
      const before = this.snap(id);
      this.commitChange(id, before, null);
    });
    this.layerEl.appendChild(bar);
    this.positionBar();
  }

  positionBar() {
    if (!this.bar || !this.sel) return;
    const box = this.els.get(this.sel);
    if (!box || box.style.display === 'none') { this.bar.style.display = 'none'; return; }
    this.bar.style.display = '';
    const top = box.offsetTop - this.bar.offsetHeight - 8;
    this.bar.style.left = `${Math.max(4, box.offsetLeft)}px`;
    this.bar.style.top = `${Math.max(4, top)}px`;
  }

  /* ---------- export rasterization (foreignObject — offline, same-origin) ---------- */

  async rasterizeInto(g) {
    const r = this.surf.canvas.getBoundingClientRect();
    const k = this.surf.canvas.width / r.width;
    for (const o of this.boxes()) {
      const box = this.els.get(o.id);
      if (!box || box.style.display === 'none') continue;
      const c = box.querySelector('.ic-tbox-content');
      const w = Math.ceil(box.offsetWidth), h = Math.ceil(c.offsetHeight);
      if (w < 1 || h < 1) continue;
      const style = `font:${getComputedStyle(c).fontSize}/${1.35} ${FONT};color:${o.data.color};text-align:${o.data.align || 'left'};word-wrap:break-word;`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="${style}">${c.innerHTML}</div></foreignObject></svg>`;
      const img = new Image();
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
      g.drawImage(img, box.offsetLeft * k, box.offsetTop * k, w * k, h * k);
    }
  }
}
