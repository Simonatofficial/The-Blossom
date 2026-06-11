/* The Blossom preset module (docs/08 §1) — pre-installed default.
   Calendar · Home · Blossom. The Blossom page: a botanical Flower Graph with
   four petals fed by the Physical / Mental / Emotional / Social skills,
   each holding its nested sub-skills (unlinked at first — hint cards show how
   to feed them). */

const sub = (names) => names.map(name => ({ type: 'skill', name }));

export const BLOSSOM_PRESET = {
  key: 'blossom',
  name: 'The Blossom',
  icon: 'flower',
  description: 'Your life in bloom — calendar, daily garden, and the four-petal flower of you.',
  pages: [
    {
      name: 'Calendar', icon: 'calendar',
      widgets: [{ type: 'calendar', name: 'Calendar' }]
    },
    {
      name: 'Home', icon: 'home',
      widgets: [
        { type: 'time', name: 'Today' },
        { type: 'quest', name: 'Daily walk', w: 'half', config: { reps: 1, difficulty: 'sprout', schedule: { kind: 'daily' }, startDate: '@today', state: { streak: 0, best: 0 } } },
        { type: 'routine', name: 'Morning routine', w: 'half', config: { items: [], cadence: 'daily', time: 'morning', expanded: false } },
        { type: 'tracker', name: 'Daily trackers', config: { trackers: [
          { id: 'water', name: 'Water', type: 'count', unit: 'cups', goal: 8 },
          { id: 'mood', name: 'Mood', type: 'scale', max: 5, goal: null },
          { id: 'sleep', name: 'Sleep', type: 'measure', unit: 'h', goal: 8 }
        ] } },
        { type: 'journal', name: 'Journal', w: 'half' },
        { type: 'goal', name: 'A goal worth growing', w: 'half' },
        { type: 'market', name: 'Market' }
      ]
    },
    {
      name: 'Blossom', icon: 'flower',
      widgets: [
        {
          type: 'graph', name: 'Life in bloom',
          config: {
            graphs: [{
              id: 'bloom', kind: 'flower', style: 'botanical', range: 'week', aggregate: 'raw',
              series: [
                { link: { sourceWidgetId: '@physical', output: 'level', transform: { scale: 1 } }, label: 'Physical' },
                { link: { sourceWidgetId: '@mental', output: 'level', transform: { scale: 1 } }, label: 'Mental' },
                { link: { sourceWidgetId: '@emotional', output: 'level', transform: { scale: 1 } }, label: 'Emotional' },
                { link: { sourceWidgetId: '@social', output: 'level', transform: { scale: 1 } }, label: 'Social' }
              ]
            }]
          }
        },
        {
          type: 'notes', name: 'Tending the flower', w: 'full',
          objects: [{ kind: 'note', data: { html: '<p>Each petal is a <b>Skill</b>. Feed a skill by opening it and linking a tracker, or nesting a quest inside — XP commits each night, and the flower grows with you.</p>', lastOpened: null } }]
        },
        { type: 'skill', name: 'Physical', w: 'half', ref: 'physical', children: sub(['Strength', 'Conditioning', 'Mobility & Recovery', 'Nutrition', 'Sleep', 'Health']) },
        { type: 'skill', name: 'Mental', w: 'half', ref: 'mental', children: sub(['Focus', 'Learning', 'Creativity', 'Discipline', 'Wisdom']) },
        { type: 'skill', name: 'Emotional', w: 'half', ref: 'emotional', children: sub(['Emotional Awareness', 'Regulation', 'Resilience', 'Expression', 'Self-Compassion', 'Positive Emotion']) },
        { type: 'skill', name: 'Social', w: 'half', ref: 'social', children: sub(['Communication', 'Relationships', 'Social Confidence', 'Conflict Resolution', 'Leadership', 'Community']) }
      ]
    }
  ]
};
