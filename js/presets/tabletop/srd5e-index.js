/* 5e SRD aggregate index (CC-BY-4.0). One import surface for all SRD data
   plus a unified search used by the Compendium widget and the smart-lookup
   pickers on the Character Sheet, Spell Book, and Inventory. */

import { CLASSES, SPELL_SLOTS } from './srd5e-classes.js';
import { RACES, BACKGROUNDS } from './srd5e-races.js';
import { SPELLS } from './srd5e-spells.js';
import { WEAPONS, ARMOR, GEAR, MAGIC_ITEMS } from './srd5e-equipment.js';
import { MONSTERS, CR_XP } from './srd5e-monsters.js';
import { CONDITIONS } from './srd5e.js';

export { CLASSES, SPELL_SLOTS, RACES, BACKGROUNDS, SPELLS, WEAPONS, ARMOR, GEAR, MAGIC_ITEMS, MONSTERS, CR_XP, CONDITIONS };

const SCHOOL_FULL = {
  Abj: 'Abjuration', Con: 'Conjuration', Div: 'Divination', Enc: 'Enchantment',
  Evo: 'Evocation', Ill: 'Illusion', Nec: 'Necromancy', Tra: 'Transmutation'
};

/** Normalize a raw SPELLS tuple into a spell object usable everywhere. */
export function spellObj(row) {
  const [name, level, school, time, range, comps, duration, classes, text] = row;
  return {
    name, level, school: SCHOOL_FULL[school] || school, time, range, comps, duration,
    classes, text,
    concentration: /^concentration/i.test(duration),
    ritual: /ritual/i.test(time)
  };
}

/** All spells as normalized objects (cached). */
let _spells = null;
export function allSpells() {
  if (!_spells) _spells = SPELLS.map(spellObj);
  return _spells;
}

/** Spells available to a given class name. */
export function spellsForClass(className) {
  return allSpells().filter(s => s.classes.includes(className));
}

/** Lookup a class definition by name (case-insensitive). */
export function classByName(name) {
  return CLASSES.find(c => c.name.toLowerCase() === String(name).toLowerCase());
}
export function raceByName(name) {
  return RACES.find(r => r.name.toLowerCase() === String(name).toLowerCase());
}
export function backgroundByName(name) {
  return BACKGROUNDS.find(b => b.name.toLowerCase() === String(name).toLowerCase());
}

/** Spell slots for a class at a level. Returns an array [l1..l9] or null. */
export function slotsFor(className, level) {
  const cls = classByName(className);
  if (!cls?.spellcasting) return null;
  const table = SPELL_SLOTS[cls.spellcasting.type];
  if (!table) return null;
  return table[Math.max(0, Math.min(19, level - 1))];
}

/* ---------- unified compendium search ---------- */

/** A category descriptor: { id, label, icon, items: () => entry[] }.
    Each entry has at least { name } and a `kind` tag matching the category. */
export const COMPENDIUM = [
  { id: 'spells', label: 'Spells', icon: 'sparkles',
    items: () => allSpells().map(s => ({ ...s, kind: 'spell' })) },
  { id: 'monsters', label: 'Monsters', icon: 'shield',
    items: () => MONSTERS.map(m => ({ ...m, kind: 'monster' })) },
  { id: 'classes', label: 'Classes', icon: 'star',
    items: () => CLASSES.map(c => ({ ...c, kind: 'class' })) },
  { id: 'races', label: 'Races', icon: 'leaf',
    items: () => RACES.map(r => ({ ...r, kind: 'race' })) },
  { id: 'backgrounds', label: 'Backgrounds', icon: 'book',
    items: () => BACKGROUNDS.map(b => ({ ...b, kind: 'background' })) },
  { id: 'weapons', label: 'Weapons', icon: 'zap',
    items: () => WEAPONS.map(w => ({ ...w, kind: 'weapon' })) },
  { id: 'armor', label: 'Armor', icon: 'shield',
    items: () => ARMOR.map(a => ({ ...a, kind: 'armor' })) },
  { id: 'gear', label: 'Gear', icon: 'bag',
    items: () => GEAR.map(g => ({ ...g, kind: 'gear' })) },
  { id: 'items', label: 'Magic Items', icon: 'sparkles',
    items: () => MAGIC_ITEMS.map(m => ({ ...m, kind: 'magicitem' })) },
  { id: 'conditions', label: 'Conditions', icon: 'info',
    items: () => CONDITIONS.map(c => ({ ...c, kind: 'condition' })) }
];

/** Search across one category (or all) by a query string. */
export function searchCompendium(query, categoryId = null) {
  const q = String(query || '').trim().toLowerCase();
  const cats = categoryId ? COMPENDIUM.filter(c => c.id === categoryId) : COMPENDIUM;
  const out = [];
  for (const cat of cats) {
    for (const entry of cat.items()) {
      if (!q || entry.name.toLowerCase().includes(q)) out.push({ ...entry, _cat: cat.id });
    }
  }
  return out;
}
