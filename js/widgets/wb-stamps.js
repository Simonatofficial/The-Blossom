/* My Stamps (CR-14): one user stamp library for the whole World Builder —
   map brushes/features, pin symbols, Pinboard cards, civ crests, character
   tokens, timeline icons, lore headers. Records live in the THEMES store as
   { id, type:'stamp', name, category, size, tint, order, img } with the
   image as a PNG data URL, so they ride the existing 'thm' Blossom-code
   path unchanged. Fed three ways: imported image files, Canvas-widget
   drawings, and Infinite Canvas selections ("Save as stamp"). */

import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, toast, openPanel, openPopover, popMenu, promptText, input, seg, confirmDialog } from '../ui/components.js';

export const STAMP_CATEGORIES = [
  ['terrain', 'Terrain brush'],
  ['structure', 'Structure'],
  ['decoration', 'Decoration'],
  ['token', 'Token']
];
const CAT_LABEL = Object.fromEntries(STAMP_CATEGORIES);
const MAX_SIDE = 320; // imported images downscale to keep Blossom codes small

/** @returns {object[]} all stamp records, in user order. */
export function allStamps() {
  return store.all('themes').filter(t => t.type === 'stamp')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getStamp(id) {
  const t = store.get('themes', id);
  return t?.type === 'stamp' ? t : null;
}

/** Persist a new stamp. @returns the record */
export function saveStampRecord({ name, category = 'decoration', size = 56, tint = false, img }) {
  const order = Math.max(0, ...allStamps().map(s => (s.order ?? 0) + 1));
  return store.put('themes', { id: ulid(), type: 'stamp', name, category, size, tint, order, img });
}

/* ---------- image plumbing ---------- */

const imgCache = new Map(); // stampId -> {src, el}
const tintCache = new Map(); // `${stampId}:${color}` -> canvas

/** Decoded <img> for a stamp (cached; refreshes if the data URL changed). */
export function stampImageEl(stamp) {
  let c = imgCache.get(stamp.id);
  if (!c || c.src !== stamp.img) {
    const im = new Image();
    im.src = stamp.img;
    c = { src: stamp.img, el: im };
    imgCache.set(stamp.id, c);
    tintCache.clear();
  }
  return c.el;
}

/** The stamp's drawable: tinted toward `color` when its tint toggle is on. */
export function stampDrawable(stamp, color = null) {
  const im = stampImageEl(stamp);
  if (!stamp.tint || !color || !im.complete || !im.naturalWidth) return im;
  const key = `${stamp.id}:${color}`;
  if (tintCache.has(key)) return tintCache.get(key);
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.55;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  if (tintCache.size > 80) tintCache.clear();
  tintCache.set(key, c);
  return c;
}

/** Draw a stamp centered on the origin at `sizePx` (longest side). */
export function drawStampAt(g, stamp, sizePx, color = null) {
  const d = stampDrawable(stamp, color);
  const w = d.width || d.naturalWidth, h = d.height || d.naturalHeight;
  if (!w || !h) return false; // still decoding — caller re-renders on load
  const k = sizePx / Math.max(w, h);
  g.drawImage(d, -w * k / 2, -h * k / 2, w * k, h * k);
  return true;
}

/** Downscale any drawable source to a PNG data URL (transparent preserved). */
export function toStampDataUrl(source, w, h) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/** Read an image file into a stamp-sized data URL. */
export function importImageFile(file) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    const url = URL.createObjectURL(file);
    im.onload = () => {
      const out = toStampDataUrl(im, im.naturalWidth, im.naturalHeight);
      URL.revokeObjectURL(url);
      resolve(out);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not an image')); };
    im.src = url;
  });
}

/* ---------- "save as stamp" flow (shared by every entry point) ---------- */

/** Ask name + category, then save. @returns {Promise<object|null>} */
export function promptNewStamp({ img, suggestedName = '', category = 'decoration' }) {
  return new Promise((resolve) => {
    let settled = false;
    const d = openPanel({ title: 'New stamp', iconName: 'sparkles', onClose: () => { if (!settled) { settled = true; resolve(null); } } });
    const pv = el('<div style="text-align:center;margin-bottom:10px"><img alt="" style="max-width:120px;max-height:120px;border-radius:10px;background:var(--surface-alt);padding:8px"></div>');
    pv.querySelector('img').src = img;
    d.body.appendChild(pv);
    const nameIn = input(suggestedName, 'Stamp name');
    d.body.appendChild(nameIn);
    let cat = category;
    const catSeg = seg(STAMP_CATEGORIES.map(([value, label]) => ({ value, label })), cat, (v) => { cat = v; });
    catSeg.style.marginTop = '10px';
    d.body.appendChild(catSeg);
    const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Add to My Stamps</button>');
    ok.onclick = () => {
      settled = true;
      const rec = saveStampRecord({ name: nameIn.value.trim() || 'Stamp', category: cat, img });
      d.close();
      toast('Saved to My Stamps', 'sparkles');
      resolve(rec);
    };
    d.body.appendChild(ok);
    setTimeout(() => nameIn.focus(), 150);
  });
}

/** File-import entry point (button handler). */
export function importStampFromFile(onSaved = null) {
  const fileIn = el('<input type="file" accept="image/*" class="hidden">');
  document.body.appendChild(fileIn);
  fileIn.onchange = async () => {
    const file = fileIn.files[0];
    fileIn.remove();
    if (!file) return;
    try {
      const img = await importImageFile(file);
      const rec = await promptNewStamp({ img, suggestedName: file.name.replace(/\.[a-z]+$/i, '') });
      if (rec) onSaved?.(rec);
    } catch {
      toast('That file didn’t want to be a stamp.', 'info');
    }
  };
  fileIn.click();
}

/* ---------- picker (a Popover, per CR-11) ---------- */

/**
 * @param {Element} anchor
 * @param {{onPick: (stamp) => void, title?: string, category?: string|null}} opts
 */
export function openStampPicker(anchor, { onPick, title = 'My Stamps', category = null }) {
  const pop = openPopover(anchor, { title, width: 300 });
  let cat = category;
  const chips = el('<div class="row" style="flex-wrap:wrap;gap:4px;margin-bottom:8px"></div>');
  const grid = el('<div class="row" style="flex-wrap:wrap;gap:6px;max-height:240px;overflow:auto"></div>');
  const chip = (label, value) => {
    const b = el(`<button class="chip">${label}</button>`);
    b.onclick = () => { cat = value; render(); };
    chips.appendChild(b);
    return b;
  };
  chip('All', null);
  for (const [value, label] of STAMP_CATEGORIES) chip(label, value);
  const render = () => {
    for (const [i, b] of [...chips.children].entries()) {
      b.classList.toggle('accent', (i === 0 && cat === null) || STAMP_CATEGORIES[i - 1]?.[0] === cat);
    }
    grid.innerHTML = '';
    const list = allStamps().filter(s => !cat || s.category === cat);
    if (!list.length) grid.appendChild(el('<p class="soft" style="font-size:0.8rem;margin:4px">No stamps here yet — import an image, or send a drawing from any canvas.</p>'));
    for (const s of list) {
      const b = el(`<button class="ic-btn" title="${s.name}" style="width:52px;height:52px;border:1px solid var(--border)"><img alt="" style="max-width:40px;max-height:40px"></button>`);
      b.querySelector('img').src = s.img;
      b.onclick = () => { pop.close(); onPick(s); };
      grid.appendChild(b);
    }
  };
  render();
  const foot = el('<div class="row" style="gap:6px;margin-top:10px"></div>');
  const imp = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px">${icon('upload', 13)} Import image</button>`);
  imp.onclick = () => { pop.close(); importStampFromFile((rec) => onPick(rec)); };
  const manage = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px">${icon('sliders', 13)} Manage</button>`);
  manage.onclick = () => { pop.close(); openStampManager(); };
  foot.append(imp, manage);
  pop.body.append(chips, grid, foot);
}

/* ---------- manager (a Panel: rename, tint, resize, reorder, codes) ---------- */

export function openStampManager() {
  const d = openPanel({ title: 'My Stamps', iconName: 'sparkles' });
  const render = () => {
    d.body.innerHTML = '';
    const list = allStamps();
    if (!list.length) d.body.appendChild(el('<div class="empty-state">' + icon('sparkles', 28) + '<p>No stamps yet. Import an image below, or use “Save as stamp” on a canvas selection or drawing.</p></div>'));
    for (const [i, s] of list.entries()) {
      const row = el(`<div class="list-item" style="cursor:default">
        <img alt="" style="width:36px;height:36px;object-fit:contain;border-radius:8px;background:var(--surface-alt)">
        <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
        <button class="btn-icon s-up" title="Earlier">${icon('chevron-up', 14)}</button>
        <button class="btn-icon s-down" title="Later">${icon('chevron-down', 14)}</button>
        <button class="btn-icon s-menu" title="More">${icon('more', 14)}</button></div>`);
      row.querySelector('img').src = s.img;
      row.querySelector('.li-title').textContent = s.name;
      row.querySelector('.li-sub').textContent = `${CAT_LABEL[s.category] || s.category}${s.tint ? ' · theme-tinted' : ''} · ${s.size}px`;
      const move = (dir) => {
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const seq = [...list];
        [seq[i], seq[j]] = [seq[j], seq[i]];
        seq.forEach((rec, n) => { rec.order = n; store.put('themes', rec); });
        render();
      };
      row.querySelector('.s-up').onclick = () => move(-1);
      row.querySelector('.s-down').onclick = () => move(+1);
      row.querySelector('.s-menu').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Rename', iconName: 'edit', fn: async () => {
          const name = await promptText({ title: 'Rename stamp', value: s.name });
          if (name) { s.name = name; store.put('themes', s); render(); }
        } },
        { label: `Category: ${CAT_LABEL[s.category]}`, iconName: 'tag', fn: () => {
          const cats = STAMP_CATEGORIES.map(([v]) => v);
          s.category = cats[(cats.indexOf(s.category) + 1) % cats.length];
          store.put('themes', s);
          render();
        } },
        { label: 'Default size…', iconName: 'maximize', fn: async () => {
          const v = await promptText({ title: 'Default size (px)', value: String(s.size) });
          const n = Number(v);
          if (n > 0) { s.size = Math.round(n); store.put('themes', s); render(); }
        } },
        { label: s.tint ? 'Stop theme tinting' : 'Tint with the theme', iconName: 'palette', fn: () => {
          s.tint = !s.tint;
          store.put('themes', s);
          tintCache.clear();
          render();
        } },
        { label: 'Copy Blossom code', iconName: 'code', fn: async () => {
          const { copyNodeCode } = await import('../ui/settings.js');
          copyNodeCode('thm', s.id, s.name);
        } },
        'sep',
        { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: `Delete “${s.name}”?`, message: 'Placed copies on maps stay as they are.' })) {
            store.del('themes', s.id);
            imgCache.delete(s.id);
            render();
          }
        } }
      ]);
      d.body.appendChild(row);
    }
    const imp = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('upload', 15)} Import image as stamp</button>`);
    imp.onclick = () => importStampFromFile(() => render());
    d.body.appendChild(imp);
  };
  render();
}
