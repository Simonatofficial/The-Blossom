/* 5e SRD aggregate index (CC-BY-4.0). One import surface for all SRD data
   plus a unified search used by the Compendium widget and the smart-lookup
   pickers on the Character Sheet, Spell Book, and Inventory. */

import { CLASSES, SPELL_SLOTS } from './srd5e-classes.js';
import { RACES, BACKGROUNDS } from './srd5e-races.js';
import { SPELLS } from './srd5e-spells.js';
import { WEAPONS, ARMOR, GEAR, MAGIC_ITEMS, TOOLS, MOUNTS, LANGUAGES, POISONS, STANDARD_ARRAY, POINT_BUY_COST } from './srd5e-equipment.js';
import { MONSTERS, CR_XP } from './srd5e-monsters.js';
import { FEATS } from './srd5e-feats.js';
import { RULES } from './srd5e-rules.js';
import { CONDITIONS } from './srd5e.js';

export {
  CLASSES, SPELL_SLOTS, RACES, BACKGROUNDS, SPELLS, WEAPONS, ARMOR, GEAR, MAGIC_ITEMS,
  TOOLS, MOUNTS, LANGUAGES, POISONS, MONSTERS, CR_XP, FEATS, RULES, CONDITIONS, STANDARD_ARRAY, POINT_BUY_COST
};

/** Attach a default source to entries that don't carry their own. */
const withSrc = (arr, src) => arr.map(e => (e.source ? e : { ...e, source: src }));

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
    items: () => withSrc(allSpells(), 'SRD 5.1').map(s => ({ ...s, kind: 'spell' })) },
  { id: 'monsters', label: 'Monsters', icon: 'shield',
    items: () => withSrc(MONSTERS, 'SRD 5.1').map(m => ({ ...m, kind: 'monster' })) },
  { id: 'classes', label: 'Classes', icon: 'star',
    items: () => withSrc(CLASSES, 'SRD 5.1 / PHB').map(c => ({ ...c, kind: 'class' })) },
  { id: 'races', label: 'Races', icon: 'leaf',
    items: () => withSrc(RACES, 'SRD 5.1').map(r => ({ ...r, kind: 'race' })) },
  { id: 'backgrounds', label: 'Backgrounds', icon: 'book',
    items: () => withSrc(BACKGROUNDS, "SRD 5.1 / PHB").map(b => ({ ...b, kind: 'background' })) },
  { id: 'feats', label: 'Feats', icon: 'star',
    items: () => FEATS.map(f => ({ ...f, kind: 'feat' })) },
  { id: 'weapons', label: 'Weapons', icon: 'zap',
    items: () => withSrc(WEAPONS, 'SRD 5.1').map(w => ({ ...w, kind: 'weapon' })) },
  { id: 'armor', label: 'Armor', icon: 'shield',
    items: () => withSrc(ARMOR, 'SRD 5.1').map(a => ({ ...a, kind: 'armor' })) },
  { id: 'gear', label: 'Gear', icon: 'bag',
    items: () => withSrc(GEAR, 'SRD 5.1').map(g => ({ ...g, kind: 'gear' })) },
  { id: 'tools', label: 'Tools', icon: 'bag',
    items: () => withSrc(TOOLS, 'SRD 5.1').map(t => ({ ...t, kind: 'tool' })) },
  { id: 'mounts', label: 'Mounts', icon: 'move',
    items: () => withSrc(MOUNTS, 'SRD 5.1').map(m => ({ ...m, kind: 'mount' })) },
  { id: 'items', label: 'Magic Items', icon: 'sparkles',
    items: () => withSrc(MAGIC_ITEMS, 'SRD 5.1').map(m => ({ ...m, kind: 'magicitem' })) },
  { id: 'languages', label: 'Languages', icon: 'info',
    items: () => withSrc(LANGUAGES, 'SRD 5.1').map(l => ({ ...l, kind: 'language' })) },
  { id: 'poisons', label: 'Poisons', icon: 'info',
    items: () => withSrc(POISONS, 'SRD 5.1').map(p => ({ ...p, kind: 'poison' })) },
  { id: 'rules', label: 'Rules', icon: 'book',
    items: () => RULES.map(r => ({ ...r, kind: 'rule' })) },
  { id: 'conditions', label: 'Conditions', icon: 'info',
    items: () => withSrc(CONDITIONS, 'SRD 5.1').map(c => ({ ...c, kind: 'condition' })) }
];

/* Homebrew provider: the homebrew store injects a function that returns
   user-created entries already shaped like compendium entries (with `_cat`,
   `kind`, `name`, `source`, `homebrew: true`). Kept as an injected hook so this
   pure-data module never depends on the IndexedDB layer. */
let _homebrew = () => [];
export function setHomebrewProvider(fn) { _homebrew = typeof fn === 'function' ? fn : (() => []); }
export function homebrewEntries() { return _homebrew() || []; }

/** Total number of compendium entries (SRD + homebrew). */
export function compendiumTotal() {
  return COMPENDIUM.reduce((n, c) => n + c.items().length, 0) + homebrewEntries().length;
}

/** Search across one category (or all) by a query string. Includes homebrew.
    categoryId 'homebrew' returns only homebrew entries. */
export function searchCompendium(query, categoryId = null) {
  const q = String(query || '').trim().toLowerCase();
  const match = (e) => !q || (e.name || '').toLowerCase().includes(q);
  const out = [];
  if (categoryId !== 'homebrew') {
    const cats = categoryId ? COMPENDIUM.filter(c => c.id === categoryId) : COMPENDIUM;
    for (const cat of cats) {
      for (const entry of cat.items()) {
        if (match(entry)) out.push({ ...entry, _cat: cat.id });
      }
    }
  }
  // merge homebrew (all, the chosen category, or the dedicated 'homebrew' view)
  for (const hb of homebrewEntries()) {
    if (categoryId && categoryId !== 'homebrew' && hb._cat !== categoryId) continue;
    if (match(hb)) out.push(hb);
  }
  return out;
}
