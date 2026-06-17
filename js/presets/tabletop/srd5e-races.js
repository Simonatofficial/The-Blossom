/* 5e SRD race & background data (CC-BY-4.0 Wizards of the Coast). */

export const RACES = [
  {
    name: 'Dwarf', size: 'Medium', speed: 25, darkvision: 60,
    abilityBonuses: [{ ability: 'con', bonus: 2 }],
    traits: [
      'Dwarven Resilience: advantage on poison saves, resistance to poison damage.',
      'Dwarven Combat Training: proficient with battleaxe, handaxe, light hammer, warhammer.',
      'Tool Proficiency: one type of artisan\'s tools.',
      'Stonecunning: add double proficiency to History checks about stonework.'
    ],
    languages: ['Common', 'Dwarvish'],
    subraces: [
      {
        name: 'Hill Dwarf',
        abilityBonuses: [{ ability: 'wis', bonus: 1 }],
        traits: ['Dwarven Toughness: +1 max HP per level.']
      },
      {
        name: 'Mountain Dwarf',
        abilityBonuses: [{ ability: 'str', bonus: 2 }],
        traits: ['Dwarven Armor Training: proficient with light and medium armor.']
      }
    ]
  },
  {
    name: 'Elf', size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'dex', bonus: 2 }],
    traits: [
      'Keen Senses: proficient in Perception.',
      'Fey Ancestry: advantage vs. charm; immune to magic sleep.',
      'Trance: meditate 4 hours instead of sleeping; fully rested.'
    ],
    languages: ['Common', 'Elvish'],
    subraces: [
      {
        name: 'High Elf',
        abilityBonuses: [{ ability: 'int', bonus: 1 }],
        traits: ['Elf Weapon Training: longsword, shortsword, shortbow, longbow proficiency.', 'Cantrip: one wizard cantrip (INT-based).', 'Extra Language: one of your choice.']
      },
      {
        name: 'Wood Elf',
        speed: 35,
        abilityBonuses: [{ ability: 'wis', bonus: 1 }],
        traits: ['Elf Weapon Training: longsword, shortsword, shortbow, longbow proficiency.', 'Fleet of Foot: speed 35 ft.', 'Mask of the Wild: hide when obscured by natural phenomena.']
      },
      {
        name: 'Dark Elf (Drow)',
        darkvision: 120,
        abilityBonuses: [{ ability: 'cha', bonus: 1 }],
        traits: ['Superior Darkvision: 120 ft.', 'Sunlight Sensitivity: disadvantage on attacks and Perception in sunlight.', 'Drow Magic: Dancing Lights at will; Faerie Fire and Darkness 1/long rest (CHA).', 'Drow Weapon Training: rapier, shortsword, hand crossbow proficiency.']
      }
    ]
  },
  {
    name: 'Halfling', size: 'Small', speed: 25, darkvision: 0,
    abilityBonuses: [{ ability: 'dex', bonus: 2 }],
    traits: [
      'Lucky: reroll any natural 1 on attack, ability check, or save; must use new roll.',
      'Brave: advantage on saves vs. fear.',
      'Halfling Nimbleness: move through space of any creature larger than you.'
    ],
    languages: ['Common', 'Halfling'],
    subraces: [
      {
        name: 'Lightfoot',
        abilityBonuses: [{ ability: 'cha', bonus: 1 }],
        traits: ['Naturally Stealthy: hide behind creatures one size larger.']
      },
      {
        name: 'Stout',
        abilityBonuses: [{ ability: 'con', bonus: 1 }],
        traits: ['Stout Resilience: advantage on saves vs. poison, resistance to poison damage.']
      }
    ]
  },
  {
    name: 'Human', size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [
      { ability: 'str', bonus: 1 }, { ability: 'dex', bonus: 1 }, { ability: 'con', bonus: 1 },
      { ability: 'int', bonus: 1 }, { ability: 'wis', bonus: 1 }, { ability: 'cha', bonus: 1 }
    ],
    traits: ['Extra Language: one of your choice.'],
    languages: ['Common', 'one extra'],
    subraces: []
  },
  {
    name: 'Dragonborn', size: 'Medium', speed: 30, darkvision: 0,
    abilityBonuses: [{ ability: 'str', bonus: 2 }, { ability: 'cha', bonus: 1 }],
    traits: [
      'Draconic Ancestry: choose a dragon type for your breath weapon damage type and resistance.',
      'Breath Weapon: 2d6 damage in line or cone (DEX or CON save, DC 8 + CON + prof). 1/rest.',
      'Damage Resistance: resistance to your ancestry\'s damage type.'
    ],
    languages: ['Common', 'Draconic'],
    subraces: []
  },
  {
    name: 'Gnome', size: 'Small', speed: 25, darkvision: 60,
    abilityBonuses: [{ ability: 'int', bonus: 2 }],
    traits: [
      'Gnome Cunning: advantage on INT, WIS, and CHA saves vs. magic.'
    ],
    languages: ['Common', 'Gnomish'],
    subraces: [
      {
        name: 'Forest Gnome',
        abilityBonuses: [{ ability: 'dex', bonus: 1 }],
        traits: ['Natural Illusionist: Minor Illusion cantrip (INT).', 'Speak with Small Beasts: simple ideas with Tiny/Small beasts.']
      },
      {
        name: 'Rock Gnome',
        abilityBonuses: [{ ability: 'con', bonus: 1 }],
        traits: ["Artificer's Lore: double proficiency on History checks about magic items, alchemical objects, or tech.", "Tinker: construct Tiny clockwork devices (fire starter, music box, toy)."]
      }
    ]
  },
  {
    name: 'Half-Elf', size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'cha', bonus: 2 }, { ability: 'any1', bonus: 1 }, { ability: 'any2', bonus: 1 }],
    traits: [
      'Fey Ancestry: advantage vs. charm; immune to magic sleep.',
      'Skill Versatility: proficiency in two skills of your choice.'
    ],
    languages: ['Common', 'Elvish', 'one extra'],
    subraces: []
  },
  {
    name: 'Half-Orc', size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'str', bonus: 2 }, { ability: 'con', bonus: 1 }],
    traits: [
      'Menacing: proficient in Intimidation.',
      'Relentless Endurance: when reduced to 0 HP, drop to 1 HP instead. 1/long rest.',
      'Savage Attacks: on a critical hit with a melee weapon, roll one extra damage die.'
    ],
    languages: ['Common', 'Orc'],
    subraces: []
  },
  {
    name: 'Tiefling', size: 'Medium', speed: 30, darkvision: 60,
    abilityBonuses: [{ ability: 'int', bonus: 1 }, { ability: 'cha', bonus: 2 }],
    traits: [
      'Hellish Resistance: resistance to fire damage.',
      'Infernal Legacy: Thaumaturgy cantrip; Hellish Rebuke 1/long rest at 3rd (INT-based); Darkness 1/long rest at 5th.'
    ],
    languages: ['Common', 'Infernal'],
    subraces: []
  }
];

export const BACKGROUNDS = [
  {
    name: 'Acolyte',
    skills: ['Insight', 'Religion'],
    tools: 'None', languages: 'Two of your choice',
    equipment: 'Holy symbol, prayer book, 5 sticks incense, vestments, common clothes, 15 gp',
    feature: 'Shelter of the Faithful: free room and board at temples of your faith; network of contacts among clergy.'
  },
  {
    name: 'Charlatan',
    skills: ['Deception', 'Sleight of Hand'],
    tools: 'Disguise kit, forgery kit', languages: 'None',
    equipment: 'Fine clothes, disguise kit, tools of the con, 15 gp',
    feature: 'False Identity: a fabricated second identity with documents and established history. Forge documents.'
  },
  {
    name: 'Criminal',
    skills: ['Deception', 'Stealth'],
    tools: "One gaming set, thieves' tools", languages: 'None',
    equipment: "Crowbar, dark common clothes with hood, 15 gp",
    feature: 'Criminal Contact: a reliable contact in the criminal underworld who can find buyers for stolen goods and pass messages.'
  },
  {
    name: 'Entertainer',
    skills: ['Acrobatics', 'Performance'],
    tools: 'Disguise kit, one musical instrument', languages: 'None',
    equipment: 'Musical instrument, favor of an admirer, costume, 15 gp',
    feature: "By Popular Demand: always find a place to perform; free lodging/food at venues you perform at; local fame."
  },
  {
    name: 'Folk Hero',
    skills: ['Animal Handling', 'Survival'],
    tools: 'One artisan\'s tool, vehicles (land)', languages: 'None',
    equipment: "Artisan's tools, shovel, iron pot, common clothes, 10 gp",
    feature: 'Rustic Hospitality: commoners will shelter and feed you; will not reveal you to authorities.'
  },
  {
    name: 'Guild Artisan',
    skills: ['Insight', 'Persuasion'],
    tools: 'One artisan\'s tool set', languages: 'One of your choice',
    equipment: "Artisan's tools, letter of introduction, traveler's clothes, 15 gp",
    feature: 'Guild Membership: guild will provide lodging, legal assistance, and a stipend of 1 gp/day while in good standing.'
  },
  {
    name: 'Hermit',
    skills: ['Medicine', 'Religion'],
    tools: 'Herbalism kit', languages: 'One of your choice',
    equipment: "Scroll case with notes, winter blanket, common clothes, herbalism kit, 5 gp",
    feature: 'Discovery: you discovered a profound truth about the cosmos, the gods, the world, or the forces of nature.'
  },
  {
    name: 'Noble',
    skills: ['History', 'Persuasion'],
    tools: 'One gaming set', languages: 'One of your choice',
    equipment: "Fine clothes, signet ring, scroll of pedigree, 25 gp",
    feature: 'Position of Privilege: welcomed in high society, common folk presume you to have authority, access to palaces.'
  },
  {
    name: 'Outlander',
    skills: ['Athletics', 'Survival'],
    tools: 'One musical instrument', languages: 'One of your choice',
    equipment: "Staff, hunting trap, trophy from an animal, traveler's clothes, 10 gp",
    feature: "Wanderer: excellent memory for geography; can always find food/water for yourself and 5 others in natural environment."
  },
  {
    name: 'Sage',
    skills: ['Arcana', 'History'],
    tools: 'None', languages: 'Two of your choice',
    equipment: "Bottle of black ink, quill, small knife, letter with unanswered question, common clothes, 10 gp",
    feature: "Researcher: when you fail to recall lore, you know where to find it (library, sage, or ancient text). Takes time and money."
  },
  {
    name: 'Sailor',
    skills: ['Athletics', 'Perception'],
    tools: "Navigator's tools, vehicles (water)", languages: 'None',
    equipment: "Belaying pin (club), 50 ft silk rope, lucky charm, common clothes, 10 gp",
    feature: "Ship's Passage: secure free passage on a sailing ship for yourself and companions; you may be expected to work."
  },
  {
    name: 'Soldier',
    skills: ['Athletics', 'Intimidation'],
    tools: 'One gaming set, vehicles (land)', languages: 'None',
    equipment: "Insignia of rank, trophy from a fallen enemy, set of bone dice, common clothes, 10 gp",
    feature: 'Military Rank: soldiers loyal to your former military organization recognize your rank; access to camps and fortresses.'
  },
  {
    name: 'Urchin',
    skills: ['Sleight of Hand', 'Stealth'],
    tools: "Disguise kit, thieves' tools", languages: 'None',
    equipment: "Small knife, map of your home city, pet mouse, token from parents, common clothes, 10 gp",
    feature: 'City Secrets: know secret passages, hidden routes, and back alleys; travel between city locations at double normal speed.'
  }
];
