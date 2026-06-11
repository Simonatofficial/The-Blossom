/* The settings drawer (docs/01): Themes, Saves, Blossom Codes, About.
   Also exports copyNodeCode / openCodeImport used across the app. */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { ulid } from '../core/ids.js';
import { router } from '../core/router.js';
import { icon } from './icons.js';
import { el, toast, confirmDialog, openDrawer, popMenu, promptText, emptyState, switchEl } from './components.js';
import { allThemes, applyGlobalTheme, activeThemeId, getTheme, withOverrides, themeOverrides, setThemeOverride, clearThemeOverrides } from '../fx/themes.js';
import { ATMOSPHERE_PRESETS } from '../fx/atmosphere.js';
import { PRESET_PARTICLES, PRESET_POINTER_FX, getParticlePreset, getPointerFxPreset } from '../presets/particles.js';
import * as codes from '../core/codes.js';
import * as saves from '../core/saves.js';

export function openSettings() {
  const d = openDrawer({ title: 'Settings', iconName: 'settings' });
  renderAppearanceSection(d);
  renderThemesSection(d);
  renderCodesSection(d);
  renderSavesSection(d);
  renderTrashSection(d);
  renderAboutSection(d);
}

/* ---------- trash (docs/01: soft deletes rest 30 days) ---------- */

function renderTrashSection(d) {
  const sec = el('<div class="dsec"><h3>Trash</h3><div class="tr-list"></div></div>');
  const list = sec.querySelector('.tr-list');
  const LABEL = { modules: 'Module', pages: 'Page', widgets: 'Widget', objects: 'Object', themes: 'Theme' };
  const render = () => {
    list.innerHTML = '';
    const items = store.all('trash').sort((a, b) => b.deletedAt - a.deletedAt).slice(0, 30);
    if (!items.length) {
      list.appendChild(el('<p class="soft" style="font-size:0.82rem">Empty — nothing is wilting here.</p>'));
      return;
    }
    for (const item of items) {
      const li = el(`<div class="list-item" style="cursor:default">
        <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
        <span class="chip">${LABEL[item._store] || item._store}</span>
        <button class="btn-icon" title="Restore">${icon('rotate-ccw', 15)}</button>
        <button class="btn-icon" title="Delete forever">${icon('x', 15)}</button></div>`);
      li.querySelector('.li-title').textContent = item.name || item.kind || 'Untitled';
      li.querySelector('.li-sub').textContent = `deleted ${new Date(item.deletedAt).toLocaleDateString()}`;
      li.querySelector('[title="Restore"]').onclick = () => {
        const rec = store.restore(item.id);
        // re-attach restored widgets to their page if the page still exists
        if (item._store === 'widgets' && rec?.pageId) {
          const page = store.get('pages', rec.pageId);
          if (page && !page.widgets.includes(rec.id)) { page.widgets.push(rec.id); store.put('pages', page); }
        }
        events.emit('page:changed', {});
        events.emit('module:changed', {});
        toast('Restored', 'leaf');
        render();
      };
      li.querySelector('[title="Delete forever"]').onclick = async () => {
        if (await confirmDialog({ title: 'Delete forever?', message: 'This cannot be undone.' })) {
          store.del('trash', item.id);
          render();
        }
      };
      list.appendChild(li);
    }
  };
  render();
  d.body.appendChild(sec);
}

/* ---------- appearance (CR-1: panel placement) ---------- */

function renderAppearanceSection(d) {
  const sec = el('<div class="dsec"><h3>Appearance</h3><div class="field"><label>Open panels as</label><div class="a-seg"></div><div class="hint">How settings, pickers, and widget views slide in. Takes effect on the next panel.</div></div></div>');
  const settings = store.getMeta('settings', {});
  const current = settings.panelPlacement || (innerWidth >= 600 ? 'right' : 'sheet');
  const segEl = el('<div class="seg"></div>');
  for (const [value, label] of [['full', 'Full page'], ['left', 'Left'], ['right', 'Right'], ['sheet', 'Bottom sheet']]) {
    const b = el(`<button type="button" class="${current === value ? 'active' : ''}">${label}</button>`);
    b.onclick = () => {
      segEl.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const s = store.getMeta('settings', {});
      s.panelPlacement = value;
      store.setMeta('settings', s);
      toast(`Panels now open as ${label.toLowerCase()}`, 'sliders');
    };
    segEl.appendChild(b);
  }
  sec.querySelector('.a-seg').appendChild(segEl);
  d.body.appendChild(sec);
}

/* ---------- themes ---------- */

function renderThemesSection(d) {
  const sec = el('<div class="dsec"><h3>Themes</h3><div class="t-list"></div></div>');
  const list = sec.querySelector('.t-list');
  const render = () => {
    list.innerHTML = '';
    for (const t of allThemes()) {
      const customized = !!themeOverrides(t.id);
      const li = el(`<button class="list-item">
        <span style="display:flex;gap:3px">${['bg', 'accent', 'highlight'].map(k => `<span style="width:14px;height:14px;border-radius:50%;background:${t.colors[k]};border:1px solid var(--border)"></span>`).join('')}</span>
        <span class="li-main"><span class="li-title"></span></span>
        ${customized ? '<span class="chip">customized</span>' : ''}
        ${t.custom ? `<span class="btn-icon t-edit" title="Edit">${icon('edit', 14)}</span><span class="btn-icon t-del" title="Delete">${icon('trash', 14)}</span>` : ''}
        ${activeThemeId() === t.id ? icon('check', 16) : ''}</button>`);
      li.querySelector('.li-title').textContent = t.name;
      li.onclick = (e) => {
        if (e.target.closest('.t-edit, .t-del')) return;
        applyGlobalTheme(t.id);
        render();
      };
      li.querySelector('.t-edit')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const { openThemeEditor } = await import('./themeeditor.js');
        openThemeEditor(t.id);
      });
      li.querySelector('.t-del')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await confirmDialog({ title: `Delete “${t.name}”?`, message: 'Anything using it falls back to Inherit.' })) {
          store.del('themes', t.id);
          if (activeThemeId() === t.id) applyGlobalTheme('space');
          render();
        }
      });
      list.appendChild(li);
    }
    list.appendChild(renderEffectsPanel(render));
    const newBtn = el(`<button class="btn-soft-wide">${icon('plus', 15)} New theme</button>`);
    newBtn.onclick = async () => {
      const { openThemeEditor } = await import('./themeeditor.js');
      openThemeEditor();
    };
    list.appendChild(newBtn);
    const newParticles = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('sparkles', 15)} New particles</button>`);
    newParticles.onclick = async () => {
      const { openParticleEditor } = await import('./particleeditor.js');
      openParticleEditor();
    };
    list.appendChild(newParticles);
  };
  render();
  d.body.appendChild(sec);
}

/* ---------- effects on the active theme (CR-5: non-destructive overrides) ---------- */

function resolveFxDef(spec) {
  if (!spec?.preset) return null;
  const base = getParticlePreset(spec.preset) || getPointerFxPreset(spec.preset) || store.get('themes', spec.preset)?.def;
  return base ? { ...base, ...(spec.overrides || {}) } : null;
}

function renderEffectsPanel(rerenderThemes) {
  const raw = getTheme(activeThemeId());
  const theme = withOverrides(raw);
  const reapply = () => { applyGlobalTheme(raw.id); rerenderThemes(); };

  const panel = el(`<div class="panel" style="padding:12px;margin:4px 0 10px">
    <div class="row-between" style="margin-bottom:8px">
      <span class="soft" style="font-size:0.74rem;letter-spacing:0.06em">EFFECTS — ${raw.name.toUpperCase()}</span>
      <span class="row e-actions"></span>
    </div>
    <div class="e-rows"></div></div>`);

  const rows = panel.querySelector('.e-rows');

  const fxRow = (label, kind, presets, allowAdjust) => {
    const spec = theme[kind];
    const row = el(`<div class="row" style="margin-bottom:8px;flex-wrap:wrap">
      <span style="font-size:0.86rem;min-width:84px">${label}</span>
      <select class="select grow" style="min-width:120px;padding:6px 9px"></select>
      <span class="e-adjust"></span><span class="e-switch"></span></div>`);
    const sel = row.querySelector('select');
    sel.appendChild(new Option('None', ''));
    for (const p of presets) sel.appendChild(new Option(p.name, p.key || p.id));
    if (kind !== 'atmosphere') {
      for (const c of store.all('themes').filter(t => t.type === 'particle')) sel.appendChild(new Option(`${c.name} (custom)`, c.id));
    }
    sel.value = spec?.preset || '';
    sel.onchange = () => {
      setThemeOverride(raw.id, kind, sel.value ? { preset: sel.value, [kind === 'atmosphere' ? 'options' : 'overrides']: {} } : null);
      reapply();
    };
    row.querySelector('.e-switch').appendChild(switchEl(!!spec, (on) => {
      setThemeOverride(raw.id, kind, on ? undefined : null); // on = back to the preset's own default
      reapply();
    }));
    if (allowAdjust && spec) {
      const adj = el(`<button class="btn-icon" title="Adjust">${icon('sliders', 15)}</button>`);
      adj.onclick = async () => {
        if (kind === 'atmosphere') {
          const slider = el('<input type="range" class="range" min="0.25" max="3" step="0.25" style="width:110px" title="Speed">');
          slider.value = spec.options?.speed || 1;
          slider.onchange = () => {
            setThemeOverride(raw.id, 'atmosphere', { ...spec, options: { ...(spec.options || {}), speed: Number(slider.value) } });
            reapply();
          };
          adj.replaceWith(slider);
        } else {
          const { openParticleEditor } = await import('./particleeditor.js');
          openParticleEditor(null, (rec) => {
            setThemeOverride(raw.id, kind, { preset: rec.id, overrides: {} });
            reapply();
          }, resolveFxDef(spec));
        }
      };
      row.querySelector('.e-adjust').appendChild(adj);
    }
    return row;
  };

  /* CR-7: particles are a LIST of up to three layers (first = back).
     Each row: preset, on/off, adjust, reorder, remove; plus an add button. */
  const particleRows = () => {
    const wrap = el('<div></div>');
    const spec = theme.particles;
    const layers = (Array.isArray(spec) ? spec : spec ? [spec] : []).map(l => ({ overrides: {}, enabled: true, ...l }));
    const save = (next) => { setThemeOverride(raw.id, 'particles', next.length ? next : null); reapply(); };

    layers.forEach((layer, i) => {
      const row = el(`<div class="row" style="margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:0.86rem;min-width:84px">${i === 0 ? 'Particles' : `Layer ${i + 1}`}</span>
        <select class="select grow" style="min-width:110px;padding:6px 9px"></select>
        <button class="btn-icon p-adj" title="Adjust">${icon('sliders', 15)}</button>
        <button class="btn-icon p-up" title="Move back">${icon('chevron-up', 14)}</button>
        <button class="btn-icon p-down" title="Move forward">${icon('chevron-down', 14)}</button>
        <button class="btn-icon p-del" title="Remove layer">${icon('x', 14)}</button>
        <span class="p-switch"></span></div>`);
      const sel = row.querySelector('select');
      for (const p of PRESET_PARTICLES) sel.appendChild(new Option(p.name, p.id));
      for (const c of store.all('themes').filter(t => t.type === 'particle')) sel.appendChild(new Option(`${c.name} (custom)`, c.id));
      sel.value = layer.preset;
      const next = () => layers.map(l => ({ ...l }));
      sel.onchange = () => { const n = next(); n[i] = { ...n[i], preset: sel.value, overrides: {} }; save(n); };
      row.querySelector('.p-switch').appendChild(switchEl(layer.enabled !== false, (on) => {
        const n = next(); n[i].enabled = on; save(n);
      }));
      row.querySelector('.p-adj').onclick = async () => {
        const { openParticleEditor } = await import('./particleeditor.js');
        openParticleEditor(null, (rec) => {
          const n = next(); n[i] = { preset: rec.id, overrides: {}, enabled: true }; save(n);
        }, resolveFxDef(layer));
      };
      const swap = (j) => {
        if (j < 0 || j >= layers.length) return;
        const n = next();
        [n[i], n[j]] = [n[j], n[i]];
        save(n);
      };
      row.querySelector('.p-up').onclick = () => swap(i - 1);
      row.querySelector('.p-down').onclick = () => swap(i + 1);
      row.querySelector('.p-del').onclick = () => { const n = next(); n.splice(i, 1); save(n); };
      wrap.appendChild(row);
    });

    if (layers.length < 3) {
      const add = el(`<button class="btn-ghost btn" style="padding:4px 10px;font-size:0.8rem;margin:-2px 0 8px 84px">${icon('plus', 13)} Add particle layer</button>`);
      add.onclick = () => save([...layers, { preset: 'fireflies', overrides: {}, enabled: true }]);
      wrap.appendChild(add);
    }
    return wrap;
  };

  rows.appendChild(fxRow('Atmosphere', 'atmosphere', ATMOSPHERE_PRESETS, true));
  rows.appendChild(particleRows());
  rows.appendChild(fxRow('Pointer FX', 'pointerFx', PRESET_POINTER_FX, true));

  if (themeOverrides(raw.id)) {
    const actions = panel.querySelector('.e-actions');
    const reset = el(`<button class="btn-ghost btn" style="padding:4px 10px;font-size:0.8rem">${icon('rotate-ccw', 13)} Reset</button>`);
    reset.onclick = async () => {
      if (await confirmDialog({ title: `Reset “${raw.name}” to its preset?`, message: 'Your effect tweaks on this theme are cleared.', confirmText: 'Reset' })) {
        clearThemeOverrides(raw.id);
        reapply();
      }
    };
    const promote = el(`<button class="btn-ghost btn" style="padding:4px 10px;font-size:0.8rem">${icon('save', 13)} Save as new</button>`);
    promote.onclick = async () => {
      const name = await promptText({ title: 'Save as new theme', label: 'Name', value: `${raw.name} (mine)` });
      if (!name) return;
      const merged = withOverrides(raw);
      const rec = store.put('themes', { id: ulid(), name, custom: true, colors: { ...merged.colors }, atmosphere: merged.atmosphere, particles: merged.particles, pointerFx: merged.pointerFx });
      clearThemeOverrides(raw.id);
      applyGlobalTheme(rec.id);
      rerenderThemes();
      toast(`${name} saved`, 'palette');
    };
    actions.append(promote, reset);
  }

  return panel;
}

/* ---------- Blossom codes library (docs/02) ---------- */

function renderCodesSection(d) {
  const sec = el('<div class="dsec"><h3>Blossom Codes</h3><div class="c-list"></div></div>');
  const list = sec.querySelector('.c-list');
  const render = () => {
    list.innerHTML = '';
    const items = store.all('saves').filter(s => s.kind === 'code').sort((a, b) => b.date - a.date);
    for (const item of items) {
      const li = el(`<div class="list-item" style="cursor:default">
        <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
        <span class="chip"></span>
        <button class="btn-icon" title="Copy">${icon('copy', 15)}</button>
        <button class="btn-icon" title="More">${icon('more', 15)}</button></div>`);
      li.querySelector('.li-title').textContent = item.name;
      li.querySelector('.li-sub').textContent = new Date(item.date).toLocaleDateString();
      li.querySelector('.chip').textContent = codes.typeLabel(item.codeType);
      li.querySelector('[title="Copy"]').onclick = async () => {
        await navigator.clipboard.writeText(item.code);
        toast('Code copied', 'code');
      };
      li.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Rename', iconName: 'edit', fn: async () => {
          const name = await promptText({ title: 'Rename code', value: item.name });
          if (name) { item.name = name; store.put('saves', item); render(); }
        } },
        { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: `Delete “${item.name}”?` })) { store.del('saves', item.id); render(); }
        } }
      ]);
      list.appendChild(li);
    }
    const paste = el(`<button class="btn-soft-wide">${icon('code', 15)} Paste a code</button>`);
    paste.onclick = () => openCodeImport({});
    list.appendChild(paste);
  };
  render();
  d.body.appendChild(sec);
  events.on('saves:changed', render);
}

/* ---------- saves (docs/01: bottom of the drawer) ---------- */

function renderSavesSection(d) {
  const sec = el('<div class="dsec"><h3>Saves</h3><div class="s-actions col"></div><div class="s-list" style="margin-top:12px"></div></div>');
  const actions = sec.querySelector('.s-actions');

  const copyBtn = el(`<button class="btn">${icon('copy', 15)} Copy save code</button>`);
  copyBtn.onclick = async () => {
    const code = await saves.saveCode();
    await navigator.clipboard.writeText(code);
    const name = await promptText({ title: 'Name this backup', label: 'Name', value: '', placeholder: 'Before the trip' });
    saves.makeAutosave(name || 'Export', 'export');
    toast('Save code copied', 'save');
  };

  const fileBtn = el(`<button class="btn">${icon('download', 15)} Download file</button>`);
  fileBtn.onclick = async () => {
    saves.downloadFile();
    const name = await promptText({ title: 'Name this backup', label: 'Name', placeholder: 'Before the trip' });
    saves.makeAutosave(name || 'Export', 'export');
  };

  const importBtn = el(`<button class="btn">${icon('upload', 15)} Import</button>`);
  importBtn.onclick = () => openCodeImport({ allowFile: true });

  const autosaveBtn = el(`<button class="btn">${icon('save', 15)} Autosave now</button>`);
  autosaveBtn.onclick = async () => {
    const name = await promptText({ title: 'Name this autosave', label: 'Name', placeholder: 'Sunday evening' });
    saves.makeAutosave(name || 'Manual save', 'manual');
    toast('Saved', 'save');
  };

  actions.append(copyBtn, fileBtn, importBtn, autosaveBtn);

  const list = sec.querySelector('.s-list');
  const render = () => {
    list.innerHTML = '';
    const items = store.all('saves').filter(s => s.kind === 'autosave').sort((a, b) => b.date - a.date).slice(0, 40);
    for (const item of items) {
      const li = el(`<div class="list-item" style="cursor:default">
        <span style="color:var(--accent)">${icon('save', 16)}</span>
        <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
        <button class="btn-icon" title="Copy code">${icon('copy', 15)}</button>
        <button class="btn-icon" title="More">${icon('more', 15)}</button></div>`);
      li.querySelector('.li-title').textContent = item.name;
      const dt = new Date(item.date);
      li.querySelector('.li-sub').textContent = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${item.history?.length > 1 ? ` · ${item.history.length} updates` : ''}`;
      li.querySelector('[title="Copy code"]').onclick = async () => {
        const code = await codes.encode('ws', item.payload);
        await navigator.clipboard.writeText(code);
        toast('Backup code copied', 'code');
      };
      li.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Restore this backup', iconName: 'rotate-ccw', fn: async () => {
          if (await confirmDialog({ title: `Restore “${item.name}”?`, message: 'Current data is backed up first, then replaced.', confirmText: 'Restore' })) {
            await saves.importWorkspace(item.payload, 'replace');
            toast('Backup restored', 'flower');
          }
        } },
        { label: 'Update snapshot', iconName: 'refresh', fn: () => {
          item.payload = codes.snapshotNode('ws', null);
          item.history = [...(item.history || []), Date.now()];
          item.date = Date.now();
          store.put('saves', item);
          render();
          toast('Snapshot updated', 'save');
        } },
        { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: `Delete “${item.name}”?` })) { store.del('saves', item.id); render(); }
        } }
      ]);
      list.appendChild(li);
    }
  };
  render();
  events.on('saves:changed', render);

  // storage durability status (docs/09)
  const status = el('<p class="soft" style="margin-top:10px;font-size:0.78rem"></p>');
  navigator.storage?.persisted?.().then(p => {
    status.textContent = p ? 'Storage: protected ✓' : 'Storage: best-effort — export backups regularly.';
  });
  sec.appendChild(status);
  d.body.appendChild(sec);
}

/* ---------- about ---------- */

function renderAboutSection(d) {
  const sec = el(`<div class="dsec"><h3>About</h3>
    <p class="soft" style="font-size:0.86rem;margin-bottom:10px">The Blossom — your cozy, all-in-one space to grow. Everything lives on your device.</p>
    <button class="btn" style="width:100%">${icon('flower', 15)} Replay the tour</button></div>`);
  sec.querySelector('button').onclick = async () => {
    store.setMeta('onboarded', null);
    const { initOnboarding } = await import('./onboarding.js');
    d.close();
    initOnboarding(true);
  };
  d.body.appendChild(sec);
}

/* ---------- copy a node as a Blossom code (used everywhere) ---------- */

export async function copyNodeCode(type, id, defaultName) {
  try {
    const payload = codes.snapshotNode(type, id);
    const code = await codes.encode(type, payload);
    await navigator.clipboard.writeText(code);
    toast('Blossom code copied', 'code');
    const name = await promptText({ title: 'Save to your Codes library?', label: 'Name', value: defaultName, confirmText: 'Save' });
    if (name) {
      store.put('saves', { id: ulid(), kind: 'code', name, codeType: type, code, date: Date.now(), sourceId: id });
      events.emit('saves:changed', {});
    }
  } catch (err) {
    console.error(err);
    toast('Could not copy that code.', 'info');
  }
}

/* ---------- import flow (paste code / load file, preview, merge/replace) ---------- */

export function openCodeImport({ pageId = null, allowFile = false } = {}) {
  const d = openDrawer({ title: 'Import', iconName: 'upload' });
  const ta = el('<textarea class="textarea" rows="4" placeholder="Paste a Blossom code (BLSM1.…)"></textarea>');
  d.body.appendChild(ta);

  if (allowFile) {
    const fileBtn = el(`<button class="btn" style="width:100%;margin-top:8px">${icon('folder', 15)} Load .blossom file</button>`);
    const fileIn = el('<input type="file" accept=".blossom,application/json" class="hidden">');
    fileBtn.onclick = () => fileIn.click();
    fileIn.onchange = async () => {
      const file = fileIn.files[0];
      if (!file) return;
      try {
        const payload = saves.parseSaveFile(await file.text());
        preview('ws', payload);
      } catch (err) { toast(err.message || 'That file could not be read.', 'info'); }
    };
    d.body.append(fileBtn, fileIn);
  }

  const goBtn = el('<button class="btn btn-primary" style="width:100%;margin-top:10px">Preview</button>');
  goBtn.onclick = async () => {
    try {
      const { type, payload } = await codes.decode(ta.value);
      preview(type, payload);
    } catch (err) { toast(err.message || 'That code could not be read.', 'info'); }
  };
  d.body.appendChild(goBtn);

  function preview(type, payload) {
    d.setTitle(`Import ${codes.typeLabel(type)}`);
    d.body.innerHTML = '';
    const counts = codes.describePayload(type, payload);
    const nice = { modules: 'modules', pages: 'pages', widgets: 'widgets', objects: 'objects', themes: 'themes' };
    const lines = Object.entries(counts).filter(([k]) => nice[k]).map(([k, n]) => `${n} ${nice[k]}`).join(' · ') || 'empty';
    d.body.appendChild(el(`<div class="panel" style="padding:14px;margin-bottom:14px">
      <div class="row">${icon('gift', 18)}<strong style="margin-left:6px">${payload.root?.name || codes.typeLabel(type)}</strong></div>
      <p class="soft" style="margin-top:6px;font-size:0.85rem">${lines}</p></div>`));

    if (type === 'ws') {
      const merge = el('<button class="btn" style="width:100%;margin-bottom:8px">Merge into my workspace</button>');
      merge.onclick = async () => { await saves.importWorkspace(payload, 'merge'); d.close(); toast('Imported — welcome home', 'flower'); };
      const replace = el('<button class="btn" style="width:100%;color:var(--warn)">Replace everything</button>');
      replace.onclick = async () => {
        if (await confirmDialog({ title: 'Replace your whole workspace?', message: 'A safety autosave is written first.', confirmText: 'Replace' })) {
          await saves.importWorkspace(payload, 'replace');
          d.close();
          toast('Workspace replaced', 'flower');
        }
      };
      d.body.append(merge, replace);
    } else {
      const ok = el('<button class="btn btn-primary" style="width:100%">Import</button>');
      ok.onclick = () => {
        const target = {};
        if (type === 'wgt') target.pageId = pageId || router.current().pageId;
        const res = codes.importNode(type, payload, target);
        if (res.droppedLinks) toast(`${res.droppedLinks} link${res.droppedLinks === 1 ? '' : 's'} pointed outside this code and ${res.droppedLinks === 1 ? 'was' : 'were'} removed.`, 'info');
        else toast('Imported', 'flower');
        events.emit('module:changed', {});
        events.emit('page:changed', {});
        d.close();
      };
      d.body.appendChild(ok);
    }
  }
}
