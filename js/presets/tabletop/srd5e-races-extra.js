/* Additional playable races, the Artificer class, and extra backgrounds.
   These are NOT part of the CC-BY SRD; each entry is a concise mechanical
   summary (ability bonuses + key traits) with its source book named — not the
   books' full descriptive text. Shapes match the SRD data so they render and
   apply identically. Users can add fully custom options via the Homebrew
   Workshop. */

export const EXTRA_RACES = [
  { name: 'Aasimar', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'cha', bonus: 2 }],
    traits: ['Celestial Resistance: resistance to necrotic and radiant damage.', 'Healing Hands: touch to heal HP equal to your level, once per long rest.', 'Light Bearer: you know the Light cantrip (CHA).'],
    languages: ['Common', 'Celestial'],
    subraces: [
      { name: 'Protector Aasimar', abilityBonuses: [{ ability: 'wis', bonus: 1 }], traits: ['Radiant Soul (3rd level): bonus action to sprout wings (30-ft fly) and add radiant damage, 1 min/long rest.'] },
      { name: 'Scourge Aasimar', abilityBonuses: [{ ability: 'con', bonus: 1 }], traits: ['Radiant Consumption (3rd level): emit searing light damaging nearby creatures and yourself.'] },
      { name: 'Fallen Aasimar', abilityBonuses: [{ ability: 'str', bonus: 1 }], traits: ['Necrotic Shroud (3rd level): frighten nearby foes and add necrotic damage.'] }
    ] },
  { name: 'Goliath', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'str', bonus: 2 }, { ability: 'con', bonus: 1 }],
    traits: ["Stone's Endurance: reaction to reduce damage by 1d12 + CON, once per short rest.", 'Powerful Build: count as one size larger for carrying capacity.', 'Mountain Born: resistance to cold; acclimated to high altitude.', 'Natural Athlete: proficient in Athletics.'],
    languages: ['Common', 'Giant'] },
  { name: 'Tabaxi', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'dex', bonus: 2 }, { ability: 'cha', bonus: 1 }],
    traits: ['Feline Agility: double your speed until you stop, once per move; recharges by staying still a turn.', "Cat's Claws: climb speed 20 ft and unarmed claws deal 1d4 slashing.", "Cat's Talent: proficient in Perception and Stealth."],
    languages: ['Common', 'one of your choice'] },
  { name: 'Firbolg', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'wis', bonus: 2 }, { ability: 'str', bonus: 1 }],
    traits: ['Firbolg Magic: cast Detect Magic and Disguise Self once per short rest (WIS).', 'Hidden Step: turn invisible as a bonus action until your next turn, once per short rest.', 'Powerful Build. Speech of Beast and Leaf: communicate simple ideas to beasts and plants.'],
    languages: ['Common', 'Elvish', 'Giant'] },
  { name: 'Kenku', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'dex', bonus: 2 }, { ability: 'wis', bonus: 1 }],
    traits: ['Expert Forgery: advantage on checks to duplicate objects or writing.', 'Kenku Training: proficient in two of Acrobatics, Deception, Stealth, Sleight of Hand.', 'Mimicry: imitate sounds and voices you have heard (Deception vs. Insight to detect).'],
    languages: ['Common (understood, spoken only via mimicry)', 'Auran'] },
  { name: 'Lizardfolk', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'con', bonus: 2 }, { ability: 'wis', bonus: 1 }],
    traits: ['Bite: natural weapon dealing 1d6 + STR piercing.', 'Natural Armor: AC 13 + DEX when unarmored.', 'Hold Breath: up to 15 minutes.', 'Cunning Artisan, Hunter\'s Lore, Hungry Jaws (bonus-action bite + temp HP once per short rest).'],
    languages: ['Common', 'Draconic'] },
  { name: 'Tortle', source: 'The Tortle Package', size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'str', bonus: 2 }, { ability: 'wis', bonus: 1 }],
    traits: ['Natural Armor: AC 17 (DEX does not affect it).', 'Shell Defense: withdraw into your shell as an action (+4 AC, prone, but can\'t act).', 'Hold Breath: up to 1 hour.', 'Claws: unarmed strikes deal 1d4 slashing.'],
    languages: ['Common', 'Aquan'] },
  { name: 'Aarakocra', source: "Elemental Evil Player's Companion", size: 'Medium', speed: 25, darkvision: 0,
    abilityBonuses: [{ ability: 'dex', bonus: 2 }, { ability: 'wis', bonus: 1 }],
    traits: ['Flight: 50-ft flying speed (no medium/heavy armor).', 'Talons: natural weapons dealing 1d4 + STR slashing.'],
    languages: ['Common', 'Aarakocra', 'Auran'] },
  { name: 'Genasi', source: "Elemental Evil Player's Companion", size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'con', bonus: 2 }],
    traits: ['Touched by the elemental planes; pick a subrace for your element.'],
    languages: ['Common', 'Primordial'],
    subraces: [
      { name: 'Air Genasi', abilityBonuses: [{ ability: 'dex', bonus: 1 }], traits: ['Unending Breath; cast Levitate once per long rest (CON).'] },
      { name: 'Earth Genasi', abilityBonuses: [{ ability: 'str', bonus: 1 }], traits: ['Walk across difficult earth/stone terrain freely; cast Pass without Trace once per long rest.'] },
      { name: 'Fire Genasi', abilityBonuses: [{ ability: 'int', bonus: 1 }], traits: ['Darkvision 60 ft; resistance to fire; Produce Flame cantrip; cast Burning Hands once per long rest.'] },
      { name: 'Water Genasi', abilityBonuses: [{ ability: 'wis', bonus: 1 }], traits: ['Swim 30 ft, amphibious; resistance to acid; Shape Water cantrip; cast Create or Destroy Water once per long rest.'] }
    ] },
  { name: 'Goblin', source: "Volo's Guide to Monsters", size: 'Small', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'dex', bonus: 2 }, { ability: 'con', bonus: 1 }],
    traits: ['Fury of the Small: once per short rest, add damage equal to your level against a bigger creature.', 'Nimble Escape: Disengage or Hide as a bonus action each turn.'],
    languages: ['Common', 'Goblin'] },
  { name: 'Hobgoblin', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'con', bonus: 2 }, { ability: 'int', bonus: 1 }],
    traits: ['Martial Training: proficient with two martial weapons and light armor.', 'Saving Face: once per short rest, add +1 per nearby ally (max +5) to a missed roll.'],
    languages: ['Common', 'Goblin'] },
  { name: 'Bugbear', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'str', bonus: 2 }, { ability: 'dex', bonus: 1 }],
    traits: ['Long-Limbed: +5 ft reach on melee attacks on your turn.', 'Powerful Build. Sneaky: proficient in Stealth.', 'Surprise Attack: +2d6 damage when you hit a surprised creature.'],
    languages: ['Common', 'Goblin'] },
  { name: 'Kobold', source: "Volo's Guide to Monsters", size: 'Small', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'dex', bonus: 2 }],
    traits: ['Pack Tactics: advantage on attacks when an ally is within 5 ft of the target.', 'Grovel, Cower, and Beg: a frantic display gives allies advantage once per short rest.', 'Sunlight Sensitivity: disadvantage in direct sunlight.'],
    languages: ['Common', 'Draconic'] },
  { name: 'Orc', source: 'Eberron: Rising from the Last War', size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'str', bonus: 2 }, { ability: 'con', bonus: 1 }],
    traits: ['Aggressive: bonus action to move up to your speed toward an enemy.', 'Powerful Build. Primal Intuition: proficient in two of several wilderness/social skills.'],
    languages: ['Common', 'Orc'] },
  { name: 'Yuan-ti Pureblood', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'cha', bonus: 2 }, { ability: 'int', bonus: 1 }],
    traits: ['Magic Resistance: advantage on saves vs. spells.', 'Poison Immunity: immune to poison damage and the poisoned condition.', 'Innate Spellcasting: Poison Spray, Animal Friendship (snakes at will), and Suggestion once per long rest (CHA).'],
    languages: ['Common', 'Abyssal', 'Draconic'] },
  { name: 'Triton', source: "Volo's Guide to Monsters", size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'str', bonus: 1 }, { ability: 'con', bonus: 1 }, { ability: 'cha', bonus: 1 }],
    traits: ['Amphibious; swim speed 30 ft.', 'Control Air and Water: cast Fog Cloud, then Gust of Wind (3rd), then Wall of Water (5th), each once per long rest.', 'Emissary of the Sea; Guardians of the Depths (resistance to cold).'],
    languages: ['Common', 'Primordial'] },
  { name: 'Warforged', source: 'Eberron: Rising from the Last War', size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'con', bonus: 2 }, { ability: 'any', bonus: 1 }],
    traits: ['Constructed Resilience: immune to disease, no need to eat/breathe/sleep; advantage vs. poison.', "Sentry's Rest: a 6-hour inactive but conscious long rest.", 'Integrated Protection: +1 AC; armor can\'t be removed against your will.', 'Specialized Design: one skill and one tool proficiency.'],
    languages: ['Common', 'one of your choice'] },
  { name: 'Changeling', source: 'Eberron: Rising from the Last War', size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'cha', bonus: 2 }, { ability: 'any', bonus: 1 }],
    traits: ['Shapechanger: change your appearance and voice as an action (any humanoid you can imagine).', 'Changeling Instincts: proficient in two of Deception, Insight, Intimidation, Persuasion.'],
    languages: ['Common', 'two of your choice'] }
];

export const EXTRA_CLASSES = [
  {
    name: 'Artificer', source: "Tasha's Cauldron of Everything", hitDie: 'd8',
    primaryAbility: 'Intelligence', saves: ['con', 'int'],
    armorProfs: 'Light and medium armor, shields',
    weaponProfs: 'Simple weapons',
    tools: "Thieves' tools, tinker's tools, one type of artisan's tools",
    skillChoices: { from: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Sleight of Hand'], count: 2 },
    spellcasting: { ability: 'int', type: 'half', list: 'Artificer', prepares: true },
    subclasses: [
      { name: 'Alchemist', desc: 'Brew Experimental Elixirs of healing and buffs; add INT to healing and acid/fire/necrotic/poison spell damage.' },
      { name: 'Artillerist', desc: 'Summon an Eldritch Cannon (flamethrower, force ballista, or protector) and gain a magical Arcane Firearm.' },
      { name: 'Battle Smith', desc: 'A loyal Steel Defender companion fights at your side; use INT for magic weapons (Battle Ready).' },
      { name: 'Armorer', desc: 'Turn armor into an arcane power suit (Guardian or Infiltrator model) with integrated weapons.' }
    ],
    features: [
      { level: 1, name: 'Magical Tinkering', desc: 'Imbue tiny objects with minor magical properties (light, message, sound, smell, or a picture).' },
      { level: 1, name: 'Spellcasting', desc: 'Prepare INT mod + half artificer level spells; you cast using tools as a spellcasting focus.' },
      { level: 2, name: 'Infuse Item', desc: 'Learn infusions (e.g. Enhanced Weapon, Bag of Holding, Replicate Magic Item) and apply them to gear after a rest.' },
      { level: 3, name: 'Artificer Specialist', desc: 'Choose a subclass (Alchemist, Artillerist, Battle Smith, or Armorer).' },
      { level: 3, name: 'The Right Tool for the Job', desc: 'Magically create one set of artisan\'s tools during a short or long rest.' },
      { level: 6, name: 'Tool Expertise', desc: 'Double your proficiency bonus for any tool you are proficient with.' },
      { level: 7, name: 'Flash of Genius', desc: 'Reaction: add your INT modifier to an ally\'s ability check or saving throw, INT-mod times per long rest.' },
      { level: 10, name: 'Magic Item Adept', desc: 'Attune to up to 4 magic items and craft common/uncommon items faster and cheaper.' },
      { level: 11, name: 'Spell-Storing Item', desc: 'Store a 1st- or 2nd-level spell in an object for others to cast.' },
      { level: 14, name: 'Magic Item Savant', desc: 'Attune to up to 5 items and ignore class/race/level requirements on them.' },
      { level: 18, name: 'Magic Item Master', desc: 'Attune to up to 6 magic items.' },
      { level: 20, name: 'Soul of Artifice', desc: '+1 to saves per attuned item; when reduced to 0 HP, end one infusion to drop to 1 HP instead.' }
    ]
  }
];

export const EXTRA_BACKGROUNDS = [
  { name: 'Haunted One', source: 'Curse of Strahd / Van Richten\'s Guide', skills: ['Choose two of Arcana, Investigation, Religion, Survival'], tools: 'None', languages: 'Two exotic of your choice', equipment: 'Monster hunter\'s pack, gothic trinket, common clothes', feature: 'Heart of Darkness: those who learn of your trauma feel pity; commoners will aid (if reluctantly) against the evil that haunts you.' },
  { name: 'Faction Agent', source: "Sword Coast Adventurer's Guide", skills: ['Insight', 'one Intelligence/Wisdom/Charisma skill of your choice'], tools: 'None', languages: 'Two of your choice', equipment: 'Faction badge, faction-cause pamphlet, ink and pen, common clothes, 15 gp', feature: 'Safe Haven: call on your faction for information, safe houses, and aid from fellow members.' },
  { name: 'Far Traveler', source: "Sword Coast Adventurer's Guide", skills: ['Insight', 'Perception'], tools: 'One musical instrument or gaming set', languages: 'One of your choice', equipment: 'Traveler\'s clothes, an instrument or gaming set, a maps-and-curios trinket, 5 gp', feature: 'All Eyes on You: your foreign manner draws curiosity and invitations; locals offer hospitality to learn about your homeland.' },
  { name: 'City Watch', source: "Sword Coast Adventurer's Guide", skills: ['Athletics', 'Insight'], tools: 'None', languages: 'Two of your choice', equipment: 'A uniform, a horn to summon aid, manacles, 10 gp', feature: 'Watcher\'s Eye: easily find the local watch-house or equivalent and expect cooperation from fellow lawkeepers.' },
  { name: 'Mercenary Veteran', source: "Sword Coast Adventurer's Guide", skills: ['Athletics', 'Persuasion'], tools: 'One gaming set, vehicles (land)', languages: 'None', equipment: 'A uniform, an insignia of your company, a gaming set, 10 gp', feature: 'Mercenary Life: know mercenary life and contacts; find work, identify companies by their gear, and know safe houses.' },
  { name: 'Knight', source: "Player's Handbook (Noble variant)", skills: ['History', 'Persuasion'], tools: 'One gaming set', languages: 'One of your choice', equipment: 'Fine clothes, a signet ring, a scroll of pedigree, a banner, 25 gp', feature: 'Retainers: three commoner retainers (e.g. a servant, a squire, and a guard) attend you.' },
  { name: 'Spy', source: "Player's Handbook (Criminal variant)", skills: ['Deception', 'Stealth'], tools: "One gaming set, thieves' tools", languages: 'None', equipment: 'A crowbar, dark common clothes with a hood, a belt pouch, 15 gp', feature: 'Criminal Contact: a reliable contact who acts as your liaison to a network of informants and criminals.' },
  { name: 'Cloistered Scholar', source: "Sword Coast Adventurer's Guide", skills: ['History', 'one of Arcana, Nature, or Religion'], tools: 'None', languages: 'Two of your choice', equipment: 'Scholar\'s robes, a writing kit, a borrowed book, 10 gp', feature: 'Library Access: free access to your institution\'s archives and the aid of its scholars and librarians.' }
];
