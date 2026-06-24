/* Activity module (docs/17 §6) — the Physical aspect's home: move, train, nourish, recover.
   Its tools route growth to Physical (preset key `activity` → ASPECT_BY_MODULE), with key
   habits pinned to petals (strength / endurance / mobility / nutrition / recovery) via
   `growthAttribute`. The Physical Aspect flower lives on Today and gets its own page.
   Existing tools only — the interactive muscle-map + exercise databases come later (docs/17 §6). */

export const ACTIVITY_PRESET = {
  key: 'activity',
  name: 'Activity',
  icon: 'activity',
  category: 'Personal', subcategory: 'Health', tags: ['physical', 'exercise', 'fitness', 'nutrition', 'aspect'],
  description: 'Your Physical aspect in bloom — movement, strength, nutrition, and recovery feeding one flower.',
  pages: [
    {
      name: 'Today', icon: 'sun', home: true,
      widgets: [
        { type: 'aspect', name: 'Physical', w: 'half', config: { aspectId: 'physical' } },
        { type: 'overview', name: 'Today', w: 'half', config: { items: [{ widgetId: '@move' }, { widgetId: '@strength' }, { widgetId: '@water' }], showEmpty: false } },
        { type: 'habit', name: 'Move every day', w: 'half', ref: 'move', config: { growthAttribute: 'endurance', difficulty: 'sprout', schedule: { kind: 'daily' }, startDate: '@today', purpose: 'A little movement, every day.' } },
        { type: 'habit', name: 'Strength training', w: 'half', ref: 'strength', config: { growthAttribute: 'strength', difficulty: 'bloom', schedule: { kind: 'daily', days: [1, 3, 5] }, startDate: '@today' } },
        { type: 'tracker', name: 'Daily body', ref: 'water', config: { trackers: [
          { id: 'water', name: 'Water', type: 'count', unit: 'cups', goal: 8 },
          { id: 'sleep', name: 'Sleep', type: 'measure', unit: 'h', goal: 8 },
          { id: 'weight', name: 'Weight', type: 'measure', unit: 'kg', goal: null }
        ] } }
      ]
    },
    {
      name: 'Train', icon: 'zap',
      widgets: [
        { type: 'quest', name: "Today's workout", config: { growthAttribute: 'strength', difficulty: 'bloom', steps: [{ id: 's1', text: 'Warm up', done: false }, { id: 's2', text: 'Main lift', done: false }, { id: 's3', text: 'Accessory work', done: false }, { id: 's4', text: 'Cool down & stretch', done: false }] } },
        { type: 'habit', name: 'Mobility & stretch', w: 'half', config: { growthAttribute: 'mobility', difficulty: 'sprout', schedule: { kind: 'daily' }, startDate: '@today' } },
        { type: 'goal', name: 'A strength goal', w: 'half', config: { growthAttribute: 'strength', purpose: 'Something to build toward.' } },
        { type: 'tracker', name: 'Workout log', config: { trackers: [
          { id: 'sets', name: 'Sets', type: 'count', unit: '', goal: null },
          { id: 'mins', name: 'Active minutes', type: 'measure', unit: 'min', goal: 30 }
        ] } }
      ]
    },
    {
      name: 'Nourish & Rest', icon: 'droplet',
      widgets: [
        { type: 'habit', name: 'Eat well', w: 'half', config: { growthAttribute: 'nutrition', difficulty: 'sprout', schedule: { kind: 'daily' }, startDate: '@today' } },
        { type: 'habit', name: 'Wind down for sleep', w: 'half', config: { growthAttribute: 'recovery', difficulty: 'sprout', schedule: { kind: 'daily' }, startDate: '@today' } },
        { type: 'notes', name: 'Meal plan', objects: [{ kind: 'note', data: { html: '<p>Plan a few balanced meals for the week here. (A full meal planner & food database arrive with the Activity overhaul.)</p>', lastOpened: null } }] }
      ]
    },
    {
      name: 'Physical', icon: 'activity',
      widgets: [
        { type: 'aspect', name: 'Physical aspect', config: { aspectId: 'physical' } },
        { type: 'notes', name: 'How this grows', objects: [{ kind: 'note', data: { html: '<p>Each petal is a part of being well in your body — <b>strength, endurance, mobility, nutrition, recovery</b>. Move, train, eat well, and rest, and the matching petal grows.</p>', lastOpened: null } }] }
      ]
    }
  ]
};
