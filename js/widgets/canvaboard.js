/* Canva Board widget (V2 §16): an object-based design canvas (distinct from the
   Infinite Canvas and World Map). DOM editor with text, shapes, images, emoji,
   and lines — each movable/resizable/rotatable, with opacity, layer order, and
   lock. Multiple pages (slides), templates, and PNG export. The card shows a
   thumbnail; rendering for thumbnail + export lives in canvaboard-render.js. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg, popMenu, toast, confirmDialog, promptText } from '../ui/components.js';
import { createObject } from './base.js';
import { renderPage } from './canvaboard-render.js';

const TEMPLATES = { blank: { w: 1080, h: 1080, label: 'Square' }, card: { w: 1050, h: 600, label: 'Card' }, poster: { w: 1080, h: 1350, label: 'Poster' }, wallpaper: { w: 1080, h: 1920, label: 'Wallpaper' } };

function activePage(widget) { const c = widget.config; return c.pages.find(p => p.id === c.activePageId) || c.pages[0]; }
function nextZ(page) { return (page.objects.reduce((m, o) => Math.max(m, o.z || 0), 0)) + 1; }

function defaultObj(type, page) {
  const base = { id: ulid(), type, rotation: 0, opacity: 1, z: nextZ(page), locked: false };
  const cx = page.w / 2, cy = page.h / 2;
  const presets = {
    text: { w: 460, h: 90, text: 'Your text', fontSize: 52, weight: 600, color: '#1b1430', align: 'left', lineHeight: 1.25 },
    rect: { w: 320, h: 220, fill: '#a78bfa', stroke: null, strokeWidth: 0, radius: 18 },
    circle: { w: 260, h: 260, fill: '#7cc4ff', stroke: null, strokeWidth: 0 },
    triangle: { w: 260, h: 230, fill: '#9be3b4', stroke: null, strokeWidth: 0 },
    emoji: { w: 130, h: 130, text: '🌸', fontSize: 104 },
    line: { w: 320, h: 40, stroke: '#1b1430', strokeWidth: 5, arrow: true }
  }[type] || {};
  return { ...base, x: Math.round(cx - (presets.w || 200) / 2), y: Math.round(cy - (presets.h || 100) / 2), ...presets };
}

registry.register({
  type: 'canvaboard',
  name: 'Canva Board',
  icon: 'image',
  description: 'A design board — text, shapes, images, slides, export',
  keywords: ['design', 'poster', 'canva', 'graphic', 'slides'],
  external: true, internal: true,
  defaultConfig: () => { const id = ulid(); return { pages: [{ id, w: 1080, h: 1080, bg: '#ffffff', objects: [] }], activePageId: id }; },

  renderCard(host, widget) {
    host.innerHTML = '';
    const page = activePage(widget);
    const cv = el('<canvas class="cb-thumb"></canvas>');
    host.appendChild(cv);
    renderPage(cv.getContext('2d'), page, Math.min(1, 320 / page.w)).then(() => {
      cv.style.width = '100%'; cv.style.height = 'auto'; cv.style.borderRadius = '10px';
    });
    host.appendChild(el(`<div class="soft" style="font-size:0.78rem;margin-top:6px;text-align:center">${widget.config.pages.length} page${widget.config.pages.length === 1 ? '' : 's'} · tap to design</div>`));
  },

  renderFull(host, widget, ctx) {
    const save = () => store.put('widgets', widget);
    let selId = null;
    host.innerHTML = '';

    const toolbar = el('<div class="cb-toolbar row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"></div>');
    const stage = el('<div class="cb-stage"></div>');
    const board = el('<div class="cb-board"></div>');
    stage.appendChild(board);
    const props = el('<div class="cb-props"></div>');
    const pagesBar = el('<div class="cb-pages row" style="gap:6px;flex-wrap:wrap;margin-top:10px"></div>');
    host.append(toolbar, stage, props, pagesBar);

    let scale = 1;
    const fit = () => { const p = activePage(widget); scale = Math.max(0.05, (stage.clientWidth || 320) / p.w); board.style.width = p.w * scale + 'px'; board.style.height = p.h * scale + 'px'; board.style.background = p.bg; };

    /* ---- object rendering + interaction ---- */
    const renderBoard = () => {
      fit();
      const p = activePage(widget);
      board.innerHTML = '';
      for (const o of [...p.objects].sort((a, b) => (a.z || 0) - (b.z || 0))) board.appendChild(objEl(o));
      renderProps();
    };

    const objEl = (o) => {
      const wrap = el(`<div class="cb-obj ${o.locked ? 'locked' : ''} ${selId === o.id ? 'sel' : ''}" data-id="${o.id}"></div>`);
      wrap.style.left = o.x * scale + 'px'; wrap.style.top = o.y * scale + 'px';
      wrap.style.width = o.w * scale + 'px'; wrap.style.height = o.h * scale + 'px';
      wrap.style.transform = `rotate(${o.rotation || 0}deg)`; wrap.style.opacity = o.opacity ?? 1;
      wrap.appendChild(objVisual(o));
      if (selId === o.id && !o.locked) { wrap.appendChild(el('<span class="cb-handle cb-resize"></span>')); wrap.appendChild(el('<span class="cb-handle cb-rotate"></span>')); }
      enableInteract(wrap, o);
      return wrap;
    };

    const objVisual = (o) => {
      if (o.type === 'text') { const d = el('<div class="cb-text"></div>'); d.style.cssText = `font-size:${o.fontSize * scale}px;font-weight:${o.weight};color:${o.color};text-align:${o.align};line-height:${o.lineHeight};width:100%;height:100%;white-space:pre-wrap;overflow:hidden`; d.textContent = o.text; return d; }
      if (o.type === 'rect') { const d = el('<div></div>'); d.style.cssText = `width:100%;height:100%;background:${o.fill || 'transparent'};border-radius:${o.radius * scale}px;${o.stroke && o.strokeWidth ? `box-shadow:inset 0 0 0 ${o.strokeWidth * scale}px ${o.stroke}` : ''}`; return d; }
      if (o.type === 'circle') { const d = el('<div></div>'); d.style.cssText = `width:100%;height:100%;background:${o.fill || 'transparent'};border-radius:50%;${o.stroke && o.strokeWidth ? `box-shadow:inset 0 0 0 ${o.strokeWidth * scale}px ${o.stroke}` : ''}`; return d; }
      if (o.type === 'triangle') { const d = el('<div></div>'); d.style.cssText = `width:100%;height:100%;background:${o.fill};clip-path:polygon(50% 0,100% 100%,0 100%)`; return d; }
      if (o.type === 'emoji') { const d = el('<div></div>'); d.style.cssText = `width:100%;height:100%;display:grid;place-items:center;font-size:${o.fontSize * scale}px`; d.textContent = o.text; return d; }
      if (o.type === 'image') { const im = el('<img alt="" style="width:100%;height:100%;object-fit:cover;border-radius:2px">'); import('./canvaboard-render.js').then(m => { im.src = m.imgURL(o.imgId) || ''; }); return im; }
      if (o.type === 'line') { const svg = el(`<svg width="100%" height="100%" viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none"></svg>`); svg.innerHTML = `<line x1="0" y1="0" x2="${o.w}" y2="${o.h}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" stroke-linecap="round"/>${o.arrow ? `<polygon points="${o.w},${o.h} ${o.w - 16},${o.h - 6} ${o.w - 6},${o.h - 16}" fill="${o.stroke}"/>` : ''}`; return svg; }
      return el('<div></div>');
    };

    const enableInteract = (wrap, o) => {
      wrap.addEventListener('pointerdown', (e) => {
        if (o.locked) { selId = o.id; renderBoard(); return; }
        const handle = e.target.closest('.cb-handle');
        e.preventDefault(); e.stopPropagation();
        selId = o.id;
        try { wrap.setPointerCapture(e.pointerId); } catch { /* synthetic / unsupported */ }
        const sx = e.clientX, sy = e.clientY, ox = o.x, oy = o.y, ow = o.w, oh = o.h, orot = o.rotation || 0;
        const rect = wrap.getBoundingClientRect(); const ccx = rect.left + rect.width / 2, ccy = rect.top + rect.height / 2;
        const mode = handle ? (handle.classList.contains('cb-rotate') ? 'rotate' : 'resize') : 'move';
        const onMove = (ev) => {
          const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
          if (mode === 'move') { o.x = Math.round(ox + dx); o.y = Math.round(oy + dy); wrap.style.left = o.x * scale + 'px'; wrap.style.top = o.y * scale + 'px'; }
          else if (mode === 'resize') { o.w = Math.max(20, Math.round(ow + dx)); o.h = Math.max(10, Math.round(oh + dy)); wrap.style.width = o.w * scale + 'px'; wrap.style.height = o.h * scale + 'px'; const v = wrap.firstChild; wrap.replaceChild(objVisual(o), v); }
          else { o.rotation = Math.round(Math.atan2(ev.clientY - ccy, ev.clientX - ccx) * 180 / Math.PI + 90); wrap.style.transform = `rotate(${o.rotation}deg)`; }
        };
        const onUp = () => { wrap.removeEventListener('pointermove', onMove); wrap.removeEventListener('pointerup', onUp); save(); renderBoard(); };
        if (handle) { wrap.addEventListener('pointermove', onMove); wrap.addEventListener('pointerup', onUp); }
        else { wrap.addEventListener('pointermove', onMove); wrap.addEventListener('pointerup', onUp); renderProps(); }
      });
    };
    board.addEventListener('pointerdown', (e) => { if (e.target === board) { selId = null; renderBoard(); } });

    /* ---- properties panel ---- */
    const renderProps = () => {
      props.innerHTML = '';
      const p = activePage(widget);
      const o = p.objects.find(x => x.id === selId);
      if (!o) { props.appendChild(el('<p class="soft" style="font-size:0.82rem;padding:6px 0">Tap an object to edit it, or add one above.</p>')); return; }
      const row = el('<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"></div>');
      const mk = (label, fn) => { const b = el(`<button class="btn-icon" title="${label}">${icon({ 'Forward': 'chevron-up', 'Back': 'chevron-down', 'Lock': 'maximize', 'Delete': 'trash' }[label], 15)}</button>`); b.onclick = fn; return b; };
      row.append(
        mk('Forward', () => { o.z = nextZ(p) + 1; save(); renderBoard(); }),
        mk('Back', () => { o.z = Math.min(0, ...p.objects.map(x => x.z)) - 1; save(); renderBoard(); }),
        (() => { const b = el(`<button class="btn-icon" title="Lock">${icon('maximize', 15)}</button>`); if (o.locked) b.style.color = 'var(--accent)'; b.onclick = () => { o.locked = !o.locked; save(); renderBoard(); }; return b; })(),
        (() => { const b = el(`<button class="btn-icon" title="Delete" style="color:var(--warn)">${icon('trash', 15)}</button>`); b.onclick = () => { p.objects = p.objects.filter(x => x.id !== o.id); selId = null; save(); renderBoard(); }; return b; })()
      );
      props.appendChild(row);
      const op = input(Math.round((o.opacity ?? 1) * 100)); op.type = 'range'; op.min = 10; op.max = 100; op.addEventListener('input', () => { o.opacity = +op.value / 100; const w = board.querySelector(`[data-id="${o.id}"]`); if (w) w.style.opacity = o.opacity; }); op.addEventListener('change', save);
      props.appendChild(field('Opacity', op));
      const rot = input(o.rotation || 0); rot.type = 'range'; rot.min = 0; rot.max = 360; rot.addEventListener('input', () => { o.rotation = +rot.value; const w = board.querySelector(`[data-id="${o.id}"]`); if (w) w.style.transform = `rotate(${o.rotation}deg)`; }); rot.addEventListener('change', save);
      props.appendChild(field('Rotation', rot));

      if (o.type === 'text') {
        const ta = el('<textarea class="textarea" rows="2"></textarea>'); ta.value = o.text; ta.addEventListener('input', () => { o.text = ta.value; save(); const w = board.querySelector(`[data-id="${o.id}"]`); if (w) w.replaceChild(objVisual(o), w.firstChild); }); props.appendChild(field('Text', ta));
        props.appendChild(field('Size', numIn(o, 'fontSize', renderBoard, save)));
        props.appendChild(field('Colour', colorIn(o, 'color', renderBoard, save)));
        props.appendChild(field('Align', seg([['left', 'Left'], ['center', 'Center'], ['right', 'Right']].map(([v, l]) => ({ value: v, label: l })), o.align, (v) => { o.align = v; save(); renderBoard(); })));
        props.appendChild(field('Weight', seg([[400, 'Normal'], [600, 'Semi'], [800, 'Bold']].map(([v, l]) => ({ value: v, label: l })), o.weight, (v) => { o.weight = v; save(); renderBoard(); })));
      } else if (o.type === 'rect' || o.type === 'circle' || o.type === 'triangle') {
        props.appendChild(field('Fill', colorIn(o, 'fill', renderBoard, save)));
        props.appendChild(field('Stroke', colorIn(o, 'stroke', renderBoard, save)));
        props.appendChild(field('Stroke width', numIn(o, 'strokeWidth', renderBoard, save)));
        if (o.type === 'rect') props.appendChild(field('Corner radius', numIn(o, 'radius', renderBoard, save)));
      } else if (o.type === 'emoji') {
        const tin = input(o.text); tin.addEventListener('change', () => { o.text = tin.value || '🌸'; save(); renderBoard(); }); props.appendChild(field('Emoji', tin));
        props.appendChild(field('Size', numIn(o, 'fontSize', renderBoard, save)));
      } else if (o.type === 'line') {
        props.appendChild(field('Colour', colorIn(o, 'stroke', renderBoard, save)));
        props.appendChild(field('Width', numIn(o, 'strokeWidth', renderBoard, save)));
        const ar = el(`<button class="chip ${o.arrow ? 'accent' : ''}" style="cursor:pointer">Arrow head</button>`); ar.onclick = () => { o.arrow = !o.arrow; ar.classList.toggle('accent'); save(); renderBoard(); }; props.appendChild(ar);
      }
    };

    /* ---- toolbar ---- */
    const addBtn = (label, iconName, fn) => { const b = el(`<button class="btn" style="padding:6px 10px">${icon(iconName, 14)} ${label}</button>`); b.onclick = fn; return b; };
    const place = (type) => { const p = activePage(widget); const o = defaultObj(type, p); p.objects.push(o); selId = o.id; save(); renderBoard(); };
    toolbar.append(
      addBtn('Text', 'type', () => place('text')),
      addBtn('Shape', 'grid', (e) => popMenu(e.currentTarget, [
        { label: 'Rectangle', iconName: 'grid', fn: () => place('rect') },
        { label: 'Circle', iconName: 'circle', fn: () => place('circle') },
        { label: 'Triangle', iconName: 'flag', fn: () => place('triangle') },
        { label: 'Line / Arrow', iconName: 'activity', fn: () => place('line') }
      ])),
      addBtn('Emoji', 'sparkles', async () => { const e = await promptText({ title: 'Emoji', label: 'Paste an emoji', placeholder: '🌸' }); if (e) { place('emoji'); const p = activePage(widget); p.objects[p.objects.length - 1].text = e; save(); renderBoard(); } }),
      addBtn('Image', 'image', () => {
        const fi = el('<input type="file" accept="image/*" class="hidden">'); document.body.appendChild(fi);
        fi.onchange = () => { const f = fi.files[0]; if (f) { const obj = createObject(widget.id, 'boardImg', { blob: f }); const im = new Image(); im.onload = () => { const p = activePage(widget); const w = 460, h = Math.round(460 * im.height / im.width); p.objects.push({ id: ulid(), type: 'image', imgId: obj.id, x: (p.w - w) / 2, y: (p.h - h) / 2, w, h, rotation: 0, opacity: 1, z: nextZ(p), locked: false }); save(); renderBoard(); }; im.src = URL.createObjectURL(f); } fi.remove(); };
        fi.click();
      }),
      addBtn('Export', 'download', () => exportPNG())
    );

    /* ---- pages bar ---- */
    const renderPages = () => {
      pagesBar.innerHTML = '';
      widget.config.pages.forEach((p, i) => {
        const t = el(`<div class="cb-pagethumb ${p.id === widget.config.activePageId ? 'active' : ''}"><canvas></canvas><span class="cb-pagedel">${icon('x', 11)}</span></div>`);
        renderPage(t.querySelector('canvas').getContext('2d'), p, Math.min(0.08, 64 / p.w));
        t.onclick = (e) => { if (e.target.closest('.cb-pagedel')) { if (widget.config.pages.length > 1 && confirm('Delete this page?')) { widget.config.pages.splice(i, 1); widget.config.activePageId = widget.config.pages[0].id; save(); renderPages(); renderBoard(); } return; } widget.config.activePageId = p.id; selId = null; save(); renderPages(); renderBoard(); };
        pagesBar.appendChild(t);
      });
      const add = el(`<button class="btn-icon cb-addpage" title="Add page">${icon('plus', 16)}</button>`);
      add.onclick = (e) => popMenu(e.currentTarget, Object.entries(TEMPLATES).map(([k, t]) => ({ label: t.label, iconName: 'image', fn: () => { const id = ulid(); widget.config.pages.push({ id, w: t.w, h: t.h, bg: '#ffffff', objects: [] }); widget.config.activePageId = id; save(); renderPages(); renderBoard(); } })));
      pagesBar.appendChild(add);
      const bg = el('<input type="color" title="Page background" style="width:30px;height:30px;border:none;background:none;cursor:pointer">'); bg.value = activePage(widget).bg || '#ffffff'; bg.oninput = () => { activePage(widget).bg = bg.value; save(); renderBoard(); renderPages(); }; pagesBar.appendChild(bg);
    };

    const exportPNG = async () => {
      const p = activePage(widget); const cv = document.createElement('canvas');
      await renderPage(cv.getContext('2d'), p, 1);
      const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'board.png'; a.click();
      toast('Exported PNG', 'download');
    };

    renderBoard(); renderPages();
  }
});

function numIn(o, key, renderBoard, save) { const n = input(o[key] ?? 0); n.type = 'number'; n.addEventListener('change', () => { o[key] = Number(n.value) || 0; save(); renderBoard(); }); return n; }
function colorIn(o, key, renderBoard, save) { const c = input(''); c.type = 'color'; c.value = /^#([0-9a-f]{6})$/i.test(o[key] || '') ? o[key] : '#888888'; c.style.cssText = 'width:40px;height:30px;padding:0;border:none;background:none;cursor:pointer'; c.addEventListener('input', () => { o[key] = c.value; save(); renderBoard(); }); return c; }
