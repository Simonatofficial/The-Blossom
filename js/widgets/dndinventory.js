/* InventoryLedger widget (docs/08 §4): items with qty/weight/value, equipped
   and attuned toggles (3 attunement pips), an auto carrying-capacity bar
   (STR × 15), and the coin purse — cp/sp/ep/gp/pp, deliberately separate
   from Blossom coins. Items live under the anchor CharacterSheet. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, popMenu, openPanel, input } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { getCharacter, saveCharacter } from './dnd-shared.js';

const COINS = [['pp', 'Platinum'], ['gp', 'Gold'], ['ep', 'Electrum'], ['sp', 'Silver'], ['cp', 'Copper']];

registry.register({
  type: 'dndinventory',
  name: 'Inventory Ledger',
  icon: 'bag',
  description: 'Gear, coin, weight, and what’s attuned',
  keywords: ['dnd', 'd&d', 'inventory', 'items', 'gold', 'rpg'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget) {
    host.innerHTML = '';
    const { owner, c } = getCharacter(widget);
    const items = objectsOf(owner.id, 'item');
    const weight = items.reduce((n, i) => n + (i.data.weight || 0) * (i.data.qty || 1), 0);
    host.appendChild(el(`<div><div style="font-size:1.4rem;font-weight:650">${c.currency.gp} gp</div>
      <div class="soft" style="font-size:0.8rem">${items.length} item${items.length === 1 ? '' : 's'} · ${Math.round(weight * 10) / 10} lb carried</div></div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const { owner, obj, c } = getCharacter(widget);
    const items = () => objectsOf(owner.id, 'item');
    const saveChar = () => saveCharacter(obj);

    /* ---- coin purse ---- */
    const purse = el('<div class="dnd-box dnd-purse" style="margin-bottom:10px"></div>');
    for (const [key, label] of COINS) {
      const cell = el(`<div class="dnd-coin" title="${label}"><input class="input" type="number" min="0"><span>${key}</span></div>`);
      const i = cell.querySelector('input');
      i.value = c.currency[key] || 0;
      i.onchange = () => { c.currency[key] = Math.max(0, Number(i.value) || 0); saveChar(); };
      purse.appendChild(cell);
    }
    host.appendChild(purse);

    /* ---- carry weight + attunement ---- */
    const status = el(`<div style="margin-bottom:10px">
      <div class="row" style="justify-content:space-between;font-size:0.8rem"><span class="soft cap-label"></span><span class="soft att-label">Attuned <span class="dnd-pips att-pips" style="display:inline-flex"></span></span></div>
      <div class="hp-bar cap-bar"><i></i></div></div>`);
    const drawStatus = () => {
      const cap = (c.abilities.str || 10) * 15;
      const weight = items().reduce((n, i) => n + (i.data.weight || 0) * (i.data.qty || 1), 0);
      status.querySelector('.cap-label').textContent = `${Math.round(weight * 10) / 10} / ${cap} lb`;
      const bar = status.querySelector('.cap-bar i');
      bar.style.width = `${Math.min(100, (weight / cap) * 100)}%`;
      status.querySelector('.cap-bar').classList.toggle('low', weight > cap);
      const attuned = items().filter(i => i.data.attuned).length;
      const pips = status.querySelector('.att-pips');
      pips.innerHTML = '';
      for (let i = 0; i < 3; i++) pips.appendChild(el(`<span class="pip${i < attuned ? ' on' : ''}" style="pointer-events:none"></span>`));
    };
    host.appendChild(status);

    /* ---- items ---- */
    const bar = el(`<div class="row" style="gap:6px;margin-bottom:8px"><input class="input grow" placeholder="Search the pack…"><button class="btn btn-primary" style="font-size:0.8rem;padding:4px 11px">${icon('plus', 13)} Item</button></div>`);
    const [search, addB] = bar.children;
    host.appendChild(bar);
    const list = el('<div></div>');
    host.appendChild(list);

    const drawList = () => {
      drawStatus();
      list.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      const shown = items()
        .filter(i => !q || i.data.name.toLowerCase().includes(q))
        .sort((a, b) => (b.data.equipped - a.data.equipped) || a.data.name.localeCompare(b.data.name));
      if (!shown.length) list.appendChild(el('<div class="empty-state">' + icon('bag', 26) + '<p>The pack is empty. Loot awaits.</p></div>'));
      for (const it of shown) {
        const row = el(`<div class="list-item" style="cursor:default">
          <button class="btn-icon it-eq" title="Equipped">${icon('shield', 14)}</button>
          <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
          <span class="chip it-qty" title="Quantity"></span>
          <button class="btn-icon" title="More">${icon('more', 13)}</button></div>`);
        row.querySelector('.li-title').textContent = it.data.name;
        row.querySelector('.li-sub').textContent = [
          it.data.weight ? `${it.data.weight} lb` : null,
          it.data.value ? `${it.data.value} gp` : null,
          it.data.attuned ? 'attuned' : null
        ].filter(Boolean).join(' · ');
        const eq = row.querySelector('.it-eq');
        eq.style.color = it.data.equipped ? 'var(--accent)' : 'var(--text-soft)';
        eq.onclick = () => { it.data.equipped = !it.data.equipped; saveObject(it); drawList(); };
        const qty = row.querySelector('.it-qty');
        qty.textContent = `×${it.data.qty || 1}`;
        qty.onclick = (e) => popMenu(e.currentTarget, [
          { label: 'One more', iconName: 'plus', fn: () => { it.data.qty = (it.data.qty || 1) + 1; saveObject(it); drawList(); } },
          { label: 'One less', iconName: 'minus', fn: () => {
            it.data.qty = (it.data.qty || 1) - 1;
            if (it.data.qty <= 0) store.del('objects', it.id);
            else saveObject(it);
            drawList();
          } }
        ]);
        row.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
          { label: it.data.attuned ? 'End attunement' : 'Attune', iconName: 'sparkles', fn: () => {
            if (!it.data.attuned && items().filter(x => x.data.attuned).length >= 3) return toast('All three attunement slots are in use.', 'sparkles');
            it.data.attuned = !it.data.attuned;
            saveObject(it);
            drawList();
          } },
          { label: 'Edit', iconName: 'edit', fn: () => editItem(it) },
          { label: 'Remove', iconName: 'trash', danger: true, fn: () => { store.del('objects', it.id); drawList(); } }
        ]);
        list.appendChild(row);
      }
    };
    search.oninput = drawList;

    const editItem = (it = null) => {
      const d = openPanel({ title: it ? 'Edit item' : 'New item', iconName: 'bag' });
      const name = input(it?.data.name || '', 'Rope, 50 ft');
      const nums = el('<div class="row" style="gap:6px;margin-top:8px"></div>');
      const numIn = (ph, val) => {
        const i = el(`<input class="input" type="number" min="0" step="any" placeholder="${ph}" style="flex:1">`);
        if (val) i.value = val;
        nums.appendChild(i);
        return i;
      };
      const qty = numIn('Qty', it?.data.qty || 1);
      const weight = numIn('lb each', it?.data.weight);
      const value = numIn('gp', it?.data.value);
      const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Save</button>');
      ok.onclick = () => {
        if (!name.value.trim()) return;
        const data = {
          name: name.value.trim(), qty: Math.max(1, Number(qty.value) || 1),
          weight: Number(weight.value) || 0, value: Number(value.value) || 0,
          equipped: it?.data.equipped || false, attuned: it?.data.attuned || false
        };
        if (it) { it.data = data; saveObject(it); }
        else createObject(owner.id, 'item', data);
        d.close();
        drawList();
      };
      d.body.append(name, nums, ok);
      setTimeout(() => name.focus(), 150);
    };
    addB.onclick = () => editItem();
    drawList();
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Carrying capacity is Strength × 15. The purse is the character’s coin — entirely separate from your Blossom coins.</p>'));
  }
});
