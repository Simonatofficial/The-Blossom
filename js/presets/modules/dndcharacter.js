/* D&D Character Manager preset module (docs/08 §4):
   Sheet · Combat · Inventory · Spells · Story. One character, five pages. */

export const DND_CHARACTER_PRESET = {
  key: 'dndcharacter',
  name: 'Tabletop Character',
  icon: 'shield',
  description: 'A living character sheet — tap to roll, rest to recover, plan the build.',
  pages: [
    {
      name: 'Sheet', icon: 'shield',
      widgets: [
        { type: 'charsheet', name: 'Character', config: { section: 'sheet', playMode: false } }
      ]
    },
    {
      name: 'Combat', icon: 'zap',
      widgets: [
        { type: 'charsheet', name: 'Combat', config: { section: 'combat' } },
        { type: 'dice', name: 'Dice', w: 'half' }
      ]
    },
    {
      name: 'Inventory', icon: 'bag',
      widgets: [{ type: 'dndinventory', name: 'Inventory' }]
    },
    {
      name: 'Spells', icon: 'sparkles',
      widgets: [
        { type: 'spellbook', name: 'Spell Book' },
        { type: 'compendium', name: 'SRD Compendium' }
      ]
    },
    {
      name: 'Story', icon: 'book',
      widgets: [
        { type: 'charsheet', name: 'Who they are', config: { section: 'story' } },
        { type: 'levelplanner', name: 'The road ahead' },
        { type: 'notes', name: 'Backstory', objects: [{ kind: 'note', data: { html: '<h1>Backstory</h1><p>Where do they come from, and what can’t they leave behind?</p>', lastOpened: null } }] },
        { type: 'journal', name: 'Session journal' }
      ]
    }
  ]
};
