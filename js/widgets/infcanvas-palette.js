/* Infinite Canvas color panel (docs/12 §8): recent colors, a palette selector
   (Blossom + curated presets + custom palettes), and a custom-palette editor —
   up to 30 swatches, add-current-color, drag to reorder, long-press to delete.
   Custom palettes persist in the themes store as type:'palette' records. */

import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, openPopover, openDrawer, popMenu, promptText } from '../ui/components.js';

export const PRESET_PALETTES = {
  blossom: { name: 'Blossom', colors: ['#2c2230', '#ffffff', '#d8697f', '#e0a23c', '#7fae7f', '#5f8fc0', '#9a7fd1', '#e88aa0', '#67c9c9', '#c25b66'] },
  warm: { name: 'Warm', colors: ['#3a1f1d', '#7a2e2b', '#c4452f', '#e0683a', '#f29a4b', '#f7c873', '#f4e3b2', '#b86a4b', '#8a4a3a', '#5c302a'] },
  cool: { name: 'Cool', colors: ['#101b2d', '#1d3557', '#2c5d8f', '#457b9d', '#5ea3c4', '#8ecbe6', '#bfe5f2', '#7a8fb4', '#4a5d8a', '#2b3a5e'] },
  earth: { name: 'Earth', colors: ['#2e261c', '#4a3b28', '#6b5436', '#8a7048', '#a98e5f', '#c4ad7d', '#7d8a5c', '#55663f', '#3c4a2e', '#8c5f43'] },
  neon: { name: 'Neon', colors: ['#0a0a12', '#ff2d95', '#ff6b35', '#f7f700', '#39ff14', '#00f5d4', '#00b3ff', '#7b2dff', '#ff2dde', '#ffffff'] },
  pastel: { name: 'Pastel', colors: ['#5a5560', '#fdf3f0', '#f7c8d0', '#fbe3b5', '#cde8c5', '#bcdcf5', '#d7c8f0', '#f5cdea', '#c5e8e3', '#e8d5c5'] },
  grayscale: { name: 'Grayscale', colors: ['#000000', '#1f1f1f', '#3d3d3d', '#5c5c5c', '#7a7a7a', '#999999', '#b8b8b8', '#d6d6d6', '#efefef', '#ffffff'] }
};

const MAX_SWATCHES = 30;

function customPalettes() {
  return store.all('themes').filter(t => t.type === 'palette');
}

function paletteOf(id) {
  if (PRESET_PALETTES[id]) return { id, ...PRESET_PALETTES[id], preset: true };
  const rec = store.get('themes', id);
  return rec ? { id: rec.id, name: rec.name, colors: rec.colors, preset: false } : { id: 'blossom', ...PRESET_PALETTES.blossom, preset: true };
}

export function openColorPanel(state, widget, onPick, anchor = null) {
  // CR-11: a mid-task utility — an anchored popover, never a panel
  const d = anchor
    ? openPopover(anchor, { title: 'Colors', width: 300 })
    : openDrawer({ title: 'Colors', iconName: 'palette' });
  const cfg = widget.config;
  cfg.recent = cfg.recent || [];
  cfg.palette = cfg.palette || 'blossom';

  const pick = (c, close = true) => {
    state.colorAlt = state.color;
    state.color = c;
    cfg.recent = [c, ...cfg.recent.filter(x => x !== c)].slice(0, 10);
    store.put('widgets', widget);
    onPick(c);
    if (close) d.close();
  };

  const render = () => {
    d.body.innerHTML = '';
    const pal = paletteOf(cfg.palette);

    // recent colors — always visible above the palette (docs/12 §8)
    if (cfg.recent.length) {
      d.body.appendChild(el('<h3 class="soft ic-ptitle">RECENT</h3>'));
      d.body.appendChild(swatchGrid(cfg.recent, { onTap: pick }));
    }

    // palette selector row
    const selRow = el('<div class="row" style="margin:10px 0 6px;gap:6px"><select class="select" style="flex:1"></select><button class="btn-icon"></button></div>');
    const sel = selRow.querySelector('select');
    for (const [id, p] of Object.entries(PRESET_PALETTES)) sel.appendChild(new Option(p.name, id));
    for (const p of customPalettes()) sel.appendChild(new Option(p.name, p.id));
    sel.value = cfg.palette;
    sel.onchange = () => { cfg.palette = sel.value; store.put('widgets', widget); render(); };
    const menuBtn = selRow.querySelector('button');
    menuBtn.innerHTML = icon('more', 16);
    menuBtn.onclick = (e) => paletteMenu(e.currentTarget, pal, cfg, widget, render);
    d.body.appendChild(selRow);

    d.body.appendChild(swatchGrid(pal.colors, {
      onTap: pick,
      editable: !pal.preset,
      onDelete: (i) => mutate(pal.id, (p) => p.colors.splice(i, 1), render),
      onReorder: (from, to) => mutate(pal.id, (p) => {
        const [c] = p.colors.splice(from, 1);
        p.colors.splice(to, 0, c);
      }, render)
    }, state.color));

    if (!pal.preset && pal.colors.length < MAX_SWATCHES) {
      const add = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('plus', 14)} Add current color (${pal.colors.length}/${MAX_SWATCHES})</button>`);
      add.onclick = () => mutate(pal.id, (p) => { if (!p.colors.includes(state.color)) p.colors.push(state.color); }, render);
      d.body.appendChild(add);
    }

    // wheel + hex entry
    const wheelRow = el('<div class="row" style="margin-top:12px"><input type="color" class="ic-wheel"><input class="input" placeholder="#hex" style="flex:1"><button class="btn btn-primary">Use</button></div>');
    const [wheel, hexIn, use] = wheelRow.children;
    wheel.value = /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : '#d8697f';
    hexIn.value = state.color;
    wheel.oninput = () => { hexIn.value = wheel.value; };
    use.onclick = () => pick(normHex(hexIn.value) || wheel.value);
    d.body.appendChild(wheelRow);
  };
  render();
}

function normHex(v) {
  const m = v.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  return m ? '#' + (m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]).toLowerCase() : null;
}

function mutate(paletteId, fn, render) {
  const rec = store.get('themes', paletteId);
  if (!rec) return;
  fn(rec);
  store.put('themes', rec);
  render();
}

/** Swatch grid: tap to pick; custom palettes add drag-reorder + long-press delete. */
function swatchGrid(colors, { onTap, editable = false, onDelete, onReorder }, current = null) {
  const g = el('<div class="ic-swatches"></div>');
  colors.forEach((c, i) => {
    const b = el(`<button class="ic-swatch" style="background:${c}" title="${c}"></button>`);
    if (c === current) b.classList.add('on');
    if (!editable) {
      b.onclick = () => onTap(c);
    } else {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        let acted = false;
        const timer = setTimeout(async () => {
          acted = true;
          if (await confirmDialog({ title: 'Remove this swatch?', confirmText: 'Remove' })) onDelete(i);
        }, 550);
        let dragTo = null;
        const onMove = (ev) => {
          if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 8) return;
          clearTimeout(timer);
          b.classList.add('dragging');
          const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.ic-swatch');
          g.querySelectorAll('.ic-swatch').forEach(s => s.classList.remove('drop'));
          if (over && over !== b) {
            over.classList.add('drop');
            dragTo = [...g.children].indexOf(over);
          }
        };
        const onUp = () => {
          clearTimeout(timer);
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          b.classList.remove('dragging');
          g.querySelectorAll('.ic-swatch').forEach(s => s.classList.remove('drop'));
          if (dragTo != null) { acted = true; onReorder(i, dragTo); }
          else if (!acted) onTap(c);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
    }
    g.appendChild(b);
  });
  return g;
}

function paletteMenu(anchor, pal, cfg, widget, render) {
  const items = [
    { label: 'New custom palette', iconName: 'plus', fn: async () => {
      const name = await promptText({ title: 'New palette', label: 'Name', placeholder: `Custom ${customPalettes().length + 1}` });
      const rec = store.put('themes', { id: ulid(), type: 'palette', name: name || `Custom ${customPalettes().length + 1}`, colors: [] });
      cfg.palette = rec.id;
      store.put('widgets', widget);
      render();
    } },
    { label: 'Duplicate as custom', iconName: 'copy', fn: () => {
      const rec = store.put('themes', { id: ulid(), type: 'palette', name: `${pal.name} copy`, colors: [...pal.colors] });
      cfg.palette = rec.id;
      store.put('widgets', widget);
      render();
    } }
  ];
  if (!pal.preset) {
    items.push(
      { label: 'Rename', iconName: 'edit', fn: async () => {
        const name = await promptText({ title: 'Rename palette', value: pal.name });
        if (name) mutate(pal.id, (p) => { p.name = name; }, render);
      } },
      { label: 'Copy Blossom code', iconName: 'code', fn: async () => {
        const { copyNodeCode } = await import('../ui/settings.js');
        copyNodeCode('thm', pal.id, pal.name);
      } },
      'sep',
      { label: 'Delete palette', iconName: 'trash', danger: true, fn: async () => {
        if (await confirmDialog({ title: `Delete “${pal.name}”?` })) {
          store.del('themes', pal.id);
          cfg.palette = 'blossom';
          store.put('widgets', widget);
          toast('Palette removed', 'palette');
          render();
        }
      } }
    );
  }
  popMenu(anchor, items);
}
