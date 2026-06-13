/* Encounter widget (docs/08 §3): build a fight from the bestiary — creatures
   (referencing StatBlocks × count), a cozy difficulty read (Sprout→Radiant, not
   raw math), treasure (roll a sibling LootTable or freeform), read-aloud text,
   and tactics. "Run it" loads the creatures into the sibling InitiativeTracker. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog, popMenu, field } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { siblingWidgets } from './wb-shared.js';
import { allStatBlocks, statBlockById } from './statblock.js';
import { allLootTables, rollLootById } from './loottable.js';

const encounters = (w) => objectsOf(w.id, 'encounter');
const FRESH = () => ({ name: 'New encounter', location: '', creatures: [], treatRef: null, treasure: '', readAloud: '', tactics: '' });

const crToNum = (cr) => {
  if (cr == null) return 0;
  const s = String(cr).trim();
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : 0; }
  return Number(s) || 0;
};

const TIERS = [
  [0.5, 'Sprout', 'A walkover'], [1, 'Bud', 'Easy'], [2, 'Bloom', 'A fair fight'],
  [3.5, 'Bright', 'Dangerous'], [Infinity, 'Radiant', 'Deadly — be ready']
];

/** Cozy difficulty estimate from creature CRs vs party size/level. */
function difficulty(d, partySize, partyLevel) {
  const threat = (d.creatures || []).reduce((s, cr) => s + crToNum(statBlockById(cr.sbId)?.cr ?? cr.cr) * (cr.count || 1), 0);
  const budget = Math.max(0.5, partySize * Math.max(1, partyLevel) * 0.25);
  const ratio = threat / budget;
  return { ...TIERS.find(([cap]) => ratio <= cap), ratio };
}

registry.register({
  type: 'encounter',
  name: 'Encounters',
  icon: 'zap',
  description: 'Plan fights — creatures, difficulty, treasure, read-aloud, and one-tap run',
  keywords: ['encounter', 'combat', 'fight', 'monster', 'dm', 'cr', 'initiative'],
  external: true, internal: true,
  defaultConfig: () => ({ partySize: 4, partyLevel: 3 }),

  renderSettings(host, widget) {
    const wrap = el('<div class="row" style="gap:10px"></div>');
    for (const [label, key] of [['Party size', 'partySize'], ['Party level', 'partyLevel']]) {
      const inp = el('<input class="input" type="number" style="width:80px">');
      inp.value = widget.config[key];
      inp.onchange = () => { widget.config[key] = Math.max(1, Number(inp.value) || 1); store.put('widgets', widget); };
      wrap.appendChild(field(label, inp));
    }
    host.appendChild(wrap);
  },

  renderCard(host, widget) {
    host.innerHTML = '';
    const list = encounters(widget);
    if (!list.length) { host.appendChild(el('<span class="soft" style="font-size:0.84rem">No encounters planned.</span>')); return; }
    const wrap = el('<div style="display:flex;flex-direction:column;gap:5px"></div>');
    for (const o of list.slice(0, 4)) {
      const t = difficulty(o.data, widget.config.partySize, widget.config.partyLevel);
      const row = el(`<div class="row" style="gap:8px"><span class="grow" style="font-size:0.9rem;font-weight:600"></span><span class="chip dm-tier" data-tier=""></span></div>`);
      row.querySelector('.grow').textContent = o.data.name;
      const chip = row.querySelector('.chip'); chip.textContent = t[1]; chip.dataset.tier = t[1];
      wrap.appendChild(row);
    }
    host.appendChild(wrap);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const wrap = el('<div></div>');
    host.appendChild(wrap);

    const showList = () => {
      wrap.innerHTML = '';
      const head = el(`<div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Encounters</h3><button class="btn btn-primary">${icon('plus', 15)} Encounter</button></div>`);
      head.querySelector('button').onclick = () => { const o = createObject(widget.id, 'encounter', FRESH()); showEnc(o.id, true); };
      wrap.appendChild(head);
      const list = encounters(widget);
      if (!list.length) { wrap.appendChild(el('<div class="empty-state">' + icon('zap', 28) + '<p>No fights brewing yet. What lurks in the dark?</p></div>')); return; }
      for (const o of list) {
        const t = difficulty(o.data, widget.config.partySize, widget.config.partyLevel);
        const row = el(`<button class="list-item"><span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span><span class="chip dm-tier" data-tier=""></span></button>`);
        row.querySelector('.li-title').textContent = o.data.name;
        row.querySelector('.li-sub').textContent = o.data.location || `${(o.data.creatures || []).reduce((s, c) => s + (c.count || 1), 0)} creatures`;
        const chip = row.querySelector('.chip'); chip.textContent = t[1]; chip.dataset.tier = t[1];
        row.onclick = () => showEnc(o.id);
        wrap.appendChild(row);
      }
    };

    const showEnc = (id, fresh = false) => {
      const o = store.get('objects', id);
      if (!o) return showList();
      const d = o.data;
      const save = () => saveObject(o);
      wrap.innerHTML = '';

      const head = el(`<div class="row" style="gap:8px;margin-bottom:6px">
        <button class="btn-icon" title="All encounters">${icon('arrow-left', 17)}</button>
        <input class="input grow" style="font-weight:650">
        <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
      head.querySelector('[title="All encounters"]').onclick = showList;
      const nameIn = head.querySelector('input');
      nameIn.value = d.name;
      nameIn.onchange = () => { d.name = nameIn.value.trim() || 'Encounter'; save(); };
      head.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Duplicate', iconName: 'copy', fn: () => { const n = createObject(widget.id, 'encounter', structuredClone(d)); n.data.name = d.name + ' copy'; saveObject(n); showEnc(n.id); } },
        { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${d.name}”?` })) { store.trash('objects', o.id); toast('Cleared', 'leaf'); showList(); } } }
      ]);
      wrap.appendChild(head);

      const locIn = el('<input class="input" placeholder="Where does it happen?" style="margin-bottom:10px;font-size:0.86rem">');
      locIn.value = d.location || '';
      locIn.onchange = () => { d.location = locIn.value; save(); };
      wrap.appendChild(locIn);

      // difficulty banner
      const banner = el('<div class="dm-diff"></div>');
      const drawBanner = () => {
        const t = difficulty(d, widget.config.partySize, widget.config.partyLevel);
        banner.dataset.tier = t[1];
        banner.innerHTML = `<b>${t[1]}</b><span class="soft">${t[2]} · party of ${widget.config.partySize} at level ${widget.config.partyLevel}</span>`;
      };
      drawBanner();
      wrap.appendChild(banner);

      // creatures
      const cSec = el(`<div class="dnd-box" style="margin:10px 0"><div class="row" style="justify-content:space-between"><span class="soft">Creatures</span><button class="btn-icon" title="Add creature">${icon('plus', 14)}</button></div><div class="enc-creatures"></div></div>`);
      const cList = cSec.querySelector('.enc-creatures');
      const drawCreatures = () => {
        cList.innerHTML = '';
        if (!d.creatures.length) cList.appendChild(el('<p class="soft" style="font-size:0.8rem;margin:4px 0">No creatures yet — pull from your Stat Blocks.</p>'));
        for (const cr of d.creatures) {
          const row = el(`<div class="row" style="gap:8px;align-items:center;padding:3px 0"><span class="grow" style="font-size:0.88rem"></span><button class="btn-icon" title="−">${icon('minus', 12)}</button><b style="min-width:20px;text-align:center"></b><button class="btn-icon" title="+">${icon('plus', 12)}</button><button class="btn-icon" title="Remove">${icon('x', 12)}</button></div>`);
          row.querySelector('.grow').textContent = `${cr.name}${cr.sbId ? ` · CR ${statBlockById(cr.sbId)?.cr ?? '?'}` : ''}`;
          row.querySelector('b').textContent = cr.count;
          row.querySelector('[title="−"]').onclick = () => { cr.count = Math.max(1, cr.count - 1); save(); drawCreatures(); drawBanner(); };
          row.querySelector('[title="+"]').onclick = () => { cr.count++; save(); drawCreatures(); drawBanner(); };
          row.querySelector('[title="Remove"]').onclick = () => { d.creatures.splice(d.creatures.indexOf(cr), 1); save(); drawCreatures(); drawBanner(); };
          cList.appendChild(row);
        }
      };
      drawCreatures();
      cSec.querySelector('[title="Add creature"]').onclick = (e) => {
        const sbs = allStatBlocks(widget);
        const items = sbs.map(s => ({ label: `${s.name} · CR ${s.cr || '?'}`, fn: () => { d.creatures.push({ name: s.name, sbId: s.id, count: 1 }); save(); drawCreatures(); drawBanner(); } }));
        items.push({ label: '+ Custom (no stat block)', iconName: 'edit', fn: () => { d.creatures.push({ name: 'Creature', sbId: null, cr: '1/4', count: 1 }); save(); drawCreatures(); drawBanner(); } });
        popMenu(e.currentTarget, items.length ? items : [{ label: 'Add a Stat Blocks widget first', fn: () => {} }]);
      };
      wrap.appendChild(cSec);

      // run it → initiative
      const runBar = el(`<button class="btn btn-primary" style="width:100%;margin-bottom:10px">${icon('zap', 15)} Run it — roll for initiative</button>`);
      runBar.onclick = () => sendToInitiative(d, widget, ctx);
      wrap.appendChild(runBar);

      // treasure: roll a sibling loot table or freeform
      const tSec = el(`<div class="dnd-box" style="margin-bottom:10px"><span class="soft">Treasure</span><div class="row" style="gap:8px;margin:6px 0"><select class="select grow"></select><button class="chip accent" title="Roll">${icon('dice', 12)} Roll</button></div><textarea class="input" rows="2" placeholder="Treasure notes — or roll a table above"></textarea></div>`);
      const sel = tSec.querySelector('select');
      sel.appendChild(new Option('— pick a loot table —', ''));
      for (const lt of allLootTables(widget)) sel.appendChild(new Option(lt.name, lt.id));
      sel.value = d.treatRef || '';
      sel.onchange = () => { d.treatRef = sel.value || null; save(); };
      const tta = tSec.querySelector('textarea');
      tta.value = d.treasure || '';
      tta.onchange = () => { d.treasure = tta.value; save(); };
      tSec.querySelector('button').onclick = () => {
        if (!d.treatRef) return toast('Pick a loot table to roll.', 'coins');
        const haul = rollLootById(d.treatRef);
        if (haul.length) { d.treasure = (d.treasure ? d.treasure + '\n' : '') + haul.join(', '); save(); tta.value = d.treasure; }
      };
      wrap.appendChild(tSec);

      for (const [label, key, rows] of [['Read-aloud', 'readAloud', 3], ['Tactics', 'tactics', 3]]) {
        const f = el(`<div class="field"><label>${label}</label><textarea class="input${key === 'readAloud' ? ' dm-read' : ''}" rows="${rows}"></textarea></div>`);
        const ta = f.querySelector('textarea');
        ta.value = d[key] || '';
        ta.onchange = () => { d[key] = ta.value; save(); };
        wrap.appendChild(f);
      }

      if (fresh) setTimeout(() => nameIn.select(), 100);
    };

    showList();
  }
});

/** Expand an encounter's creatures into combatants and hand them to the
    sibling InitiativeTracker (keeping any PCs already added there). */
function sendToInitiative(d, widget, ctx) {
  const init = siblingWidgets(widget, ['initiative'])[0];
  if (!init) return toast('Add an Initiative Tracker to this campaign first.', 'info');
  const monsters = [];
  for (const cr of d.creatures) {
    const sb = statBlockById(cr.sbId);
    for (let i = 0; i < (cr.count || 1); i++) {
      monsters.push({
        id: 'm' + Math.random().toString(36).slice(2, 8),
        name: cr.count > 1 ? `${cr.name} ${i + 1}` : cr.name,
        init: null, hp: sb?.hp || 10, maxHp: sb?.hp || 10, ac: sb?.ac || null,
        isPC: false, conditions: [], deathSaves: { ok: 0, bad: 0 }
      });
    }
  }
  const kept = (init.config.combatants || []).filter(c => c.isPC);
  init.config.combatants = [...kept, ...monsters];
  init.config.round = 1;
  init.config.turnIndex = 0;
  store.put('widgets', init);
  events.emit('dm:init-changed', { widgetId: init.id });
  toast(`${d.name} → Initiative Tracker`, 'zap');
  ctx.goWidget(init.id);
}
