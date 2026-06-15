/* 5e SRD reference data (V2 §13). The 5e System Reference Document is licensed
   CC-BY-4.0 by Wizards of the Coast; these condensed tables are embedded so
   Tabletop widgets can show system-accurate rules offline. Summaries are
   paraphrased for brevity. */

export const ABILITIES = [
  { key: 'str', name: 'Strength' }, { key: 'dex', name: 'Dexterity' }, { key: 'con', name: 'Constitution' },
  { key: 'int', name: 'Intelligence' }, { key: 'wis', name: 'Wisdom' }, { key: 'cha', name: 'Charisma' }
];

/** Skill → governing ability (5e SRD). */
export const SKILLS = [
  ['Acrobatics', 'dex'], ['Animal Handling', 'wis'], ['Arcana', 'int'], ['Athletics', 'str'],
  ['Deception', 'cha'], ['History', 'int'], ['Insight', 'wis'], ['Intimidation', 'cha'],
  ['Investigation', 'int'], ['Medicine', 'wis'], ['Nature', 'int'], ['Perception', 'wis'],
  ['Performance', 'cha'], ['Persuasion', 'cha'], ['Religion', 'int'], ['Sleight of Hand', 'dex'],
  ['Stealth', 'dex'], ['Survival', 'wis']
].map(([name, ability]) => ({ name, ability }));

/** The 5e conditions, with paraphrased effects. */
export const CONDITIONS = [
  { name: 'Blinded', effect: 'Can’t see; auto-fails sight checks. Attacks against it have advantage; its attacks have disadvantage.' },
  { name: 'Charmed', effect: 'Can’t attack the charmer or target it with harmful effects; the charmer has advantage on social checks with it.' },
  { name: 'Deafened', effect: 'Can’t hear; auto-fails hearing checks.' },
  { name: 'Frightened', effect: 'Disadvantage on checks and attacks while the source is in line of sight; can’t willingly move closer to it.' },
  { name: 'Grappled', effect: 'Speed 0; ends if the grappler is incapacitated or moved away.' },
  { name: 'Incapacitated', effect: 'Can’t take actions or reactions.' },
  { name: 'Invisible', effect: 'Heavily obscured for hiding. Attacks against it have disadvantage; its attacks have advantage.' },
  { name: 'Paralyzed', effect: 'Incapacitated; can’t move/speak; auto-fails STR & DEX saves. Attacks have advantage; hits within 5 ft are crits.' },
  { name: 'Petrified', effect: 'Turned to stone: incapacitated, unaware, weight ×10, resistant to all damage, immune to poison/disease.' },
  { name: 'Poisoned', effect: 'Disadvantage on attack rolls and ability checks.' },
  { name: 'Prone', effect: 'Can only crawl; disadvantage on attacks. Melee attacks against it have advantage; ranged have disadvantage.' },
  { name: 'Restrained', effect: 'Speed 0; attacks against it have advantage, its attacks have disadvantage; disadvantage on DEX saves.' },
  { name: 'Stunned', effect: 'Incapacitated; can’t move; auto-fails STR & DEX saves. Attacks against it have advantage.' },
  { name: 'Unconscious', effect: 'Incapacitated, prone, unaware; drops what it holds; auto-fails STR & DEX saves. Hits within 5 ft are crits.' },
  { name: 'Exhaustion', effect: '1: disadvantage on checks · 2: speed halved · 3: disadvantage on attacks & saves · 4: HP max halved · 5: speed 0 · 6: death.' }
];

/** Encounter difficulty XP thresholds per character level (5e DMG). */
export const XP_THRESHOLDS = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800]
};
