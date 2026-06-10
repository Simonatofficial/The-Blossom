/* Small preset modules (docs/08 §7) — pure definitions over existing widgets. */

export const SMALL_PRESETS = [
  {
    key: 'reading', name: 'Reading Nook', icon: 'book-open',
    description: 'Books in progress, reading sessions, and a quotes notebook.',
    pages: [{
      name: 'Nook', icon: 'book-open',
      widgets: [
        { type: 'tracker', name: 'Reading', config: { trackers: [
          { id: 'pages', name: 'Pages read', type: 'count', unit: 'pages', goal: 20 },
          { id: 'minutes', name: 'Minutes', type: 'measure', unit: 'min', goal: 30 }
        ] } },
        { type: 'alarm', name: 'Reading timer', w: 'half' },
        { type: 'quest', name: 'Read today', w: 'half', config: { reps: 1, difficulty: 'sprout', schedule: { kind: 'daily' }, startDate: '@today', state: { streak: 0, best: 0 } } },
        { type: 'notes', name: 'Bookshelf', objects: [{ kind: 'note', data: { html: '<h2>Reading now</h2><ul><li>…</li></ul><h2>Up next</h2><ul><li>…</li></ul>', lastOpened: null } }] },
        { type: 'notes', name: 'Quotes', objects: [{ kind: 'note', data: { html: '<p><i>Lines worth keeping live here.</i></p>', lastOpened: null } }] }
      ]
    }]
  },
  {
    key: 'recipes', name: 'Recipe Box', icon: 'folder',
    description: 'Recipes, a weekly meal plan, and the grocery list.',
    pages: [{
      name: 'Kitchen', icon: 'home',
      widgets: [
        { type: 'calendar', name: 'Meal plan' },
        { type: 'notes', name: 'Recipes', w: 'half', objects: [{ kind: 'note', data: { html: '<h2>Recipes</h2><p>One note per dish — ingredients as checkboxes, steps below.</p>', lastOpened: null } }] },
        { type: 'notes', name: 'Grocery list', w: 'half', objects: [{ kind: 'note', data: { html: '<div class="check-line"><input type="checkbox"><span>&nbsp;oats</span></div>', lastOpened: null } }] }
      ]
    }]
  },
  {
    key: 'budget', name: 'Budget Garden', icon: 'coins',
    description: 'Track spending and grow savings goals. Display-only math.',
    pages: [{
      name: 'Garden', icon: 'sprout',
      widgets: [
        { type: 'tracker', name: 'Daily spending', config: { trackers: [
          { id: 'spend', name: 'Spent', type: 'measure', unit: '$', goal: null },
          { id: 'saved', name: 'Set aside', type: 'measure', unit: '$', goal: null }
        ] } },
        { type: 'goal', name: 'Savings goal', w: 'half' },
        { type: 'graph', name: 'Spending', w: 'half', config: { graphs: [{ id: 'g1', kind: 'bar', range: 'week', aggregate: 'raw', series: [] }] } }
      ]
    }]
  },
  {
    key: 'musicpractice', name: 'Music Practice', icon: 'music',
    description: 'Practice quests, a metronome-ish timer, and an instrument skill tree.',
    pages: [{
      name: 'Practice', icon: 'music',
      widgets: [
        { type: 'skill', name: 'Instrument', ref: 'inst', children: [
          { type: 'skill', name: 'Technique' }, { type: 'skill', name: 'Repertoire' }, { type: 'skill', name: 'Theory' }
        ] },
        { type: 'quest', name: 'Practice session', w: 'half', config: { reps: 1, difficulty: 'bloom', schedule: { kind: 'daily' }, startDate: '@today', state: { streak: 0, best: 0 } } },
        { type: 'alarm', name: 'Session timer', w: 'half' },
        { type: 'notes', name: 'Practice log' }
      ]
    }]
  },
  {
    key: 'fitness', name: 'Fitness Log', icon: 'activity',
    description: 'Workout routine, exercise trackers, measurements, progress graphs.',
    pages: [{
      name: 'Training', icon: 'activity',
      widgets: [
        { type: 'routine', name: 'Workout', config: { items: [], cadence: 'daily', time: 'morning', expanded: true } },
        { type: 'tracker', name: 'Body', w: 'half', config: { trackers: [
          { id: 'weight', name: 'Weight', type: 'measure', unit: 'kg', goal: null },
          { id: 'sleep', name: 'Sleep', type: 'measure', unit: 'h', goal: 8 }
        ] } },
        { type: 'alarm', name: 'Rest timer', w: 'half' },
        { type: 'graph', name: 'Progress', config: { graphs: [{ id: 'g1', kind: 'line', range: 'month', aggregate: 'raw', series: [] }] } }
      ]
    }]
  }
];
