/* CharacterSheet combat face (docs/08 §4): HP/temp steppers, hit dice,
   death saves, condition chips, tap-to-roll attacks, user-defined resource
   pips, and short/long rest buttons that restore what the user configured.
   Rendered by dndsheet.js when a charsheet widget's section is 'combat'. */

import { icon } from '../ui/icons.js';
import { el, toast, popMenu, openPanel, input, seg } from '../ui/components.js';
import { CONDITIONS, mod, fmtMod, getCharacter, saveCharacter, rollD20, rollFormula } from './dnd-shared.js';

export function renderCombat(host, env) {
  const { widget } = env;
  const { obj, c } = getCharacter(widget);
  const save = () => saveCharacter(obj);
  const rerender = () => env.render();

  /* ---- HP: steppers, bar, temp ---- */
  const hp = el(`<div class="dnd-hp">
    <div class="row" style="gap:6px;align-items:center;justify-content:center">
      <button class="btn-icon h-d5" title="−5">−5</button><button class="btn-icon h-d1" title="−1">${icon('minus', 14)}</button>
      <b class="dnd-hp-num"></b>
      <button class="btn-icon h-u1" title="+1">${icon('plus', 14)}</button><button class="btn-icon h-u5" title="+5">+5</button>
    </div>
    <div class="hp-bar"><i></i></div>
    <div class="row" style="justify-content:center;gap:10px;font-size:0.8rem;margin-top:4px">
      <span class="soft">Max <input class="input h-max" type="number" style="width:58px;padding:2px 6px"></span>
      <span class="soft">Temp <input class="input h-temp" type="number" style="width:58px;padding:2px 6px"></span>
    </div></div>`);
  const num = hp.querySelector('.dnd-hp-num');
  const bar = hp.querySelector('.hp-bar i');
  const drawHp = () => {
    num.textContent = `${c.hp.cur} / ${c.hp.max}${c.hp.temp ? `  (+${c.hp.temp})` : ''}`;
    bar.style.width = `${Math.max(0, Math.min(100, (c.hp.cur / Math.max(1, c.hp.max)) * 100))}%`;
    bar.parentElement.classList.toggle('low', c.hp.cur <= c.hp.max / 4);
  };
  const bump = (n) => {
    if (n < 0 && c.hp.temp > 0) { // damage chews temp HP first (5e)
      const eat = Math.min(c.hp.temp, -n);
      c.hp.temp -= eat;
      n += eat;
      hp.querySelector('.h-temp').value = c.hp.temp;
    }
    c.hp.cur = Math.max(0, Math.min(c.hp.max, c.hp.cur + n));
    save();
    drawHp();
  };
  hp.querySelector('.h-d5').onclick = () => bump(-5);
  hp.querySelector('.h-d1').onclick = () => bump(-1);
  hp.querySelector('.h-u1').onclick = () => bump(1);
  hp.querySelector('.h-u5').onclick = () => bump(5);
  const maxIn = hp.querySelector('.h-max'), tempIn = hp.querySelector('.h-temp');
  maxIn.value = c.hp.max;
  tempIn.value = c.hp.temp;
  maxIn.onchange = () => { c.hp.max = Math.max(1, Number(maxIn.value) || 1); c.hp.cur = Math.min(c.hp.cur, c.hp.max); save(); drawHp(); };
  tempIn.onchange = () => { c.hp.temp = Math.max(0, Number(tempIn.value) || 0); save(); drawHp(); };
  drawHp();
  host.appendChild(hp);

  /* ---- hit dice + death saves, side by side ---- */
  const duo = el('<div class="dnd-duo"></div>');
  const hd = el(`<div class="dnd-box"><span class="soft">Hit dice</span>
    <div class="row" style="gap:6px;align-items:center">
      <select class="select" style="width:70px;padding:3px 6px"></select>
      <b class="hd-left"></b>
      <button class="btn" style="font-size:0.76rem;padding:3px 9px">Spend</button>
    </div></div>`);
  const die = hd.querySelector('select');
  for (const d of ['d6', 'd8', 'd10', 'd12']) die.appendChild(new Option(d, d));
  die.value = c.hitDice.die || 'd8';
  die.onchange = () => { c.hitDice.die = die.value; save(); };
  const hdLeft = hd.querySelector('.hd-left');
  const drawHd = () => { hdLeft.textContent = `${Math.max(0, c.level - c.hitDice.used)} / ${c.level}`; };
  hd.querySelector('button').onclick = () => {
    if (c.hitDice.used >= c.level) return toast('No hit dice left — long rest restores half.', 'dice');
    c.hitDice.used++;
    const healed = rollFormula(widget, 'Hit die', `1${c.hitDice.die}${fmtMod(mod(c.abilities.con))}`);
    if (healed !== null) bump(Math.max(0, healed));
    save();
    drawHd();
  };
  drawHd();

  const ds = el(`<div class="dnd-box"><span class="soft">Death saves</span>
    <div class="row" style="gap:8px"><span class="dnd-pips ds-ok"></span><span class="dnd-pips ds-bad"></span>
    <button class="btn-icon" title="Reset">${icon('refresh', 13)}</button></div></div>`);
  const drawDs = () => {
    for (const [cls, key, sym] of [['.ds-ok', 'ok', '✓'], ['.ds-bad', 'bad', '✗']]) {
      const span = ds.querySelector(cls);
      span.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const p = el(`<button class="pip${i < c.deathSaves[key] ? ' on' : ''}${key === 'bad' ? ' bad' : ''}">${i < c.deathSaves[key] ? sym : ''}</button>`);
        p.onclick = () => { c.deathSaves[key] = i < c.deathSaves[key] ? i : i + 1; save(); drawDs(); };
        span.appendChild(p);
      }
    }
  };
  ds.querySelector('[title="Reset"]').onclick = () => { c.deathSaves = { ok: 0, bad: 0 }; save(); drawDs(); };
  drawDs();
  duo.append(hd, ds);
  host.appendChild(duo);

  /* ---- conditions ---- */
  const conds = el('<div class="row" style="flex-wrap:wrap;gap:5px;margin:10px 0"></div>');
  const drawConds = () => {
    conds.innerHTML = '';
    for (const cond of c.conditions) {
      const chip = el(`<button class="chip accent" title="Tap to clear">${cond.name}${cond.rounds ? ` · ${cond.rounds}r` : ''} ×</button>`);
      chip.onclick = () => { c.conditions.splice(c.conditions.indexOf(cond), 1); save(); drawConds(); };
      conds.appendChild(chip);
    }
    const add = el(`<button class="chip">${icon('plus', 11)} Condition</button>`);
    add.onclick = (e) => popMenu(e.currentTarget, CONDITIONS.filter(n => !c.conditions.some(x => x.name === n)).map(n => ({
      label: n, fn: () => { c.conditions.push({ name: n, rounds: 0 }); save(); drawConds(); }
    })));
    conds.appendChild(add);
  };
  drawConds();
  host.appendChild(conds);

  /* ---- attacks: tap to-hit → d20 roll · tap damage → formula roll ---- */
  const atkSec = el(`<div class="dnd-box" style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><span class="soft">Attacks</span><button class="btn-icon">${icon('plus', 14)}</button></div><div class="atk-list"></div></div>`);
  const atkList = atkSec.querySelector('.atk-list');
  const drawAtks = () => {
    atkList.innerHTML = '';
    if (!c.attacks.length) atkList.appendChild(el('<p class="soft" style="font-size:0.8rem;margin:4px 0">No attacks yet — add a sword, a bow, a cantrip…</p>'));
    for (const a of c.attacks) {
      const row = el(`<div class="list-item" style="cursor:default"><span class="li-main"><span class="li-title"></span></span>
        <button class="chip" title="Roll to hit"></button><button class="chip" title="Roll damage"></button>
        <button class="btn-icon" title="More">${icon('more', 13)}</button></div>`);
      row.querySelector('.li-title').textContent = a.name;
      const [hit, dmg] = row.querySelectorAll('.chip');
      hit.textContent = fmtMod(a.toHit);
      dmg.textContent = a.dmg;
      hit.onclick = () => rollD20(widget, `${a.name} attack`, a.toHit);
      dmg.onclick = () => rollFormula(widget, `${a.name} damage`, a.dmg);
      row.querySelector('[title="More"]').onclick = (e) => popMenu(e.currentTarget, [
        { label: 'Edit', iconName: 'edit', fn: () => editAttack(a) },
        { label: 'Remove', iconName: 'trash', danger: true, fn: () => { c.attacks.splice(c.attacks.indexOf(a), 1); save(); drawAtks(); } }
      ]);
      atkList.appendChild(row);
    }
  };
  const editAttack = (a = null) => {
    const d = openPanel({ title: a ? 'Edit attack' : 'New attack', iconName: 'zap' });
    const name = input(a?.name || '', 'Longsword');
    const toHit = el('<input class="input" type="number" placeholder="+5" style="margin-top:8px">');
    toHit.value = a ? a.toHit : '';
    const dmg = input(a?.dmg || '', '1d8+3');
    dmg.style.marginTop = '8px';
    const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Save</button>');
    ok.onclick = () => {
      if (!name.value.trim()) return;
      const data = { name: name.value.trim(), toHit: Number(toHit.value) || 0, dmg: dmg.value.trim() || '1d6' };
      if (a) Object.assign(a, data);
      else c.attacks.push(data);
      save();
      d.close();
      drawAtks();
    };
    d.body.append(name, toHit, dmg, ok);
    setTimeout(() => name.focus(), 150);
  };
  atkSec.querySelector('.btn-icon').onclick = () => editAttack();
  drawAtks();
  host.appendChild(atkSec);

  /* ---- resources: rage, ki, sorcery points… pips that rests refill ---- */
  const resSec = el(`<div class="dnd-box" style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><span class="soft">Resources</span><button class="btn-icon">${icon('plus', 14)}</button></div><div class="res-list"></div></div>`);
  const resList = resSec.querySelector('.res-list');
  const drawRes = () => {
    resList.innerHTML = '';
    for (const r of c.resources) {
      const row = el(`<div class="row" style="gap:8px;align-items:center;padding:4px 0"><span style="font-size:0.86rem;min-width:90px"></span><span class="dnd-pips grow"></span><button class="btn-icon" title="Remove">${icon('x', 12)}</button></div>`);
      row.querySelector('span').textContent = `${r.name} (${r.restore})`;
      const pips = row.querySelector('.dnd-pips');
      for (let i = 0; i < r.max; i++) {
        const p = el(`<button class="pip${i < r.max - r.used ? ' on' : ''}"></button>`);
        p.onclick = () => { const left = r.max - r.used; r.used = i < left ? r.max - i : r.max - i - 1; save(); drawRes(); };
        pips.appendChild(p);
      }
      row.querySelector('[title="Remove"]').onclick = () => { c.resources.splice(c.resources.indexOf(r), 1); save(); drawRes(); };
      resList.appendChild(row);
    }
    if (!c.resources.length) resList.appendChild(el('<p class="soft" style="font-size:0.8rem;margin:4px 0">Rage, ki, sorcery points, inspiration — anything with pips.</p>'));
  };
  resSec.querySelector('.btn-icon').onclick = () => {
    const d = openPanel({ title: 'New resource', iconName: 'zap' });
    const name = input('', 'Ki points');
    const max = el('<input class="input" type="number" placeholder="How many?" style="margin-top:8px">');
    let restore = 'long';
    const sg = seg([{ value: 'short', label: 'Short rest' }, { value: 'long', label: 'Long rest' }], 'long', (v) => { restore = v; });
    sg.style.marginTop = '8px';
    const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Add</button>');
    ok.onclick = () => {
      if (!name.value.trim() || !(Number(max.value) > 0)) return;
      c.resources.push({ name: name.value.trim(), max: Math.min(20, Number(max.value)), used: 0, restore });
      save();
      d.close();
      drawRes();
    };
    d.body.append(name, max, sg, ok);
  };
  drawRes();
  host.appendChild(resSec);

  /* ---- rests ---- */
  const rests = el(`<div class="row" style="gap:8px"><button class="btn grow">${icon('moon', 14)} Short rest</button><button class="btn btn-primary grow">${icon('sun', 14)} Long rest</button></div>`);
  const [shortB, longB] = rests.querySelectorAll('button');
  shortB.onclick = () => {
    for (const r of c.resources) if (r.restore === 'short') r.used = 0;
    save();
    rerender();
    toast('Short rest — short-rest resources refreshed. Spend hit dice to heal.', 'moon');
  };
  longB.onclick = () => {
    c.hp.cur = c.hp.max;
    c.hp.temp = 0;
    c.hitDice.used = Math.max(0, c.hitDice.used - Math.max(1, Math.floor(c.level / 2)));
    for (const r of c.resources) r.used = 0;
    for (const s of Object.values(c.slots)) s.used = 0;
    c.deathSaves = { ok: 0, bad: 0 };
    save();
    rerender();
    toast('Long rest — HP full, slots and resources restored.', 'sun');
  };
  host.appendChild(rests);
}
