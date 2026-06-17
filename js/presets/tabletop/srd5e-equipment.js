/* 5e SRD equipment data (CC-BY-4.0 Wizards of the Coast): weapons, armor,
   adventuring gear, and a selection of magic items. */

/* Weapon: { name, category, cost, damage, damageType, weight, props } */
export const WEAPONS = [
  // Simple Melee
  { name: 'Club', category: 'Simple Melee', cost: '1 sp', damage: '1d4', damageType: 'bludgeoning', weight: 2, props: 'Light' },
  { name: 'Dagger', category: 'Simple Melee', cost: '2 gp', damage: '1d4', damageType: 'piercing', weight: 1, props: 'Finesse, light, thrown (20/60)' },
  { name: 'Greatclub', category: 'Simple Melee', cost: '2 sp', damage: '1d8', damageType: 'bludgeoning', weight: 10, props: 'Two-handed' },
  { name: 'Handaxe', category: 'Simple Melee', cost: '5 gp', damage: '1d6', damageType: 'slashing', weight: 2, props: 'Light, thrown (20/60)' },
  { name: 'Javelin', category: 'Simple Melee', cost: '5 sp', damage: '1d6', damageType: 'piercing', weight: 2, props: 'Thrown (30/120)' },
  { name: 'Light Hammer', category: 'Simple Melee', cost: '2 gp', damage: '1d4', damageType: 'bludgeoning', weight: 2, props: 'Light, thrown (20/60)' },
  { name: 'Mace', category: 'Simple Melee', cost: '5 gp', damage: '1d6', damageType: 'bludgeoning', weight: 4, props: '—' },
  { name: 'Quarterstaff', category: 'Simple Melee', cost: '2 sp', damage: '1d6', damageType: 'bludgeoning', weight: 4, props: 'Versatile (1d8)' },
  { name: 'Sickle', category: 'Simple Melee', cost: '1 gp', damage: '1d4', damageType: 'slashing', weight: 2, props: 'Light' },
  { name: 'Spear', category: 'Simple Melee', cost: '1 gp', damage: '1d6', damageType: 'piercing', weight: 3, props: 'Thrown (20/60), versatile (1d8)' },
  // Simple Ranged
  { name: 'Light Crossbow', category: 'Simple Ranged', cost: '25 gp', damage: '1d8', damageType: 'piercing', weight: 5, props: 'Ammunition (80/320), loading, two-handed' },
  { name: 'Dart', category: 'Simple Ranged', cost: '5 cp', damage: '1d4', damageType: 'piercing', weight: 0.25, props: 'Finesse, thrown (20/60)' },
  { name: 'Shortbow', category: 'Simple Ranged', cost: '25 gp', damage: '1d6', damageType: 'piercing', weight: 2, props: 'Ammunition (80/320), two-handed' },
  { name: 'Sling', category: 'Simple Ranged', cost: '1 sp', damage: '1d4', damageType: 'bludgeoning', weight: 0, props: 'Ammunition (30/120)' },
  // Martial Melee
  { name: 'Battleaxe', category: 'Martial Melee', cost: '10 gp', damage: '1d8', damageType: 'slashing', weight: 4, props: 'Versatile (1d10)' },
  { name: 'Flail', category: 'Martial Melee', cost: '10 gp', damage: '1d8', damageType: 'bludgeoning', weight: 2, props: '—' },
  { name: 'Glaive', category: 'Martial Melee', cost: '20 gp', damage: '1d10', damageType: 'slashing', weight: 6, props: 'Heavy, reach, two-handed' },
  { name: 'Greataxe', category: 'Martial Melee', cost: '30 gp', damage: '1d12', damageType: 'slashing', weight: 7, props: 'Heavy, two-handed' },
  { name: 'Greatsword', category: 'Martial Melee', cost: '50 gp', damage: '2d6', damageType: 'slashing', weight: 6, props: 'Heavy, two-handed' },
  { name: 'Halberd', category: 'Martial Melee', cost: '20 gp', damage: '1d10', damageType: 'slashing', weight: 6, props: 'Heavy, reach, two-handed' },
  { name: 'Lance', category: 'Martial Melee', cost: '10 gp', damage: '1d12', damageType: 'piercing', weight: 6, props: 'Reach, special' },
  { name: 'Longsword', category: 'Martial Melee', cost: '15 gp', damage: '1d8', damageType: 'slashing', weight: 3, props: 'Versatile (1d10)' },
  { name: 'Maul', category: 'Martial Melee', cost: '10 gp', damage: '2d6', damageType: 'bludgeoning', weight: 10, props: 'Heavy, two-handed' },
  { name: 'Morningstar', category: 'Martial Melee', cost: '15 gp', damage: '1d8', damageType: 'piercing', weight: 4, props: '—' },
  { name: 'Pike', category: 'Martial Melee', cost: '5 gp', damage: '1d10', damageType: 'piercing', weight: 18, props: 'Heavy, reach, two-handed' },
  { name: 'Rapier', category: 'Martial Melee', cost: '25 gp', damage: '1d8', damageType: 'piercing', weight: 2, props: 'Finesse' },
  { name: 'Scimitar', category: 'Martial Melee', cost: '25 gp', damage: '1d6', damageType: 'slashing', weight: 3, props: 'Finesse, light' },
  { name: 'Shortsword', category: 'Martial Melee', cost: '10 gp', damage: '1d6', damageType: 'piercing', weight: 2, props: 'Finesse, light' },
  { name: 'Trident', category: 'Martial Melee', cost: '5 gp', damage: '1d6', damageType: 'piercing', weight: 4, props: 'Thrown (20/60), versatile (1d8)' },
  { name: 'War Pick', category: 'Martial Melee', cost: '5 gp', damage: '1d8', damageType: 'piercing', weight: 2, props: '—' },
  { name: 'Warhammer', category: 'Martial Melee', cost: '15 gp', damage: '1d8', damageType: 'bludgeoning', weight: 2, props: 'Versatile (1d10)' },
  { name: 'Whip', category: 'Martial Melee', cost: '2 gp', damage: '1d4', damageType: 'slashing', weight: 3, props: 'Finesse, reach' },
  // Martial Ranged
  { name: 'Blowgun', category: 'Martial Ranged', cost: '10 gp', damage: '1', damageType: 'piercing', weight: 1, props: 'Ammunition (25/100), loading' },
  { name: 'Hand Crossbow', category: 'Martial Ranged', cost: '75 gp', damage: '1d6', damageType: 'piercing', weight: 3, props: 'Ammunition (30/120), light, loading' },
  { name: 'Heavy Crossbow', category: 'Martial Ranged', cost: '50 gp', damage: '1d10', damageType: 'piercing', weight: 18, props: 'Ammunition (100/400), heavy, loading, two-handed' },
  { name: 'Longbow', category: 'Martial Ranged', cost: '50 gp', damage: '1d8', damageType: 'piercing', weight: 2, props: 'Ammunition (150/600), heavy, two-handed' },
  { name: 'Net', category: 'Martial Ranged', cost: '1 gp', damage: '—', damageType: '—', weight: 3, props: 'Special, thrown (5/15)' }
];

/* Armor: { name, category, ac, strength, stealth, weight, cost } */
export const ARMOR = [
  // Light
  { name: 'Padded', category: 'Light', ac: '11 + DEX', stealth: 'Disadvantage', weight: 8, cost: '5 gp' },
  { name: 'Leather', category: 'Light', ac: '11 + DEX', stealth: '—', weight: 10, cost: '10 gp' },
  { name: 'Studded Leather', category: 'Light', ac: '12 + DEX', stealth: '—', weight: 13, cost: '45 gp' },
  // Medium
  { name: 'Hide', category: 'Medium', ac: '12 + DEX (max 2)', stealth: '—', weight: 12, cost: '10 gp' },
  { name: 'Chain Shirt', category: 'Medium', ac: '13 + DEX (max 2)', stealth: '—', weight: 20, cost: '50 gp' },
  { name: 'Scale Mail', category: 'Medium', ac: '14 + DEX (max 2)', stealth: 'Disadvantage', weight: 45, cost: '50 gp' },
  { name: 'Breastplate', category: 'Medium', ac: '14 + DEX (max 2)', stealth: '—', weight: 20, cost: '400 gp' },
  { name: 'Half Plate', category: 'Medium', ac: '15 + DEX (max 2)', stealth: 'Disadvantage', weight: 40, cost: '750 gp' },
  // Heavy
  { name: 'Ring Mail', category: 'Heavy', ac: '14', stealth: 'Disadvantage', weight: 40, cost: '30 gp' },
  { name: 'Chain Mail', category: 'Heavy', ac: '16', strength: 'Str 13', stealth: 'Disadvantage', weight: 55, cost: '75 gp' },
  { name: 'Splint', category: 'Heavy', ac: '17', strength: 'Str 15', stealth: 'Disadvantage', weight: 60, cost: '200 gp' },
  { name: 'Plate', category: 'Heavy', ac: '18', strength: 'Str 15', stealth: 'Disadvantage', weight: 65, cost: '1500 gp' },
  // Shield
  { name: 'Shield', category: 'Shield', ac: '+2', stealth: '—', weight: 6, cost: '10 gp' }
];

/* Adventuring gear: { name, cost, weight, desc } */
export const GEAR = [
  { name: 'Abacus', cost: '2 gp', weight: 2, desc: 'A counting frame.' },
  { name: 'Acid (vial)', cost: '25 gp', weight: 1, desc: 'Throw as action: 2d6 acid damage on a hit (ranged attack, 20 ft).' },
  { name: "Alchemist's Fire (flask)", cost: '50 gp', weight: 1, desc: 'Throw as action: 1d4 fire damage at start of each turn until extinguished (DC 10 DEX action to end).' },
  { name: 'Arrows (20)', cost: '1 gp', weight: 1, desc: 'Ammunition for bows.' },
  { name: 'Crossbow Bolts (20)', cost: '1 gp', weight: 1.5, desc: 'Ammunition for crossbows.' },
  { name: 'Backpack', cost: '2 gp', weight: 5, desc: 'Holds up to 1 cubic foot / 30 lb of gear.' },
  { name: 'Bedroll', cost: '1 gp', weight: 7, desc: 'For sleeping outdoors.' },
  { name: 'Bell', cost: '1 gp', weight: 0, desc: 'A small bell.' },
  { name: 'Blanket', cost: '5 sp', weight: 3, desc: 'A warm blanket.' },
  { name: 'Block and Tackle', cost: '1 gp', weight: 5, desc: 'A pulley system; lift up to 4× the weight you can normally.' },
  { name: 'Book', cost: '25 gp', weight: 5, desc: 'A tome of lore, fiction, or records.' },
  { name: 'Caltrops (bag of 20)', cost: '1 gp', weight: 2, desc: 'Spread in 5-ft square: DC 15 DEX save or stop and take 1 piercing, speed reduced 10 ft.' },
  { name: 'Candle', cost: '1 cp', weight: 0, desc: 'Sheds bright light 5 ft, dim 5 ft more, for 1 hour.' },
  { name: 'Chain (10 ft)', cost: '5 gp', weight: 10, desc: 'Has 10 HP; DC 20 STR check to burst.' },
  { name: 'Climber\'s Kit', cost: '25 gp', weight: 12, desc: 'Pitons, boot tips, gloves, harness — anchor yourself.' },
  { name: 'Crowbar', cost: '2 gp', weight: 5, desc: 'Advantage on STR checks where leverage applies.' },
  { name: 'Grappling Hook', cost: '2 gp', weight: 4, desc: 'For securing a rope.' },
  { name: 'Hammer', cost: '1 gp', weight: 3, desc: 'For driving pitons.' },
  { name: 'Healer\'s Kit', cost: '5 gp', weight: 3, desc: '10 uses. Stabilize a dying creature without a WIS (Medicine) check.' },
  { name: 'Holy Water (flask)', cost: '25 gp', weight: 1, desc: 'Throw as action: fiends/undead take 2d6 radiant damage on a hit.' },
  { name: 'Lantern, Hooded', cost: '5 gp', weight: 2, desc: 'Bright light 30 ft, dim 30 ft more, 6 hr per pint of oil.' },
  { name: 'Lock', cost: '10 gp', weight: 1, desc: 'DC 15 DEX check with thieves\' tools to pick.' },
  { name: 'Manacles', cost: '2 gp', weight: 6, desc: 'DC 20 DEX or STR check to escape; AC 19, 15 HP.' },
  { name: 'Oil (flask)', cost: '1 sp', weight: 1, desc: 'Throw or pour: 5 fire damage to a covered creature when ignited.' },
  { name: 'Piton', cost: '5 cp', weight: 0.25, desc: 'An iron spike for anchoring rope.' },
  { name: 'Potion of Healing', cost: '50 gp', weight: 0.5, desc: 'Regain 2d4+2 HP as a bonus action.' },
  { name: 'Rations (1 day)', cost: '5 sp', weight: 2, desc: 'Dry food for one day.' },
  { name: 'Rope, Hempen (50 ft)', cost: '1 gp', weight: 10, desc: '2 HP; DC 17 STR check to burst.' },
  { name: 'Rope, Silk (50 ft)', cost: '10 gp', weight: 5, desc: '2 HP; DC 17 STR check to burst.' },
  { name: 'Tinderbox', cost: '5 sp', weight: 1, desc: 'Light a fire (takes an action for torch/candle, 1 min otherwise).' },
  { name: 'Torch', cost: '1 cp', weight: 1, desc: 'Bright light 20 ft, dim 20 ft more, for 1 hr. Melee: 1 fire damage.' },
  { name: 'Waterskin', cost: '2 sp', weight: 5, desc: 'Holds 4 pints of liquid (full).' }
];

/* A taste of magic items from the SRD: { name, type, rarity, attunement, desc } */
export const MAGIC_ITEMS = [
  { name: 'Bag of Holding', type: 'Wondrous item', rarity: 'Uncommon', attunement: false, desc: 'Interior space holds up to 500 lb / 64 cu ft, always weighs 15 lb. Retrieving an item is an action.' },
  { name: 'Boots of Speed', type: 'Wondrous item', rarity: 'Rare', attunement: true, desc: 'Bonus action to double speed; attacks against you have disadvantage. Up to 10 min per long rest.' },
  { name: 'Cloak of Protection', type: 'Wondrous item', rarity: 'Uncommon', attunement: true, desc: '+1 to AC and saving throws.' },
  { name: 'Flame Tongue', type: 'Weapon (any sword)', rarity: 'Rare', attunement: true, desc: 'Bonus action to ignite: +2d6 fire damage; sheds bright light 40 ft.' },
  { name: 'Gauntlets of Ogre Power', type: 'Wondrous item', rarity: 'Uncommon', attunement: true, desc: 'Your Strength score is 19 while wearing these (no effect if already higher).' },
  { name: 'Ring of Protection', type: 'Ring', rarity: 'Rare', attunement: true, desc: '+1 to AC and saving throws.' },
  { name: 'Staff of Healing', type: 'Staff', rarity: 'Rare', attunement: true, desc: '10 charges. Cast Cure Wounds (1 charge/level), Lesser Restoration (2), or Mass Cure Wounds (5).' },
  { name: 'Wand of Magic Missiles', type: 'Wand', rarity: 'Uncommon', attunement: false, desc: '7 charges. Cast Magic Missile (1 charge per spell level). Regains 1d6+1 charges at dawn.' },
  { name: '+1 Weapon', type: 'Weapon (any)', rarity: 'Uncommon', attunement: false, desc: '+1 bonus to attack and damage rolls made with this magic weapon.' },
  { name: '+1 Shield', type: 'Armor (shield)', rarity: 'Uncommon', attunement: false, desc: 'You gain an additional +1 bonus to AC while wielding this shield.' },
  { name: 'Amulet of Health', type: 'Wondrous item', rarity: 'Rare', attunement: true, desc: 'Your Constitution score is 19 while wearing this (no effect if already higher).' },
  { name: 'Cloak of Elvenkind', type: 'Wondrous item', rarity: 'Uncommon', attunement: true, desc: 'Advantage on Stealth checks to hide; others have disadvantage on Perception to see you (hood up).' },
  { name: 'Immovable Rod', type: 'Rod', rarity: 'Uncommon', attunement: false, desc: 'Press the button to fix it in place (holds up to 8000 lb). DC 30 STR check to move 10 ft.' },
  { name: 'Ring of Spell Storing', type: 'Ring', rarity: 'Rare', attunement: true, desc: 'Stores up to 5 levels of spells cast into it; you (or another) can cast them later.' }
];
