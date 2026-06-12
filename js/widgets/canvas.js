/* Canvas widget (docs/05): a drawing surface — pen/marker/eraser, layers,
   undo/redo, zoom/pan, PNG export. Card shows the latest drawing thumbnail.
   Drawing core shared with the Infinite Canvas module (canvas-core.js). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, promptText } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { DrawingSurface, newDoc, setLayerImage } from './canvas-core.js';

const thumbUrls = new Map();
function thumbUrl(obj) {
  if (!obj.data.thumb) return null;
  if (!thumbUrls.has(obj.id)) thumbUrls.set(obj.id, URL.createObjectURL(obj.data.thumb));
  return thumbUrls.get(obj.id);
}

function latestDrawing(widget) {
  return objectsOf(widget.id, 'drawing').sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

registry.register({
  type: 'canvas',
  name: 'Canvas',
  icon: 'pen',
  description: 'Draw, sketch, layer',
  external: true, internal: true,

  renderCard(host, widget) {
    host.innerHTML = '';
    const obj = latestDrawing(widget);
    const url = obj && thumbUrl(obj);
    if (url) {
      const t = el(`<div class="gal-cover"><img alt=""><span class="chip" style="position:absolute;left:8px;bottom:8px"></span></div>`);
      t.querySelector('img').src = url;
      t.querySelector('.chip').textContent = obj.data.name || 'Drawing';
      host.appendChild(t);
    } else {
      host.appendChild(el('<p class="soft">Tap to start drawing.</p>'));
    }
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    let obj = latestDrawing(widget);
    if (!obj) obj = createObject(widget.id, 'drawing', { name: 'Drawing 1', doc: newDoc(), thumb: null });

    let surface = null;
    let saveTimer = null;
    const persist = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        obj.data.thumb = await surface.toPNG(320);
        thumbUrls.delete(obj.id);
        saveObject(obj);
      }, 700);
    };

    // toolbar
    const bar = el('<div class="note-toolbar" style="margin-bottom:8px"></div>');
    const tb = (html, title, fn) => {
      const b = el(`<button class="btn-icon" title="${title}">${html}</button>`);
      b.onclick = fn;
      return b;
    };
    const toolBtns = {};
    for (const [tool, ic] of [['pen', 'edit'], ['marker', 'feather'], ['eraser', 'x-circle']]) {
      toolBtns[tool] = tb(icon(ic === 'x-circle' ? 'x' : ic, 15), tool, () => {
        surface.tool = tool;
        Object.values(toolBtns).forEach(b => b.style.color = '');
        toolBtns[tool].style.color = 'var(--accent)';
      });
      bar.appendChild(toolBtns[tool]);
    }
    bar.appendChild(el('<span class="sep"></span>'));

    const colors = ['#2c2230', '#d8697f', '#e0a23c', '#7fae7f', '#5f8fc0', '#9a7fd1', '#ffffff'];
    for (const c of colors) {
      const sw = el(`<button class="btn-icon" title="${c}"><span style="display:block;width:15px;height:15px;border-radius:50%;background:${c};border:1px solid var(--border)"></span></button>`);
      sw.onclick = () => { surface.color = c; };
      bar.appendChild(sw);
    }
    const wheel = el('<input type="color" style="width:26px;height:26px;border:none;background:none;padding:0" title="Custom color">');
    wheel.oninput = () => { surface.color = wheel.value; };
    bar.appendChild(wheel);
    bar.appendChild(el('<span class="sep"></span>'));

    const sizeIn = el('<input type="range" class="range" min="1" max="40" value="6" style="width:84px" title="Size">');
    sizeIn.oninput = () => { surface.size = Number(sizeIn.value); };
    bar.appendChild(sizeIn);
    const opIn = el('<input type="range" class="range" min="0.1" max="1" step="0.05" value="1" style="width:64px" title="Opacity">');
    opIn.oninput = () => { surface.opacity = Number(opIn.value); };
    bar.appendChild(opIn);
    bar.appendChild(el('<span class="sep"></span>'));

    bar.appendChild(tb(icon('rotate-ccw', 15), 'Undo', () => { surface.undo(); persist(); }));
    bar.appendChild(tb(icon('refresh', 15), 'Redo', () => { surface.redo(); persist(); }));
    bar.appendChild(tb(icon('layers', 15), 'Layers', (e) => layersMenu(e.currentTarget)));
    bar.appendChild(tb(icon('maximize', 15), 'Fit', () => { surface.fitToView(); surface.render(); }));
    bar.appendChild(tb(icon('download', 15), 'Export PNG', async () => {
      const blob = await surface.toPNG();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${obj.data.name || 'drawing'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }));
    bar.appendChild(tb(icon('sparkles', 15), 'Save as stamp (My Stamps)', async () => {
      // transparent composite (no paper fill) so stamps keep their cutout
      const c = document.createElement('canvas');
      c.width = surface.doc.w;
      c.height = surface.doc.h;
      const g = c.getContext('2d');
      for (const layer of surface.doc.layers) {
        if (layer.visible) g.drawImage(surface.layerCanvas(layer), 0, 0);
      }
      const { toStampDataUrl, promptNewStamp } = await import('./wb-stamps.js');
      promptNewStamp({ img: toStampDataUrl(c, c.width, c.height), suggestedName: obj.data.name || 'Drawing' });
    }));
    bar.appendChild(tb(icon('image', 15), 'Import image as layer', () => {
      const fileIn = el('<input type="file" accept="image/*" class="hidden">');
      document.body.appendChild(fileIn);
      fileIn.onchange = () => {
        const file = fileIn.files[0];
        fileIn.remove();
        if (!file || surface.doc.layers.length >= 8) return;
        const img = new Image();
        img.onload = () => {
          const layer = { id: ulid(), name: 'Image', visible: true, strokes: [], imageBlob: file };
          setLayerImage(layer, img);
          surface.doc.layers.unshift(layer);
          surface.invalidate(layer.id);
          surface.render();
          persist();
        };
        img.src = URL.createObjectURL(file);
      };
      fileIn.click();
    }));
    bar.appendChild(tb(icon('more', 15), 'Drawings', (e) => drawingsMenu(e.currentTarget)));

    const layersMenu = (anchor) => {
      popMenu(anchor, [
        ...surface.doc.layers.map((l) => ({
          label: `${l.visible ? '●' : '○'} ${l.name}${l.id === surface.activeLayer ? '  ✓' : ''}`,
          fn: () => {
            if (l.id === surface.activeLayer) { l.visible = !l.visible; }
            surface.activeLayer = l.id;
            surface.render();
            persist();
          }
        })),
        'sep',
        { label: 'Add layer', iconName: 'plus', fn: () => {
          if (surface.doc.layers.length >= 8) return;
          const l = { id: ulid(), name: `Layer ${surface.doc.layers.length + 1}`, visible: true, strokes: [] };
          surface.doc.layers.push(l);
          surface.activeLayer = l.id;
          persist();
        } }
      ]);
    };

    const drawingsMenu = (anchor) => {
      const all = objectsOf(widget.id, 'drawing').sort((a, b) => b.updatedAt - a.updatedAt);
      popMenu(anchor, [
        ...all.map(d => ({ label: `${d.id === obj.id ? '✓ ' : ''}${d.data.name}`, fn: () => { obj = d; mount(); } })),
        'sep',
        { label: 'New drawing', iconName: 'plus', fn: async () => {
          const name = await promptText({ title: 'New drawing', label: 'Name', value: `Drawing ${all.length + 1}` });
          obj = createObject(widget.id, 'drawing', { name: name || `Drawing ${all.length + 1}`, doc: newDoc(), thumb: null });
          mount();
        } },
        { label: 'Rename', iconName: 'edit', fn: async () => {
          const name = await promptText({ title: 'Rename drawing', value: obj.data.name });
          if (name) { obj.data.name = name; saveObject(obj); }
        } }
      ]);
    };

    const surfaceHost = el('<div style="border-radius:12px;overflow:hidden;border:1px solid var(--border)"></div>');
    host.append(bar, surfaceHost);

    const mount = () => {
      surfaceHost.innerHTML = '';
      surface = new DrawingSurface(surfaceHost, { doc: obj.data.doc, onChange: persist });
      toolBtns.pen.style.color = 'var(--accent)';
    };
    mount();
  }
});
