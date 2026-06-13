/* InitiativeTracker widget (docs/08 §3): the live-play surface. Turn order with
   HP steppers, condition chips that count down each round, death-save pips for
   downed PCs, a round counter, and a giant one-tap "Next turn" — built for
   one-handed use at the table. Encounters load their creatures in here. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { icon } from '../ui/icons.js';
import { el, toast, popMenu, openPanel, input, seg } from '../ui/components.js';
import { CONDITIONS } from './dnd-shared.js';

const newId = () => 'c' + Math.random().toString(36).slice(2, 8);
const blank = (over = {}) => ({ id: newId(), name: 'Combatant', init: null, hp: 10, maxHp: 10, ac: null, isPC: false, conditions: [], deathSaves: { ok: 0, bad: 0 }, ...over });

/** Live combatants in turn order (initiative desc, unrolled last). */
function ordered(cfg) {
  return (cfg.combatants || []).slice().sort((a, b) => (b.init ?? -99) - (a.init ?? -99));
}

registry.register({
  type: 'initiative',
  name: 'Initiative',
  icon: 'activity',
  description: 'Live combat turn tracker — HP, conditions, death saves, big next-turn tap',
  keywords: ['initiative', 'combat', 'turn', 'tracker', 'dnd', 'dm', 'fight', 'round'],
  external: true, internal: true,
  defaultConfig: () => ({ combatants: [], round: 1, turnIndex: 0 }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const cfg = widget.config;
    const list = ordered(cfg);
    if (!list.length) { host.appendChild(el('<span class="soft" style="font-size:0.84rem">No fight in progress.</span>')); return; }
    const cur = list[Math.min(cfg.turnIndex, list.length - 1)];
    const card = el(`<div><div class="soft" style="font-size:0.78rem">Round ${cfg.round} · ${list.length} in the fray</div><div style="font-weight:650;font-size:1.05rem;margin:2px 0"></div><button class="btn btn-primary" style="width:100%;margin-top:4px">${icon('skip-forward', 14)} Next turn</button></div>`);
    card.querySelector('div:nth-child(2)').textContent = `▶ ${cur.name}${cur.hp <= 0 ? ' (down)' : ''}`;
    card.querySelector('button').onclick = (e) => { e.stopPropagation(); nextTurn(widget); };
    host.appendChild(card);
  },

  renderFull(host, widget, ctx) {
    const render = () => draw(host, widget, ctx, render);
    render();
    // live refresh when an Encounter loads combatants here
    const off = events.on('dm:init-changed', (e) => {
      if (!host.isConnected) { off(); return; }
      if (e.widgetId === widget.id) render();
    });
  }
});

function save(widget) { store.put('widgets', widget); }

/** Advance the turn; wrapping rolls the round and ticks condition timers. */
function nextTurn(widget) {
  const cfg = widget.config;
  const n = (cfg.combatants || []).length;
  if (!n) return;
  cfg.turnIndex = (cfg.turnIndex || 0) + 1;
  if (cfg.turnIndex >= n) {
    cfg.turnIndex = 0;
    cfg.round = (cfg.round || 1) + 1;
    for (const c of cfg.combatants) {
      c.conditions = (c.conditions || []).filter(cd => {
        if (cd.rounds > 0) { cd.rounds--; return cd.rounds > 0; }
        return true; // 0 = indefinite, kept
      });
    }
    toast(`Round ${cfg.round}`, 'activity');
  }
  save(widget);
  events.emit('dm:init-changed', { widgetId: widget.id });
}

function draw(host, widget, ctx, render) {
  host.innerHTML = '';
  const cfg = widget.config;
  const wrap = el('<div></div>');
  host.appendChild(wrap);

  // top bar: round + tools
  const bar = el(`<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
    <div class="row" style="gap:6px;align-items:center"><span class="soft">Round</span>
      <button class="btn-icon" title="−">${icon('minus', 13)}</button><b style="min-width:24px;text-align:center;font-size:1.1rem"></b><button class="btn-icon" title="+">${icon('plus', 13)}</button></div>
    <div class="row" style="gap:6px"><button class="btn" title="Roll all initiative">${icon('dice', 14)} Roll all</button><button class="btn-icon" title="More">${icon('more', 16)}</button></div></div>`);
  bar.querySelector('b').textContent = cfg.round || 1;
  bar.querySelector('[title="−"]').onclick = () => { cfg.round = Math.max(1, (cfg.round || 1) - 1); save(widget); render(); };
  bar.querySelector('[title="+"]').onclick = () => { cfg.round = (cfg.round || 1) + 1; save(widget); render(); };
  bar.querySelector('[title="Roll all initiative"]').onclick = () => {
    for (const c of cfg.combatants) c.init = 1 + Math.floor(Math.random() * 20);
    cfg.turnIndex = 0;
    save(widget); render();
    toast('Initiative rolled', 'dice');
  };
  bar.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
    { label: 'Sort by initiative', iconName: 'sliders', fn: () => { cfg.combatants = ordered(cfg); cfg.turnIndex = 0; save(widget); render(); } },
    { label: 'Reset rounds', iconName: 'refresh', fn: () => { cfg.round = 1; cfg.turnIndex = 0; save(widget); render(); } },
    { label: 'Clear all combatants', iconName: 'trash', danger: true, fn: () => { cfg.combatants = []; cfg.round = 1; cfg.turnIndex = 0; save(widget); render(); } }
  ]);
  wrap.appendChild(bar);

  const list = ordered(cfg);
  const curId = list[Math.min(cfg.turnIndex || 0, Math.max(0, list.length - 1))]?.id;

  if (!list.length) {
    wrap.appendChild(el('<div class="empty-state">' + icon('activity', 28) + '<p>No combatants yet. Add the party, then send an encounter — or add foes by hand.</p></div>'));
  }

  const rows = el('<div class="init-list"></div>');
  for (const c of list) {
    const row = el(`<div class="init-row${c.id === curId ? ' cur' : ''}${c.hp <= 0 ? ' down' : ''}">
      <span class="init-num"></span>
      <div class="init-main">
        <div class="row" style="gap:6px;align-items:center"><b class="init-name"></b><span class="soft init-ac"></span></div>
        <div class="init-conds row" style="flex-wrap:wrap;gap:4px"></div>
      </div>
      <div class="init-hp row" style="gap:4px;align-items:center">
        <button class="btn-icon" title="−1">${icon('minus', 12)}</button>
        <span class="init-hpnum"></span>
        <button class="btn-icon" title="+1">${icon('plus', 12)}</button>
      </div>
      <button class="btn-icon" title="More">${icon('more', 14)}</button></div>`);
    row.querySelector('.init-num').textContent = c.init ?? '—';
    row.querySelector('.init-name').textContent = c.name;
    row.querySelector('.init-ac').textContent = c.ac ? `AC ${c.ac}` : '';
    row.querySelector('.init-hpnum').textContent = `${c.hp}${c.maxHp ? `/${c.maxHp}` : ''}`;
    const bump = (n) => { c.hp = Math.max(-99, Math.min(c.maxHp || 999, c.hp + n)); save(widget); render(); };
    row.querySelector('[title="−1"]').onclick = () => bump(-1);
    row.querySelector('[title="+1"]').onclick = () => bump(1);
    row.querySelector('.init-hpnum').onclick = () => editHp(c, widget, render);

    // conditions
    const conds = row.querySelector('.init-conds');
    for (const cd of (c.conditions || [])) {
      const chip = el(`<button class="chip accent" title="Tap to clear"></button>`);
      chip.textContent = `${cd.name}${cd.rounds > 0 ? ` ${cd.rounds}r` : ''}`;
      chip.onclick = () => { c.conditions.splice(c.conditions.indexOf(cd), 1); save(widget); render(); };
      conds.appendChild(chip);
    }
    const addCond = el(`<button class="chip" title="Add condition">${icon('plus', 10)}</button>`);
    addCond.onclick = (e) => popMenu(e.currentTarget, CONDITIONS.filter(n => !(c.conditions || []).some(x => x.name === n)).map(n => ({
      label: n, fn: () => { c.conditions = c.conditions || []; c.conditions.push({ name: n, rounds: 0 }); save(widget); render(); }
    })));
    conds.appendChild(addCond);

    // death saves for downed PCs
    if (c.isPC && c.hp <= 0) {
      const ds = el('<div class="row" style="gap:8px;margin-top:4px"><span class="dnd-pips ds-ok"></span><span class="dnd-pips ds-bad"></span></div>');
      for (const [cls, key, sym] of [['.ds-ok', 'ok', '✓'], ['.ds-bad', 'bad', '✗']]) {
        const span = ds.querySelector(cls);
        for (let i = 0; i < 3; i++) {
          const p = el(`<button class="pip${i < c.deathSaves[key] ? ' on' : ''}${key === 'bad' ? ' bad' : ''}">${i < c.deathSaves[key] ? sym : ''}</button>`);
          p.onclick = () => { c.deathSaves[key] = i < c.deathSaves[key] ? i : i + 1; save(widget); render(); };
          span.appendChild(p);
        }
      }
      row.querySelector('.init-main').appendChild(ds);
    }

    row.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
      { label: 'Set initiative', iconName: 'dice', fn: async () => { const v = await promptNum('Initiative'); if (v !== null) { c.init = v; save(widget); render(); } } },
      { label: c.isPC ? 'Mark as monster' : 'Mark as PC', iconName: 'user', fn: () => { c.isPC = !c.isPC; save(widget); render(); } },
      { label: 'Remove', iconName: 'trash', danger: true, fn: () => { cfg.combatants = cfg.combatants.filter(x => x.id !== c.id); save(widget); render(); } }
    ]);
    rows.appendChild(row);
  }
  wrap.appendChild(rows);

  // add combatant
  const add = el(`<button class="btn" style="width:100%;margin-top:8px">${icon('plus', 14)} Add combatant</button>`);
  add.onclick = () => addCombatant(widget, render);
  wrap.appendChild(add);

  // giant next turn
  const next = el(`<button class="init-next">${icon('skip-forward', 22)}<span>Next turn</span></button>`);
  next.onclick = () => { nextTurn(widget); render(); };
  wrap.appendChild(next);
}

function editHp(c, widget, render) {
  const d = openPanel({ title: c.name + ' — HP', iconName: 'heart' });
  const cur = input(String(c.hp), 'Current HP');
  const max = input(String(c.maxHp || ''), 'Max HP');
  max.style.marginTop = '8px';
  const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Save</button>');
  ok.onclick = () => { c.hp = Number(cur.value) || 0; c.maxHp = Math.max(0, Number(max.value) || 0); save(widget); d.close(); render(); };
  d.body.append(cur, max, ok);
  setTimeout(() => cur.select(), 120);
}

function addCombatant(widget, render) {
  const d = openPanel({ title: 'Add combatant', iconName: 'plus' });
  const name = input('', 'Name');
  const hp = el('<input class="input" type="number" placeholder="HP" style="margin-top:8px">');
  const init = el('<input class="input" type="number" placeholder="Initiative (optional)" style="margin-top:8px">');
  let isPC = false;
  const sg = seg([{ value: 'monster', label: 'Monster' }, { value: 'pc', label: 'PC' }], 'monster', (v) => { isPC = v === 'pc'; });
  sg.style.marginTop = '8px';
  const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Add</button>');
  ok.onclick = () => {
    if (!name.value.trim()) return;
    const h = Number(hp.value) || 10;
    widget.config.combatants.push(blank({ name: name.value.trim(), hp: h, maxHp: h, init: init.value === '' ? null : Number(init.value), isPC }));
    save(widget); d.close(); render();
  };
  d.body.append(name, hp, init, sg, ok);
  setTimeout(() => name.focus(), 120);
}

/** Tiny numeric prompt via a panel. @returns {Promise<number|null>} */
function promptNum(label) {
  return new Promise((resolve) => {
    const d = openPanel({ title: label, iconName: 'dice', onClose: () => resolve(null) });
    const inp = el('<input class="input" type="number">');
    const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Set</button>');
    ok.onclick = () => { const v = Number(inp.value); resolve(Number.isFinite(v) ? v : null); d.close(); };
    d.body.append(inp, ok);
    setTimeout(() => inp.focus(), 120);
  });
}
