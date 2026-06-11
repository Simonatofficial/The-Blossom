/* Shared UI components (docs/01): panel, drawer, toast, confirm, menu, form
   helpers. Drawers over modals; only destructive confirms use a dialog.
   CR-1: every surface opens through openPanel(), which obeys the global
   "Open panels as" preference (full page / left / right / bottom sheet). */

import { icon } from './icons.js';
import { store } from '../core/store.js';

/** Build an element from an HTML string (single root). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ---------- toast ---------- */
let toastHost = null;

/** Show a quiet toast. @param {string} msg @param {string} [iconName] */
export function toast(msg, iconName = 'flower') {
  if (!toastHost) {
    toastHost = el('<div id="toast-host"></div>');
    document.body.appendChild(toastHost);
  }
  const t = el(`<div class="toast">${icon(iconName, 16)}<span></span></div>`);
  t.querySelector('span').textContent = msg;
  toastHost.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

/* ---------- confirm dialog (destructive actions only) ---------- */

/**
 * @param {{title: string, message?: string, confirmText?: string}} opts
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message = '', confirmText = 'Delete' }) {
  return new Promise(resolve => {
    const back = el(`
      <div class="dialog-backdrop">
        <div class="dialog" role="alertdialog" aria-label="${title}">
          <h3></h3><p></p>
          <div class="row-end">
            <button class="btn btn-ghost" data-act="cancel">Cancel</button>
            <button class="btn" data-act="ok"></button>
          </div>
        </div>
      </div>`);
    back.querySelector('h3').textContent = title;
    back.querySelector('p').textContent = message;
    back.querySelector('[data-act="ok"]').textContent = confirmText;
    const done = (val) => {
      back.classList.remove('open');
      setTimeout(() => back.remove(), 220);
      resolve(val);
    };
    back.querySelector('[data-act="cancel"]').onclick = () => done(false);
    back.querySelector('[data-act="ok"]').onclick = () => done(true);
    back.onclick = (e) => { if (e.target === back) done(false); };
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('open'));
    back.querySelector('[data-act="cancel"]').focus();
  });
}

/* ---------- panels (stackable; placement-aware, CR-1) ---------- */
const drawerStack = [];

/** Resolve the user's panel placement preference. */
export function panelPlacement() {
  const set = store.getMeta('settings', {})?.panelPlacement;
  if (['full', 'left', 'right', 'sheet'].includes(set)) return set;
  return innerWidth >= 600 ? 'right' : 'sheet';
}

/**
 * Open a panel. Placement follows Settings → Appearance unless overridden.
 * @param {{title: string, iconName?: string, onClose?: () => void,
 *          placement?: 'full'|'left'|'right'|'sheet',
 *          crumbs?: string[],
 *          actions?: {iconName: string, label: string, fn: () => void}[]}} opts
 * @returns {{body: HTMLElement, close: () => void, setTitle: (t: string) => void}}
 */
export function openPanel({ title, iconName = 'flower', onClose = null, placement = null, crumbs = null, actions = [] }) {
  const place = placement || panelPlacement();
  const nested = drawerStack.length > 0; // stacked opens get a back affordance
  const back = el('<div class="drawer-backdrop"></div>');
  const drawer = el(`
    <div class="drawer place-${place}" role="dialog" aria-label="${title}">
      ${place === 'sheet' ? '<div class="sheet-handle" aria-hidden="true"></div>' : ''}
      <div class="drawer-head">
        <button class="btn-icon" aria-label="Close">${icon(place === 'full' || nested ? 'arrow-left' : 'x', 18)}</button>
        <span class="d-icon" style="color:var(--accent)">${icon(iconName, 20)}</span>
        <div class="grow" style="min-width:0">
          <h2></h2>
          ${crumbs?.length ? '<div class="d-crumbs"></div>' : ''}
        </div>
        <span class="d-actions row"></span>
      </div>
      <div class="drawer-body"></div>
    </div>`);
  drawer.querySelector('h2').textContent = title;
  if (crumbs?.length) {
    drawer.querySelector('.d-crumbs').textContent = crumbs.join(' › ');
  }
  for (const a of actions) {
    const b = el(`<button class="btn-icon" aria-label="${a.label}" title="${a.label}">${icon(a.iconName, 17)}</button>`);
    b.onclick = a.fn;
    drawer.querySelector('.d-actions').appendChild(b);
  }

  const ctl = {
    body: drawer.querySelector('.drawer-body'),
    el: drawer,
    setTitle(t) { drawer.querySelector('h2').textContent = t; },
    close() {
      const i = drawerStack.indexOf(ctl);
      if (i >= 0) drawerStack.splice(i, 1);
      back.classList.remove('open');
      drawer.classList.remove('open');
      setTimeout(() => { back.remove(); drawer.remove(); }, 280);
      onClose?.();
    }
  };
  back.onclick = () => ctl.close();
  drawer.querySelector('[aria-label="Close"]').onclick = () => ctl.close();

  // sheet: drag handle — up expands toward full, down dismisses
  if (place === 'sheet') {
    const handle = drawer.querySelector('.sheet-handle');
    handle.addEventListener('pointerdown', (start) => {
      start.preventDefault();
      handle.setPointerCapture(start.pointerId);
      let dy = 0;
      const onMove = (e) => {
        dy = e.clientY - start.clientY;
        if (dy > 0) drawer.style.transform = `translateY(${dy}px)`;
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        drawer.style.transform = '';
        if (dy > drawer.offsetHeight * 0.25) ctl.close();
        else if (dy < -40) drawer.classList.add('expanded');
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }

  // left/right: swipe toward the edge to close
  if (place === 'left' || place === 'right') {
    let sx = null;
    // canvases own their pointer (drawing/panning must never swipe-close)
    drawer.addEventListener('pointerdown', (e) => { if (!e.target.closest('input,textarea,select,button,[contenteditable],canvas,.range')) sx = e.clientX; }, { passive: true });
    drawer.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx;
      if ((place === 'right' && dx > 80) || (place === 'left' && dx < -80)) ctl.close();
      sx = null;
    }, { passive: true });
  }

  document.body.appendChild(back);
  document.body.appendChild(drawer);
  requestAnimationFrame(() => { back.classList.add('open'); drawer.classList.add('open'); });
  drawerStack.push(ctl);
  return ctl;
}

/** Back-compat alias — every existing surface routes through openPanel. */
export const openDrawer = openPanel;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawerStack.length) drawerStack[drawerStack.length - 1].close();
});

/* ---------- popover menu ---------- */

/**
 * @param {HTMLElement} anchor
 * @param {(({label: string, iconName?: string, danger?: boolean, fn: () => void})|'sep')[]} items
 */
export function popMenu(anchor, items) {
  document.querySelector('.menu')?.remove();
  const menu = el('<div class="menu" role="menu"></div>');
  for (const item of items) {
    if (item === 'sep') { menu.appendChild(el('<hr>')); continue; }
    const b = el(`<button role="menuitem" class="${item.danger ? 'danger' : ''}">${item.iconName ? icon(item.iconName, 16) : ''}<span></span></button>`);
    b.querySelector('span').textContent = item.label;
    b.onclick = () => { close(); item.fn(); };
    menu.appendChild(b);
  }
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let x = Math.min(r.right - mw + 8, window.innerWidth - mw - 8);
  let y = r.bottom + 6;
  if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 6);
  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${y}px`;
  requestAnimationFrame(() => menu.classList.add('open'));
  function close() {
    menu.classList.remove('open');
    setTimeout(() => menu.remove(), 160);
    document.removeEventListener('pointerdown', onAway, true);
  }
  function onAway(e) { if (!menu.contains(e.target)) close(); }
  setTimeout(() => document.addEventListener('pointerdown', onAway, true), 0);
}

/* ---------- small form helpers ---------- */

/** A labeled field row. */
export function field(labelText, controlEl, hint = '') {
  const f = el(`<div class="field"><label></label></div>`);
  f.querySelector('label').textContent = labelText;
  f.appendChild(controlEl);
  if (hint) {
    const h = el('<div class="hint"></div>');
    h.textContent = hint;
    f.appendChild(h);
  }
  return f;
}

/** Text input. */
export function input(value = '', placeholder = '') {
  const i = el(`<input class="input" type="text">`);
  i.value = value;
  i.placeholder = placeholder;
  return i;
}

/** Segmented control. */
export function seg(options, value, onChange) {
  const s = el('<div class="seg"></div>');
  for (const opt of options) {
    const b = el('<button type="button"></button>');
    b.textContent = opt.label;
    if (opt.value === value) b.classList.add('active');
    b.onclick = () => {
      s.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      onChange(opt.value);
    };
    s.appendChild(b);
  }
  return s;
}

/** Toggle switch. */
export function switchEl(checked, onChange) {
  const s = el(`<label class="switch"><input type="checkbox"><span class="knob"></span></label>`);
  const c = s.querySelector('input');
  c.checked = checked;
  c.onchange = () => onChange(c.checked);
  return s;
}

/** Warm empty state. */
export function emptyState(iconName, text, btnLabel = null, onBtn = null) {
  const e = el(`<div class="empty-state">${icon(iconName, 30)}<p></p></div>`);
  e.querySelector('p').textContent = text;
  if (btnLabel) {
    const b = el('<button class="btn"></button>');
    b.textContent = btnLabel;
    b.onclick = onBtn;
    e.appendChild(b);
  }
  return e;
}

/** Ask the user for a single line of text (drawer, not a modal). */
export function promptText({ title, label = 'Name', value = '', placeholder = '', confirmText = 'Save' }) {
  return new Promise(resolve => {
    let settled = false;
    const d = openDrawer({
      title, iconName: 'edit',
      onClose: () => { if (!settled) { settled = true; resolve(null); } }
    });
    const i = input(value, placeholder);
    const ok = el('<button class="btn btn-primary" style="width:100%"></button>');
    ok.textContent = confirmText;
    const finish = () => { settled = true; resolve(i.value.trim() || null); d.close(); };
    ok.onclick = finish;
    i.onkeydown = (e) => { if (e.key === 'Enter') finish(); };
    d.body.appendChild(field(label, i));
    d.body.appendChild(ok);
    setTimeout(() => i.focus(), 150);
  });
}
