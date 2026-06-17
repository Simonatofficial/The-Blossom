/* Shared character-build helpers (V2 §12e). Applies SRD class/race/background
   choices onto a character record and derives starting stats. Used by both the
   Character Sheet's "Build from SRD" button and the guided Character Creator. */

import { slotsFor } from '../presets/tabletop/srd5e-index.js';

export const SKILL_KEY = {
  'Acrobatics': 'acrobatics', 'Animal Handling': 'animal', 'Arcana': 'arcana', 'Athletics': 'athletics',
  'Deception': 'deception', 'History': 'history', 'Insight': 'insight', 'Intimidation': 'intimidation',
  'Investigation': 'investigation', 'Medicine': 'medicine', 'Nature': 'nature', 'Perception': 'perception',
  'Performance': 'performance', 'Persuasion': 'persuasion', 'Religion': 'religion', 'Sleight of Hand': 'sleight',
  'Stealth': 'stealth', 'Survival': 'survival'
};

export const abilMod = (s) => Math.floor(((Number(s) || 10) - 10) / 2);

/** Apply a chosen SRD class to a character: saves, hit die, spell slots. */
export function applyClass(c, cls) {
  c.cls = cls.name;
  c.saveProfs = [...new Set([...(c.saveProfs || []), ...cls.saves])];
  c.hitDice = { die: cls.hitDie, used: c.hitDice?.used || 0 };
  if (cls.spellcasting) {
    c.spellAbility = c.spellAbility || cls.spellcasting.ability;
    const slots = slotsFor(cls.name, c.level || 1);
    if (slots) {
      c.slots = c.slots || {};
      slots.forEach((max, i) => { if (max > 0) c.slots[i + 1] = { max, used: Math.min(c.slots[i + 1]?.used || 0, max) }; });
    }
  }
}

/** Apply a chosen SRD race: speed, darkvision senses, ability bonuses (once). */
export function applyRace(c, race) {
  const changed = c.race !== race.name;
  c.race = race.name;
  c.speed = race.speed;
  if (race.darkvision) c.senses = `Darkvision ${race.darkvision} ft`;
  if (changed) {
    for (const b of race.abilityBonuses || []) {
      if (c.abilities[b.ability] != null) c.abilities[b.ability] = Math.min(20, c.abilities[b.ability] + b.bonus);
    }
  }
}

/** Apply a chosen SRD background: its two skill proficiencies. */
export function applyBackground(c, bg) {
  c.background = bg.name;
  c.skillProfs = c.skillProfs || {};
  for (const s of bg.skills) { const k = SKILL_KEY[s]; if (k && !c.skillProfs[k]) c.skillProfs[k] = 1; }
}

/** Level-1 max HP = hit-die max + CON modifier. */
export function startingHp(cls, conScore) {
  const die = Number((cls?.hitDie || 'd8').slice(1)) || 8;
  return Math.max(1, die + abilMod(conScore));
}
