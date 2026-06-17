/* 5e rules reference (SRD 5.1, CC-BY-4.0). Condensed summaries of the core
   rules players reach for at the table. Paraphrased for quick reference. */

export const RULES = [
  { name: 'Actions in Combat', source: 'SRD 5.1', text:
    'On your turn you can move and take one action. Common actions: Attack, Cast a Spell, Dash (extra movement equal to your speed), Disengage (movement doesn\'t provoke opportunity attacks), Dodge (attacks vs. you have disadvantage; advantage on DEX saves), Help (give an ally advantage), Hide (make a Stealth check), Ready (prepare an action to a trigger), Search, Use an Object.' },
  { name: 'Bonus Actions', source: 'SRD 5.1', text:
    'Various features, spells, and abilities let you take an additional action — a bonus action — on your turn. You can take only one bonus action per turn, and only when a feature says you can.' },
  { name: 'Reactions', source: 'SRD 5.1', text:
    'A reaction is an instant response to a trigger, usable even on someone else\'s turn. You get one reaction per round, regaining it at the start of your turn. The opportunity attack is the most common reaction.' },
  { name: 'Opportunity Attacks', source: 'SRD 5.1', text:
    'When a hostile creature you can see moves out of your reach, you can use your reaction to make one melee attack against it. Taking the Disengage action avoids provoking opportunity attacks.' },
  { name: 'Advantage & Disadvantage', source: 'SRD 5.1', text:
    'With advantage, roll two d20s and use the higher. With disadvantage, use the lower. They don\'t stack — you have one or the other regardless of how many sources apply, and if you have both, you roll a single normal d20.' },
  { name: 'Cover', source: 'SRD 5.1', text:
    'Half cover (low wall, furniture): +2 AC and DEX saves. Three-quarters cover (arrow slit, tree trunk): +5 AC and DEX saves. Total cover: can\'t be targeted directly.' },
  { name: 'Death Saving Throws', source: 'SRD 5.1', text:
    'At 0 HP, roll a d20 at the start of each turn: 10+ is a success, 9 or lower a failure. Three successes = stable; three failures = death. A natural 1 counts as two failures; a natural 20 means you regain 1 HP. Taking damage at 0 HP is a failure (a crit = two).' },
  { name: 'Dropping to 0 Hit Points', source: 'SRD 5.1', text:
    'When you drop to 0 HP you either die outright (if excess damage ≥ your HP maximum) or fall unconscious and begin making death saving throws. Any healing brings you back to consciousness.' },
  { name: 'Short Rest', source: 'SRD 5.1', text:
    'A short rest is at least 1 hour of light activity. You can spend Hit Dice to heal: roll the die, add your CON modifier, and regain that many HP per die spent. Some class features recharge on a short rest.' },
  { name: 'Long Rest', source: 'SRD 5.1', text:
    'A long rest is at least 8 hours. You regain all lost HP, recover up to half your total Hit Dice, and reset spell slots and most abilities. You can benefit from only one long rest per 24 hours and must have at least 1 HP to start one.' },
  { name: 'Resting & Hit Dice', source: 'SRD 5.1', text:
    'You have a number of Hit Dice equal to your level, of the type your class uses. Spend them on short rests to heal; regain up to half on a long rest.' },
  { name: 'Conditions', source: 'SRD 5.1', text:
    'A condition alters a creature\'s capabilities. The 15 conditions are blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, and exhaustion. See each condition\'s own entry for details.' },
  { name: 'Exhaustion', source: 'SRD 5.1', text:
    'Exhaustion has six levels: 1 disadvantage on ability checks; 2 speed halved; 3 disadvantage on attacks and saves; 4 HP maximum halved; 5 speed reduced to 0; 6 death. A long rest removes one level (with food and drink).' },
  { name: 'Ability Checks', source: 'SRD 5.1', text:
    'Roll a d20, add the relevant ability modifier (and proficiency bonus if proficient), and compare to a DC: 5 very easy, 10 easy, 15 medium, 20 hard, 25 very hard, 30 nearly impossible.' },
  { name: 'Ability Scores & Modifiers', source: 'SRD 5.1', text:
    'Modifier = (score − 10) ÷ 2, rounded down. Score 1 → −5, 8–9 → −1, 10–11 → +0, 12–13 → +1, 14–15 → +2, 16–17 → +3, 18–19 → +4, 20 → +5. Scores normally cap at 20 for player characters.' },
  { name: 'Proficiency Bonus', source: 'SRD 5.1', text:
    'Your proficiency bonus scales with level: +2 at levels 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16, +6 at 17–20. Add it once to any roll you are proficient in (twice with expertise).' },
  { name: 'Saving Throws', source: 'SRD 5.1', text:
    'A saving throw represents resisting a threat: roll a d20, add the relevant ability modifier (plus proficiency if your class grants that save), and meet or beat the effect\'s DC.' },
  { name: 'Carrying Capacity', source: 'SRD 5.1', text:
    'Your carrying capacity is your Strength score × 15 pounds. Beyond that you are encumbered. Pushing, dragging, or lifting is up to twice your carrying capacity.' },
  { name: 'Leveling Up', source: 'SRD 5.1', text:
    'When you gain a level you gain HP (roll or take the average of your Hit Die + CON modifier), may gain class features, and your proficiency bonus may increase. Ability Score Improvements come at certain class levels (often 4, 8, 12, 16, 19).' },
  { name: 'Experience Points', source: 'SRD 5.1', text:
    'XP thresholds to reach each level: 2nd 300, 3rd 900, 4th 2,700, 5th 6,500, 6th 14,000, 7th 23,000, 8th 34,000, 9th 48,000, 10th 64,000, 11th 85,000, 12th 100,000, 13th 120,000, 14th 140,000, 15th 165,000, 16th 195,000, 17th 225,000, 18th 265,000, 19th 305,000, 20th 355,000.' },
  { name: 'Spellcasting Basics', source: 'SRD 5.1', text:
    'Spell save DC = 8 + proficiency bonus + spellcasting ability modifier. Spell attack bonus = proficiency bonus + spellcasting ability modifier. Casting at a higher level uses a higher slot for stronger effects. Concentration ends if you cast another concentration spell, are incapacitated, or fail a CON save (DC 10 or half the damage taken, whichever is higher) after taking damage.' },
  { name: 'Cover & Hiding (Stealth)', source: 'SRD 5.1', text:
    'You can\'t hide from a creature that can see you clearly. When hidden, you have advantage on your attack and the target can\'t use its reaction against an attack it can\'t see coming. A Perception check opposes your Stealth.' },
  { name: 'Vision & Light', source: 'SRD 5.1', text:
    'Bright light lets most creatures see normally. Dim light (a lightly obscured area) imposes disadvantage on Perception checks relying on sight. Darkness heavily obscures — a creature effectively suffers the blinded condition. Darkvision lets a creature treat dim light as bright and darkness as dim (in shades of gray) within range.' },
  { name: 'Falling', source: 'SRD 5.1', text:
    'A fall deals 1d6 bludgeoning damage per 10 feet fallen, to a maximum of 20d6, and the creature lands prone unless it avoids the damage.' },
  { name: 'Improvised Damage & Object AC', source: 'SRD 5.1', text:
    'Objects have AC and HP set by the DM; they automatically fail STR and DEX saves and are immune to poison and psychic damage. Use the situation to assign improvised damage (e.g., a guideline of 1d10 per "dangerous" level).' }
];
