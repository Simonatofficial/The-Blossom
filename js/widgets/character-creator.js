/* Character Creator (V2 §12e): a simple D&D-Beyond-style guided builder that
   walks Race → Class → Abilities → Background → Review and writes the result
   onto the module's anchor character. Registers a placeable `chargen` widget
   and exports openCharacterCreator() for the Character Sheet's menu. */

import { registry } from './registry.js';
import { el, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { createCharacter, saveCharacter } from './dnd-shared.js';
import {
  ALL_RACES as RACES, ALL_CLASSES as CLASSES, ALL_BACKGROUNDS as BACKGROUNDS, STANDARD_ARRAY, POINT_BUY_COST
} from '../presets/tabletop/srd5e-index.js';
import {
  applyClass, applyRace, applyBackground, startingHp, abilMod
} from './tabletop-build.js';

const ABBR = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const sgn = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** Open the guided creator inline in `host`. onDone() fires after Create. */
export function renderCreator(host, env) {
  const { widget, onDone } = env;
  host.innerHTML = '';

  const draft = {
    step: 0,
    race: null, subrace: null,
    cls: null,
    method: 'array',
    base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    array: {},   // ability -> assigned value (standard array or rolled pool)
    rolled: null, // [6] rolled scores when method === 'roll'
    background: null,
    alignment: '',
    name: ''
  };

  const roll4d6 = () => { const d = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6)).sort((a, b) => a - b); return d[1] + d[2] + d[3]; };

  const wrap = el('<div class="cc-wrap"></div>');
  host.appendChild(wrap);

  const STEPS = ['Race', 'Class', 'Abilities', 'Background', 'Review'];

  const racialBonus = (key) => {
    let b = 0;
    for (const x of draft.race?.abilityBonuses || []) if (x.ability === key) b += x.bonus;
    for (const x of draft.subrace?.abilityBonuses || []) if (x.ability === key) b += x.bonus;
    return b;
  };
  const usesPool = () => draft.method === 'array' || draft.method === 'roll';
  const poolValues = () => draft.method === 'roll' ? (draft.rolled || []) : STANDARD_ARRAY;
  const baseScore = (key) => usesPool() ? (draft.array[key] || 0) : draft.base[key];
  const finalScore = (key) => Math.min(20, baseScore(key) + racialBonus(key));

  const draw = () => {
    wrap.innerHTML = '';
    // progress rail
    const rail = el('<div class="cc-rail"></div>');
    STEPS.forEach((s, i) => {
      const dot = el(`<button class="cc-dot${i === draft.step ? ' on' : ''}${i < draft.step ? ' done' : ''}"><b>${i + 1}</b><span>${s}</span></button>`);
      dot.onclick = () => { if (i <= maxReached()) { draft.step = i; draw(); } };
      rail.appendChild(dot);
    });
    wrap.appendChild(rail);

    const body = el('<div class="cc-body"></div>');
    wrap.appendChild(body);
    [stepRace, stepClass, stepAbilities, stepBackground, stepReview][draft.step](body);

    // nav
    const nav = el('<div class="cc-nav"></div>');
    const back = el(`<button class="btn">${icon('arrow-left', 14)} Back</button>`);
    back.disabled = draft.step === 0;
    back.onclick = () => { draft.step = Math.max(0, draft.step - 1); draw(); };
    nav.appendChild(back);
    if (draft.step < STEPS.length - 1) {
      const next = el('<button class="btn btn-primary">Next</button>');
      next.disabled = !canAdvance();
      next.onclick = () => { draft.step++; draw(); };
      nav.appendChild(next);
    } else {
      const make = el(`<button class="btn btn-primary">${icon('sparkles', 14)} Create character</button>`);
      make.disabled = !draft.name.trim();
      make.onclick = create;
      nav.appendChild(make);
    }
    wrap.appendChild(nav);
  };

  const maxReached = () => {
    // allow jumping back to any completed step, or the current one
    let m = 0;
    if (draft.race) m = 1;
    if (draft.race && draft.cls) m = 2;
    if (draft.race && draft.cls && abilitiesValid()) m = 3;
    if (draft.race && draft.cls && abilitiesValid() && draft.background) m = 4;
    return Math.max(m, draft.step);
  };
  const canAdvance = () => [
    () => !!draft.race && (!draft.race.subraces?.length || draft.subrace),
    () => !!draft.cls,
    abilitiesValid,
    () => !!draft.background
  ][draft.step]?.() ?? true;

  function abilitiesValid() {
    if (draft.method === 'array') return KEYS.every(k => draft.array[k]);
    if (draft.method === 'roll') return !!draft.rolled && KEYS.every(k => draft.array[k]);
    if (draft.method === 'pointbuy') return pointsLeft() >= 0;
    return KEYS.every(k => draft.base[k] >= 1 && draft.base[k] <= 20);
  }
  function pointsLeft() {
    return 27 - KEYS.reduce((n, k) => n + (POINT_BUY_COST[draft.base[k]] ?? 99), 0);
  }

  /* ---------- step 1: race ---------- */
  function stepRace(body) {
    body.appendChild(el('<p class="cc-hint">Choose your heritage. It shapes your size, speed, and a few signature traits.</p>'));
    const grid = el('<div class="cc-grid"></div>');
    for (const r of RACES) {
      const card = el(`<button class="cc-card${draft.race === r ? ' sel' : ''}"><b>${r.name}</b><span>${r.size} · ${r.speed} ft${r.darkvision ? ' · darkvision' : ''}</span></button>`);
      card.onclick = () => { draft.race = r; draft.subrace = r.subraces?.length ? null : null; draw(); };
      grid.appendChild(card);
    }
    body.appendChild(grid);
    if (draft.race) {
      body.appendChild(el(`<p class="cc-note"><b>${draft.race.name}:</b> ${(draft.race.traits || []).join(' ')}</p>`));
      if (draft.race.subraces?.length) {
        body.appendChild(el('<div class="cc-sub">Subrace</div>'));
        const sg = el('<div class="cc-grid"></div>');
        for (const sr of draft.race.subraces) {
          const c = el(`<button class="cc-card${draft.subrace === sr ? ' sel' : ''}"><b>${sr.name}</b><span>${(sr.abilityBonuses || []).map(b => `${ABBR[b.ability]} +${b.bonus}`).join(', ')}</span></button>`);
          c.onclick = () => { draft.subrace = sr; draw(); };
          sg.appendChild(c);
        }
        body.appendChild(sg);
      }
    }
  }

  /* ---------- step 2: class ---------- */
  function stepClass(body) {
    body.appendChild(el('<p class="cc-hint">Choose your class — your role, hit die, and how you fight or cast.</p>'));
    const grid = el('<div class="cc-grid"></div>');
    for (const c of CLASSES) {
      const card = el(`<button class="cc-card${draft.cls === c ? ' sel' : ''}"><b>${c.name}</b><span>${c.hitDie} · ${c.saves.map(s => ABBR[s]).join('/')}${c.spellcasting ? ' · caster' : ''}</span></button>`);
      card.onclick = () => { draft.cls = c; draw(); };
      grid.appendChild(card);
    }
    body.appendChild(grid);
    if (draft.cls) body.appendChild(el(`<p class="cc-note"><b>${draft.cls.name}:</b> primary ${draft.cls.primaryAbility}. Armor: ${draft.cls.armorProfs}. Skills: choose ${draft.cls.skillChoices.count} from ${draft.cls.skillChoices.from === 'any' ? 'any' : draft.cls.skillChoices.from.join(', ')}.</p>`));
  }

  /* ---------- step 3: abilities ---------- */
  function stepAbilities(body) {
    body.appendChild(el('<p class="cc-hint">Set your six ability scores. Racial bonuses are added automatically.</p>'));
    const methods = el('<div class="cc-methods"></div>');
    for (const [m, label] of [['array', 'Standard array'], ['roll', 'Roll dice'], ['pointbuy', 'Point buy'], ['manual', 'Manual']]) {
      const b = el(`<button class="chip${draft.method === m ? ' accent' : ''}">${label}</button>`);
      b.onclick = () => { draft.method = m; if (m !== 'array' && m !== 'roll') draft.array = {}; draw(); };
      methods.appendChild(b);
    }
    body.appendChild(methods);

    // shared pool-assignment UI for array + roll (each value used once)
    const drawPool = () => {
      const used = new Set(Object.values(draft.array).filter(v => v != null));
      const pool = poolValues();
      for (const k of KEYS) {
        const row = el(`<div class="cc-ab"><span>${ABBR[k]}</span><select class="select"></select><em></em></div>`);
        const sel = row.querySelector('select');
        sel.appendChild(new Option('—', ''));
        // multiset: allow duplicate values in the pool (rolls can repeat)
        const counts = {};
        for (const v of pool) counts[v] = (counts[v] || 0) + 1;
        const assignedCounts = {};
        for (const v of Object.values(draft.array)) if (v != null) assignedCounts[v] = (assignedCounts[v] || 0) + 1;
        const seen = new Set();
        for (const v of pool) {
          if (seen.has(v)) continue; seen.add(v);
          const opt = new Option(String(v), String(v));
          const remaining = counts[v] - (assignedCounts[v] || 0) + (draft.array[k] === v ? 1 : 0);
          if (remaining <= 0 && draft.array[k] !== v) opt.disabled = true;
          sel.appendChild(opt);
        }
        sel.value = draft.array[k] ? String(draft.array[k]) : '';
        sel.onchange = () => { draft.array[k] = sel.value ? Number(sel.value) : undefined; draw(); };
        row.querySelector('em').textContent = draft.array[k] ? `→ ${finalScore(k)} (${sgn(abilMod(finalScore(k)))})` : '';
        body.appendChild(row);
      }
    };

    if (draft.method === 'array') {
      body.appendChild(el(`<p class="cc-note">Assign these values, one each: <b>${STANDARD_ARRAY.join(', ')}</b>.</p>`));
      drawPool();
    } else if (draft.method === 'roll') {
      const rollRow = el(`<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="btn btn-primary" style="font-size:0.82rem">${icon('dice', 14)} Roll 4d6 (drop lowest) ×6</button><span class="cc-rolled soft" style="font-size:0.84rem"></span></div>`);
      const rolledLabel = rollRow.querySelector('.cc-rolled');
      rolledLabel.textContent = draft.rolled ? `Rolled: ${[...draft.rolled].sort((a, b) => b - a).join(', ')}` : 'No scores rolled yet.';
      rollRow.querySelector('button').onclick = () => { draft.rolled = Array.from({ length: 6 }, roll4d6).sort((a, b) => b - a); draft.array = {}; draw(); };
      body.appendChild(rollRow);
      if (draft.rolled) { body.appendChild(el('<p class="cc-note">Now assign each rolled score to an ability.</p>')); drawPool(); }
    } else if (draft.method === 'pointbuy') {
      const left = pointsLeft();
      body.appendChild(el(`<p class="cc-note">Points remaining: <b class="${left < 0 ? 'cc-bad' : ''}">${left}</b> / 27. Scores range 8–15 before racial bonuses.</p>`));
      for (const k of KEYS) {
        const row = el(`<div class="cc-ab"><span>${ABBR[k]}</span>
          <button class="btn-icon cc-minus">${icon('minus', 14)}</button><b class="cc-val">${draft.base[k]}</b><button class="btn-icon cc-plus">${icon('plus', 14)}</button>
          <em>→ ${finalScore(k)} (${sgn(abilMod(finalScore(k)))})</em></div>`);
        row.querySelector('.cc-minus').onclick = () => { if (draft.base[k] > 8) { draft.base[k]--; draw(); } };
        row.querySelector('.cc-plus').onclick = () => { if (draft.base[k] < 15 && (POINT_BUY_COST[draft.base[k] + 1] - POINT_BUY_COST[draft.base[k]]) <= left) { draft.base[k]++; draw(); } };
        body.appendChild(row);
      }
    } else {
      for (const k of KEYS) {
        const row = el(`<div class="cc-ab"><span>${ABBR[k]}</span><input class="input" type="number" min="1" max="20" style="width:64px"><em></em></div>`);
        const inp = row.querySelector('input');
        inp.value = draft.base[k];
        inp.onchange = () => { draft.base[k] = Math.max(1, Math.min(20, Number(inp.value) || 10)); draw(); };
        row.querySelector('em').textContent = `→ ${finalScore(k)} (${sgn(abilMod(finalScore(k)))})`;
        body.appendChild(row);
      }
    }
  }

  /* ---------- step 4: background ---------- */
  function stepBackground(body) {
    body.appendChild(el('<p class="cc-hint">A background grants two skill proficiencies and a roleplay feature.</p>'));
    const grid = el('<div class="cc-grid"></div>');
    for (const b of BACKGROUNDS) {
      const card = el(`<button class="cc-card${draft.background === b ? ' sel' : ''}"><b>${b.name}</b><span>${b.skills.join(', ')}</span></button>`);
      card.onclick = () => { draft.background = b; draw(); };
      grid.appendChild(card);
    }
    body.appendChild(grid);
    if (draft.background) body.appendChild(el(`<p class="cc-note"><b>${draft.background.name}:</b> ${draft.background.feature}</p>`));
  }

  /* ---------- step 5: review ---------- */
  function stepReview(body) {
    const nameRow = el('<div class="cc-ab" style="margin-bottom:8px"><span>Name</span><input class="input grow" placeholder="Name your hero…"></div>');
    const ni = nameRow.querySelector('input');
    ni.value = draft.name;
    ni.oninput = () => { draft.name = ni.value; const mk = wrap.querySelector('.cc-nav .btn-primary'); if (mk) mk.disabled = !draft.name.trim(); };
    body.appendChild(nameRow);

    const alRow = el('<div class="cc-ab" style="margin-bottom:10px"><span>Align</span><select class="select grow"></select></div>');
    const alSel = alRow.querySelector('select');
    alSel.appendChild(new Option('—', ''));
    for (const a of ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil']) alSel.appendChild(new Option(a, a));
    alSel.value = draft.alignment || '';
    alSel.onchange = () => { draft.alignment = alSel.value; };
    body.appendChild(alRow);

    const sum = el('<div class="cc-summary"></div>');
    const line = (a, b) => sum.appendChild(el(`<div class="cc-srow"><span>${a}</span><b>${b}</b></div>`));
    line('Race', draft.subrace ? `${draft.subrace.name} ${draft.race.name}` : draft.race?.name || '—');
    line('Class', draft.cls?.name || '—');
    line('Background', draft.background?.name || '—');
    line('Hit die', draft.cls?.hitDie || '—');
    body.appendChild(sum);

    const ab = el('<div class="cc-abilities"></div>');
    for (const k of KEYS) ab.appendChild(el(`<div><span>${ABBR[k]}</span><b>${finalScore(k)}</b><i>${sgn(abilMod(finalScore(k)))}</i></div>`));
    body.appendChild(ab);

    const con = finalScore('con');
    body.appendChild(el(`<p class="cc-note">Starting HP <b>${startingHp(draft.cls, con)}</b> · base AC <b>${10 + abilMod(finalScore('dex'))}</b> · speed <b>${draft.race?.speed || 30} ft</b>.</p>`));
  }

  /* ---------- commit ---------- */
  function create() {
    const { obj, c } = createCharacter(widget); // a NEW character, made active
    c.name = draft.name.trim() || 'New adventurer';
    c.level = 1;
    c.alignment = draft.alignment || '';
    // base scores (pre-racial)
    for (const k of KEYS) c.abilities[k] = baseScore(k) || 10;
    c.race = ''; // force applyRace to add bonuses
    if (draft.race) applyRace(c, draft.race);
    if (draft.subrace) {
      if (draft.subrace.speed) c.speed = draft.subrace.speed;
      for (const b of draft.subrace.abilityBonuses || []) if (c.abilities[b.ability] != null) c.abilities[b.ability] = Math.min(20, c.abilities[b.ability] + b.bonus);
    }
    if (draft.cls) applyClass(c, draft.cls);
    if (draft.background) applyBackground(c, draft.background);
    const con = c.abilities.con;
    c.hp = { cur: startingHp(draft.cls, con), max: startingHp(draft.cls, con), temp: 0 };
    c.ac = 10 + abilMod(c.abilities.dex);
    saveCharacter(obj);
    toast(`${c.name} created — welcome to the table!`, 'sparkles');
    onDone?.();
  }

  draw();
}

/** Launch the creator inside a slide-over panel (used from the sheet menu). */
export async function openCharacterCreator(env) {
  const { openPanel } = await import('../ui/components.js');
  const d = openPanel({ title: 'Character creation guide', iconName: 'sparkles' });
  renderCreator(d.body, { ...env, onDone: () => { d.close(); env.onDone?.(); } });
}

registry.register({
  type: 'chargen',
  name: 'Character Creator',
  icon: 'sparkles',
  description: 'A guided, step-by-step 5e character builder',
  keywords: ['dnd', 'd&d', 'character', 'create', 'builder', 'guide', 'rpg', 'tabletop', 'wizard'],
  category: 'Tabletop',
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host) {
    host.innerHTML = '';
    host.appendChild(el(`<div class="row" style="gap:8px;align-items:center">
      <span style="color:var(--accent)">${icon('sparkles', 22)}</span>
      <div><div style="font-weight:650">Character Creator</div>
      <div class="soft" style="font-size:0.8rem">Build a 5e hero step by step</div></div></div>`));
  },

  renderFull(host, widget, ctx) {
    renderCreator(host, { widget, ctx, onDone: () => this.renderFull(host, widget, ctx) });
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">This guide writes to the character shared by this module\'s Character Sheet. Run it once to set up a new hero, then fine-tune on the sheet.</p>'));
  }
});
