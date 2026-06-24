/* Liri module (docs/17 §4) — your companion's home. Three cozy pages:
     • Liri      — the vignette (companion) + the My Blossom hub of five Aspect flowers
     • Liri Life — the care loop (bond, mood, feed/play, journal)
     • Discover  — the 15-question element quiz (its own surface)
   All Liri widgets are self-contained and read the growth ledger + Liri state — no @ref wiring
   needed. Existing widgets only; the procedural Liri art is a placeholder for Simon's final art. */

const aspectCard = (id, name) => ({ type: 'aspect', name, w: 'half', config: { aspectId: id } });

export const LIRI_PRESET = {
  key: 'liri',
  name: 'Liri',
  icon: 'sparkles',
  category: 'Personal', subcategory: 'Growth', tags: ['liri', 'companion', 'aspects', 'pet'],
  description: 'Your soul-bonded companion — discovered by a quiz, grown from your five aspects, tended in Liri Life.',
  pages: [
    {
      name: 'Liri', icon: 'sparkles', home: true,
      widgets: [
        { type: 'companion', name: 'Liri' },
        { type: 'notes', name: 'About Liri', objects: [{ kind: 'note', data: { html: '<p>Liri is a living portrait of you. <b>Physical</b> grows its size, <b>Mental</b> its abilities, <b>Emotional</b> its colour, <b>Social</b> its finery, and <b>Recreation</b> its sparkle. Live your aspects below and watch it bloom.</p>', lastOpened: null } }] },
        aspectCard('mental', 'Mental'),
        aspectCard('physical', 'Physical'),
        aspectCard('emotional', 'Emotional'),
        aspectCard('social', 'Social'),
        aspectCard('recreation', 'Recreation')
      ]
    },
    {
      name: 'Liri Life', icon: 'heart',
      widgets: [
        { type: 'lirilife', name: 'Liri Life' },
        { type: 'market', name: 'Market' }
      ]
    },
    {
      name: 'Discover', icon: 'wand',
      widgets: [
        { type: 'elementquiz', name: "Liri's element" }
      ]
    }
  ]
};
