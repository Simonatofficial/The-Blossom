/* Homebrew form schemas (docs/14 §B). One field-driven form per compendium
   category; buildEntry() turns raw field values into an entry shaped exactly
   like the SRD data so entryDetail/entrySubtitle render it identically. */

const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

/* field: { key, label, type, options?, ph?, full? }
   types: text · num · textarea · bool · select · tags · lines · abilities · bonuses */
export const FORMS = {
  spells: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'level', label: 'Level (0 = cantrip)', type: 'num' },
    { key: 'school', label: 'School', type: 'select', options: SCHOOLS },
    { key: 'time', label: 'Casting time', type: 'text', ph: '1 action' },
    { key: 'range', label: 'Range', type: 'text', ph: '60 ft' },
    { key: 'comps', label: 'Components', type: 'text', ph: 'V, S, M' },
    { key: 'duration', label: 'Duration', type: 'text', ph: 'Instantaneous' },
    { key: 'classes', label: 'Classes', type: 'tags', ph: 'Wizard, Sorcerer' },
    { key: 'text', label: 'Description', type: 'textarea', full: true }
  ],
  monsters: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'size', label: 'Size', type: 'text', ph: 'Medium' },
    { key: 'type', label: 'Type', type: 'text', ph: 'Humanoid' },
    { key: 'alignment', label: 'Alignment', type: 'text', ph: 'neutral evil' },
    { key: 'ac', label: 'AC', type: 'num' },
    { key: 'hp', label: 'HP', type: 'num' },
    { key: 'hd', label: 'Hit dice', type: 'text', ph: '2d8+2' },
    { key: 'speed', label: 'Speed', type: 'text', ph: '30 ft' },
    { key: 'cr', label: 'CR', type: 'text', ph: '1/4' },
    { key: 'xp', label: 'XP', type: 'num' },
    { key: 'abilities', label: 'Ability scores', type: 'abilities', full: true },
    { key: 'skills', label: 'Skills', type: 'text', ph: 'Stealth +6' },
    { key: 'senses', label: 'Senses', type: 'text', ph: 'darkvision 60 ft' },
    { key: 'languages', label: 'Languages', type: 'text', ph: 'Common' },
    { key: 'traits', label: 'Traits (one per line)', type: 'lines', full: true },
    { key: 'actions', label: 'Actions (one per line)', type: 'lines', full: true }
  ],
  items: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'type', label: 'Type', type: 'text', ph: 'Wondrous item' },
    { key: 'rarity', label: 'Rarity', type: 'select', options: RARITIES },
    { key: 'attunement', label: 'Requires attunement', type: 'bool' },
    { key: 'desc', label: 'Description', type: 'textarea', full: true }
  ],
  weapons: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'category', label: 'Category', type: 'text', ph: 'Martial Melee' },
    { key: 'damage', label: 'Damage', type: 'text', ph: '1d8' },
    { key: 'damageType', label: 'Damage type', type: 'text', ph: 'slashing' },
    { key: 'props', label: 'Properties', type: 'text', ph: 'Versatile (1d10)' },
    { key: 'cost', label: 'Cost', type: 'text', ph: '15 gp' },
    { key: 'weight', label: 'Weight (lb)', type: 'num' }
  ],
  armor: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'category', label: 'Category', type: 'text', ph: 'Medium' },
    { key: 'ac', label: 'Armor Class', type: 'text', ph: '14 + DEX (max 2)' },
    { key: 'strength', label: 'Strength req.', type: 'text', ph: 'Str 13' },
    { key: 'stealth', label: 'Stealth', type: 'text', ph: 'Disadvantage' },
    { key: 'cost', label: 'Cost', type: 'text', ph: '50 gp' },
    { key: 'weight', label: 'Weight (lb)', type: 'num' }
  ],
  gear: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'cost', label: 'Cost', type: 'text', ph: '5 gp' },
    { key: 'weight', label: 'Weight (lb)', type: 'num' },
    { key: 'desc', label: 'Description', type: 'textarea', full: true }
  ],
  feats: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'prereq', label: 'Prerequisite', type: 'text', ph: '—' },
    { key: 'desc', label: 'Description', type: 'textarea', full: true }
  ],
  backgrounds: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'skills', label: 'Skill proficiencies', type: 'tags', ph: 'Insight, Religion' },
    { key: 'tools', label: 'Tools', type: 'text', ph: 'None' },
    { key: 'languages', label: 'Languages', type: 'text', ph: 'Two of your choice' },
    { key: 'equipment', label: 'Equipment', type: 'textarea', full: true },
    { key: 'feature', label: 'Feature', type: 'textarea', full: true }
  ],
  races: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'size', label: 'Size', type: 'text', ph: 'Medium' },
    { key: 'speed', label: 'Speed (ft)', type: 'num' },
    { key: 'darkvision', label: 'Darkvision (ft, 0 = none)', type: 'num' },
    { key: 'abilityBonuses', label: 'Ability bonuses', type: 'bonuses', ph: 'con +2, wis +1', full: true },
    { key: 'languages', label: 'Languages', type: 'tags', ph: 'Common, Elvish' },
    { key: 'traits', label: 'Traits (one per line)', type: 'lines', full: true }
  ],
  classes: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'hitDie', label: 'Hit die', type: 'text', ph: 'd8' },
    { key: 'primaryAbility', label: 'Primary ability', type: 'text', ph: 'Strength' },
    { key: 'saves', label: 'Saving throws', type: 'tags', ph: 'str, con' },
    { key: 'armorProfs', label: 'Armor proficiencies', type: 'text' },
    { key: 'weaponProfs', label: 'Weapon proficiencies', type: 'text' },
    { key: 'tools', label: 'Tools', type: 'text' },
    { key: 'skillCount', label: 'Number of skill choices', type: 'num' },
    { key: 'skillFrom', label: 'Skill list (blank = any)', type: 'tags' },
    { key: 'features', label: 'Features (one per line)', type: 'lines', full: true }
  ],
  tools: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'category', label: 'Category', type: 'text', ph: "Artisan's Tools" },
    { key: 'cost', label: 'Cost', type: 'text', ph: '10 gp' },
    { key: 'weight', label: 'Weight (lb)', type: 'num' },
    { key: 'desc', label: 'Description', type: 'textarea', full: true }
  ],
  mounts: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'category', label: 'Category', type: 'text', ph: 'Mount / Vehicle (land)' },
    { key: 'cost', label: 'Cost', type: 'text', ph: '75 gp' },
    { key: 'speed', label: 'Speed', type: 'text', ph: '60 ft' },
    { key: 'capacity', label: 'Carrying capacity', type: 'text', ph: '480 lb' },
    { key: 'desc', label: 'Description', type: 'textarea', full: true }
  ],
  languages: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'type', label: 'Type', type: 'select', options: ['Standard', 'Exotic', 'Exotic (secret)'] },
    { key: 'script', label: 'Script', type: 'text', ph: 'Common' },
    { key: 'speakers', label: 'Typical speakers', type: 'text' }
  ],
  poisons: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'type', label: 'Type', type: 'select', options: ['Ingested', 'Contact', 'Inhaled', 'Injury'] },
    { key: 'price', label: 'Price', type: 'text', ph: '200 gp' },
    { key: 'desc', label: 'Effect', type: 'textarea', full: true }
  ],
  conditions: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'effect', label: 'Effect', type: 'textarea', full: true }
  ],
  rules: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'text', label: 'Text', type: 'textarea', full: true }
  ]
};

export const CATEGORY_LABELS = {
  spells: 'Spell', monsters: 'Monster', items: 'Magic Item', weapons: 'Weapon',
  armor: 'Armor', gear: 'Gear', tools: 'Tool', mounts: 'Mount / Vehicle',
  languages: 'Language', poisons: 'Poison', feats: 'Feat', backgrounds: 'Background',
  races: 'Race', classes: 'Class', conditions: 'Condition', rules: 'Rule'
};

const parseBonuses = (s) => String(s || '').split(',').map(t => t.trim()).filter(Boolean).map(t => {
  const m = t.match(/([a-z]+)\s*([+-]?\d+)/i);
  return m ? { ability: m[1].toLowerCase().slice(0, 3), bonus: Number(m[2]) } : null;
}).filter(Boolean);
const fmtBonuses = (arr) => (arr || []).map(b => `${b.ability} ${b.bonus >= 0 ? '+' : ''}${b.bonus}`).join(', ');

/** Convert raw form values → a stored entry shaped for entryDetail. */
export function buildEntry(category, raw) {
  const e = {};
  for (const f of FORMS[category]) {
    const v = raw[f.key];
    if (f.type === 'abilities') { for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) e[k] = Number(raw[k]) || 10; }
    else if (f.type === 'bonuses') e.abilityBonuses = parseBonuses(v);
    else if (f.type === 'num') e[f.key] = Number(v) || 0;
    else if (f.type === 'bool') e[f.key] = !!v;
    else if (f.type === 'tags') e[f.key] = String(v || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (f.type === 'lines') e[f.key] = String(v || '').split('\n').map(s => s.trim()).filter(Boolean);
    else e[f.key] = (v ?? '').toString();
  }
  // category-specific derived fields so entryDetail renders correctly
  if (category === 'spells') { e.concentration = /concentration/i.test(e.duration || ''); e.ritual = /ritual/i.test(e.time || ''); }
  if (category === 'classes') {
    e.saves = (e.saves || []).map(s => s.toLowerCase().slice(0, 3));
    e.skillChoices = { count: Number(raw.skillCount) || 0, from: (raw.skillFrom && String(raw.skillFrom).trim()) ? String(raw.skillFrom).split(',').map(s => s.trim()).filter(Boolean) : 'any' };
    delete e.skillCount; delete e.skillFrom;
    e.subclasses = e.subclasses || [];
    e.features = (e.features || []).map(line => ({ level: 1, name: '', desc: line }));
    e.spellcasting = null;
  }
  return e;
}

/** Convert a stored entry → raw form values for editing. */
export function entryToRaw(category, entry = {}) {
  const raw = {};
  for (const f of FORMS[category]) {
    if (f.type === 'abilities') { for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) raw[k] = entry[k] ?? 10; }
    else if (f.type === 'bonuses') raw[f.key] = fmtBonuses(entry.abilityBonuses);
    else if (f.type === 'tags') raw[f.key] = Array.isArray(entry[f.key]) ? entry[f.key].join(', ') : (entry[f.key] || '');
    else if (f.type === 'lines') {
      if (f.key === 'features' && Array.isArray(entry.features)) raw[f.key] = entry.features.map(x => x.desc || x.name || x).join('\n');
      else raw[f.key] = Array.isArray(entry[f.key]) ? entry[f.key].join('\n') : (entry[f.key] || '');
    }
    else if (f.key === 'skillCount') raw[f.key] = entry.skillChoices?.count ?? '';
    else if (f.key === 'skillFrom') raw[f.key] = Array.isArray(entry.skillChoices?.from) ? entry.skillChoices.from.join(', ') : '';
    else raw[f.key] = entry[f.key] ?? '';
  }
  return raw;
}
