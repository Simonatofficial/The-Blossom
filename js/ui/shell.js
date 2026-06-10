/* App chrome (docs/01): module switcher + settings buttons (top right, fade
   when idle), bottom page tabs, page host. Quiet — nothing competes. */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { ulid } from '../core/ids.js';
import { router } from '../core/router.js';
import { icon, iconOrEmoji, iconNames } from './icons.js';
import { el, toast, confirmDialog, openDrawer, popMenu, promptText } from './components.js';
import { openSettings } from './settings.js';
import { getTheme, allThemes } from '../fx/themes.js';

const MAX_TABS = 5;

export function initShell(app) {
  app.innerHTML = '';
  const chrome = el(`
    <div id="chrome-top">
      <button class="chrome-btn" id="btn-modules" aria-label="Modules">${icon('grid', 18)}</button>
      <button class="chrome-btn" id="btn-settings" aria-label="Settings">${icon('settings', 18)}</button>
    </div>`);
  chrome.querySelector('#btn-modules').onclick = openModuleSwitcher;
  chrome.querySelector('#btn-settings').onclick = () => openSettings();
  app.appendChild(chrome);
  app.appendChild(el('<div id="page-host"></div>'));
  app.appendChild(el('<nav id="tab-bar" aria-label="Pages"></nav>'));

  // chrome wakes on any touch, settles after a pause
  let awakeTimer = null;
  document.addEventListener('pointerdown', () => {
    chrome.classList.add('awake');
    document.getElementById('tab-bar')?.classList.add('awake');
    clearTimeout(awakeTimer);
    awakeTimer = setTimeout(() => {
      chrome.classList.remove('awake');
      document.getElementById('tab-bar')?.classList.remove('awake');
    }, 3500);
  }, { passive: true });

  events.on('route:changed', renderTabs);
  events.on('module:changed', renderTabs);
  renderTabs();
}

/* ---------- page tabs ---------- */

function renderTabs() {
  const bar = document.getElementById('tab-bar');
  if (!bar) return;
  bar.innerHTML = '';
  const { moduleId, pageId } = router.current();
  const mod = store.get('modules', moduleId);
  if (!mod) return;

  const pages = mod.pages.map(id => store.get('pages', id)).filter(Boolean);
  const visible = pages.length > MAX_TABS ? pages.slice(0, MAX_TABS - 1) : pages;

  for (const page of visible) {
    const tab = el(`<button class="tab"><span class="tab-icon">${iconOrEmoji(page.icon, 18)}</span><span class="tab-name"></span></button>`);
    tab.querySelector('.tab-name').textContent = page.name;
    if (page.id === pageId) tab.classList.add('active');
    tab.onclick = () => router.go(mod.id, page.id);
    longPress(tab, () => pageMenu(tab, mod, page));
    bar.appendChild(tab);
  }

  if (pages.length > MAX_TABS) {
    const more = el(`<button class="tab"><span class="tab-icon">${icon('more', 18)}</span><span class="tab-name">More</span></button>`);
    more.onclick = () => {
      const d = openDrawer({ title: mod.name, iconName: 'grid' });
      for (const page of pages) {
        const li = el(`<button class="list-item">${iconOrEmoji(page.icon, 18)}<span class="li-main"><span class="li-title"></span></span></button>`);
        li.querySelector('.li-title').textContent = page.name;
        li.onclick = () => { d.close(); router.go(mod.id, page.id); };
        d.body.appendChild(li);
      }
      d.body.appendChild(addPageButton(mod));
    };
    bar.appendChild(more);
  }
}

function longPress(elm, fn) {
  elm.addEventListener('contextmenu', (e) => { e.preventDefault(); fn(); });
  let timer = null;
  elm.addEventListener('pointerdown', () => { timer = setTimeout(fn, 550); }, { passive: true });
  for (const evt of ['pointerup', 'pointermove', 'pointercancel']) {
    elm.addEventListener(evt, () => clearTimeout(timer), { passive: true });
  }
}

function addPageButton(mod) {
  const b = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('plus', 15)} Add page</button>`);
  b.onclick = async () => {
    const name = await promptText({ title: 'Add page', label: 'Page name', placeholder: 'Garden', confirmText: 'Add' });
    if (!name) return;
    const page = store.put('pages', { id: ulid(), moduleId: mod.id, name, icon: 'circle', widgets: [], themeOverride: null });
    mod.pages.push(page.id);
    store.put('modules', mod);
    events.emit('module:changed', { moduleId: mod.id });
    router.go(mod.id, page.id);
  };
  return b;
}

/* ---------- page menu (long-press a tab — docs/04) ---------- */

function pageMenu(anchor, mod, page) {
  const idx = mod.pages.indexOf(page.id);
  popMenu(anchor, [
    { label: 'Add page', iconName: 'plus', fn: () => addPageButton(mod).click() },
    { label: 'Rename', iconName: 'edit', fn: async () => {
      const name = await promptText({ title: 'Rename page', value: page.name });
      if (name) { page.name = name; store.put('pages', page); events.emit('module:changed', {}); }
    } },
    { label: 'Change icon', iconName: 'star', fn: () => openIconPicker(page.icon, (val) => {
      page.icon = val; store.put('pages', page); events.emit('module:changed', {});
    }) },
    { label: 'Move left', iconName: 'chevron-left', fn: () => {
      if (idx > 0) { mod.pages.splice(idx, 1); mod.pages.splice(idx - 1, 0, page.id); store.put('modules', mod); events.emit('module:changed', {}); }
    } },
    { label: 'Move right', iconName: 'chevron-right', fn: () => {
      if (idx < mod.pages.length - 1) { mod.pages.splice(idx, 1); mod.pages.splice(idx + 1, 0, page.id); store.put('modules', mod); events.emit('module:changed', {}); }
    } },
    { label: 'Theme', iconName: 'palette', fn: () => openThemeOverridePicker(page.themeOverride, (id) => {
      page.themeOverride = id; store.put('pages', page); events.emit('page:changed', {});
    }) },
    { label: 'Copy Blossom code', iconName: 'code', fn: async () => {
      const { copyNodeCode } = await import('./settings.js');
      copyNodeCode('pg', page.id, page.name);
    } },
    'sep',
    { label: 'Delete page', iconName: 'trash', danger: true, fn: async () => {
      if (mod.pages.length <= 1) { toast('A module keeps at least one page.', 'info'); return; }
      if (await confirmDialog({ title: `Delete “${page.name}”?`, message: 'Its widgets rest in the trash for 30 days.' })) {
        const { removeWidget } = await import('../widgets/base.js');
        for (const wid of [...page.widgets]) {
          const w = store.get('widgets', wid);
          if (w) removeWidget(w);
        }
        mod.pages = mod.pages.filter(id => id !== page.id);
        store.put('modules', mod);
        store.trash('pages', page.id);
        events.emit('module:changed', {});
        router.go(mod.id);
      }
    } }
  ]);
}

/* ---------- icon picker (SVG icons first, then an emoji tab — docs/03) ---------- */

export function openIconPicker(current, onPick) {
  const d = openDrawer({ title: 'Choose an icon', iconName: 'star' });
  const grid = el('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px"></div>');
  for (const name of iconNames()) {
    const b = el(`<button class="btn-icon" style="width:44px;height:44px;${name === current ? 'color:var(--accent);background:var(--accent-soft)' : ''}" title="${name}">${icon(name, 20)}</button>`);
    b.onclick = () => { onPick(name); d.close(); };
    grid.appendChild(b);
  }
  d.body.appendChild(grid);
  const emojiIn = el('<input class="input" maxlength="4" placeholder="…or type an emoji accent">');
  emojiIn.style.marginTop = '14px';
  emojiIn.addEventListener('change', () => {
    if (emojiIn.value.trim()) { onPick(emojiIn.value.trim()); d.close(); }
  });
  d.body.appendChild(emojiIn);
}

/* ---------- theme override picker (Inherit / theme list) ---------- */

export function openThemeOverridePicker(current, onPick) {
  const d = openDrawer({ title: 'Theme', iconName: 'palette' });
  const inherit = el(`<button class="list-item"><span class="li-main"><span class="li-title">Inherit (default)</span></span>${!current ? icon('check', 16) : ''}</button>`);
  inherit.onclick = () => { onPick(null); d.close(); };
  d.body.appendChild(inherit);
  for (const t of allThemes()) {
    const li = el(`<button class="list-item">
      <span style="display:flex;gap:3px">${['bg', 'accent', 'highlight'].map(k => `<span style="width:14px;height:14px;border-radius:50%;background:${t.colors[k]};border:1px solid var(--border)"></span>`).join('')}</span>
      <span class="li-main"><span class="li-title"></span></span>${current === t.id ? icon('check', 16) : ''}</button>`);
    li.querySelector('.li-title').textContent = t.name;
    li.onclick = () => { onPick(t.id); d.close(); };
    d.body.appendChild(li);
  }
}

/* ---------- module switcher ---------- */

function openModuleSwitcher() {
  const d = openDrawer({ title: 'Modules', iconName: 'grid' });

  const render = () => {
    d.body.innerHTML = '';
    for (const mod of store.all('modules')) {
      const t = mod.themeOverride ? getTheme(mod.themeOverride) : null;
      const li = el(`<button class="list-item">
        <span style="color:var(--accent)">${iconOrEmoji(mod.icon, 20)}</span>
        <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
        ${t ? `<span style="width:14px;height:14px;border-radius:50%;background:${t.colors.accent}"></span>` : ''}
        <span class="btn-icon w-mod-menu">${icon('more', 16)}</span></button>`);
      li.querySelector('.li-title').textContent = mod.name;
      li.querySelector('.li-sub').textContent = `${mod.pages.length} page${mod.pages.length === 1 ? '' : 's'}`;
      li.onclick = (e) => {
        if (e.target.closest('.w-mod-menu')) return;
        d.close();
        router.go(mod.id);
      };
      li.querySelector('.w-mod-menu').addEventListener('click', (e) => {
        e.stopPropagation();
        moduleMenu(e.currentTarget, mod, render);
      });
      d.body.appendChild(li);
    }

    const add = el(`<button class="btn-soft-wide" style="margin-top:10px">${icon('plus', 16)} New module</button>`);
    add.onclick = (e) => popMenu(e.currentTarget, [
      { label: 'From Preset', iconName: 'gift', fn: async () => {
        const { openPresetGallery } = await import('./presetgallery.js');
        d.close();
        openPresetGallery();
      } },
      { label: 'From Blossom code', iconName: 'code', fn: async () => {
        const { openCodeImport } = await import('./settings.js');
        d.close();
        openCodeImport({});
      } },
      { label: 'From Scratch', iconName: 'edit', fn: async () => {
        const name = await promptText({ title: 'New module', label: 'Module name', placeholder: 'My module', confirmText: 'Create' });
        if (!name) return;
        const page = store.put('pages', { id: ulid(), moduleId: null, name: 'Home', icon: 'home', widgets: [], themeOverride: null });
        const mod = store.put('modules', { id: ulid(), name, icon: 'circle', pages: [page.id], themeOverride: null, presetKey: null });
        page.moduleId = mod.id;
        store.put('pages', page);
        d.close();
        router.go(mod.id);
      } }
    ]);
    d.body.appendChild(add);
  };

  function moduleMenu(anchor, mod, rerender) {
    popMenu(anchor, [
      { label: 'Rename', iconName: 'edit', fn: async () => {
        const name = await promptText({ title: 'Rename module', value: mod.name });
        if (name) { mod.name = name; store.put('modules', mod); events.emit('module:changed', {}); rerender(); }
      } },
      { label: 'Change icon', iconName: 'star', fn: () => openIconPicker(mod.icon, (val) => {
        mod.icon = val; store.put('modules', mod); events.emit('module:changed', {}); rerender();
      }) },
      { label: 'Theme', iconName: 'palette', fn: () => openThemeOverridePicker(mod.themeOverride, (id) => {
        mod.themeOverride = id; store.put('modules', mod); events.emit('page:changed', {}); rerender();
      }) },
      { label: 'Copy Blossom code', iconName: 'code', fn: async () => {
        const { copyNodeCode } = await import('./settings.js');
        copyNodeCode('mod', mod.id, mod.name);
      } },
      'sep',
      { label: 'Delete module', iconName: 'trash', danger: true, fn: async () => {
        if (store.all('modules').length <= 1) { toast('The last module stays planted.', 'info'); return; }
        if (await confirmDialog({ title: `Delete “${mod.name}”?`, message: 'Everything inside rests in the trash for 30 days.' })) {
          const { removeWidget } = await import('../widgets/base.js');
          for (const pid of mod.pages) {
            const page = store.get('pages', pid);
            if (!page) continue;
            for (const wid of [...page.widgets]) {
              const w = store.get('widgets', wid);
              if (w) removeWidget(w);
            }
            store.trash('pages', pid);
          }
          store.trash('modules', mod.id);
          events.emit('module:changed', {});
          router.go(store.all('modules')[0].id);
          rerender();
        }
      } }
    ]);
  }

  render();
}
