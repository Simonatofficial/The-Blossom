/* Module-group manager (docs/13 §3b). Create/rename/icon/delete custom groups,
   reorder groups, and reorder/add/remove their member modules. Built-in All &
   Favorites aren't listed here (All is automatic; Favorites is curated by the
   star + pin/hide on module rows). Opens as a Panel (CR-11). */

import { store } from '../core/store.js';
import { icon, iconOrEmoji } from './icons.js';
import { el, openPanel, popMenu, promptText, confirmDialog, toast, emptyState } from './components.js';
import * as G from '../core/groups.js';

export function openGroupManager() {
  const d = openPanel({ title: 'Module groups', iconName: 'layers' });
  const list = el('<div class="nav-list"></div>');
  d.body.appendChild(list);

  const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; };

  const render = () => {
    list.innerHTML = '';
    const groups = G.listGroups().filter(g => !g.builtin);
    if (!groups.length) {
      list.appendChild(emptyState('layers', 'No custom groups yet. Create one below — All and Favorites are always there.'));
    }
    groups.forEach((g, gi) => {
      const card = el('<div class="panel" style="padding:10px;margin-bottom:10px"></div>');
      const head = el(`<div class="row-between" style="margin-bottom:6px">
        <button class="row gm-rename" style="gap:6px;min-width:0;background:none;border:none;color:var(--text);cursor:pointer">${icon(g.icon, 16)}<strong class="gm-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></strong></button>
        <span class="row" style="gap:2px">
          <button class="btn-icon gm-up" title="Move group up">${icon('chevron-up', 15)}</button>
          <button class="btn-icon gm-down" title="Move group down">${icon('chevron-down', 15)}</button>
          <button class="btn-icon gm-menu" title="More">${icon('more', 15)}</button>
        </span></div>`);
      head.querySelector('.gm-name').textContent = g.name;
      head.querySelector('.gm-rename').onclick = async () => { const n = await promptText({ title: 'Rename group', value: g.name }); if (n) { G.renameGroup(g.id, n); render(); } };
      const gUp = head.querySelector('.gm-up'), gDown = head.querySelector('.gm-down');
      gUp.disabled = gi === 0; gDown.disabled = gi === groups.length - 1;
      gUp.onclick = () => { G.reorderGroups(swap(groups.map(x => x.id), gi, gi - 1)); render(); };
      gDown.onclick = () => { G.reorderGroups(swap(groups.map(x => x.id), gi, gi + 1)); render(); };
      head.querySelector('.gm-menu').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Change icon', iconName: 'star', fn: async () => { const { openIconPicker } = await import('./shell.js'); openIconPicker(g.icon, (v) => { G.setGroupIcon(g.id, v); render(); }); } },
        { label: 'Delete group', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${g.name}”?`, message: 'The modules stay — only the group is removed.' })) { G.deleteGroup(g.id); render(); } } }
      ]);
      card.appendChild(head);

      const members = G.groupModules(g.id);
      if (!members.length) card.appendChild(el('<p class="soft" style="font-size:0.8rem;margin:2px 0 6px">No modules yet — add some below.</p>'));
      members.forEach((m, mi) => {
        const r = el(`<div class="row-between" style="padding:3px 0">
          <span class="row" style="gap:6px;min-width:0">${iconOrEmoji(m.icon, 16)}<span class="gm-mn" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span></span>
          <span class="row" style="gap:2px">
            <button class="btn-icon mm-up" title="Up">${icon('chevron-up', 14)}</button>
            <button class="btn-icon mm-down" title="Down">${icon('chevron-down', 14)}</button>
            <button class="btn-icon mm-rm" title="Remove from group">${icon('x', 14)}</button>
          </span></div>`);
        r.querySelector('.gm-mn').textContent = m.name;
        const mUp = r.querySelector('.mm-up'), mDown = r.querySelector('.mm-down');
        mUp.disabled = mi === 0; mDown.disabled = mi === members.length - 1;
        mUp.onclick = () => { G.reorderGroupModules(g.id, swap(members.map(x => x.id), mi, mi - 1)); render(); };
        mDown.onclick = () => { G.reorderGroupModules(g.id, swap(members.map(x => x.id), mi, mi + 1)); render(); };
        r.querySelector('.mm-rm').onclick = () => { G.toggleModuleInGroup(g.id, m.id); render(); };
        card.appendChild(r);
      });

      const add = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('plus', 14)} Add module</button>`);
      add.onclick = (e) => {
        const avail = store.all('modules').filter(m => !G.inGroup(g.id, m.id));
        if (!avail.length) { toast('Every module is already in this group.', 'info'); return; }
        popMenu(e.currentTarget, avail.map(m => ({ label: m.name, iconName: 'circle', fn: () => { G.toggleModuleInGroup(g.id, m.id); render(); } })));
      };
      card.appendChild(add);
      list.appendChild(card);
    });
  };

  const newBtn = el(`<button class="btn btn-primary" style="width:100%;margin-top:6px">${icon('plus', 15)} New group</button>`);
  newBtn.onclick = async () => { const n = await promptText({ title: 'New group', label: 'Group name', placeholder: 'School', confirmText: 'Create' }); if (n) { G.createGroup(n); render(); } };
  d.body.appendChild(newBtn);
  render();
}
