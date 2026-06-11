/* Infinite Canvas widget (docs/08 §2): the deep-zoom art surface.
   Strokes persist in per-sector objects (2^20-unit tiles, coords relative to
   the sector origin) so saves stay incremental and precision holds at depth.
   Bookmarks are named viewpoints; exports snapshot the viewport to PNG and
   shelve a copy in a sibling Gallery widget when one exists. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, popMenu, promptText } from '../ui/components.js';
import { objectsOf, createObject, saveObject, todayStr } from './base.js';
import { InfiniteSurface, SECTOR, strokeBbox } from './infcanvas-engine.js';

function sectorObj(widget, sx, sy) {
  return objectsOf(widget.id, 'sector').find(o => o.data.sx === sx && o.data.sy === sy) ||
    createObject(widget.id, 'sector', { sx, sy, strokes: [] });
}

/** Flattened, time-ordered strokes across all sectors (cached per widget). */
const flatCache = new Map();
function allStrokes(widget) {
  let c = flatCache.get(widget.id);
  if (!c) {
    c = objectsOf(widget.id, 'sector')
      .flatMap(o => o.data.strokes.map(s => ({ ...s, sx: o.data.sx, sy: o.data.sy })))
      .sort((a, b) => a.t - b.t);
    flatCache.set(widget.id, c);
  }
  return c;
}
function dirty(widget) { flatCache.delete(widget.id); }

function worldBounds(widget) {
  const all = allStrokes(widget);
  if (!all.length) return { x0: -400, y0: -300, x1: 400, y1: 300 };
  return {
    x0: Math.min(...all.map(s => s.bbox.x0)), y0: Math.min(...all.map(s => s.bbox.y0)),
    x1: Math.max(...all.map(s => s.bbox.x1)), y1: Math.max(...all.map(s => s.bbox.y1))
  };
}

function zoomLabel(scale) {
  if (scale >= 1) return `×${scale >= 10 ? Math.round(scale) : scale.toFixed(1)}`;
  return `×${scale.toPrecision(2)}`;
}

registry.register({
  type: 'infcanvas',
  name: 'Infinite Canvas',
  icon: 'maximize',
  description: 'A boundless deep-zoom drawing surface',
  keywords: ['draw', 'art', 'zoom', 'infinite', 'map', 'sketch'],
  external: true, internal: true,
  defaultConfig: () => ({ view: { cx: 0, cy: 0, zoomExp: 0 } }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const n = allStrokes(widget).length;
    const sectors = objectsOf(widget.id, 'sector').length;
    const canvas = el('<canvas style="width:100%;height:130px;border-radius:10px;background:var(--surface-alt)"></canvas>');
    canvas.width = 600;
    canvas.height = 220;
    host.appendChild(canvas);
    if (n) {
      const surf = new InfiniteSurface(canvas, { strokes: () => allStrokes(widget) });
      surf.fitTo(worldBounds(widget));
    }
    host.appendChild(el(`<div class="soft" style="font-size:0.78rem;margin-top:6px;text-align:center">${n} stroke${n === 1 ? '' : 's'} across ${sectors} sector${sectors === 1 ? '' : 's'}</div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const bar = el('<div class="note-toolbar"></div>');
    const surfHost = el('<div style="border-radius:12px;overflow:hidden;border:1px solid var(--border);position:relative"></div>');
    const canvas = el('<canvas class="ic-surface"></canvas>');
    const readout = el('<span class="chip" style="position:absolute;right:8px;bottom:8px;pointer-events:none">×1</span>');
    surfHost.append(canvas, readout);
    host.append(bar, surfHost);
    canvas.width = Math.max(320, host.clientWidth || 700);
    canvas.height = Math.min(innerHeight - 200, Math.round(canvas.width * 0.72));

    const undoStack = [];
    const surf = new InfiniteSurface(canvas, {
      strokes: () => allStrokes(widget),
      onViewChange: (v) => {
        widget.config.view = { ...v };
        store.put('widgets', widget);
        readout.textContent = zoomLabel(surf.scale());
      },
      onStrokeDone: (pts, state) => {
        const sx = Math.floor(pts[0][0] / SECTOR), sy = Math.floor(pts[0][1] / SECTOR);
        const stroke = {
          ...state,
          pts: pts.map(([x, y]) => [x - sx * SECTOR, y - sy * SECTOR]),
          bbox: strokeBbox(pts, state.size),
          t: Date.now() + Math.random()
        };
        const obj = sectorObj(widget, sx, sy);
        obj.data.strokes.push(stroke);
        saveObject(obj);
        dirty(widget);
        undoStack.push({ objId: obj.id, t: stroke.t });
        surf.invalidate(stroke.bbox);
        surf.render();
      },
      onTextAt: async (wx, wy) => {
        const text = await promptText({ title: 'Place text', label: 'Text', confirmText: 'Place' });
        if (!text) return;
        const sx = Math.floor(wx / SECTOR), sy = Math.floor(wy / SECTOR);
        const size = surf.effectiveSize() * 2;
        const stroke = {
          tool: 'text', text, color: surf.color, size, opacity: 1,
          pts: [[wx - sx * SECTOR, wy - sy * SECTOR]],
          bbox: { x0: wx - size, y0: wy - size * 8, x1: wx + size * 6 * text.length, y1: wy + size * 2 },
          t: Date.now() + Math.random()
        };
        const obj = sectorObj(widget, sx, sy);
        obj.data.strokes.push(stroke);
        saveObject(obj);
        dirty(widget);
        undoStack.push({ objId: obj.id, t: stroke.t });
        surf.invalidate(stroke.bbox);
        surf.render();
      }
    }, { ...widget.config.view });

    /* ---- toolbar ---- */
    const tb = (html, title, fn) => {
      const b = el(`<button class="btn-icon" title="${title}">${html}</button>`);
      b.onclick = (e) => fn(e);
      return b;
    };
    const toolBtns = {};
    for (const [tool, ic, label] of [
      ['pan', 'move', 'Pan'], ['pen', 'edit', 'Pen'], ['marker', 'feather', 'Marker'],
      ['eraser', 'x', 'Eraser'], ['line', 'minus', 'Line'], ['rect', 'grid', 'Rectangle'],
      ['ellipse', 'circle', 'Ellipse'], ['text', 'type', 'Text']
    ]) {
      toolBtns[tool] = tb(icon(ic, 15), label, () => {
        surf.tool = tool;
        Object.values(toolBtns).forEach(b => b.style.color = '');
        toolBtns[tool].style.color = 'var(--accent)';
      });
      bar.appendChild(toolBtns[tool]);
    }
    toolBtns.pen.style.color = 'var(--accent)';
    bar.appendChild(el('<span class="sep"></span>'));

    for (const c of ['#2c2230', '#d8697f', '#e0a23c', '#7fae7f', '#5f8fc0', '#ffffff']) {
      const sw = el(`<button class="btn-icon" title="${c}"><span style="display:block;width:14px;height:14px;border-radius:50%;background:${c};border:1px solid var(--border)"></span></button>`);
      sw.onclick = () => { surf.color = c; };
      bar.appendChild(sw);
    }
    const wheel = el('<input type="color" style="width:24px;height:24px;border:none;background:none;padding:0" title="Custom color">');
    wheel.oninput = () => { surf.color = wheel.value; };
    bar.appendChild(wheel);
    bar.appendChild(el('<span class="sep"></span>'));

    const sizeIn = el('<input type="range" class="range" min="1" max="40" value="4" style="width:80px" title="Brush size">');
    sizeIn.oninput = () => { surf.size = Number(sizeIn.value); };
    bar.appendChild(sizeIn);
    const scaleToggle = tb('<b style="font-size:0.66rem">px</b>', 'Brush: world-scaled (tap for screen-scaled)', () => {
      surf.screenScaled = !surf.screenScaled;
      scaleToggle.style.color = surf.screenScaled ? 'var(--accent)' : '';
      toast(surf.screenScaled ? 'Brush is screen-scaled' : 'Brush is world-scaled', 'edit');
    });
    bar.appendChild(scaleToggle);
    bar.appendChild(el('<span class="sep"></span>'));

    bar.appendChild(tb(icon('rotate-ccw', 15), 'Undo', () => {
      const op = undoStack.pop();
      if (!op) return;
      const obj = store.get('objects', op.objId);
      if (!obj) return;
      const i = obj.data.strokes.findIndex(s => s.t === op.t);
      if (i >= 0) {
        const [removed] = obj.data.strokes.splice(i, 1);
        saveObject(obj);
        dirty(widget);
        surf.invalidate(removed.bbox);
        surf.render();
      }
    }));
    bar.appendChild(tb(icon('maximize', 15), 'Fit everything', () => surf.fitTo(worldBounds(widget))));
    bar.appendChild(tb(icon('star', 15), 'Bookmarks', (e) => {
      const marks = objectsOf(widget.id, 'bookmark');
      popMenu(e.currentTarget, [
        ...marks.map(m => ({ label: m.data.name, iconName: 'star', fn: () => {
          surf.view = { cx: m.data.cx, cy: m.data.cy, zoomExp: m.data.zoomExp };
          surf.render();
          readout.textContent = zoomLabel(surf.scale());
        } })),
        ...(marks.length ? ['sep'] : []),
        { label: 'Save this viewpoint', iconName: 'plus', fn: async () => {
          const name = await promptText({ title: 'Bookmark this view', label: 'Name', placeholder: 'The northern coast' });
          if (name) {
            createObject(widget.id, 'bookmark', { name, ...surf.view });
            toast('Viewpoint saved', 'star');
          }
        } }
      ]);
    }));
    bar.appendChild(tb(icon('download', 15), 'Export snapshot', async () => {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${widget.name}-${todayStr()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      // shelve a copy in a sibling Gallery widget (docs/08: Gallery page)
      const mod = store.all('modules').find(m => m.pages.some(p => store.get('pages', p)?.widgets.includes(widget.id)));
      const gal = mod?.pages.flatMap(pid => store.get('pages', pid)?.widgets || [])
        .map(id => store.get('widgets', id)).find(w => w?.type === 'gallery');
      if (gal) {
        createObject(gal.id, 'image', { blob, caption: `${widget.name} · ${zoomLabel(surf.scale())}` });
        toast('Snapshot shelved in the gallery', 'image');
      }
    }));

    readout.textContent = zoomLabel(surf.scale());
    surf.render();
  }
});
