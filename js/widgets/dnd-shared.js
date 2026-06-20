/* D&D Character shared core (docs/08 §4): 5e tables and math, the anchor
   character record, and dice-roll helpers. ALL character data (the character
   object, items, spells, level plans) lives under the module's anchor
   CharacterSheet widget, so one 'wgt' Blossom code carries the whole
   character into a DM module's Players page. Other widgets on the module's
   pages resolve the anchor through the same sibling lookup World Builder
   uses, then read/write its objects. */

import { store } from '../core/store.js';
import { toast } from '../ui/components.js';
import { objectsOf, createObject } from './base.js';
import { siblingWidgets } from './wb-shared.js';

export const ABILITIES = [
  ['str', 'Strength'], ['dex', 'Dexterity'], ['con', 'Constitution'],
  ['int', 'Intelligence'], ['wis', 'Wisdom'], ['cha', 'Charisma']
];

export const SKILLS = [
  ['acrobatics', 'Acrobatics', 'dex'], ['animal', 'Animal Handling', 'wis'],
  ['arcana', 'Arcana', 'int'], ['athletics', 'Athletics', 'str'],
  ['deception', 'Deception', 'cha'], ['history', 'History', 'int'],
  ['insight', 'Insight', 'wis'], ['intimidation', 'Intimidation', 'cha'],
  ['investigation', 'Investigation', 'int'], ['medicine', 'Medicine', 'wis'],
  ['nature', 'Nature', 'int'], ['perception', 'Perception', 'wis'],
  ['performance', 'Performance', 'cha'], ['persuasion', 'Persuasion', 'cha'],
  ['religion', 'Religion', 'int'], ['sleight', 'Sleight of Hand', 'dex'],
  ['stealth', 'Stealth', 'dex'], ['survival', 'Survival', 'wis']
];

export const CONDITIONS = ['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'exhaustion'];

export const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

export const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
export const profBonus = (level) => Math.ceil((Number(level) || 1) / 4) + 1;
export const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** Skill/save bonus for a character. profs: 0 none · 1 proficient · 2 expertise. */
export function skillBonus(char, key) {
  const [, , ab] = SKILLS.find(s => s[0] === key);
  return mod(char.abilities[ab]) + (char.skillProfs?.[key] || 0) * profBonus(char.level);
}
export function saveBonus(char, ab) {
  return mod(char.abilities[ab]) + (char.saveProfs?.includes(ab) ? profBonus(char.level) : 0);
}

/* ---------- the anchor: one character per module ---------- */

const FRESH_CHARACTER = () => ({
  name: 'New adventurer', cls: '', subclass: '', level: 1, xp: 0,
  race: '', background: '', alignment: '', inspiration: false,
  stampId: null,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  saveProfs: [], skillProfs: {},
  ac: 10, autoAC: true, acMisc: 0, speed: 30, initMisc: 0, senses: '',
  hp: { cur: 10, max: 10, temp: 0 },
  hitDice: { die: 'd8', used: 0 },
  deathSaves: { ok: 0, bad: 0 },
  conditions: [],
  attacks: [],
  resources: [],
  features: [], // class features, racial traits, feats: {name, source, text}
  proficiencies: { armor: '', weapons: '', tools: '', languages: '' },
  appearance: { size: 'Medium', age: '', height: '', weight: '', eyes: '', skin: '', hair: '', faith: '' },
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  spellAbility: '', slots: {}, preparedLimit: 0,
  persona: { traits: '', ideals: '', bonds: '', flaws: '' },
  reputations: [],
  plans: [], levelLog: []
});

/** Character XP thresholds for levels 1–20 (5e DMG). */
export const XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** The module's anchor sheet widget (section 'sheet' wins, else first). */
export function anchorSheet(widget) {
  const sheets = siblingWidgets(widget, ['charsheet']);
  return sheets.find(w => w.config.section === 'sheet') || sheets[0] || widget;
}

/** Who owns this widget's character data: a self-contained sheet (an imported
    PC on a DM's table) owns its own; otherwise the module's shared anchor. */
export function ownerOf(widget) {
  return widget.config?.selfContained ? widget : anchorSheet(widget);
}

/** Spell save DC (8 + prof + ability mod) — null until a casting ability is set. */
export function spellSaveDC(c) {
  return c.spellAbility ? 8 + profBonus(c.level) + mod(c.abilities[c.spellAbility]) : null;
}
/** Spell attack bonus (prof + ability mod) — null until a casting ability is set. */
export function spellAttackBonus(c) {
  return c.spellAbility ? profBonus(c.level) + mod(c.abilities[c.spellAbility]) : null;
}

/** All character records owned by this widget's anchor. @returns {object[]} */
export function listCharacters(widget) {
  return objectsOf(ownerOf(widget).id, 'character');
}

/** Point the anchor at a specific character; all sibling widgets follow. */
export function setActiveCharacter(widget, id) {
  const owner = ownerOf(widget);
  owner.config = owner.config || {};
  owner.config.activeCharId = id;
  store.put('widgets', owner);
}

/** Create a fresh character (optionally pre-filled) and make it active. */
export function createCharacter(widget, data = null) {
  const owner = ownerOf(widget);
  const obj = createObject(owner.id, 'character', { ...FRESH_CHARACTER(), ...(data || {}) });
  setActiveCharacter(widget, obj.id);
  return { owner, obj, c: obj.data };
}

/** Resolve (and lazily create) the active character record. @returns {{owner, obj, c}} */
export function getCharacter(widget) {
  const owner = ownerOf(widget);
  const all = objectsOf(owner.id, 'character');
  const activeId = owner.config?.activeCharId;
  let obj = (activeId && all.find(o => o.id === activeId)) || all[0] || null;
  if (!obj) obj = createObject(owner.id, 'character', FRESH_CHARACTER());
  if (owner.config?.activeCharId !== obj.id) {
    owner.config = owner.config || {};
    owner.config.activeCharId = obj.id; // keep the pointer valid
    store.put('widgets', owner);
  }
  for (const [k, v] of Object.entries(FRESH_CHARACTER())) {
    if (obj.data[k] === undefined) obj.data[k] = v; // older saves grow new fields
  }
  return { owner, obj, c: obj.data };
}

/* ---------- equipment linking (docs/14 §C) ---------- */

/** Parse an SRD armor entry into a compact AC rule stored on an item. */
export function parseArmorAC(entry) {
  const ac = String(entry?.ac || '').trim();
  if (entry?.category === 'Shield' || ac.startsWith('+')) {
    return { kind: 'shield', bonus: Math.abs(Number(ac.replace(/[^\d-]/g, '')) || 2) };
  }
  const base = parseInt(ac, 10) || 10;
  const hasDex = /dex/i.test(ac);
  const maxM = ac.match(/max\s*(\d+)/i);
  return { kind: 'body', base, dexCap: hasDex ? (maxM ? Number(maxM[1]) : 99) : 0 };
}

/** Compute AC from a character's equipped armor items (CR: armor → AC). */
export function computeAC(c, items) {
  const dex = mod(c.abilities.dex);
  let body = null, shield = 0;
  for (const it of items) {
    const a = it.data?.armor;
    if (!it.data?.equipped || !a) continue;
    if (a.kind === 'shield') shield += a.bonus || 2;
    else body = a; // a later-equipped body armor wins
  }
  const base = body ? body.base + Math.min(dex, body.dexCap) : 10 + dex; // unarmored
  return base + shield + (c.acMisc || 0);
}

/** The character's effective AC — auto from equipped armor, or the manual value. */
export function effectiveAC(widget) {
  const { owner, c } = getCharacter(widget);
  if (c.autoAC === false) return c.ac;
  return computeAC(c, objectsOf(owner.id, 'item'));
}

/** Build a tap-to-roll attack {name, toHit, dmg} from an SRD weapon entry. */
export function weaponToAttack(c, w, name = null) {
  const isRanged = /ranged/i.test(w.category || '');
  const isFinesse = /finesse/i.test(w.props || '');
  const str = mod(c.abilities.str), dex = mod(c.abilities.dex);
  const abil = isRanged ? dex : isFinesse ? Math.max(str, dex) : str;
  const toHit = profBonus(c.level) + abil;
  const dmg = `${w.damage || '1d4'}${abil ? fmtMod(abil) : ''}`;
  return { name: name || w.name, toHit, dmg };
}

export function saveCharacter(obj) {
  store.put('objects', obj);
}

/* ---------- rolling (result toast + the sibling Dice widget's history) ---------- */

function logToDice(widget, formula, total) {
  const dice = siblingWidgets(widget, ['dice'])[0];
  if (!dice) return;
  dice.config.history = [{ formula, total }, ...(dice.config.history || [])].slice(0, 12);
  store.put('widgets', dice);
}

/** d20 + modifier with a result toast. @returns {number} total */
export function rollD20(widget, label, modifier) {
  const die = 1 + Math.floor(Math.random() * 20);
  const total = die + modifier;
  const flavor = die === 20 ? ' — natural 20!' : die === 1 ? ' — natural 1…' : '';
  toast(`${label}: ${total}  (d20 ${die} ${fmtMod(modifier)})${flavor}`, 'dice');
  logToDice(widget, `${label} d20${fmtMod(modifier)}`, total);
  return total;
}

/** Roll a damage-style formula: terms of NdM and flat numbers (2d6+1d4+3). */
export function rollFormula(widget, label, formula) {
  const terms = String(formula).replace(/\s/g, '').match(/[+-]?[^+-]+/g) || [];
  let total = 0;
  const parts = [];
  for (const t of terms) {
    const sign = t.startsWith('-') ? -1 : 1;
    const body = t.replace(/^[+-]/, '');
    const dm = body.match(/^(\d*)d(\d+)$/i);
    if (dm) {
      const n = Math.min(40, Number(dm[1] || 1));
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * Number(dm[2])));
      total += sign * rolls.reduce((a, b) => a + b, 0);
      parts.push(rolls.join('+'));
    } else if (/^\d+$/.test(body)) {
      total += sign * Number(body);
      parts.push(body);
    } else {
      toast('Formula reads like 1d8+3 (or 2d6+1d4+2).', 'dice');
      return null;
    }
  }
  if (!terms.length) return null;
  toast(`${label}: ${total}  (${parts.join(' + ')})`, 'dice');
  logToDice(widget, `${label} ${formula}`, total);
  return total;
}
