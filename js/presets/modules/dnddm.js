/* D&D Dungeon Master — Campaign Manager preset (docs/08 §3):
   Dashboard · Story · World · NPCs · Encounters · Players · Sessions.
   Reuses World Builder pieces (worldmap/lorewiki/civprofile/worldchars) and
   D&D Character pieces; adds the DM-specific widgets (statblock, encounter,
   initiative, loottable, sessionlog, relationshipweb). The bestiary, encounters
   and tracker find each other through the module-scoped sibling lookup. */

export const DND_DM_PRESET = {
  key: 'dnddm',
  name: 'D&D Campaign',
  icon: 'dice',
  description: 'Run a whole campaign — story, world, NPCs, encounters, live combat, and session logs.',
  pages: [
    {
      name: 'Dashboard', icon: 'home',
      widgets: [
        { type: 'time', name: 'Today' },
        { type: 'quest', name: 'Next-session prep' },
        { type: 'dice', name: 'Dice', w: 'half' },
        { type: 'notes', name: 'Campaign notes', objects: [{ kind: 'note', data: { html: '<h1>The campaign so far</h1><p>Where the party stands, the threats ahead, the threads still dangling…</p>', lastOpened: null } }] }
      ]
    },
    {
      name: 'Story', icon: 'book',
      widgets: [
        { type: 'notes', name: 'Arcs & scenes', objects: [{ kind: 'note', data: { html: '<h1>Arc I</h1><p>Chapters, scenes, and the beats you want to hit. Link NPCs and locations with [[ … ]] once your world fills in.</p>', lastOpened: null } }] },
        { type: 'wtimeline', name: 'Story beats' }
      ]
    },
    {
      name: 'World', icon: 'globe',
      widgets: [
        { type: 'worldmap', name: 'World map' },
        { type: 'lorewiki', name: 'Lore' },
        { type: 'civprofile', name: 'Factions & realms' }
      ]
    },
    {
      name: 'NPCs', icon: 'users',
      widgets: [
        { type: 'worldchars', name: 'NPCs' },
        { type: 'statblock', name: 'Stat Blocks' },
        { type: 'relationshipweb', name: 'Relationship web' }
      ]
    },
    {
      name: 'Encounters', icon: 'zap',
      widgets: [
        { type: 'encounter', name: 'Encounters' },
        { type: 'initiative', name: 'Initiative tracker' },
        { type: 'loottable', name: 'Loot tables' }
      ]
    },
    {
      name: 'Players', icon: 'shield',
      widgets: [
        { type: 'worldchars', name: 'The party' },
        { type: 'counter', name: 'Inspiration', w: 'half', config: { count: 0, step: 1, dailyReset: false, target: null } },
        { type: 'notes', name: 'XP & milestones', objects: [{ kind: 'note', data: { html: '<h1>XP &amp; milestones</h1><p>Awards, level-ups, and the moments that earned them.</p>', lastOpened: null } }] },
        { type: 'gallery', name: 'Handouts' }
      ]
    },
    {
      name: 'Sessions', icon: 'calendar',
      widgets: [
        { type: 'sessionlog', name: 'Session log' }
      ]
    }
  ]
};
