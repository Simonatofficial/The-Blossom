/* LootTable widget (docs/08 §3): weighted random treasure/encounter tables with
   a big "roll" button. Each table is one object; rolling draws weighted entries,
   toasts the haul, and keeps a short per-table history. Encounters reference a
   table to roll its treasure inline. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, popMenu } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { siblingWidgets } from './wb-shared.js';

const tables = (w) => objectsOf(w.id, 'loot');

const FRESH = () => ({ name: 'New table', draws: 1, entries: [{ weight: 1, text: 'Nothing of note' }], history: [] });

/** Draw `draws` weighted entries from a table's data. @returns {string[]} */
export function rollLootData(d) {
  const pool = (d.entries || []).filter(e => (e.weight || 0) > 0 && e.text);
  if (!pool.length) return [];
  const total = pool.reduce((s, e) => s + e.weight, 0);
  const out = [];
  for (let i = 0; i < Math.max(1, d.draws || 1); i++) {
    let r = Math.random() * total;
    for (const e of pool) { r -= e.weight; if (r <= 0) { out.push(e.text); break; } }
  }
  return out;
}

/** All loot tables across the module (for Encounter treasure pickers). */
export function allLootTables(widget) {
  const out = [];
  for (const w of siblingWidgets(widget, ['loottable'])) {
    for (const o of objectsOf(w.id, 'loot')) out.push({ id: o.id, name: o.data.name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Roll a table by id (used by Encounter); toasts + records history. */
export function rollLootById(id) {
  const o = id && store.get('objects', id);
  if (!o || o.kind !== 'loot') return [];
  const haul = rollLootData(o.data);
  if (haul.length) {
    o.data.history = [{ at: Date.now(), haul }, ...(o.data.history || [])].slice(0, 8);
    saveObject(o);
    toast(`${o.data.name}: ${haul.join(', ')}`, 'coins');
  }
  return haul;
}

registry.register({
  type: 'loottable',
  name: 'Loot Tables',
  icon: 'coins',
  description: 'Weighted random tables — roll for treasure, rumors, or wandering monsters',
  keywords: ['loot', 'treasure', 'random', 'table', 'roll', 'reward', 'dm'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget) {
    host.innerHTML = '';
    const list = tables(widget);
    if (!list.length) { host.appendChild(el('<span class="soft" style="font-size:0.84rem">No tables yet.</span>')); return; }
    const wrap = el('<div style="display:flex;flex-direction:column;gap:6px"></div>');
    for (const o of list.slice(0, 3)) {
      const row = el(`<div class="row" style="gap:8px"><span class="grow" style="font-size:0.9rem;font-weight:600"></span><button class="chip accent">${icon('dice', 12)} Roll</button></div>`);
      row.querySelector('span').textContent = o.data.name;
      row.querySelector('button').onclick = (e) => { e.stopPropagation(); rollLootById(o.id); };
      wrap.appendChild(row);
    }
    host.appendChild(wrap);
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);
    const head = el(`<div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Tables</h3><button class="btn btn-primary">${icon('plus', 15)} Table</button></div>`);
    head.querySelector('button').onclick = () => { createObject(widget.id, 'loot', FRESH()); render(); };
    wrap.appendChild(head);
    const list = el('<div></div>');
    wrap.appendChild(list);

    const render = () => {
      list.innerHTML = '';
      const all = tables(widget);
      if (!all.length) { list.appendChild(el('<div class="empty-state">' + icon('coins', 28) + '<p>No tables yet. What might the dragon be hoarding?</p></div>')); return; }
      for (const o of all) {
        const d = o.data;
        const save = () => saveObject(o);
        const card = el(`<details class="wb-sec" style="margin-bottom:8px"><summary><span class="loot-sum"></span></summary><div class="wb-sec-body"></div></details>`);
        const sum = card.querySelector('.loot-sum');
        const drawSum = () => sum.textContent = `${d.name} · ${(d.entries || []).length} entries`;
        drawSum();
        const body = card.querySelector('.wb-sec-body');

        const top = el(`<div class="row" style="gap:8px;margin-bottom:8px"><input class="input grow" style="font-weight:600"><label class="soft" style="font-size:0.8rem">draws <input class="input" type="number" style="width:50px;padding:3px 6px"></label><button class="btn-icon" title="More">${icon('more', 15)}</button></div>`);
        const [nameIn, drawsWrap, more] = top.children;
        nameIn.value = d.name;
        nameIn.onchange = () => { d.name = nameIn.value.trim() || 'Table'; save(); drawSum(); };
        const drawsIn = drawsWrap.querySelector('input');
        drawsIn.value = d.draws || 1;
        drawsIn.onchange = () => { d.draws = Math.max(1, Number(drawsIn.value) || 1); save(); };
        more.onclick = (e) => popMenu(e.currentTarget, [
          { label: 'Duplicate', iconName: 'copy', fn: () => { const n = createObject(widget.id, 'loot', structuredClone(d)); n.data.name = d.name + ' copy'; saveObject(n); render(); } },
          { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${d.name}”?` })) { store.trash('objects', o.id); render(); } } }
        ]);
        body.appendChild(top);

        const rows = el('<div></div>');
        const drawRows = () => {
          rows.innerHTML = '';
          for (const e of d.entries) {
            const r = el(`<div class="row" style="gap:6px;margin-bottom:4px"><input class="input" type="number" title="weight" style="width:58px"><input class="input grow" placeholder="What's found?"><button class="btn-icon" title="Remove">${icon('x', 12)}</button></div>`);
            const [wIn, tIn, rm] = r.children;
            wIn.value = e.weight; tIn.value = e.text;
            wIn.onchange = () => { e.weight = Math.max(0, Number(wIn.value) || 0); save(); };
            tIn.onchange = () => { e.text = tIn.value; save(); };
            rm.onclick = () => { d.entries.splice(d.entries.indexOf(e), 1); save(); drawRows(); drawSum(); };
            rows.appendChild(r);
          }
        };
        drawRows();
        body.appendChild(rows);

        const addRow = el(`<button class="btn" style="width:100%;margin-bottom:8px">${icon('plus', 14)} Add entry</button>`);
        addRow.onclick = () => { d.entries.push({ weight: 1, text: '' }); save(); drawRows(); drawSum(); };
        body.appendChild(addRow);

        const rollBar = el(`<div class="row" style="gap:8px;align-items:center"><button class="btn btn-primary">${icon('dice', 15)} Roll table</button><span class="soft loot-last" style="font-size:0.84rem"></span></div>`);
        const last = rollBar.querySelector('.loot-last');
        if ((d.history || [])[0]) last.textContent = '→ ' + d.history[0].haul.join(', ');
        rollBar.querySelector('button').onclick = () => {
          const haul = rollLootData(d);
          if (!haul.length) return toast('Add some entries with weight first.', 'coins');
          d.history = [{ at: Date.now(), haul }, ...(d.history || [])].slice(0, 8);
          save();
          last.textContent = '→ ' + haul.join(', ');
          toast(`${d.name}: ${haul.join(', ')}`, 'coins');
        };
        body.appendChild(rollBar);
        list.appendChild(card);
      }
    };
    render();
  }
});
