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
    const prevFocus = document.activeElement; // restore focus on close (a11y)
    const back = el(`
      <div class="dialog-backdrop">
        <div class="dialog" role="alertdialog" aria-modal="true" aria-label="${title}">
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
      if (prevFocus?.isConnected) prevFocus.focus();
      resolve(val);
    };
    back.querySelector('[data-act="cancel"]').onclick = () => done(false);
    back.querySelector('[data-act="ok"]').onclick = () => done(true);
    back.onclick = (e) => { if (e.target === back) done(false); };
    // Esc cancels; Tab stays within the two buttons (focus trap)
    back.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      else if (e.key === 'Tab') {
        const f = [...back.querySelectorAll('button')];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
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
 * Open a panel (CR-11: app/meta surfaces and pickers — never widget content;
 * widget views are routed PAGES). Placement follows Settings → Appearance
 * unless overridden. One panel at a time: opening a second replaces the first.
 * @param {{title: string, iconName?: string, onClose?: () => void,
 *          placement?: 'full'|'left'|'right'|'sheet',
 *          crumbs?: string[],
 *          actions?: {iconName: string, label: string, fn: () => void}[]}} opts
 * @returns {{body: HTMLElement, close: () => void, setTitle: (t: string) => void}}
 */
export function openPanel({ title, iconName = 'flower', onClose = null, placement = null, crumbs = null, actions = [] }) {
  const place = placement || panelPlacement();
  const prevFocus = document.activeElement; // restore focus when the panel closes (a11y)
  const nested = drawerStack.length > 0; // a replaced panel leaves a back affordance
  for (const ctl of [...drawerStack]) ctl.close(); // one panel at a time (CR-11)
  const back = el('<div class="drawer-backdrop"></div>');
  const drawer = el(`
    <div class="drawer place-${place}" role="dialog" aria-modal="true" aria-label="${title}">
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
      if (prevFocus?.isConnected) prevFocus.focus(); // return focus where it was
    }
  };
  back.onclick = () => ctl.close();
  drawer.querySelector('[aria-label="Close"]').onclick = () => ctl.close();

  // focus trap (a11y): keep Tab within the open panel; Esc is handled globally
  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...drawer.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(x => !x.disabled && x.offsetParent !== null);
    if (f.length < 2) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

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
  requestAnimationFrame(() => {
    back.classList.add('open');
    drawer.classList.add('open');
    drawer.querySelector('[aria-label="Close"]')?.focus(); // move focus in (callers may refocus a field)
  });
  drawerStack.push(ctl);
  return ctl;
}

/** Back-compat alias — every existing surface routes through openPanel. */
export const openDrawer = openPanel;

/** Close every open panel (navigation must not leave stale overlays). */
export function closeStrayPanels() {
  for (const ctl of [...drawerStack]) ctl.close();
}

/* ---------- popovers (CR-11): quick mid-task utilities — small, anchored,
   no scrim, no route change, gone on tap-outside or selection ---------- */

/* CR-15: collision-aware placement, shared by every floating surface.
   The visual viewport (keyboard, browser UI) is the truth; the popover is
   measured AFTER its content exists (a ResizeObserver re-places it whenever
   it grows), flips to whichever side of the anchor fits, clamps to an 8px
   margin, and — only when no side fits — constrains its height so content
   scrolls internally instead of running off-screen. */

const PLACE_MARGIN = 8;

function viewportBox() {
  const vv = window.visualViewport;
  return vv
    ? { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height }
    : { x: 0, y: 0, w: innerWidth, h: innerHeight };
}

/**
 * Place a fixed-position element beside its anchor.
 * @param {HTMLElement} elm
 * @param {{getBoundingClientRect: () => DOMRect}} anchor (real or synthetic)
 * @param {{gap?: number, align?: 'start'|'center'|'end', caret?: HTMLElement}} opts
 */
function placeFloating(elm, anchor, { gap = 8, align = 'start', caret = null } = {}) {
  const vp = viewportBox();
  const m = PLACE_MARGIN;
  const r = anchor.getBoundingClientRect();
  if (elm.style.maxHeight) elm.style.maxHeight = ''; // natural size first
  let pw = elm.offsetWidth, ph = elm.offsetHeight;
  const space = {
    below: vp.y + vp.h - r.bottom - gap - m,
    above: r.top - vp.y - gap - m,
    right: vp.x + vp.w - r.right - gap - m,
    left: r.left - vp.x - gap - m
  };
  let side;
  if (ph <= space.below) side = 'below';
  else if (ph <= space.above) side = 'above';
  else if (pw <= space.right && ph <= vp.h - 2 * m) side = 'right';
  else if (pw <= space.left && ph <= vp.h - 2 * m) side = 'left';
  else {
    side = space.below >= space.above ? 'below' : 'above';
    elm.style.maxHeight = `${Math.max(120, space[side])}px`;
    ph = elm.offsetHeight;
  }
  let x, y;
  if (side === 'below' || side === 'above') {
    x = align === 'end' ? r.right - pw : align === 'center' ? r.left + r.width / 2 - pw / 2 : r.left;
    y = side === 'below' ? r.bottom + gap : r.top - ph - gap;
  } else {
    x = side === 'right' ? r.right + gap : r.left - pw - gap;
    y = r.top + r.height / 2 - ph / 2;
  }
  x = Math.round(Math.min(Math.max(vp.x + m, x), vp.x + vp.w - pw - m));
  y = Math.round(Math.min(Math.max(vp.y + m, y), vp.y + vp.h - ph - m));
  if (elm.style.left !== `${x}px`) elm.style.left = `${x}px`;
  if (elm.style.top !== `${y}px`) elm.style.top = `${y}px`;
  if (caret) {
    // the caret keeps pointing at the anchor even when the body is clamped
    caret.dataset.side = side;
    if (side === 'below' || side === 'above') {
      caret.style.top = caret.style.bottom = '';
      caret.style.left = `${Math.min(Math.max(r.left + r.width / 2 - x - 6, 10), pw - 22)}px`;
    } else {
      caret.style.left = '';
      caret.style.top = `${Math.min(Math.max(r.top + r.height / 2 - y - 6, 10), ph - 22)}px`;
    }
  }
  return side;
}

/** Keep elm placed while it lives: content growth, viewport/keyboard
    changes, scrolling anchors. @returns {() => void} dispose */
function watchPlacement(elm, anchor, opts) {
  let queued = false;
  const replace = () => {
    if (queued || !elm.isConnected) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!elm.isConnected) return;
      placeFloating(elm, anchor, opts);
      mo.takeRecords(); // swallow our own style writes — no feedback loop
    });
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(replace) : null;
  ro?.observe(elm);
  // MutationObserver too: it fires even in hidden documents (RO may not),
  // and most callers fill the body after opening
  const mo = new MutationObserver(replace);
  mo.observe(elm, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  const vv = window.visualViewport;
  vv?.addEventListener('resize', replace);
  vv?.addEventListener('scroll', replace);
  window.addEventListener('resize', replace);
  document.addEventListener('scroll', replace, { capture: true, passive: true });
  return () => {
    ro?.disconnect();
    mo.disconnect();
    vv?.removeEventListener('resize', replace);
    vv?.removeEventListener('scroll', replace);
    window.removeEventListener('resize', replace);
    document.removeEventListener('scroll', replace, { capture: true });
  };
}

/**
 * @param {HTMLElement} anchor the control that opened it
 * @param {{title?: string, width?: number, onClose?: () => void}} opts
 * @returns {{body: HTMLElement, el: HTMLElement, close: () => void}}
 */
export function openPopover(anchor, { title = null, width = 280, onClose = null } = {}) {
  document.querySelector('.popover')?.remove();
  const pop = el(`<div class="popover" role="dialog"><span class="pop-caret" aria-hidden="true"></span>${title ? '<h3 class="pop-title"></h3>' : ''}<div class="pop-body"></div></div>`);
  if (title) pop.querySelector('.pop-title').textContent = title;
  pop.style.width = `${Math.min(width, viewportBox().w - 2 * PLACE_MARGIN)}px`;
  // inside browser fullscreen (canvas focus page), body children are hidden
  (document.fullscreenElement || document.body).appendChild(pop);
  const opts = { caret: pop.querySelector('.pop-caret') };
  const unwatch = watchPlacement(pop, anchor, opts);
  let closed = false;
  const ctl = {
    el: pop,
    body: pop.querySelector('.pop-body'),
    close() {
      if (closed) return;
      closed = true;
      unwatch();
      pop.classList.remove('open');
      setTimeout(() => pop.remove(), 140);
      document.removeEventListener('pointerdown', onAway, true);
      onClose?.();
    }
  };
  function onAway(e) { if (!pop.contains(e.target)) ctl.close(); }
  setTimeout(() => document.addEventListener('pointerdown', onAway, true), 0);
  // place after the caller fills the body (callers fill synchronously);
  // microtask beats rAF in hidden documents, the observer covers the rest
  queueMicrotask(() => {
    if (!pop.isConnected) return;
    placeFloating(pop, anchor, opts);
    pop.classList.add('open');
  });
  return ctl;
}

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
  (document.fullscreenElement || document.body).appendChild(menu);
  // same collision-aware placement as popovers (CR-15); menus hug the
  // anchor's right edge, flip and clamp like everything else
  const opts = { gap: 6, align: 'end' };
  const unwatch = watchPlacement(menu, anchor, opts);
  queueMicrotask(() => {
    if (!menu.isConnected) return;
    placeFloating(menu, anchor, opts);
    menu.classList.add('open');
  });
  function close() {
    unwatch();
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

/** Segmented control (exposed as a radio group for assistive tech). */
export function seg(options, value, onChange) {
  const s = el('<div class="seg" role="radiogroup"></div>');
  for (const opt of options) {
    const b = el('<button type="button" role="radio"></button>');
    b.textContent = opt.label;
    const on = opt.value === value;
    if (on) b.classList.add('active');
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.onclick = () => {
      s.querySelectorAll('button').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('active');
      b.setAttribute('aria-checked', 'true');
      onChange(opt.value);
    };
    s.appendChild(b);
  }
  return s;
}

/** Toggle switch (a native checkbox exposed with the switch role). */
export function switchEl(checked, onChange) {
  const s = el(`<label class="switch"><input type="checkbox" role="switch"><span class="knob"></span></label>`);
  const c = s.querySelector('input');
  c.checked = checked;
  c.setAttribute('aria-checked', checked ? 'true' : 'false');
  c.onchange = () => { c.setAttribute('aria-checked', c.checked ? 'true' : 'false'); onChange(c.checked); };
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
