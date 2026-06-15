/* The settings drawer (docs/01): Themes, Saves, Blossom Codes, About.
   Also exports copyNodeCode / openCodeImport used across the app. */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { ulid } from '../core/ids.js';
import { router } from '../core/router.js';
import { icon } from './icons.js';
import { el, toast, confirmDialog, openDrawer, popMenu, promptText, emptyState, switchEl, field, input, rangeField } from './components.js';
import { allThemes, applyGlobalTheme, activeThemeId, getTheme, withOverrides, themeOverrides, setThemeOverride, clearThemeOverrides } from '../fx/themes.js';
import { ATMOSPHERE_PRESETS, ATMOSPHERE_OPTIONS } from '../fx/atmosphere.js';
import { WEATHER_EFFECTS } from '../fx/weather.js';
import { PRESET_POINTER_FX, getParticlePreset, getPointerFxPreset } from '../presets/particles.js';
import * as codes from '../core/codes.js';
import * as saves from '../core/saves.js';
import { syncStatus, accountInfo, upgradeAccount, kofiHandle } from '../core/sync.js';

export function openSettings() {
  const d = openDrawer({ title: 'Settings', iconName: 'settings' });
  renderAppearanceSection(d);
  renderAccountSection(d);
  renderVisualEffectsSection(d);
  renderThemesSection(d);
  renderCodesSection(d);
  renderSavesSection(d);
  renderTrashSection(d);
  renderAboutSection(d);
}

/* ---------- trash (docs/01: soft deletes rest 30 days) ---------- */

function renderTrashSection(d) {
  const sec = el('<div class="dsec"><h3>Trash</h3><div class="tr-bar"></div><div class="tr-list"></div></div>');
  const bar = sec.querySelector('.tr-bar');
  const list = sec.querySelector('.tr-list');
  const LABEL = { modules: 'Module', pages: 'Page', widgets: 'Widget', objects: 'Object', themes: 'Theme' };
  const selected = new Set(); // checked trash ids

  /** Put one trashed record back, re-attaching a restored widget to its page. */
  const restoreItem = (item) => {
    const rec = store.restore(item.id);
    if (item._store === 'widgets' && rec?.pageId) {
      const page = store.get('pages', rec.pageId);
      if (page && !page.widgets.includes(rec.id)) { page.widgets.push(rec.id); store.put('pages', page); }
    }
    return rec;
  };

  /** Permanently delete a set of trashed ids after one confirm. */
  const purge = async (ids, empty = false) => {
    if (!ids.length) return;
    const ok = await confirmDialog({
      title: empty ? 'Empty the trash?' : `Delete ${ids.length} item${ids.length > 1 ? 's' : ''} forever?`,
      message: 'This cannot be undone.',
      confirmText: empty ? 'Empty trash' : 'Delete forever'
    });
    if (!ok) return;
    for (const id of ids) { store.del('trash', id); selected.delete(id); }
    toast(empty ? 'Trash emptied' : `Deleted ${ids.length} forever`, 'trash');
    render();
  };

  const restoreMany = (ids) => {
    const all = store.all('trash');
    for (const id of ids) { const it = all.find(x => x.id === id); if (it) restoreItem(it); }
    selected.clear();
    events.emit('page:changed', {});
    events.emit('module:changed', {});
    toast(ids.length > 1 ? `Restored ${ids.length}` : 'Restored', 'leaf');
    render();
  };

  const render = () => {
    const all = store.all('trash').sort((a, b) => b.deletedAt - a.deletedAt);
    for (const id of [...selected]) if (!all.some(x => x.id === id)) selected.delete(id); // drop stale
    const items = all.slice(0, 30);

    // ---- toolbar: select-all + bulk actions ----
    bar.innerHTML = '';
    if (all.length) {
      const allShownSel = items.length > 0 && items.every(i => selected.has(i.id));
      const head = el(`<div class="row tr-head">
        <button class="btn-icon tr-all" title="Select all">${icon(allShownSel ? 'check-square' : 'square', 16)}</button>
        <span class="soft grow tr-count"></span></div>`);
      head.querySelector('.tr-count').textContent = selected.size
        ? `${selected.size} selected`
        : `${all.length} item${all.length > 1 ? 's' : ''}${all.length > items.length ? ` · showing ${items.length}` : ''}`;
      head.querySelector('.tr-all').onclick = () => {
        if (allShownSel) items.forEach(i => selected.delete(i.id));
        else items.forEach(i => selected.add(i.id));
        render();
      };
      if (selected.size) {
        const restoreB = el(`<button class="btn tr-act">${icon('rotate-ccw', 14)} Restore</button>`);
        restoreB.onclick = () => restoreMany([...selected]);
        const delB = el(`<button class="btn tr-act tr-danger">${icon('trash', 14)} Delete forever</button>`);
        delB.onclick = () => purge([...selected]);
        head.append(restoreB, delB);
      } else {
        const emptyB = el(`<button class="btn tr-act tr-danger">${icon('trash', 14)} Empty trash</button>`);
        emptyB.onclick = () => purge(all.map(i => i.id), true);
        head.append(emptyB);
      }
      bar.appendChild(head);
    }

    // ---- the list ----
    list.innerHTML = '';
    if (!all.length) {
      list.appendChild(el('<p class="soft" style="font-size:0.82rem">Empty — nothing is wilting here.</p>'));
      return;
    }
    for (const item of items) {
      const sel = selected.has(item.id);
      const li = el(`<div class="list-item${sel ? ' sel' : ''}" style="cursor:default">
        <button class="btn-icon tr-check" title="Select">${icon(sel ? 'check-square' : 'square', 16)}</button>
        <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
        <span class="chip">${LABEL[item._store] || item._store}</span>
        <button class="btn-icon" title="Restore">${icon('rotate-ccw', 15)}</button>
        <button class="btn-icon" title="Delete forever">${icon('x', 15)}</button></div>`);
      li.querySelector('.li-title').textContent = item.name || item.kind || 'Untitled';
      li.querySelector('.li-sub').textContent = `deleted ${new Date(item.deletedAt).toLocaleDateString()}`;
      li.querySelector('.tr-check').onclick = () => { sel ? selected.delete(item.id) : selected.add(item.id); render(); };
      li.querySelector('[title="Restore"]').onclick = () => restoreMany([item.id]);
      li.querySelector('[title="Delete forever"]').onclick = () => purge([item.id]);
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
  const segEl = el('<div class="seg" role="radiogroup" aria-label="Open panels as"></div>');
  for (const [value, label] of [['full', 'Full page'], ['left', 'Left'], ['right', 'Right'], ['sheet', 'Bottom sheet']]) {
    const on = current === value;
    const b = el(`<button type="button" role="radio" aria-checked="${on}" class="${on ? 'active' : ''}">${label}</button>`);
    b.onclick = () => {
      segEl.querySelectorAll('button').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('active');
      b.setAttribute('aria-checked', 'true');
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

/* ---------- account / cloud sync (V2 §1) — only shown when sync is configured ---------- */

function renderAccountSection(d) {
  const info = accountInfo();
  if (!info.configured) return; // sync not set up → hide entirely (silently disabled)

  const sec = el(`<div class="dsec"><h3>Account</h3>
    <div class="row" style="margin-bottom:10px"><span class="sync-dot"></span><span class="soft sync-label" style="font-size:0.84rem"></span></div>
    <div class="acct-body"></div></div>`);
  const dot = sec.querySelector('.sync-dot');
  const label = sec.querySelector('.sync-label');
  const paint = (s) => {
    dot.className = `sync-dot sync-${s}`;
    label.textContent = s === 'syncing' ? 'Syncing…' : s === 'error' ? 'Sync paused — will retry' : 'Synced';
  };
  paint(syncStatus());
  events.on('sync:status', ({ status }) => { if (sec.isConnected) paint(status); });

  const body = sec.querySelector('.acct-body');
  const render = () => {
    body.innerHTML = '';
    const a = accountInfo();
    if (!a.active) { body.appendChild(el('<p class="soft" style="font-size:0.84rem">Connecting…</p>')); return; }
    if (a.anonymous) {
      body.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:8px">You’re signed in anonymously. Add an email and password to sign in on another device and keep everything in sync.</p>'));
      const email = input('', 'you@example.com'); email.type = 'email';
      const pass = input('', 'Password (8+ characters)'); pass.type = 'password';
      const btn = el(`<button class="btn btn-primary" style="width:100%;margin-top:8px">${icon('check', 15)} Create account</button>`);
      btn.onclick = async () => {
        if (!email.value.trim() || pass.value.length < 8) { toast('Enter an email and an 8+ character password.', 'info'); return; }
        btn.disabled = true;
        try { await upgradeAccount(email.value.trim(), pass.value); toast('Account created — you’re synced', 'check'); render(); }
        catch (err) { toast(err.message || 'Could not create the account.', 'info'); btn.disabled = false; }
      };
      body.append(field('Email', email), field('Password', pass), btn);
    } else {
      const p = el('<p class="soft" style="font-size:0.84rem"></p>');
      p.textContent = `Signed in as ${a.email}. Your data syncs across your devices.`;
      body.appendChild(p);
    }
  };
  render();
  d.body.appendChild(sec);
}

/* ---------- visual effects master toggles (V2 §5) ---------- */

function renderVisualEffectsSection(d) {
  const sec = el('<div class="dsec"><h3>Effects</h3><div class="ve-rows"></div></div>');
  const rows = sec.querySelector('.ve-rows');
  const getFx = () => store.getMeta('settings', {})?.fx || {};
  const setFx = (k, v, weather = false) => {
    const s = store.getMeta('settings', {});
    s.fx = { ...(s.fx || {}), [k]: v };
    store.setMeta('settings', s);
    events.emit(weather ? 'weather:changed' : 'page:changed', {});
  };
  const setWeatherOpt = (patch) => {
    const s = store.getMeta('settings', {});
    s.fx = s.fx || {}; s.fx.weather = { ...(s.fx.weather || {}), ...patch };
    store.setMeta('settings', s);
    events.emit('weather:changed', {});
  };
  const themeId = () => activeThemeId();
  const curTheme = () => withOverrides(getTheme(themeId()));
  const reapply = () => { applyGlobalTheme(themeId()); render(); };

  // a Weather-style block: a labelled toggle; when on, its options show below it.
  const block = (label, hint, on, onToggle, optionsFn) => {
    const wrap = el('<div class="ve-block" style="margin-bottom:6px"></div>');
    const r = el('<div class="ve-row"><div class="grow"><div class="ve-label"></div><div class="hint"></div></div></div>');
    r.querySelector('.ve-label').textContent = label;
    r.querySelector('.hint').textContent = hint;
    r.appendChild(switchEl(on, onToggle));
    wrap.appendChild(r);
    if (on && optionsFn) {
      const opts = el('<div class="ve-options" style="margin:6px 2px 12px 2px"></div>');
      optionsFn(opts);
      wrap.appendChild(opts);
    }
    rows.appendChild(wrap);
  };
  const chips = (opts, items, current, onPick) => {
    const cr = el('<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>');
    for (const it of items) {
      const c = el(`<button class="chip ${current === it.value ? 'accent' : ''}"></button>`);
      c.textContent = it.label;
      c.onclick = () => onPick(it.value);
      cr.appendChild(c);
    }
    opts.appendChild(cr);
  };

  function render() {
    rows.innerHTML = '';
    const fx = getFx();
    const theme = curTheme();
    const id = themeId();

    // Atmosphere — pick a scene + its one slider
    block('Atmosphere', 'A slow background scene.', fx.atmosphereEnabled !== false,
      (v) => { setFx('atmosphereEnabled', v); render(); },
      (opts) => {
        const cur = theme.atmosphere?.preset || '';
        chips(opts, [{ value: '', label: 'None' }, ...ATMOSPHERE_PRESETS.map(a => ({ value: a.key, label: a.name }))], cur,
          (v) => { setThemeOverride(id, 'atmosphere', v ? { preset: v, options: {} } : null); reapply(); });
        const o = cur && ATMOSPHERE_OPTIONS[cur];
        if (o) {
          const lbl = el('<div class="soft" style="font-size:0.8rem;margin:0 2px 4px;cursor:help"></div>');
          lbl.textContent = o.label; lbl.title = o.tip;
          opts.appendChild(lbl);
          opts.appendChild(rangeField({ min: o.min, max: o.max, step: o.step, value: theme.atmosphere?.options?.[o.key] ?? o.def, unit: o.unit,
            onChange: (v) => { setThemeOverride(id, 'atmosphere', { preset: cur, options: { ...(theme.atmosphere?.options || {}), [o.key]: v } }); applyGlobalTheme(id); } }));
        }
      });

    // Particles — active layers + add (opens the particle picker)
    block('Particles', 'Drifting bits for the active theme.', fx.particlesEnabled !== false,
      (v) => { setFx('particlesEnabled', v); render(); },
      (opts) => renderParticleLayers(opts, theme, id, reapply));

    // Weather — effect chips + intensity
    block('Weather', 'Snow, rain, clouds, wind, fire — tappable.', fx.weatherEnabled === true,
      (v) => { setFx('weatherEnabled', v, true); render(); },
      (opts) => {
        const wx = fx.weather || {};
        chips(opts, [{ value: null, label: 'Off' }, ...WEATHER_EFFECTS.map(e => ({ value: e.key, label: e.name }))], wx.activeEffect || null,
          (v) => { setWeatherOpt({ activeEffect: v }); render(); });
        const lbl = el('<div class="soft" style="font-size:0.8rem;margin:0 2px 4px">Intensity</div>');
        opts.appendChild(lbl);
        opts.appendChild(rangeField({ min: 0, max: 100, step: 5, value: Math.round((wx.intensity ?? 0.5) * 100), unit: '%', onChange: (v) => setWeatherOpt({ intensity: v / 100 }) }));
      });

    // Pointer trail — a flourish that follows touch
    block('Pointer trail', 'A flourish that follows your touch.', !!theme.pointerFx,
      (v) => { setThemeOverride(id, 'pointerFx', v ? { preset: PRESET_POINTER_FX[0].id, overrides: {} } : null); reapply(); },
      (opts) => {
        const cur = theme.pointerFx?.preset || '';
        chips(opts, PRESET_POINTER_FX.map(p => ({ value: p.id, label: p.name })), cur,
          (v) => { setThemeOverride(id, 'pointerFx', { preset: v, overrides: {} }); reapply(); });
      });

    if (themeOverrides(id)) {
      const reset = el(`<button class="btn-ghost btn" style="padding:4px 10px;font-size:0.8rem;margin-top:2px">${icon('rotate-ccw', 13)} Reset to ${getTheme(id).name}'s defaults</button>`);
      reset.onclick = async () => {
        if (await confirmDialog({ title: 'Reset effects?', message: 'Your atmosphere, particle and pointer tweaks on this theme are cleared.', confirmText: 'Reset' })) { clearThemeOverrides(id); reapply(); }
      };
      rows.appendChild(reset);
    }
  }
  render();
  d.body.appendChild(sec);
}

/* The active theme's particle layers (up to 3): pick · on/off · adjust · remove,
   plus an Add that opens the particle picker. Wraps on a narrow screen so no
   control is pushed off the edge (fixes the off-screen toggle, V2 §5). */
function renderParticleLayers(wrap, theme, id, reapply) {
  const spec = theme.particles;
  const layers = (Array.isArray(spec) ? spec : spec ? [spec] : []).map(l => ({ overrides: {}, enabled: true, ...l }));
  const save = (next) => { setThemeOverride(id, 'particles', next.length ? next : null); reapply(); };
  const labelFor = (pid) => getParticlePreset(pid)?.name || store.get('themes', pid)?.name || pid;
  const clone = () => layers.map(l => ({ ...l }));

  layers.forEach((layer, i) => {
    const row = el(`<div class="row" style="gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center">
      <button class="btn p-pick grow" style="min-width:120px;justify-content:flex-start;padding:6px 10px"></button>
      <span class="p-switch"></span>
      <button class="btn-icon p-adj" title="Adjust">${icon('sliders', 15)}</button>
      <button class="btn-icon p-del" title="Remove">${icon('x', 14)}</button>
    </div>`);
    const pick = row.querySelector('.p-pick');
    pick.textContent = labelFor(layer.preset);
    pick.onclick = async () => {
      const { openParticlePicker } = await import('./particlepicker.js');
      openParticlePicker({ current: layer.preset, onPick: (pid) => { const n = clone(); n[i] = { ...n[i], preset: pid, overrides: {} }; save(n); } });
    };
    row.querySelector('.p-switch').appendChild(switchEl(layer.enabled !== false, (on) => { const n = clone(); n[i].enabled = on; save(n); }));
    row.querySelector('.p-adj').onclick = async () => {
      const { openParticleEditor } = await import('./particleeditor.js');
      openParticleEditor(null, (rec) => { const n = clone(); n[i] = { preset: rec.id, overrides: {}, enabled: true }; save(n); }, resolveFxDef(layer));
    };
    row.querySelector('.p-del').onclick = () => { const n = clone(); n.splice(i, 1); save(n); };
    wrap.appendChild(row);
  });

  if (layers.length < 3) {
    const add = el(`<button class="btn-soft-wide" style="margin-top:2px">${icon('plus', 14)} Add particle</button>`);
    add.onclick = async () => {
      const { openParticlePicker } = await import('./particlepicker.js');
      openParticlePicker({ current: '', onPick: (pid) => save([...layers, { preset: pid, overrides: {}, enabled: true }]) });
    };
    wrap.appendChild(add);
  }
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
        <span class="btn-icon t-edit" title="${t.custom ? 'Edit' : 'Customize'}">${icon('edit', 14)}</span>
        ${t.custom ? `<span class="btn-icon t-del" title="Delete">${icon('trash', 14)}</span>` : ''}
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

/* (The former per-theme EFFECTS panel was folded into the Effects section above
   — renderVisualEffectsSection / renderParticleLayers. resolveFxDef is kept as
   it's still used by the particle layer rows.) */

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
    saves.recordExport();
    toast('Save code copied', 'save');
  };

  const fileBtn = el(`<button class="btn">${icon('download', 15)} Download file</button>`);
  fileBtn.onclick = async () => {
    saves.downloadFile();
    const name = await promptText({ title: 'Name this backup', label: 'Name', placeholder: 'Before the trip' });
    saves.makeAutosave(name || 'Export', 'export');
    saves.recordExport();
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
        { label: 'Restore this backup', iconName: 'rotate-ccw', fn: () => openBackupRestore(item.payload, item.name) },
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

  // storage durability + last off-device backup status (docs/09)
  const status = el('<p class="soft" style="margin-top:10px;font-size:0.78rem"></p>');
  const lastExp = saves.lastExportAt();
  const backupLine = lastExp
    ? `Last off-device backup: ${Math.max(0, Math.round((Date.now() - lastExp) / 86400000))} days ago.`
    : 'No off-device backup yet — Download file keeps a copy you won’t lose.';
  navigator.storage?.persisted?.().then(p => {
    status.textContent = `${p ? 'Storage: protected ✓' : 'Storage: best-effort.'} ${backupLine}`;
  });
  status.textContent = backupLine; // shown immediately; persisted check refines it
  sec.appendChild(status);

  // ---- danger zone: full reset (V2 §10) — three gated steps, red styling ----
  const reset = el(`<button class="btn btn-danger" style="width:100%;margin-top:18px">${icon('trash', 15)} Reset all data</button>`);
  reset.onclick = resetAllDataFlow;
  sec.appendChild(reset);

  d.body.appendChild(sec);
}

/* Full reset (V2 §10): three deliberate steps so a mistap can never wipe data.
   Only completing all three — confirm, re-confirm, then type DELETE — erases
   everything and restarts the app fresh. */
async function resetAllDataFlow() {
  const step1 = await confirmDialog({
    title: 'Reset all data?',
    message: 'This will permanently delete all your modules, pages, widgets, objects, themes, and settings.',
    confirmText: 'Delete everything'
  });
  if (!step1) return;
  const step2 = await confirmDialog({
    title: 'Are you absolutely sure?',
    message: 'This cannot be undone. If you might want it back, download a backup first.',
    confirmText: 'Yes, delete everything'
  });
  if (!step2) return;
  if (!(await typeDeleteToConfirm())) return;
  await store.resetAll();
  location.reload();
}

/** Step 3: a typed confirmation. Resolves true only when the user types DELETE. */
function typeDeleteToConfirm() {
  return new Promise((resolve) => {
    let settled = false;
    const d = openDrawer({ title: 'Final step', iconName: 'trash', onClose: () => { if (!settled) { settled = true; resolve(false); } } });
    d.body.appendChild(el('<p class="soft" style="margin-bottom:6px">Type <strong>DELETE</strong> to confirm. There is no undo.</p>'));
    const inp = input('', 'DELETE');
    const btn = el(`<button class="btn btn-danger" style="width:100%;margin-top:12px" disabled>${icon('trash', 15)} Confirm reset</button>`);
    inp.addEventListener('input', () => { btn.disabled = inp.value !== 'DELETE'; });
    const confirm = () => { if (inp.value === 'DELETE') { settled = true; resolve(true); d.close(); } };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
    btn.onclick = confirm;
    d.body.append(field('Confirmation', inp), btn);
    setTimeout(() => inp.focus(), 150);
  });
}

/* ---------- about ---------- */

/* Manual update check — a persistent companion to the auto-update toast, so the
   user is never stranded on an old build waiting for a prompt that didn't show.
   Posts SKIP_WAITING to a waiting worker; app.js's controllerchange → reload. */
async function checkForUpdates(btn) {
  if (!('serviceWorker' in navigator)) { toast('Updates need a browser with service workers.', 'info'); return; }
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { toast('No update found — you’re on the latest version.', 'flower'); return; }
    await reg.update().catch(() => {});
    const waiting = reg.waiting || await new Promise((res) => {
      const inst = reg.installing;
      if (!inst) return res(null);
      inst.addEventListener('statechange', () => { if (reg.waiting) res(reg.waiting); });
      setTimeout(() => res(reg.waiting || null), 3000);
    });
    if (waiting) { toast('A new version is ready — updating…', 'flower'); waiting.postMessage('SKIP_WAITING'); }
    else toast('You’re on the latest version 🌸', 'flower');
  } catch (err) {
    console.error('[update check]', err);
    toast('Could not check for updates.', 'info');
  } finally {
    btn.disabled = false; btn.innerHTML = label;
  }
}

function renderAboutSection(d) {
  const sec = el(`<div class="dsec"><h3>About</h3>
    <p class="soft" style="font-size:0.86rem;margin-bottom:10px">The Blossom — your cozy, all-in-one space to grow. Everything lives on your device.</p>
    <button class="btn" data-act="tour" style="width:100%">${icon('flower', 15)} Replay the tour</button>
    <button class="btn" data-act="update" style="width:100%;margin-top:10px">${icon('refresh', 15)} Check for updates</button>
    <button class="btn" data-act="reset" style="width:100%;margin-top:10px">${icon('leaf', 15)} Reset app (keeps your data)</button>
    <p class="soft" style="font-size:0.78rem;margin-top:8px">Stuck on an old or broken version? Reset clears the app cache and reloads. Your saved data is never touched.</p></div>`);
  sec.querySelector('[data-act="tour"]').onclick = async () => {
    store.setMeta('onboarded', null);
    const { initOnboarding } = await import('./onboarding.js');
    d.close();
    initOnboarding(true);
  };
  sec.querySelector('[data-act="update"]').onclick = (e) => checkForUpdates(e.currentTarget);
  sec.querySelector('[data-act="reset"]').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Reset the app?',
      message: 'This clears the cached app files and reloads the latest version. Your saved data (modules, pages, codes) stays safe.',
      confirmText: 'Reset & reload'
    });
    if (ok) window.__blossom?.resetApp?.();
  };
  // Ko-fi support (V2 §1) — opt-in: only when a handle is configured
  const handle = kofiHandle();
  if (handle) {
    const support = el('<a class="btn" style="width:100%;margin-top:10px;text-decoration:none" target="_blank" rel="noopener">☕ Support on Ko-fi</a>');
    support.href = `https://ko-fi.com/${encodeURIComponent(handle)}`;
    sec.appendChild(support);
  }
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
  const preview = (type, payload) => renderImportPreview(d, type, payload, { pageId });
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
}

/* ---------- shared import preview (contents, save date, what you have now) ---------- */

const COUNT_ORDER = ['modules', 'pages', 'widgets', 'objects', 'themes'];
function fmtCounts(c) {
  return COUNT_ORDER.filter(k => c[k]).map(k => `${c[k]} ${k}`).join(' · ') || 'empty';
}
function liveCounts() {
  return {
    modules: store.all('modules').length,
    pages: store.all('pages').length,
    widgets: store.all('widgets').length,
    objects: store.all('objects').length,
    themes: store.all('themes').length
  };
}

/**
 * Render the import/restore preview into an open drawer: what the save holds,
 * when it was taken, and — for a whole-workspace import — what you have now, so
 * Replace can never overwrite your data unseen. Shared by paste-code import and
 * the autosave "Restore this backup" flow.
 * @param {{body:HTMLElement,setTitle:Function,close:Function}} d open drawer
 * @param {string} type @param {object} payload
 * @param {{pageId?:string, name?:string}} [opts]
 */
function renderImportPreview(d, type, payload, { pageId = null, name = null } = {}) {
  d.setTitle(type === 'ws' ? 'Restore preview' : `Import ${codes.typeLabel(type)}`);
  d.body.innerHTML = '';
  const counts = codes.describePayload(type, payload);
  const when = payload.exportedAt ? new Date(payload.exportedAt) : null;

  const panel = el('<div class="panel" style="padding:14px;margin-bottom:14px"></div>');
  const head = el(`<div class="row">${icon('gift', 18)}<strong style="margin-left:6px"></strong></div>`);
  head.querySelector('strong').textContent = name || payload.root?.name || codes.typeLabel(type);
  panel.appendChild(head);
  if (when) panel.appendChild(el(`<p class="soft" style="margin-top:6px;font-size:0.8rem">Saved ${when.toLocaleDateString()} · ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>`));
  panel.appendChild(el(`<p class="soft" style="margin-top:6px;font-size:0.85rem">Contains: ${fmtCounts(counts)}</p>`));
  if (type === 'ws') panel.appendChild(el(`<p class="soft" style="margin-top:4px;font-size:0.8rem">You have now: ${fmtCounts(liveCounts())}</p>`));
  d.body.appendChild(panel);

  if (type === 'ws') {
    const merge = el('<button class="btn" style="width:100%;margin-bottom:8px">Merge into my workspace</button>');
    merge.onclick = async () => { await saves.importWorkspace(payload, 'merge'); d.close(); toast('Imported — welcome home', 'flower'); };
    const replace = el('<button class="btn" style="width:100%;color:var(--warn)">Replace everything</button>');
    replace.onclick = async () => {
      if (await confirmDialog({ title: 'Replace your whole workspace?', message: 'Your current data is saved to a safety autosave first, then replaced by this backup.', confirmText: 'Replace' })) {
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
      if (type === 'pg') target.moduleId = router.current().moduleId;
      const res = codes.importNode(type, payload, target);
      if (res.droppedLinks) toast(`${res.droppedLinks} link${res.droppedLinks === 1 ? '' : 's'} pointed outside this code and ${res.droppedLinks === 1 ? 'was' : 'were'} removed.`, 'info');
      else if (type === 'pg') {
        // P-4: confirm the page landed in the current module, and jump to it.
        const mod = store.get('modules', target.moduleId);
        toast(`Page added to ${mod?.name || 'module'}`, 'flower');
        if (mod && res.rootId) router.go(mod.id, res.rootId);
      } else toast('Imported', 'flower');
      events.emit('module:changed', {});
      events.emit('page:changed', {});
      d.close();
    };
    d.body.appendChild(ok);
  }
}

/** Open a restore preview for an existing autosave/backup workspace payload. */
export function openBackupRestore(payload, name) {
  const d = openDrawer({ title: 'Restore preview', iconName: 'rotate-ccw' });
  renderImportPreview(d, 'ws', payload, { name });
}
