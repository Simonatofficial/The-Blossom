/* World Builder preset module (docs/08 §5):
   Atlas · Lore · Civilizations · Characters · Timeline · Pinboard. */

export const WORLD_PRESET = {
  key: 'worldbuilder',
  name: 'World Builder',
  icon: 'globe',
  description: 'Maps, lore, civilizations, characters and time — a whole world in one place.',
  pages: [
    {
      name: 'Atlas', icon: 'map',
      widgets: [
        { type: 'worldmap', name: 'Overworld' },
        { type: 'notes', name: 'How the Atlas works', objects: [{ kind: 'note', data: { html: '<p>Paint <b>terrain</b> (tap the brush twice for styles), stamp <b>features</b>, drop <b>labels</b> (big ones show zoomed out, small ones up close) and <b>pins</b> that link lore, civilizations, characters — or another World Map widget for region maps.</p>', lastOpened: null } }] }
      ]
    },
    {
      name: 'Lore', icon: 'book-open',
      widgets: [{ type: 'lorewiki', name: 'Lore' }]
    },
    {
      name: 'Civilizations', icon: 'shield',
      widgets: [{ type: 'civprofile', name: 'Civilizations' }]
    },
    {
      name: 'Characters', icon: 'users',
      widgets: [{ type: 'worldchars', name: 'Characters' }]
    },
    {
      name: 'Timeline', icon: 'clock',
      widgets: [{ type: 'wtimeline', name: 'History' }]
    },
    {
      name: 'Pinboard', icon: 'grid',
      widgets: [{ type: 'pinboard', name: 'Ideas' }]
    }
  ]
};
