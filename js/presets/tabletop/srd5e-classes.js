/* 5e SRD class data (CC-BY-4.0 Wizards of the Coast). Each class has its
   level table, proficiencies, and subclass options from the SRD. */

/** Spell slot table by class level. Row index = level-1. */
export const SPELL_SLOTS = {
  full: [ // Bard, Cleric, Druid, Sorcerer, Wizard
    [2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
    [4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
    [4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],
    [4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],
    [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]
  ],
  half: [ // Paladin, Ranger
    [0,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],
    [4,2,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
    [4,3,2,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],
    [4,3,3,1,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
    [4,3,3,3,1,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,0,0,0,0]
  ],
  warlock: [ // Warlock (pact magic — all slots are max level for tier)
    [1,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0],[0,2,0,0,0,0,0,0,0],[0,2,0,0,0,0,0,0,0],
    [0,0,2,0,0,0,0,0,0],[0,0,2,0,0,0,0,0,0],[0,0,0,2,0,0,0,0,0],[0,0,0,2,0,0,0,0,0],
    [0,0,0,0,2,0,0,0,0],[0,0,0,0,2,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],
    [0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],
    [0,0,0,0,4,0,0,0,0],[0,0,0,0,4,0,0,0,0],[0,0,0,0,4,0,0,0,0],[0,0,0,0,4,0,0,0,0]
  ]
};

export const CLASSES = [
  {
    name: 'Barbarian', hitDie: 'd12',
    primaryAbility: 'Strength',
    saves: ['str', 'con'],
    armorProfs: 'Light armor, medium armor, shields',
    weaponProfs: 'Simple weapons, martial weapons',
    tools: 'None',
    skillChoices: { from: ['Animal Handling','Athletics','Intimidation','Nature','Perception','Survival'], count: 2 },
    spellcasting: null,
    subclasses: [
      { name: 'Path of the Berserker', desc: 'Frenzy and Mindless Rage let you rampage without the cost of exhaustion (later). Channel pure fury.' },
      { name: 'Path of the Totem Warrior', desc: 'Draw spiritual power from Bear, Eagle, or Wolf totems for resilience, senses, or pack tactics.' }
    ],
    features: [
      { level: 1, name: 'Rage', desc: 'Bonus action. Advantage on STR checks/saves, bonus damage (+2/+3/+4), resistance to B/P/S damage. Ends if no attack made or taken.' },
      { level: 1, name: 'Unarmored Defense', desc: 'AC = 10 + DEX mod + CON mod when not wearing armor.' },
      { level: 2, name: 'Reckless Attack', desc: 'First attack each turn gains advantage; all attacks against you have advantage until your next turn.' },
      { level: 2, name: 'Danger Sense', desc: 'Advantage on DEX saves against effects you can see (traps, spells) — not if blinded/incapacitated.' },
      { level: 3, name: 'Primal Path', desc: 'Choose a subclass path.' },
      { level: 4, name: 'ASI', desc: 'Ability Score Improvement (+2 to one or +1 to two).' },
      { level: 5, name: 'Extra Attack', desc: 'Attack twice instead of once when you take the Attack action.' },
      { level: 5, name: 'Fast Movement', desc: 'Speed +10 ft when not wearing heavy armor.' },
      { level: 7, name: 'Feral Instinct', desc: 'Advantage on Initiative. Can act on surprise round if you rage immediately.' },
      { level: 9, name: 'Brutal Critical', desc: 'Roll one extra weapon damage die on a critical hit.' },
      { level: 11, name: 'Relentless Rage', desc: 'When reduced to 0 HP while raging, DC 10 CON save (+ 5 per use this rest) to stay at 1 HP instead.' },
      { level: 15, name: 'Persistent Rage', desc: 'Rage ends only if you fall unconscious or choose to end it.' },
      { level: 20, name: 'Primal Champion', desc: 'STR and CON each increase by 4 (max 24).' }
    ]
  },
  {
    name: 'Bard', hitDie: 'd8',
    primaryAbility: 'Charisma',
    saves: ['dex', 'cha'],
    armorProfs: 'Light armor',
    weaponProfs: 'Simple weapons, hand crossbows, longswords, rapiers, shortswords',
    tools: 'Three musical instruments of your choice',
    skillChoices: { from: 'any', count: 3 },
    spellcasting: { ability: 'cha', type: 'full', list: 'Bard', cantrips: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4] },
    subclasses: [
      { name: 'College of Lore', desc: 'Additional proficiencies, Cutting Words, and Magical Secrets from any class list.' },
      { name: 'College of Valor', desc: 'Martial training, Combat Inspiration (bonus to attack/damage/AC), Extra Attack at 6.' }
    ],
    features: [
      { level: 1, name: 'Bardic Inspiration', desc: 'Bonus action: grant a creature a d6 inspiration die to add to one roll. Uses = CHA mod (min 1), refreshes on long rest.' },
      { level: 2, name: 'Jack of All Trades', desc: 'Add half your proficiency bonus to any ability check you are not proficient in.' },
      { level: 2, name: 'Song of Rest', desc: 'During a short rest, creatures who hear you and spend hit dice regain extra HP (d6 at 2nd).' },
      { level: 3, name: 'Expertise', desc: 'Double proficiency bonus for two skills or tools you are proficient with.' },
      { level: 3, name: 'Bard College', desc: 'Choose a college subclass.' },
      { level: 4, name: 'ASI', desc: 'Ability Score Improvement.' },
      { level: 5, name: 'Font of Inspiration', desc: 'Regain all Bardic Inspiration uses on short or long rest.' },
      { level: 6, name: 'Countercharm', desc: 'Use your action to give nearby allies advantage vs. fear and charm until your next turn.' },
      { level: 10, name: 'Magical Secrets', desc: 'Learn two spells from any class list. Repeat at 14 and 18.' },
      { level: 20, name: 'Superior Inspiration', desc: 'If you have no Bardic Inspiration dice left, regain one when you roll Initiative.' }
    ]
  },
  {
    name: 'Cleric', hitDie: 'd8',
    primaryAbility: 'Wisdom',
    saves: ['wis', 'cha'],
    armorProfs: 'Light armor, medium armor, shields',
    weaponProfs: 'Simple weapons',
    tools: 'None',
    skillChoices: { from: ['History','Insight','Medicine','Persuasion','Religion'], count: 2 },
    spellcasting: { ability: 'wis', type: 'full', list: 'Cleric', prepares: true, cantrips: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5] },
    subclasses: [
      { name: 'Life Domain', desc: 'Heavy armor, healing bonus (Disciple of Life), Preserve Life channel, Mass Cure Wounds.' },
      { name: 'Light Domain', desc: 'Warding Flare, Radiance of the Dawn channel, Improved Flare, Corona of Light.' },
      { name: 'Trickery Domain', desc: 'Blessing of the Trickster, Invoke Duplicity channel, Cloak of Shadows, Divine Strike (poison).' },
      { name: 'Knowledge Domain', desc: 'Blessings of Knowledge (two languages + two skills expertise), Visions of the Past channel.' },
      { name: 'Nature Domain', desc: 'Acolyte of Nature, Charm Animals & Plants channel, Dampen Elements, Master of Nature.' },
      { name: 'Tempest Domain', desc: 'Heavy armor, Wrath of the Storm, Destructive Wrath channel, Thunderbolt Strike, Stormborn.' },
      { name: 'War Domain', desc: 'Heavy armor, War Priest (bonus attack), Guided Strike channel, War God\'s Blessing.' }
    ],
    features: [
      { level: 1, name: 'Spellcasting', desc: 'Prepare WIS mod + cleric level spells each day from the full Cleric list.' },
      { level: 1, name: 'Divine Domain', desc: 'Choose a domain subclass; gain bonus spells, armor, and features.' },
      { level: 2, name: 'Channel Divinity', desc: 'Once per rest, use a special channel power: Turn Undead (WIS save or flee for 1 min) or your domain power.' },
      { level: 5, name: 'Destroy Undead', desc: 'When you Turn Undead and the creature fails, it is destroyed if its CR is low enough (CR 1/2 at 5th).' },
      { level: 10, name: 'Divine Intervention', desc: 'Roll d100 ≤ cleric level; if successful, your deity intervenes with an effect of their choice.' },
      { level: 20, name: 'Divine Intervention (improved)', desc: 'Divine Intervention automatically succeeds.' }
    ]
  },
  {
    name: 'Druid', hitDie: 'd8',
    primaryAbility: 'Wisdom',
    saves: ['int', 'wis'],
    armorProfs: 'Light armor, medium armor, shields (non-metal)',
    weaponProfs: 'Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears',
    tools: 'Herbalism kit',
    skillChoices: { from: ['Arcana','Animal Handling','Insight','Medicine','Nature','Perception','Religion','Survival'], count: 2 },
    spellcasting: { ability: 'wis', type: 'full', list: 'Druid', prepares: true, cantrips: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4] },
    subclasses: [
      { name: 'Circle of the Land', desc: 'Bonus spells by terrain, Natural Recovery (regain spell slots on short rest), Nature\'s Ward.' },
      { name: 'Circle of the Moon', desc: 'Combat Wild Shape (bonus action, use spell slots to regain HP), Elemental Wild Shape at 10.' }
    ],
    features: [
      { level: 2, name: 'Wild Shape', desc: 'Transform into a beast (CR 1/4, no swim/fly at 2nd; CR 1/2 swim at 4th; CR 1 fly at 8th). 2/rest, lasts INT-mod hours.' },
      { level: 2, name: 'Druid Circle', desc: 'Choose a circle subclass.' },
      { level: 18, name: 'Timeless Body', desc: 'Age 10× slower; immune to aging magic.' },
      { level: 18, name: 'Beast Spells', desc: 'Cast spells while in Wild Shape form.' },
      { level: 20, name: 'Archdruid', desc: 'Unlimited Wild Shape uses.' }
    ]
  },
  {
    name: 'Fighter', hitDie: 'd10',
    primaryAbility: 'Strength or Dexterity',
    saves: ['str', 'con'],
    armorProfs: 'All armor, shields',
    weaponProfs: 'Simple weapons, martial weapons',
    tools: 'None',
    skillChoices: { from: ['Acrobatics','Animal Handling','Athletics','History','Insight','Intimidation','Perception','Survival'], count: 2 },
    spellcasting: null,
    subclasses: [
      { name: 'Champion', desc: 'Improved Critical (19-20), Remarkable Athlete, additional Fighting Style, Survivor (regen at low HP).' },
      { name: 'Battle Master', desc: 'Maneuvers (Superiority Dice d8), Combat Superiority, Know Your Enemy, Relentless.' },
      { name: 'Eldritch Knight', desc: 'Arcane spell slots (1/3 caster, INT), Weapon Bond, War Magic, Eldritch Strike, Arcane Charge.' }
    ],
    features: [
      { level: 1, name: 'Fighting Style', desc: 'Choose one: Archery (+2 ranged), Defense (+1 AC in armor), Dueling (+2 melee damage), Great Weapon (+reroll 1-2 on damage), Protection (impose disadvantage on adjacent attack), Two-Weapon (+ability mod to offhand).' },
      { level: 1, name: 'Second Wind', desc: 'Bonus action: regain 1d10 + fighter level HP. Once per short or long rest.' },
      { level: 2, name: 'Action Surge', desc: 'Take one additional action on your turn. 1/rest (2/rest at 17th).' },
      { level: 3, name: 'Martial Archetype', desc: 'Choose a subclass.' },
      { level: 4, name: 'ASI', desc: 'ASI at 4, 6, 8, 12, 14, 16, 19 (most of any class).' },
      { level: 5, name: 'Extra Attack', desc: 'Attack twice. Three attacks at 11th, four at 20th.' },
      { level: 9, name: 'Indomitable', desc: 'Reroll a failed saving throw (use result). 1/long rest (2 at 13th, 3 at 17th).' }
    ]
  },
  {
    name: 'Monk', hitDie: 'd8',
    primaryAbility: 'Dexterity & Wisdom',
    saves: ['str', 'dex'],
    armorProfs: 'None',
    weaponProfs: 'Simple weapons, shortswords',
    tools: 'One artisan\'s tool or musical instrument',
    skillChoices: { from: ['Acrobatics','Athletics','History','Insight','Religion','Stealth'], count: 2 },
    spellcasting: null,
    subclasses: [
      { name: 'Way of the Open Hand', desc: 'Open Hand Technique (knock prone, push, or deny reaction on Flurry), Wholeness of Body, Tranquility, Quivering Palm.' },
      { name: 'Way of Shadow', desc: 'Shadow Arts (minor illusion & darkness), Shadow Step, Cloak of Shadows, Shadow Strike.' },
      { name: 'Way of the Four Elements', desc: 'Spend ki to cast elemental discipline spells (water whip, fire wall, etc.).' }
    ],
    features: [
      { level: 1, name: 'Unarmored Defense', desc: 'AC = 10 + DEX mod + WIS mod when not wearing armor.' },
      { level: 1, name: 'Martial Arts', desc: 'Use DEX for monk weapon attacks; unarmed damage = 1d4 (scales to 1d10 at 17). Bonus action unarmed strike after attack action.' },
      { level: 2, name: 'Ki', desc: 'WIS mod + level ki points/rest. Flurry of Blows (2 ki: 2 bonus unarmed strikes), Patient Defense (1 ki: Dodge), Step of the Wind (1 ki: Dash/Disengage as bonus).' },
      { level: 2, name: 'Unarmored Movement', desc: 'Speed +10 ft (scales to +60 ft at 18th).' },
      { level: 3, name: 'Deflect Missiles', desc: 'Reaction: reduce ranged weapon damage by 1d10 + DEX + monk level. If reduced to 0, catch and throw it (1 ki).' },
      { level: 3, name: 'Monastic Tradition', desc: 'Choose a subclass.' },
      { level: 4, name: 'Slow Fall', desc: 'Reaction: reduce fall damage by 5 × monk level.' },
      { level: 5, name: 'Extra Attack', desc: 'Two attacks when you take the Attack action.' },
      { level: 5, name: 'Stunning Strike', desc: '1 ki after hitting: target makes CON save or is stunned until end of your next turn.' },
      { level: 6, name: 'Ki-Empowered Strikes', desc: 'Unarmed strikes count as magical.' },
      { level: 7, name: 'Evasion', desc: 'On a DEX save for half damage: take none on success, half on failure.' },
      { level: 10, name: 'Purity of Body', desc: 'Immune to disease and poison.' },
      { level: 13, name: 'Tongue of the Sun and Moon', desc: 'Understand and be understood in any spoken language.' },
      { level: 14, name: 'Diamond Soul', desc: 'Proficient in all saving throws. Spend 1 ki to reroll a failed save.' },
      { level: 15, name: 'Timeless Body', desc: 'No longer need food or water; age 10× slower.' },
      { level: 18, name: 'Empty Body', desc: '4 ki: invisible for 1 min with resistance to all damage except force. 8 ki: cast Astral Projection.' },
      { level: 20, name: 'Perfect Self', desc: 'Regain 4 ki when you roll Initiative with none remaining.' }
    ]
  },
  {
    name: 'Paladin', hitDie: 'd10',
    primaryAbility: 'Strength & Charisma',
    saves: ['wis', 'cha'],
    armorProfs: 'All armor, shields',
    weaponProfs: 'Simple weapons, martial weapons',
    tools: 'None',
    skillChoices: { from: ['Athletics','Insight','Intimidation','Medicine','Persuasion','Religion'], count: 2 },
    spellcasting: { ability: 'cha', type: 'half', list: 'Paladin', prepares: true },
    subclasses: [
      { name: 'Oath of Devotion', desc: 'Sacred Weapon and Turn the Unholy channels; Aura of Devotion; Holy Nimbus.' },
      { name: 'Oath of the Ancients', desc: 'Nature\'s Wrath and Turn the Faithless channels; Aura of Warding; Undying Sentinel.' },
      { name: 'Oath of Vengeance', desc: 'Abjure Enemy and Vow of Enmity channels; Relentless Avenger; Soul of Vengeance.' }
    ],
    features: [
      { level: 1, name: 'Divine Sense', desc: 'Detect the location of celestials, fiends, and undead within 60 ft. Uses = 1 + CHA mod/long rest.' },
      { level: 1, name: 'Lay on Hands', desc: 'Pool of 5 × paladin level HP. Action: restore HP or cure disease/poison (5 HP).' },
      { level: 2, name: 'Fighting Style', desc: 'Choose: Defense, Dueling, Great Weapon, or Protection.' },
      { level: 2, name: 'Divine Smite', desc: 'After a melee hit, expend a spell slot for 2d8 radiant damage (+ 1d8 per slot level above 1st, max 5d8). +1d8 vs undead/fiends.' },
      { level: 3, name: 'Divine Health', desc: 'Immune to disease.' },
      { level: 3, name: 'Sacred Oath', desc: 'Choose a subclass. Gain Channel Divinity (1/rest).' },
      { level: 5, name: 'Extra Attack', desc: 'Attack twice when you take the Attack action.' },
      { level: 6, name: 'Aura of Protection', desc: 'Allies within 10 ft (30 ft at 18th) add your CHA mod to saving throws.' },
      { level: 10, name: 'Aura of Courage', desc: 'Allies within 10 ft (30 ft at 18th) can\'t be frightened while you are conscious.' },
      { level: 11, name: 'Improved Divine Smite', desc: 'Your melee weapon attacks deal an extra 1d8 radiant damage always.' },
      { level: 14, name: 'Cleansing Touch', desc: 'Action: end one spell on yourself or a willing creature you touch. CHA mod times / long rest.' },
      { level: 20, name: 'Sacred Oath capstone', desc: 'Varies by oath (e.g. Holy Nimbus for Devotion: 10 ft aura of sunlight).' }
    ]
  },
  {
    name: 'Ranger', hitDie: 'd10',
    primaryAbility: 'Dexterity & Wisdom',
    saves: ['str', 'dex'],
    armorProfs: 'Light armor, medium armor, shields',
    weaponProfs: 'Simple weapons, martial weapons',
    tools: 'None',
    skillChoices: { from: ['Animal Handling','Athletics','Insight','Investigation','Nature','Perception','Stealth','Survival'], count: 3 },
    spellcasting: { ability: 'wis', type: 'half', list: 'Ranger' },
    subclasses: [
      { name: 'Hunter', desc: 'Colossus Slayer / Giant Killer / Horde Breaker at 3; Escape the Horde / Multiattack Defense at 7; Volley / Whirlwind Attack at 11; Evasion / Stand Against the Tide at 15.' },
      { name: 'Beast Master', desc: 'Ranger\'s Companion (beast acts on your turn), Exceptional Training (it can Dash/Disengage/Help as bonus), Bestial Fury (two attacks at 11).' }
    ],
    features: [
      { level: 1, name: 'Favored Enemy', desc: 'Advantage on Survival to track, and INT checks to recall info about, one creature type. Learn its language.' },
      { level: 1, name: 'Natural Explorer', desc: 'Choose a favored terrain. Expertise on INT/WIS checks, travel pace benefits, extra foraging, tracking.' },
      { level: 2, name: 'Fighting Style', desc: 'Choose: Archery, Defense, Dueling, or Two-Weapon Fighting.' },
      { level: 3, name: 'Ranger Archetype', desc: 'Choose a subclass.' },
      { level: 3, name: 'Primeval Awareness', desc: 'Expend one spell slot to sense the types of fiends/undead/etc. within 1 mile (6 miles in favored terrain).' },
      { level: 5, name: 'Extra Attack', desc: 'Attack twice when you take the Attack action.' },
      { level: 8, name: 'Land\'s Stride', desc: 'Move through nonmagical difficult terrain without cost; advantage vs. plant-based magical difficult terrain.' },
      { level: 10, name: 'Hide in Plain Sight', desc: 'Camouflage yourself (–10 to Perception checks against you while motionless).' },
      { level: 14, name: 'Vanish', desc: 'Hide as a bonus action; can\'t be tracked by nonmagical means.' },
      { level: 18, name: 'Feral Senses', desc: 'No penalty for attacking invisible creatures. Aware of invisible creatures within 30 ft.' },
      { level: 20, name: 'Foe Slayer', desc: 'Once per turn, add WIS mod to attack or damage roll against favored enemy.' }
    ]
  },
  {
    name: 'Rogue', hitDie: 'd8',
    primaryAbility: 'Dexterity',
    saves: ['dex', 'int'],
    armorProfs: 'Light armor',
    weaponProfs: 'Simple weapons, hand crossbows, longswords, rapiers, shortswords',
    tools: "Thieves' tools",
    skillChoices: { from: ['Acrobatics','Athletics','Deception','Insight','Intimidation','Investigation','Perception','Performance','Persuasion','Sleight of Hand','Stealth'], count: 4 },
    spellcasting: null,
    subclasses: [
      { name: 'Thief', desc: 'Fast Hands (Use Object as bonus action), Second-Story Work (climb at speed), Supreme Sneak, Use Magic Device, Thief\'s Reflexes.' },
      { name: 'Assassin', desc: 'Bonus proficiencies (disguise/poisoner kits), Assassinate (advantage vs. uninitiated), Infiltration Expertise, Impostor, Death Strike.' },
      { name: 'Arcane Trickster', desc: '1/3 Wizard spellcaster (INT), Mage Hand Legerdemain, Magical Ambush, Versatile Trickster, Spell Thief.' }
    ],
    features: [
      { level: 1, name: 'Expertise', desc: 'Double proficiency on two skills or thieves\' tools (two more at 6th).' },
      { level: 1, name: 'Sneak Attack', desc: 'Once per turn, add 1d6 per two rogue levels to one attack made with advantage or while an ally is adjacent to the target.' },
      { level: 1, name: "Thieves' Cant", desc: 'Secret language of the underworld plus coded signs.' },
      { level: 2, name: 'Cunning Action', desc: 'Bonus action: Dash, Disengage, or Hide.' },
      { level: 3, name: 'Roguish Archetype', desc: 'Choose a subclass.' },
      { level: 5, name: 'Uncanny Dodge', desc: 'Reaction: halve the damage from one attack you can see.' },
      { level: 7, name: 'Evasion', desc: 'DEX saves for half damage: take none on success, half on failure.' },
      { level: 11, name: 'Reliable Talent', desc: 'Any ability check with proficiency treats a roll of 9 or lower as a 10.' },
      { level: 14, name: 'Blindsense', desc: 'Aware of hidden or invisible creatures within 10 ft.' },
      { level: 15, name: 'Slippery Mind', desc: 'Proficiency in WIS saves.' },
      { level: 18, name: 'Elusive', desc: 'Attackers never have advantage on attacks against you while you are not incapacitated.' },
      { level: 20, name: 'Stroke of Luck', desc: 'Turn a missed attack into a hit or a failed ability check into a 20. 1/rest.' }
    ]
  },
  {
    name: 'Sorcerer', hitDie: 'd6',
    primaryAbility: 'Charisma',
    saves: ['con', 'cha'],
    armorProfs: 'None',
    weaponProfs: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    tools: 'None',
    skillChoices: { from: ['Arcana','Deception','Insight','Intimidation','Persuasion','Religion'], count: 2 },
    spellcasting: { ability: 'cha', type: 'full', list: 'Sorcerer', known: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15], cantrips: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6] },
    subclasses: [
      { name: 'Draconic Bloodline', desc: 'Dragon Ancestor (language + resistance), Draconic Resilience (+1 HP/level, scales AC to 13+DEX), Elemental Affinity, Dragon Wings, Draconic Presence.' },
      { name: 'Wild Magic Surge', desc: 'Random magic effects on spell cast, Tides of Chaos (advantage once/roll for surge after), Bend Luck (2 sorcery pts: change d4 of one creature\'s roll), Controlled Chaos, Spell Bombardment.' }
    ],
    features: [
      { level: 2, name: 'Font of Magic', desc: 'Sorcery points = sorcerer level. Convert: 1 sp = 1 slot level in cost (Flexible Casting), or convert a slot to sp.' },
      { level: 3, name: 'Metamagic', desc: '2 options at 3rd (2 more at 10th, 17th). Careful (save 1/slot lvl), Distant (double range), Empowered (reroll 1/slot lvl damage dice), Extended (double duration), Heightened (2 sp: target has disadvantage on 1st save), Quickened (2 sp: cast as bonus), Subtle (no V/S components), Twinned (1 sp/slot lvl: same spell on 2 targets).' },
      { level: 20, name: 'Sorcerous Restoration', desc: 'Regain 4 sorcery points on a short rest.' }
    ]
  },
  {
    name: 'Warlock', hitDie: 'd8',
    primaryAbility: 'Charisma',
    saves: ['wis', 'cha'],
    armorProfs: 'Light armor',
    weaponProfs: 'Simple weapons',
    tools: 'None',
    skillChoices: { from: ['Arcana','Deception','History','Intimidation','Investigation','Nature','Religion'], count: 2 },
    spellcasting: { ability: 'cha', type: 'warlock', list: 'Warlock', known: [2,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4], cantrips: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4] },
    subclasses: [
      { name: 'The Archfey', desc: 'Fey Presence (charm/frighten in 10 ft cube), Misty Escape (react: teleport 60 ft then turn invisible), Beguiling Defenses (immune to charm, reflect it), Dark Delirium (charm/frighten 1 min concentration).' },
      { name: 'The Fiend', desc: 'Dark One\'s Blessing (temp HP on kill), Dark One\'s Own Luck (add d10 once/rest), Fiendish Resilience (resistance choice), Hurl Through Hell (banish & deal 10d10 psychic on return).' },
      { name: 'The Great Old One', desc: 'Awakened Mind (telepathy 30 ft), Entropic Ward (react: impose disadvantage, advantage next), Thought Shield (resistance to psychic, mind-reader takes equal damage), Create Thrall.' }
    ],
    features: [
      { level: 1, name: 'Otherworldly Patron', desc: 'Choose a patron subclass.' },
      { level: 2, name: 'Eldritch Invocations', desc: '2 invocations at 2nd (more at higher levels): Agonizing Blast (+CHA to Eldritch Blast), Devil\'s Sight (darkvision 120 ft through magical darkness), Misty Visions (Silent Image at will), Repelling Blast (push 10 ft), etc.' },
      { level: 3, name: 'Pact Boon', desc: 'Pact of the Chain (familiar, plus special attacks), Pact of the Blade (create melee pact weapon, use CHA), Pact of the Tome (3 cantrips from any list, plus ritual casting).' },
      { level: 4, name: 'ASI', desc: 'Ability Score Improvement.' },
      { level: 11, name: 'Mystic Arcanum', desc: 'Cast one 6th-level spell without a slot 1/long rest. Additional slots at 13th (7th), 15th (8th), 17th (9th).' },
      { level: 20, name: 'Eldritch Master', desc: '1 minute to commune with your patron and regain all expended spell slots. 1/long rest.' }
    ]
  },
  {
    name: 'Wizard', hitDie: 'd6',
    primaryAbility: 'Intelligence',
    saves: ['int', 'wis'],
    armorProfs: 'None',
    weaponProfs: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    tools: 'None',
    skillChoices: { from: ['Arcana','History','Insight','Investigation','Medicine','Religion'], count: 2 },
    spellcasting: { ability: 'int', type: 'full', list: 'Wizard', prepares: true, cantrips: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5] },
    subclasses: [
      { name: 'School of Abjuration', desc: 'Abjuration Savant (half cost for abjuration scrolls), Arcane Ward (HP buffer from abjuration spells), Projected Ward, Improved Abjuration, Spell Resistance.' },
      { name: 'School of Conjuration', desc: 'Conjuration Savant, Minor Conjuration (small object), Benign Transposition (teleport or swap ally, 1/rest), Focused Conjuration (damage can\'t break concentration on conjuration), Durable Summons.' },
      { name: 'School of Divination', desc: 'Divination Savant, Portent (roll 2d20 each day, swap any roll), Expert Divination (regain slot ≤ half divination slot), The Third Eye, Greater Portent.' },
      { name: 'School of Enchantment', desc: 'Enchantment Savant, Hypnotic Gaze (1 action: charm 1 creature adjacent, WIS save each turn), Instinctive Charm (react: redirect attack to nearest creature), Split Enchantment, Alter Memories.' },
      { name: 'School of Evocation', desc: 'Evocation Savant, Sculpt Spells (exclude creatures from evocation AoE), Potent Cantrip (half damage on save), Empowered Evocation (+INT to evocation damage), Overchannel (maximize damage).' },
      { name: 'School of Illusion', desc: 'Illusion Savant, Improved Minor Illusion (sound + image combined), Malleable Illusions (change illusion on the fly), Illusory Self (react: impose disadvantage 1/rest), Illusory Reality (make one part real for 1 min).' },
      { name: 'School of Necromancy', desc: 'Necromancy Savant, Grim Harvest (regain HP when a non-undead creature dies from your spell), Undead Thralls (+proficiency bonus HP and damage to undead), Inured to Undeath (resistance to necrotic, max HP can\'t be reduced), Command Undead.' },
      { name: 'School of Transmutation', desc: 'Transmutation Savant, Minor Alchemy (transmute one material into another temporarily), Transmuter\'s Stone (benefit stone: darkvision/extra movement/proficiency CON/resistance), Shapechanger (polymorph to beast at will), Master Transmuter.' }
    ],
    features: [
      { level: 1, name: 'Spellcasting', desc: 'Spellbook: start with 6 spells, add 2 per level. Prepare INT mod + wizard level spells each day.' },
      { level: 1, name: 'Arcane Recovery', desc: 'Once per long rest, after a short rest: recover spell slots whose combined levels are ≤ half your wizard level.' },
      { level: 2, name: 'Arcane Tradition', desc: 'Choose a school subclass.' },
      { level: 18, name: 'Spell Mastery', desc: 'Choose one 1st-level and one 2nd-level spell; cast them at their lowest level without spending spell slots.' },
      { level: 20, name: 'Signature Spells', desc: 'Choose two 3rd-level wizard spells; always have them prepared and can cast them once each at 3rd level without a slot per short rest.' }
    ]
  }
];
