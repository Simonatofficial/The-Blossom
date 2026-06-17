/* Shared compendium rendering + picker (V2 §12e/§13). Renders a full detail
   view for any SRD entry (spell, monster, class, race, weapon, etc.) and
   provides openCompendiumPicker() — a searchable drawer used by the smart-add
   buttons on the Character Sheet, Spell Book, and Inventory. */

import { el, openPanel, seg } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import {
  COMPENDIUM, searchCompendium, classByName, slotsFor, spellsForClass
} from '../presets/tabletop/srd5e-index.js';

const ABBR = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const abilMod = (s) => Math.floor((s - 10) / 2);
const sgn = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** A short one-line subtitle for a list row. */
export function entrySubtitle(e) {
  switch (e.kind) {
    case 'spell': return `${e.level === 0 ? 'Cantrip' : `Lv ${e.level}`} · ${e.school}${e.concentration ? ' · Conc.' : ''}${e.ritual ? ' · Ritual' : ''}`;
    case 'monster': return `${e.size} ${e.type} · CR ${e.cr} · ${e.hp} HP · AC ${e.ac}`;
    case 'class': return `Hit die ${e.hitDie} · Saves ${e.saves.map(s => ABBR[s]).join(', ')}`;
    case 'race': return `${e.size} · Speed ${e.speed} ft${e.darkvision ? ` · Darkvision ${e.darkvision}` : ''}`;
    case 'background': return `Skills: ${e.skills.join(', ')}`;
    case 'weapon': return `${e.category} · ${e.damage} ${e.damageType} · ${e.cost}`;
    case 'armor': return `${e.category} · AC ${e.ac} · ${e.cost}`;
    case 'gear': return `${e.cost}${e.weight ? ` · ${e.weight} lb` : ''}`;
    case 'magicitem': return `${e.type} · ${e.rarity}${e.attunement ? ' · attunement' : ''}`;
    case 'feat': return e.prereq && e.prereq !== '—' ? `Feat · ${e.prereq}` : 'Feat';
    case 'rule': return 'Rule';
    case 'condition': return 'Condition';
    default: return '';
  }
}

/** Build a rich detail element for any entry. */
export function entryDetail(e) {
  const box = el('<div class="cmp-detail"></div>');
  const p = (html) => box.appendChild(el(`<p class="cmp-line">${html}</p>`));
  const h = (t) => box.appendChild(el(`<div class="cmp-sub">${t}</div>`));

  if (e.kind === 'spell') {
    p(`<b>${e.level === 0 ? 'Cantrip' : `Level ${e.level}`}</b> · ${e.school}`);
    p(`<b>Casting time:</b> ${e.time}`);
    p(`<b>Range:</b> ${e.range} &nbsp; <b>Components:</b> ${e.comps}`);
    p(`<b>Duration:</b> ${e.duration}`);
    p(`<b>Classes:</b> ${e.classes.join(', ')}`);
    box.appendChild(el(`<p class="cmp-text"></p>`)).textContent = e.text;
  } else if (e.kind === 'monster') {
    p(`<i>${e.size} ${e.type}, ${e.alignment}</i>`);
    p(`<b>AC</b> ${e.ac} &nbsp; <b>HP</b> ${e.hp} (${e.hd}) &nbsp; <b>Speed</b> ${e.speed}`);
    const stats = el('<div class="cmp-abilities"></div>');
    for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      stats.appendChild(el(`<div><span>${ABBR[k]}</span><b>${e[k]} (${sgn(abilMod(e[k]))})</b></div>`));
    }
    box.appendChild(stats);
    if (e.skills) p(`<b>Skills</b> ${e.skills}`);
    if (e.senses) p(`<b>Senses</b> ${e.senses}`);
    if (e.languages) p(`<b>Languages</b> ${e.languages}`);
    p(`<b>Challenge</b> ${e.cr} (${e.xp} XP)`);
    if (e.traits?.length) { h('Traits'); for (const t of e.traits) p(t); }
    if (e.actions?.length) { h('Actions'); for (const a of e.actions) p(a); }
  } else if (e.kind === 'class') {
    p(`<b>Hit die:</b> ${e.hitDie} &nbsp; <b>Primary:</b> ${e.primaryAbility}`);
    p(`<b>Saving throws:</b> ${e.saves.map(s => ABBR[s]).join(', ')}`);
    p(`<b>Armor:</b> ${e.armorProfs}`);
    p(`<b>Weapons:</b> ${e.weaponProfs}`);
    p(`<b>Tools:</b> ${e.tools}`);
    p(`<b>Skills:</b> choose ${e.skillChoices.count} from ${e.skillChoices.from === 'any' ? 'any' : e.skillChoices.from.join(', ')}`);
    if (e.spellcasting) p(`<b>Spellcasting:</b> ${ABBR[e.spellcasting.ability]}-based ${e.spellcasting.type} caster`);
    if (e.subclasses?.length) {
      h('Subclasses');
      for (const sc of e.subclasses) { box.appendChild(el(`<p class="cmp-line"><b>${sc.name}.</b> ${sc.desc}</p>`)); }
    }
    if (e.features?.length) {
      h('Features by level');
      for (const f of e.features) box.appendChild(el(`<p class="cmp-line"><b>Lv ${f.level} — ${f.name}.</b> ${f.desc}</p>`));
    }
  } else if (e.kind === 'race') {
    p(`<b>Size:</b> ${e.size} &nbsp; <b>Speed:</b> ${e.speed} ft${e.darkvision ? ` &nbsp; <b>Darkvision:</b> ${e.darkvision} ft` : ''}`);
    p(`<b>Ability bonuses:</b> ${e.abilityBonuses.map(b => `${(ABBR[b.ability] || b.ability)} +${b.bonus}`).join(', ')}`);
    p(`<b>Languages:</b> ${e.languages.join(', ')}`);
    if (e.traits?.length) { h('Traits'); for (const t of e.traits) p(t); }
    if (e.subraces?.length) {
      h('Subraces');
      for (const sr of e.subraces) box.appendChild(el(`<p class="cmp-line"><b>${sr.name}.</b> ${(sr.abilityBonuses || []).map(b => `${ABBR[b.ability] || b.ability} +${b.bonus}`).join(', ')}${sr.traits ? ' — ' + sr.traits.join(' ') : ''}</p>`));
    }
  } else if (e.kind === 'background') {
    p(`<b>Skills:</b> ${e.skills.join(', ')}`);
    p(`<b>Tools:</b> ${e.tools} &nbsp; <b>Languages:</b> ${e.languages}`);
    p(`<b>Equipment:</b> ${e.equipment}`);
    h('Feature'); p(e.feature);
  } else if (e.kind === 'weapon') {
    p(`<b>Category:</b> ${e.category}`);
    p(`<b>Damage:</b> ${e.damage} ${e.damageType}`);
    p(`<b>Properties:</b> ${e.props}`);
    p(`<b>Cost:</b> ${e.cost} &nbsp; <b>Weight:</b> ${e.weight} lb`);
  } else if (e.kind === 'armor') {
    p(`<b>Category:</b> ${e.category}`);
    p(`<b>Armor Class:</b> ${e.ac}`);
    if (e.strength) p(`<b>Strength:</b> ${e.strength}`);
    p(`<b>Stealth:</b> ${e.stealth}`);
    p(`<b>Cost:</b> ${e.cost} &nbsp; <b>Weight:</b> ${e.weight} lb`);
  } else if (e.kind === 'gear') {
    p(`<b>Cost:</b> ${e.cost}${e.weight ? ` &nbsp; <b>Weight:</b> ${e.weight} lb` : ''}`);
    box.appendChild(el('<p class="cmp-text"></p>')).textContent = e.desc;
  } else if (e.kind === 'magicitem') {
    p(`<i>${e.type}, ${e.rarity}${e.attunement ? ' (requires attunement)' : ''}</i>`);
    box.appendChild(el('<p class="cmp-text"></p>')).textContent = e.desc;
  } else if (e.kind === 'feat') {
    if (e.prereq && e.prereq !== '—') p(`<b>Prerequisite:</b> ${e.prereq}`);
    box.appendChild(el('<p class="cmp-text"></p>')).textContent = e.desc;
  } else if (e.kind === 'rule') {
    box.appendChild(el('<p class="cmp-text"></p>')).textContent = e.text;
  } else if (e.kind === 'condition') {
    box.appendChild(el('<p class="cmp-text"></p>')).textContent = e.effect;
  }
  if (e.source) box.appendChild(el(`<p class="cmp-src">Source: ${e.source}</p>`));
  return box;
}

/**
 * Open a searchable compendium picker.
 * @param {{title?:string, category?:string, onPick:(entry)=>void}} opts
 *   category: a COMPENDIUM id to lock the search to (e.g. 'spells'). Omit for all.
 */
export function openCompendiumPicker({ title = 'Compendium', category = null, onPick }) {
  const d = openPanel({ title, iconName: 'book' });
  const search = el('<input class="input" placeholder="Search…" autocomplete="off" style="margin-bottom:8px">');
  d.body.appendChild(search);

  // category filter row (only when not locked)
  let activeCat = category;
  if (!category) {
    const row = el('<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px"></div>');
    const mk = (id, label) => {
      const b = el(`<button class="chip${activeCat === id ? ' accent' : ''}">${label}</button>`);
      b.onclick = () => { activeCat = id; [...row.children].forEach(c => c.classList.remove('accent')); b.classList.add('accent'); draw(); };
      row.appendChild(b);
    };
    mk(null, 'All');
    for (const c of COMPENDIUM) mk(c.id, c.label);
    d.body.appendChild(row);
  }

  const list = el('<div class="cmp-list"></div>');
  d.body.appendChild(list);

  const draw = () => {
    list.innerHTML = '';
    const results = searchCompendium(search.value, activeCat).slice(0, 60);
    if (!results.length) { list.appendChild(el('<p class="soft" style="font-size:0.85rem;padding:8px">No matches.</p>')); return; }
    for (const e of results) {
      const row = el(`<button class="list-item" style="width:100%;text-align:left;cursor:pointer">
        <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
        ${onPick ? `<span class="chip" style="pointer-events:none">${icon('plus', 12)} Add</span>` : ''}</button>`);
      row.querySelector('.li-title').textContent = e.name;
      row.querySelector('.li-sub').textContent = entrySubtitle(e);
      row.onclick = () => { onPick ? onPick(e) : showDetail(e); };
      list.appendChild(row);
    }
  };

  const showDetail = (e) => {
    const dd = openPanel({ title: e.name, iconName: COMPENDIUM.find(c => c.id === e._cat)?.icon || 'book' });
    dd.body.appendChild(entryDetail(e));
  };

  search.oninput = draw;
  draw();
  setTimeout(() => search.focus(), 150);
  return d;
}

export { COMPENDIUM, slotsFor, classByName, spellsForClass };
