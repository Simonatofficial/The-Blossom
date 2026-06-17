/* StatBlock widget (docs/08 §3): a bestiary of 5e-style stat blocks shared by
   the DM module's NPCs and Encounters. Each block is one object; full mode has
   abilities/AC/HP/CR/traits/actions with tap-to-roll, and a system-agnostic
   freeform mode for non-5e games. Encounters reference blocks by id through the
   module-scoped sibling lookup, so one bestiary feeds every fight. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, popMenu, openDrawer } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { ABILITIES, mod, fmtMod, rollD20, rollFormula } from './dnd-shared.js';
import { siblingWidgets } from './wb-shared.js';
import { CONDITIONS, SKILLS } from '../presets/tabletop/srd5e.js';
import { openCompendiumPicker } from './tabletop-compendium.js';

const blocks = (w) => objectsOf(w.id, 'statblock');

/** Split an SRD trait/action line ("Pack Tactics: advantage…") into name+text. */
function splitLine(s) {
  const i = String(s).indexOf(': ');
  return i > 0 ? { name: s.slice(0, i), text: s.slice(i + 2) } : { name: '', text: String(s) };
}

/** Map a compendium monster entry to a fresh statblock object's data. */
function monsterToBlock(m) {
  return {
    name: m.name, meta: `${m.size} ${m.type}, ${m.alignment}`,
    ac: Number(m.ac) || 10, hp: Number(m.hp) || 1, hpFormula: m.hd || '',
    speed: m.speed || '30 ft', cr: m.cr || '?',
    abilities: { str: m.str, dex: m.dex, con: m.con, int: m.int, wis: m.wis, cha: m.cha },
    traits: [
      ...(m.skills ? [{ name: 'Skills', text: m.skills }] : []),
      ...(m.senses ? [{ name: 'Senses', text: m.senses }] : []),
      ...(m.languages ? [{ name: 'Languages', text: m.languages }] : []),
      { name: 'Challenge', text: `${m.cr} (${m.xp} XP)` },
      ...(m.traits || []).map(splitLine)
    ],
    actions: (m.actions || []).map(splitLine),
    notes: '', freeform: null, source: m.source || 'SRD 5.1'
  };
}

/** SRD rules reference (V2 §13): system-accurate conditions + skills, offline. */
function openRulesReference() {
  const d = openDrawer({ title: 'Rules reference (5e SRD)', iconName: 'shield' });
  d.body.appendChild(el('<h3 class="soft" style="font-size:0.76rem;margin:2px 0 8px">CONDITIONS</h3>'));
  for (const c of CONDITIONS) {
    const det = el('<details class="el-card" style="margin-bottom:6px"><summary><strong></strong></summary><p class="soft" style="font-size:0.85rem;margin:6px 0 0"></p></details>');
    det.querySelector('strong').textContent = c.name;
    det.querySelector('p').textContent = c.effect;
    d.body.appendChild(det);
  }
  d.body.appendChild(el('<h3 class="soft" style="font-size:0.76rem;margin:14px 0 8px">SKILLS → ABILITY</h3>'));
  const grid = el('<div class="row" style="flex-wrap:wrap;gap:5px"></div>');
  for (const s of SKILLS) grid.appendChild(el(`<span class="chip">${s.name} · ${s.ability.toUpperCase()}</span>`));
  d.body.appendChild(grid);
}

const FRESH = () => ({
  name: 'New creature', meta: 'Medium humanoid', ac: 12, hp: 11, hpFormula: '2d8+2',
  speed: '30 ft.', cr: '1/4',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  traits: [], actions: [], notes: '', freeform: null
});

/** Every stat block across the module's bestiaries (for Encounter pickers). */
export function allStatBlocks(widget) {
  const out = [];
  for (const w of siblingWidgets(widget, ['statblock'])) {
    for (const o of objectsOf(w.id, 'statblock')) out.push({ id: o.id, name: o.data.name, cr: o.data.cr, data: o.data });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a block id to its object data (may be gone). */
export function statBlockById(id) {
  const o = id && store.get('objects', id);
  return o && o.kind === 'statblock' ? o.data : null;
}

registry.register({
  type: 'statblock',
  name: 'Stat Blocks',
  icon: 'shield',
  description: 'A bestiary of creatures — abilities, AC/HP, traits, tap-to-roll actions',
  keywords: ['dnd', 'monster', 'creature', 'bestiary', 'npc', 'statblock', '5e', 'dm'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  outputs: (widget) => [{
    key: 'creatures', name: 'Creature count', dayKeyed: false,
    get: () => blocks(widget).length
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const list = blocks(widget);
    if (!list.length) { host.appendChild(el('<span class="soft" style="font-size:0.84rem">No creatures yet.</span>')); return; }
    const wrap = el('<div class="row" style="flex-wrap:wrap;gap:5px"></div>');
    for (const o of list.slice(0, 6)) wrap.appendChild(el(`<span class="chip">${o.data.name} · CR ${o.data.cr || '?'}</span>`));
    if (list.length > 6) wrap.appendChild(el(`<span class="soft" style="font-size:0.8rem;align-self:center">+${list.length - 6}</span>`));
    host.appendChild(wrap);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);

    const showGrid = () => {
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="gap:8px;margin-bottom:12px"><input class="input grow" placeholder="Find a creature…"><button class="btn-icon" title="Rules reference">${icon('book-open', 16)}</button><button class="btn btn-srd" title="Add from SRD">${icon('book', 14)} SRD</button><button class="btn btn-primary">${icon('plus', 15)} Creature</button></div>`);
      const search = head.querySelector('input'), add = head.querySelector('.btn-primary');
      head.querySelector('[title="Rules reference"]').onclick = openRulesReference;
      head.querySelector('.btn-srd').onclick = () => openCompendiumPicker({
        title: 'Add a monster from the SRD', category: 'monsters',
        onPick: (m) => { const o = createObject(widget.id, 'statblock', monsterToBlock(m)); toast(`${m.name} added to the bestiary.`, 'shield'); showBlock(o.id); }
      });
      add.onclick = () => { const o = createObject(widget.id, 'statblock', FRESH()); showBlock(o.id, true); };
      wrap.appendChild(head);
      const grid = el('<div class="dm-blocks"></div>');
      wrap.appendChild(grid);
      const render = () => {
        grid.innerHTML = '';
        const q = search.value.trim().toLowerCase();
        const list = blocks(widget).filter(o => !q || o.data.name.toLowerCase().includes(q)).sort((a, b) => a.data.name.localeCompare(b.data.name));
        if (!list.length) grid.appendChild(el('<div class="empty-state" style="grid-column:1/-1">' + icon('shield', 28) + '<p>An empty bestiary. Summon your first creature.</p></div>'));
        for (const o of list) {
          const card = el(`<button class="dm-block-card"><b></b><span class="soft"></span><span class="chip" style="align-self:flex-start;margin-top:4px">CR ${o.data.cr || '?'}</span></button>`);
          card.querySelector('b').textContent = o.data.name;
          card.querySelector('.soft').textContent = o.data.meta || '';
          card.onclick = () => showBlock(o.id);
          grid.appendChild(card);
        }
      };
      search.oninput = render;
      render();
    };

    const showBlock = (id, fresh = false) => {
      const o = store.get('objects', id);
      if (!o) return showGrid();
      const d = o.data;
      const save = () => saveObject(o);
      wrap.innerHTML = '';

      const head = el(`<div class="row" style="gap:8px;margin-bottom:8px">
        <button class="btn-icon" title="All creatures">${icon('arrow-left', 17)}</button>
        <input class="input grow" style="font-weight:650">
        <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
      head.querySelector('[title="All creatures"]').onclick = showGrid;
      const nameIn = head.querySelector('input');
      nameIn.value = d.name;
      nameIn.onchange = () => { d.name = nameIn.value.trim() || 'Unnamed'; save(); };
      head.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: d.freeform === null ? 'Switch to freeform' : 'Switch to 5e block', iconName: 'repeat', fn: () => { d.freeform = d.freeform === null ? '' : null; save(); showBlock(id); } },
        { label: 'Duplicate', iconName: 'copy', fn: () => { const n = createObject(widget.id, 'statblock', structuredClone(d)); n.data.name = d.name + ' copy'; saveObject(n); showBlock(n.id); } },
        { label: 'Delete', iconName: 'trash', danger: true, fn: async () => {
          if (await confirmDialog({ title: `Delete “${d.name}”?`, message: 'It rests in the trash for 30 days.' })) { store.trash('objects', o.id); toast('Banished', 'leaf'); showGrid(); }
        } }
      ]);
      wrap.appendChild(head);

      const metaIn = el('<input class="input" placeholder="Medium dragon, chaotic evil" style="margin-bottom:8px;font-size:0.84rem">');
      metaIn.value = d.meta || '';
      metaIn.onchange = () => { d.meta = metaIn.value; save(); };
      wrap.appendChild(metaIn);

      if (d.freeform !== null) {
        const ff = el('<textarea class="input" rows="10" placeholder="Paste or write any stat block — system-agnostic."></textarea>');
        ff.value = d.freeform;
        ff.onchange = () => { d.freeform = ff.value; save(); };
        wrap.appendChild(ff);
        if (fresh) setTimeout(() => nameIn.select(), 100);
        return;
      }

      // core stats: AC / HP / speed / CR
      const stats = el(`<div class="dm-statrow">
        <label>AC <input class="input" type="number" data-k="ac"></label>
        <label>HP <input class="input" data-k="hp" style="width:54px"></label>
        <label>Hit dice <input class="input" data-k="hpFormula" placeholder="2d8+2"></label>
        <label>Speed <input class="input" data-k="speed"></label>
        <label>CR <input class="input" data-k="cr" style="width:54px"></label></div>`);
      for (const inp of stats.querySelectorAll('input')) {
        const k = inp.dataset.k;
        inp.value = d[k];
        inp.onchange = () => { d[k] = inp.type === 'number' ? (Number(inp.value) || 0) : inp.value; save(); };
      }
      wrap.appendChild(stats);

      // abilities — tap to roll a check
      const abil = el('<div class="dm-abil"></div>');
      for (const [key, label] of ABILITIES) {
        const cell = el(`<button class="dm-abil-cell" title="Roll ${label} check"><span>${key.toUpperCase()}</span><input class="input" type="number"><b></b></button>`);
        const inp = cell.querySelector('input');
        inp.value = d.abilities[key];
        const drawMod = () => cell.querySelector('b').textContent = fmtMod(mod(d.abilities[key]));
        inp.onchange = () => { d.abilities[key] = Number(inp.value) || 10; save(); drawMod(); };
        inp.onclick = (e) => e.stopPropagation();
        cell.onclick = () => rollD20(widget, `${d.name} ${label}`, mod(d.abilities[key]));
        drawMod();
        abil.appendChild(cell);
      }
      wrap.appendChild(abil);

      // traits + actions
      const listSection = (title, key, opts = {}) => {
        const sec = el(`<details class="wb-sec" open><summary>${title}</summary><div class="wb-sec-body"></div></details>`);
        const body = sec.querySelector('.wb-sec-body');
        const render = () => {
          body.innerHTML = '';
          for (const it of (d[key] || [])) {
            const row = el(`<div class="dnd-box" style="margin-bottom:6px"><div class="row" style="gap:6px"><input class="input grow" style="font-weight:600" placeholder="Name"><button class="btn-icon" title="Remove">${icon('x', 13)}</button></div><textarea class="input" rows="2" placeholder="Description" style="margin-top:5px"></textarea></div>`);
            const [nm, ta] = [row.querySelector('input'), row.querySelector('textarea')];
            nm.value = it.name || ''; ta.value = it.text || '';
            nm.onchange = () => { it.name = nm.value; save(); };
            ta.onchange = () => { it.text = ta.value; save(); };
            if (opts.roll) {
              const rolls = el('<div class="row" style="gap:6px;margin-top:5px"><input class="input" type="number" placeholder="+hit" style="width:64px"><input class="input grow" placeholder="damage 1d8+2"><button class="chip" title="Roll to hit">Hit</button><button class="chip" title="Roll damage">Dmg</button></div>');
              const [hitIn, dmgIn, hitB, dmgB] = rolls.children;
              hitIn.value = it.toHit ?? ''; dmgIn.value = it.dmg || '';
              hitIn.onchange = () => { it.toHit = Number(hitIn.value) || 0; save(); };
              dmgIn.onchange = () => { it.dmg = dmgIn.value; save(); };
              hitB.onclick = () => rollD20(widget, `${it.name || d.name} attack`, it.toHit || 0);
              dmgB.onclick = () => it.dmg ? rollFormula(widget, `${it.name || d.name} damage`, it.dmg) : toast('Add a damage formula first.', 'dice');
              row.appendChild(rolls);
            }
            row.querySelector('[title="Remove"]').onclick = () => { d[key].splice(d[key].indexOf(it), 1); save(); render(); };
            body.appendChild(row);
          }
          const add = el(`<button class="btn" style="width:100%">${icon('plus', 14)} Add ${opts.one || 'entry'}</button>`);
          add.onclick = () => { d[key] = d[key] || []; d[key].push({ name: '', text: '' }); save(); render(); };
          body.appendChild(add);
        };
        render();
        wrap.appendChild(sec);
      };
      listSection('Traits', 'traits', { one: 'trait' });
      listSection('Actions', 'actions', { one: 'action', roll: true });

      if (fresh) setTimeout(() => nameIn.select(), 100);
    };

    if (widget.config.pendingOpen) {
      const id = widget.config.pendingOpen;
      delete widget.config.pendingOpen; store.put('widgets', widget);
      showBlock(id);
    } else showGrid();
  }
});
