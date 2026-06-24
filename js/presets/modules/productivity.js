/* Productivity module (docs/17 §6) — the Mental aspect's home: the ultimate learning hub.
   Tasks, focus, study, habits, goals. Its tools route their growth to Mental (via the
   preset key `productivity` → ASPECT_BY_MODULE), with a few pinned to specific petals via
   `growthAttribute`. The Mental Aspect tool (the flower) sits on Today and gets its own page.
   Built from existing tools only — no engine change (docs/17 §1, "add, don't replace"). */

export const PRODUCTIVITY_PRESET = {
  key: 'productivity',
  name: 'Productivity',
  icon: 'target',
  category: 'Personal', subcategory: 'Growth', tags: ['mental', 'focus', 'study', 'habits', 'aspect'],
  description: 'Your Mental aspect in bloom — focus, learning, habits, and goals, all feeding the same flower.',
  pages: [
    {
      name: 'Today', icon: 'sun', home: true,
      widgets: [
        { type: 'aspect', name: 'Mental', w: 'half', ref: 'asp', config: { aspectId: 'mental' } },
        { type: 'overview', name: 'Today', w: 'half', config: { items: [{ widgetId: '@focus' }, { widgetId: '@study' }, { widgetId: '@deepgoal' }], showEmpty: false } },
        { type: 'habit', name: 'Deep work', w: 'half', config: { growthAttribute: 'focus', difficulty: 'bloom', schedule: { kind: 'daily', days: [1, 2, 3, 4, 5] }, startDate: '@today', purpose: 'Protect one block of undistracted work.', ref: 'focus' }, ref: 'focus' },
        { type: 'habit', name: 'Study every day', w: 'half', config: { growthAttribute: 'learning', difficulty: 'sprout', schedule: { kind: 'daily' }, startDate: '@today' }, ref: 'study' },
        { type: 'reminder', name: 'Reminders' }
      ]
    },
    {
      name: 'Focus', icon: 'timer',
      widgets: [
        { type: 'alarm', name: 'Focus timer', config: { mode: 'pomodoro' } },
        { type: 'quest', name: 'Single hard problem', w: 'half', config: { growthAttribute: 'problem-solving', difficulty: 'bloom', steps: [{ id: 's1', text: 'Define the problem clearly', done: false }, { id: 's2', text: 'Break it into parts', done: false }, { id: 's3', text: 'Solve one part', done: false }] } },
        { type: 'goal', name: 'A goal worth pursuing', w: 'half', ref: 'deepgoal', config: { growthAttribute: 'learning', purpose: 'A meaningful project to grow your mind.' } },
        { type: 'tracker', name: 'Focus log', config: { trackers: [
          { id: 'deepmin', name: 'Deep-work minutes', type: 'measure', unit: 'min', goal: 90 },
          { id: 'mood', name: 'Clarity', type: 'scale', max: 5, goal: null }
        ] } }
      ]
    },
    {
      name: 'Learn', icon: 'book-open',
      widgets: [
        { type: 'notebook', name: 'Notebook', ref: 'nb' },
        { type: 'elements', name: 'Key terms', config: { sources: [{ notebookId: '@nb', on: true }] } },
        { type: 'flashcards', name: 'Flashcards', ref: 'fc', config: { sources: [{ notebookId: '@nb', on: true }] } },
        { type: 'quiz', name: 'Quiz', config: { sources: [{ fcId: '@fc', on: true }] } }
      ]
    },
    {
      name: 'Mental', icon: 'sparkles',
      widgets: [
        { type: 'aspect', name: 'Mental aspect', config: { aspectId: 'mental' } },
        { type: 'notes', name: 'How this grows', objects: [{ kind: 'note', data: { html: '<p>Every petal is an <b>attribute</b> of your mind; the little stars are <b>skills</b>. Finish a focus block, study, solve a problem, or hit a goal here and the matching petal grows — the flower is just your real effort, in bloom.</p>', lastOpened: null } }] }
      ]
    }
  ]
};
