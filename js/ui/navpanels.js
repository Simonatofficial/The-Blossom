/* FAB navigation panels (V2 §3): Modules, Pages, and Widgets — the single
   coherent flow reached from the + button. Each opens as a Panel (CR-11). */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { ulid } from '../core/ids.js';
import { router } from '../core/router.js';
import { registry } from '../widgets/registry.js';
import { icon, iconOrEmoji } from './icons.js';
import { el, toast, confirmDialog, openPanel, popMenu, promptText, input, field, emptyState } from './components.js';
import { getTheme } from '../fx/themes.js';
import { PRESET_CATEGORIES } from '../presets/modules/index.js';
import { listHubs, inHub, toggleModuleInHub, createHub, isPinned, toggleFavPin, pruneModule } from '../core/hubs.js';

/* ---------- shared helpers ---------- */

/** Resolve a module's category, honouring an explicit field then its preset. */
function modCategory(m) { return m.category || PRESET_CATEGORIES[m.presetKey]?.category || 'General'; }
function modSubcategory(m) { return m.subcategory || PRESET_CATEGORIES[m.presetKey]?.subcategory || null; }
function modTags(m) { return (m.tags?.length ? m.tags : PRESET_CATEGORIES[m.presetKey]?.tags) || []; }

function matchModule(m, q) {
  return [m.name, modCategory(m), modSubcategory(m), ...modTags(m)]
    .filter(Boolean).some(s => String(s).toLowerCase().includes(q));
}

/** A bottom action bar with two buttons. */
function bottomBar(primaryLabel, primaryIcon, onPrimary, onImport) {
  const bar = el('<div class="nav-bottom"></div>');
  const add = el(`<button class="btn btn-primary grow">${icon(primaryIcon, 15)} ${primaryLabel}</button>`);
  add.onclick = onPrimary;
  const imp = el(`<button class="btn">${icon('code', 15)} Import Code</button>`);
  imp.onclick = onImport;
  bar.append(add, imp);
  return bar;
}

async function importCode(opts) {
  const { openCodeImport } = await import('./settings.js');
  openCodeImport(opts);
}
async function copyCode(type, id, name) {
  const { copyNodeCode } = await import('./settings.js');
  copyNodeCode(type, id, name);
}

/* ---------- Modules panel (categorized, searchable — §3 + §11) ---------- */

export function openModulesPanel() {
  const d = openPanel({ title: 'Modules', iconName: 'grid' });
  const search = el('<input class="input" placeholder="Search modules, categories, tags" style="margin-bottom:10px">');
  const groupsBtn = el(`<button class="btn-soft-wide" style="margin-bottom:10px">${icon('layers', 15)} Manage hubs</button>`);
  groupsBtn.onclick = async () => { const { openHubManager } = await import('./hubmanager.js'); openHubManager(); };
  const list = el('<div class="nav-list"></div>');
  d.body.append(search, groupsBtn, list);

  const render = () => {
    list.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    const mods = store.all('modules').filter(m => !q || matchModule(m, q));
    if (!mods.length) { list.appendChild(emptyState('grid', 'No modules match that search.')); }

    // group: category -> subcategory(or '') -> [modules]
    const groups = new Map();
    for (const m of mods) {
      const cat = modCategory(m), sub = modSubcategory(m) || '';
      if (!groups.has(cat)) groups.set(cat, new Map());
      const subs = groups.get(cat);
      if (!subs.has(sub)) subs.set(sub, []);
      subs.get(sub).push(m);
    }
    const curMod = router.current().moduleId;
    // P-3: collapse categories by default; a single category stays open so a
    // short list isn't needlessly folded.
    const startOpen = groups.size <= 1;
    for (const [cat, subs] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      const det = el(`<details class="nav-group"${startOpen ? ' open' : ''}><summary><span class="nav-chev">${icon('chevron-right', 14)}</span><span class="grow"></span><span class="nav-count"></span></summary><div class="nav-group-body"></div></details>`);
      det.querySelector('summary .grow').textContent = cat;
      const body = det.querySelector('.nav-group-body');
      let count = 0;
      for (const [sub, items] of [...subs].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (sub) {
          const sh = el('<div class="nav-subhead"></div>');
          sh.textContent = sub;
          body.appendChild(sh);
        }
        for (const m of items) {
          count++;
          body.appendChild(moduleRow(m, m.id === curMod, d, render));
        }
      }
      det.querySelector('.nav-count').textContent = count;
      list.appendChild(det);
    }
  };
  search.addEventListener('input', render);

  d.body.appendChild(bottomBar('New Module', 'plus', (e) => newModuleMenu(e.currentTarget, d), () => importCode({})));
  render();
}

function moduleRow(m, active, d, rerender) {
  const t = m.themeOverride ? getTheme(m.themeOverride) : null;
  const sub = modSubcategory(m);
  const row = el(`<div class="nav-row${active ? ' active' : ''}">
    <span class="nav-ic" style="color:var(--accent)">${iconOrEmoji(m.icon, 20)}</span>
    <span class="nav-main"><span class="nav-title"></span><span class="nav-sub"></span></span>
    ${sub ? '<span class="chip nav-chip"></span>' : ''}
    ${t ? `<span class="nav-themedot" style="background:${t.colors.accent}"></span>` : ''}
    <button class="btn-icon nav-menu" aria-label="Module menu">${icon('more', 16)}</button></div>`);
  row.querySelector('.nav-title').textContent = m.name;
  row.querySelector('.nav-sub').textContent = `${m.pages.length} page${m.pages.length === 1 ? '' : 's'}`;
  if (sub) row.querySelector('.nav-chip').textContent = sub;
  row.addEventListener('click', (e) => {
    if (e.target.closest('.nav-menu')) return;
    d.close();
    router.go(m.id);
  });
  row.querySelector('.nav-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    const anchor = e.currentTarget;
    popMenu(anchor, [
      { label: 'Edit', iconName: 'edit', fn: () => editModule(m, rerender) },
      { label: isPinned(m.id) ? 'Unpin from Favorites' : 'Pin to Favorites', iconName: 'star', fn: () => { toggleFavPin(m.id); rerender?.(); } },
      { label: 'Add to hub…', iconName: 'layers', fn: () => hubAssignMenu(anchor, m) },
      { label: 'Copy Code', iconName: 'code', fn: () => copyCode('mod', m.id, m.name) },
      'sep',
      { label: 'Delete', iconName: 'trash', danger: true, fn: () => deleteModule(m, rerender) }
    ]);
  });
  return row;
}

/** Toggle a module's membership in custom hubs (docs/17 §5). */
function hubAssignMenu(anchor, m) {
  const items = listHubs().filter(g => !g.builtin).map(g => ({
    label: `${inHub(g.id, m.id) ? '✓ ' : ''}${g.name}`, iconName: 'layers',
    fn: () => { toggleModuleInHub(g.id, m.id); toast(inHub(g.id, m.id) ? `Added to ${g.name}` : `Removed from ${g.name}`, 'layers'); }
  }));
  items.push({ label: 'New hub…', iconName: 'plus', fn: async () => {
    const name = await promptText({ title: 'New hub', label: 'Hub name', placeholder: 'Physical', confirmText: 'Create' });
    if (name) { const g = createHub(name); toggleModuleInHub(g.id, m.id); toast(`Added to ${g.name}`, 'layers'); }
  } });
  popMenu(anchor, items);
}

/** Edit a module's name, icon, and organisation (V2 §14). */
function editModule(m, rerender) {
  const d = openPanel({ title: `Edit ${m.name}`, iconName: 'edit' });
  const nameIn = input(m.name, 'Module name');
  const catIn = input(modCategory(m) === 'General' && !m.category ? '' : modCategory(m), 'e.g. Personal, Gaming, Work');
  const subIn = input(modSubcategory(m) || '', 'e.g. Health, D&D, Finance');
  const tagsIn = input(modTags(m).join(', '), 'comma, separated, tags');
  const save = el(`<button class="btn btn-primary" style="width:100%;margin-top:8px">${icon('check', 15)} Save</button>`);
  save.onclick = () => {
    m.name = nameIn.value.trim() || m.name;
    m.category = catIn.value.trim() || null;
    m.subcategory = subIn.value.trim() || null;
    m.tags = tagsIn.value.split(',').map(s => s.trim()).filter(Boolean);
    store.put('modules', m);
    events.emit('module:changed', {});
    d.close();
    rerender?.();
    toast('Module updated', 'check');
  };
  const iconBtn = el(`<button class="btn" style="width:100%">${iconOrEmoji(m.icon, 16)} Change icon</button>`);
  iconBtn.onclick = async () => {
    const { openIconPicker } = await import('./shell.js');
    openIconPicker(m.icon, (val) => { m.icon = val; store.put('modules', m); iconBtn.innerHTML = `${iconOrEmoji(val, 16)} Change icon`; events.emit('module:changed', {}); });
  };
  d.body.append(
    field('Name', nameIn), iconBtn,
    field('Category', catIn), field('Subcategory', subIn), field('Tags', tagsIn), save
  );
}

async function deleteModule(m, rerender) {
  if (store.all('modules').length <= 1) { toast('The last module stays planted.', 'info'); return; }
  if (!(await confirmDialog({ title: `Delete “${m.name}”?`, message: 'Everything inside rests in the trash for 30 days.' }))) return;
  const { removeWidget } = await import('../widgets/base.js');
  for (const pid of m.pages) {
    const page = store.get('pages', pid);
    if (!page) continue;
    for (const wid of [...page.widgets]) { const w = store.get('widgets', wid); if (w) removeWidget(w); }
    store.trash('pages', pid);
  }
  store.trash('modules', m.id);
  pruneModule(m.id); // drop it from groups / pins / hides / per-group last
  events.emit('module:changed', {});
  if (router.current().moduleId === m.id) router.go(store.all('modules')[0].id);
  rerender?.();
}

function newModuleMenu(anchor, panel) {
  popMenu(anchor, [
    { label: 'From Preset', iconName: 'gift', fn: async () => { const { openPresetGallery } = await import('./presetgallery.js'); panel.close(); openPresetGallery(); } },
    { label: 'Help me build', iconName: 'wand', fn: async () => {
      panel.close();
      const { openBuildWizard } = await import('./buildwizard.js');
      const { SCRATCH_BLUEPRINT } = await import('../presets/blueprints.js');
      openBuildWizard(SCRATCH_BLUEPRINT);
    } },
    { label: 'Blank module', iconName: 'edit', fn: async () => {
      const name = await promptText({ title: 'New module', label: 'Module name', placeholder: 'My module', confirmText: 'Create' });
      if (!name) return;
      const page = store.put('pages', { id: ulid(), moduleId: null, name: 'Home', icon: 'home', widgets: [], themeOverride: null });
      const mod = store.put('modules', { id: ulid(), name, icon: 'circle', pages: [page.id], themeOverride: null, presetKey: null, category: null, subcategory: null, tags: [] });
      page.moduleId = mod.id; store.put('pages', page);
      panel.close();
      router.go(mod.id);
    } },
    { label: 'From Code', iconName: 'code', fn: () => { panel.close(); importCode({}); } }
  ]);
}

/* ---------- Pages panel (active module; drag-to-reorder — §3) ---------- */

export function openPagesPanel() {
  const { moduleId, pageId } = router.current();
  const mod = store.get('modules', moduleId);
  const d = openPanel({ title: mod ? `${mod.name} — Pages` : 'Pages', iconName: 'note' });
  if (!mod) { d.body.appendChild(emptyState('note', 'No module is open.')); return; }
  const list = el('<div class="nav-list nav-pages"></div>');
  d.body.appendChild(list);

  const render = () => {
    list.innerHTML = '';
    const pages = mod.pages.map(id => store.get('pages', id)).filter(Boolean);
    pages.forEach((page) => {
      const row = el(`<div class="nav-row${page.id === pageId ? ' active' : ''}" draggable="false">
        <button class="btn-icon nav-drag" aria-label="Drag to reorder">${icon('drag', 16)}</button>
        <span class="nav-ic">${iconOrEmoji(page.icon, 18)}</span>
        <span class="nav-main"><span class="nav-title"></span></span>
        ${mod.homePageId === page.id ? `<span class="nav-home" title="Home page">${icon('home', 14)}</span>` : ''}
        <button class="btn-icon nav-menu" aria-label="Page menu">${icon('more', 16)}</button></div>`);
      row.dataset.pid = page.id;
      row.querySelector('.nav-title').textContent = page.name;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.nav-menu, .nav-drag')) return;
        d.close();
        router.go(mod.id, page.id);
      });
      row.querySelector('.nav-menu').addEventListener('click', (e) => {
        e.stopPropagation();
        const anchor = e.currentTarget;
        popMenu(anchor, [
          { label: 'Rename', iconName: 'edit', fn: async () => { const n = await promptText({ title: 'Rename page', value: page.name }); if (n) { page.name = n; store.put('pages', page); events.emit('module:changed', {}); render(); } } },
          { label: mod.homePageId === page.id ? 'Remove as home' : 'Set as home', iconName: 'home', fn: () => { mod.homePageId = mod.homePageId === page.id ? null : page.id; store.put('modules', mod); events.emit('module:changed', {}); render(); } },
          // Phase 2 (docs/15 §4): pick a page's layout archetype — its room shape
          { label: 'Layout', iconName: 'grid', fn: () => {
            const cur = page.layout || 'masonry';
            popMenu(anchor, [['masonry', 'Board'], ['stream', 'Reading'], ['hearth', 'Hearth'], ['gallery', 'Gallery'], ['split', 'Split']].map(([v, label]) => ({
              label: cur === v ? `${label}  ✓` : label,
              fn: () => { page.layout = v === 'masonry' ? null : v; store.put('pages', page); events.emit('page:changed', {}); render(); }
            })));
          } },
          { label: 'Copy Code', iconName: 'code', fn: () => copyCode('pg', page.id, page.name) },
          'sep',
          { label: 'Delete', iconName: 'trash', danger: true, fn: () => deletePage(mod, page, render) }
        ]);
      });
      enablePageDrag(row.querySelector('.nav-drag'), row, list, mod);
      list.appendChild(row);
    });
  };

  d.body.appendChild(bottomBar('New Page', 'plus', (e) => popMenu(e.currentTarget, [
    { label: 'Blank page', iconName: 'plus', fn: async () => {
      const name = await promptText({ title: 'Add page', label: 'Page name', placeholder: 'Garden', confirmText: 'Add' });
      if (!name) return;
      const page = store.put('pages', { id: ulid(), moduleId: mod.id, name, icon: 'circle', widgets: [], themeOverride: null });
      mod.pages.push(page.id); store.put('modules', mod);
      events.emit('module:changed', { moduleId: mod.id });
      d.close(); router.go(mod.id, page.id);
    } },
    { label: 'Help me build', iconName: 'wand', fn: async () => {
      const { openBuildWizard } = await import('./buildwizard.js');
      const { PAGE_BLUEPRINT } = await import('../presets/blueprints.js');
      const { instantiatePageInto } = await import('../presets/modules/index.js');
      openBuildWizard(PAGE_BLUEPRINT, { onPlant: (def) => { const page = instantiatePageInto(mod, def.pages[0]); router.go(mod.id, page.id); } });
    } }
  ]), () => importCode({})));
  render();
}

async function deletePage(mod, page, render) {
  if (mod.pages.length <= 1) { toast('A module keeps at least one page.', 'info'); return; }
  if (!(await confirmDialog({ title: `Delete “${page.name}”?`, message: 'Its widgets rest in the trash for 30 days.' }))) return;
  const { removeWidget } = await import('../widgets/base.js');
  for (const wid of [...page.widgets]) { const w = store.get('widgets', wid); if (w) removeWidget(w); }
  if (mod.homePageId === page.id) mod.homePageId = null;
  mod.pages = mod.pages.filter(id => id !== page.id);
  store.put('modules', mod);
  store.trash('pages', page.id);
  events.emit('module:changed', {});
  if (router.current().pageId === page.id) router.go(mod.id);
  render();
}

/** Pointer reorder for the pages list: the row follows the pointer between
    siblings, and the new order is read back from the DOM (each row carries its
    page id in data-pid) on release. */
function enablePageDrag(handle, row, list, mod) {
  handle.addEventListener('pointerdown', (start) => {
    start.preventDefault();
    handle.setPointerCapture(start.pointerId);
    let started = false;
    const onMove = (e) => {
      if (!started && Math.abs(e.clientY - start.clientY) < 6) return;
      started = true; row.classList.add('nav-dragging');
      const siblings = [...list.querySelectorAll('.nav-row')].filter(r => r !== row);
      let placed = false;
      for (const s of siblings) {
        const r = s.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { list.insertBefore(row, s); placed = true; break; }
      }
      if (!placed) list.appendChild(row);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      row.classList.remove('nav-dragging');
      if (started) {
        mod.pages = [...list.querySelectorAll('.nav-row')].map(r => r.dataset.pid);
        store.put('modules', mod);
        events.emit('module:changed', {});
      }
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}

/* ---------- Widgets panel (active page — §3) ---------- */

export function openWidgetsPanel() {
  const { pageId } = router.current();
  const page = store.get('pages', pageId);
  const d = openPanel({ title: page ? `${page.name} — Widgets` : 'Widgets', iconName: 'layers' });
  if (!page) { d.body.appendChild(emptyState('layers', 'No page is open.')); return; }
  const list = el('<div class="nav-list"></div>');
  d.body.appendChild(list);

  const widgetRow = (w) => {
    const def = registry.get(w.type);
    const row = el(`<div class="nav-row">
      <span class="nav-ic" style="color:var(--accent)">${icon(def?.icon || 'circle', 18)}</span>
      <span class="nav-main"><span class="nav-title"></span><span class="nav-sub"></span></span>
      <button class="btn-icon nav-menu" aria-label="Widget menu">${icon('more', 16)}</button></div>`);
    row.querySelector('.nav-title').textContent = w.name;
    row.querySelector('.nav-sub').textContent = def?.name || w.type;
    const openIt = async () => {
      const { openInternal } = await import('../modules/engine.js');
      d.close();
      if (def?.internal) openInternal(w);
      else { events.emit('widget:focus', { widgetId: w.id }); }
    };
    row.addEventListener('click', (e) => { if (!e.target.closest('.nav-menu')) openIt(); });
    row.querySelector('.nav-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      popMenu(e.currentTarget, [
        { label: 'Edit', iconName: 'edit', fn: async () => { const { openWidgetSettings } = await import('../widgets/base.js'); openWidgetSettings(w); } },
        ...(def?.internal ? [{ label: 'Open', iconName: 'arrow-right', fn: openIt }] : []),
        { label: 'Copy Code', iconName: 'code', fn: () => copyCode('wgt', w.id, w.name) },
        'sep',
        { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
          if (!(await confirmDialog({ title: `Delete “${w.name}”?`, message: 'It rests in the trash for 30 days.' }))) return;
          const { removeWidget } = await import('../widgets/base.js');
          removeWidget(w); toast('Moved to trash', 'leaf'); render();
        } }
      ]);
    });
    return row;
  };

  const render = () => {
    list.innerHTML = '';
    const widgets = page.widgets.map(id => store.get('widgets', id)).filter(Boolean);
    if (!widgets.length) { list.appendChild(emptyState('layers', 'This page is quiet. Add a widget below.')); return; }

    // P-3: group by category into collapsed sections (like the Modules panel).
    const groups = new Map();
    for (const w of widgets) {
      const cat = registry.categoryOf(w.type);
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(w);
    }
    // A short list doesn't need folding — show flat when there's only one group.
    if (groups.size <= 1) {
      for (const w of widgets) list.appendChild(widgetRow(w));
      return;
    }
    for (const [cat, items] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      const det = el(`<details class="nav-group"><summary><span class="nav-chev">${icon('chevron-right', 14)}</span><span class="grow"></span><span class="nav-count"></span></summary><div class="nav-group-body"></div></details>`);
      det.querySelector('summary .grow').textContent = cat;
      det.querySelector('.nav-count').textContent = items.length;
      const body = det.querySelector('.nav-group-body');
      for (const w of items) body.appendChild(widgetRow(w));
      list.appendChild(det);
    }
  };

  d.body.appendChild(bottomBar('Add Widget', 'plus', async () => {
    const { openWidgetGallery } = await import('./picker.js');
    d.close();
    openWidgetGallery({ pageId: page.id });
  }, () => importCode({ pageId: page.id })));
  render();
}
