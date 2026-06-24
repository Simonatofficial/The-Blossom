/* Hub manager (docs/17 §5) — the evolution of the v94 group manager. Create / rename /
   icon / delete custom hubs, reorder them and their member modules, AND wire hub-to-hub
   links (a Hub connects to other Hubs). Built-in All & Favorites aren't listed (All is
   automatic; Favorites is curated by the star + pin/hide on module rows). Opens as a Panel. */

import { store } from '../core/store.js';
import { icon, iconOrEmoji } from './icons.js';
import { el, openPanel, popMenu, promptText, confirmDialog, toast, emptyState } from './components.js';
import * as H from '../core/hubs.js';

export function openHubManager() {
  const d = openPanel({ title: 'Hubs', iconName: 'layers' });
  const list = el('<div class="nav-list"></div>');
  d.body.appendChild(list);

  const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; };

  const render = () => {
    list.innerHTML = '';
    const hubs = H.listHubs().filter(g => !g.builtin);
    if (!hubs.length) {
      list.appendChild(emptyState('layers', 'No custom hubs yet. Create one below — All and Favorites are always there.'));
    }
    hubs.forEach((g, gi) => {
      const card = el('<div class="panel" style="padding:10px;margin-bottom:10px"></div>');
      const head = el(`<div class="row-between" style="margin-bottom:6px">
        <button class="row gm-rename" style="gap:6px;min-width:0;background:none;border:none;color:var(--text);cursor:pointer">${icon(g.icon, 16)}<strong class="gm-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></strong></button>
        <span class="row" style="gap:2px">
          <button class="btn-icon gm-up" title="Move hub up">${icon('chevron-up', 15)}</button>
          <button class="btn-icon gm-down" title="Move hub down">${icon('chevron-down', 15)}</button>
          <button class="btn-icon gm-menu" title="More">${icon('more', 15)}</button>
        </span></div>`);
      head.querySelector('.gm-name').textContent = g.name;
      head.querySelector('.gm-rename').onclick = async () => { const n = await promptText({ title: 'Rename hub', value: g.name }); if (n) { H.renameHub(g.id, n); render(); } };
      const gUp = head.querySelector('.gm-up'), gDown = head.querySelector('.gm-down');
      gUp.disabled = gi === 0; gDown.disabled = gi === hubs.length - 1;
      gUp.onclick = () => { H.reorderHubs(swap(hubs.map(x => x.id), gi, gi - 1)); render(); };
      gDown.onclick = () => { H.reorderHubs(swap(hubs.map(x => x.id), gi, gi + 1)); render(); };
      head.querySelector('.gm-menu').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Change icon', iconName: 'star', fn: async () => { const { openIconPicker } = await import('./shell.js'); openIconPicker(g.icon, (v) => { H.setHubIcon(g.id, v); render(); }); } },
        { label: 'Delete hub', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${g.name}”?`, message: 'The modules stay — only the hub (and its links) are removed.' })) { H.deleteHub(g.id); render(); } } }
      ]);
      card.appendChild(head);

      // ---- member modules ----
      const members = H.hubModules(g.id);
      if (!members.length) card.appendChild(el('<p class="soft" style="font-size:0.8rem;margin:2px 0 6px">No modules yet — add some below.</p>'));
      members.forEach((m, mi) => {
        const r = el(`<div class="row-between" style="padding:3px 0">
          <span class="row" style="gap:6px;min-width:0">${iconOrEmoji(m.icon, 16)}<span class="gm-mn" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span></span>
          <span class="row" style="gap:2px">
            <button class="btn-icon mm-up" title="Up">${icon('chevron-up', 14)}</button>
            <button class="btn-icon mm-down" title="Down">${icon('chevron-down', 14)}</button>
            <button class="btn-icon mm-rm" title="Remove from hub">${icon('x', 14)}</button>
          </span></div>`);
        r.querySelector('.gm-mn').textContent = m.name;
        const mUp = r.querySelector('.mm-up'), mDown = r.querySelector('.mm-down');
        mUp.disabled = mi === 0; mDown.disabled = mi === members.length - 1;
        mUp.onclick = () => { H.reorderHubModules(g.id, swap(members.map(x => x.id), mi, mi - 1)); render(); };
        mDown.onclick = () => { H.reorderHubModules(g.id, swap(members.map(x => x.id), mi, mi + 1)); render(); };
        r.querySelector('.mm-rm').onclick = () => { H.toggleModuleInHub(g.id, m.id); render(); };
        card.appendChild(r);
      });

      const add = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('plus', 14)} Add module</button>`);
      add.onclick = (e) => {
        const avail = store.all('modules').filter(m => !H.inHub(g.id, m.id));
        if (!avail.length) { toast('Every module is already in this hub.', 'info'); return; }
        popMenu(e.currentTarget, avail.map(m => ({ label: m.name, iconName: 'circle', fn: () => { H.toggleModuleInHub(g.id, m.id); render(); } })));
      };
      card.appendChild(add);

      // ---- hub-to-hub links (docs/17 §5.1) ----
      const linked = H.linkedHubs(g.id);
      const linkWrap = el('<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center"></div>');
      linkWrap.appendChild(el(`<span class="soft" style="font-size:0.74rem;display:inline-flex;align-items:center;gap:4px">${icon('link', 12)} Links</span>`));
      for (const { hub } of linked) {
        const chip = el(`<span class="chip" style="display:inline-flex;align-items:center;gap:4px">${icon(hub.icon || 'layers', 11)}<span class="hl-name"></span><button class="btn-icon hl-rm" title="Unlink" style="width:16px;height:16px">${icon('x', 11)}</button></span>`);
        chip.querySelector('.hl-name').textContent = hub.name;
        chip.querySelector('.hl-rm').onclick = () => { H.unlinkHubs(g.id, hub.id); render(); };
        linkWrap.appendChild(chip);
      }
      const linkBtn = el(`<button class="btn-icon" title="Link to another hub" style="width:22px;height:22px">${icon('plus', 13)}</button>`);
      linkBtn.onclick = (e) => {
        const linkedIds = new Set(linked.map(x => x.hub.id));
        const avail = hubs.filter(x => x.id !== g.id && !linkedIds.has(x.id));
        if (!avail.length) { toast('No other hubs to link to yet.', 'info'); return; }
        popMenu(e.currentTarget, avail.map(x => ({ label: x.name, iconName: x.icon || 'layers', fn: () => { H.linkHubs(g.id, x.id); render(); } })));
      };
      linkWrap.appendChild(linkBtn);
      card.appendChild(linkWrap);

      list.appendChild(card);
    });
  };

  const newBtn = el(`<button class="btn btn-primary" style="width:100%;margin-top:6px">${icon('plus', 15)} New hub</button>`);
  newBtn.onclick = async () => { const n = await promptText({ title: 'New hub', label: 'Hub name', placeholder: 'Physical', confirmText: 'Create' }); if (n) { H.createHub(n); render(); } };
  d.body.appendChild(newBtn);
  render();
}
