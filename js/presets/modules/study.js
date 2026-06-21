/* Study module preset (docs/08 + V2 §W). Four focused pages wired together with
   @refs so the whole study loop works the moment it's planted:
     • Today    — daily hub: Overview activity feed, Reminders, study Skill + Habit
     • Notebook — Class→Section→Unit→Topic notes, a linked Glossary, a file Library
     • Study    — Flashcards (grown from the Notebook) and a Quiz (from the cards)
     • Progress — graphs of cards reviewed + quiz scores over time
   Everything downstream points back at the one Notebook (@nb) → Flashcards (@fc) →
   Quiz (@qz), with the Skill (@sk) and Habit (@hb) feeding the daily Overview. */

export const STUDY_PRESET = {
  key: 'study',
  name: 'Study',
  icon: 'book-open',
  description: 'A complete study loop — notes with key terms, a glossary, flashcards, quizzes, reminders, and progress graphs, all wired together.',
  pages: [
    {
      name: 'Today', icon: 'sun', home: true,
      widgets: [
        { type: 'overview', name: 'Today', config: { items: [{ widgetId: '@nb' }, { widgetId: '@fc' }, { widgetId: '@qz' }, { widgetId: '@sk' }, { widgetId: '@hb' }], showEmpty: false } },
        { type: 'reminder', name: 'Study reminders' },
        { type: 'skill', name: 'Studying', ref: 'sk', w: 'half' },
        { type: 'habit', name: 'Study every day', ref: 'hb', w: 'half' },
        { type: 'notes', name: 'Scratchpad', objects: [{ kind: 'note', data: { html: '<p>Anything on your mind for today’s study…</p>', lastOpened: null } }] }
      ]
    },
    {
      name: 'Notebook', icon: 'book-open',
      widgets: [
        { type: 'notebook', name: 'Notebook', ref: 'nb' },
        { type: 'elements', name: 'Glossary', config: { sources: [{ notebookId: '@nb', on: true }] } },
        { type: 'docshelf', name: 'Files & handouts', ref: 'lib' }
      ]
    },
    {
      name: 'Study', icon: 'layers',
      widgets: [
        { type: 'flashcards', name: 'Flashcards', ref: 'fc', config: { sources: [{ notebookId: '@nb', on: true }] } },
        { type: 'quiz', name: 'Quiz', ref: 'qz', config: { sources: [{ fcId: '@fc', on: true }] } }
      ]
    },
    {
      name: 'Progress', icon: 'bar-chart',
      widgets: [
        { type: 'graph', name: 'Study skills', config: { graphs: [{
          id: 'g_skills', kind: 'flower', range: 'all', absoluteScale: true, scaleMax: 100,
          xAxis: { type: 'category', grain: null, period: 0, label: '' },
          yAxis: { dim: 'score', label: 'Recall', unit: '%' },
          legend: false, valueLabels: false, gridlines: false, rotationDeg: 0,
          datasets: [{ id: 'd_skills', name: 'Study skills', source: 'study', points: [] }]
        }] } },
        { type: 'graph', name: 'Cards reviewed', config: { graphs: [{
          id: 'g_rev', kind: 'bar', range: '30d',
          xAxis: { type: 'time', grain: 'week', period: 0, label: '' },
          yAxis: { dim: 'completed', label: 'Cards', unit: '' },
          legend: true, valueLabels: true, gridlines: true,
          datasets: [{ id: 'd_rev', name: 'Cards reviewed', source: 'link', link: { sourceWidgetId: '@fc', output: 'reviewsToday', transform: { scale: 1 } }, points: [] }]
        }] } },
        { type: 'graph', name: 'Quiz scores by time of day', config: { graphs: [{
          id: 'g_qz', kind: 'scatter', range: '30d',
          xDomain: [0, 24], yDomain: [0, 100], xTicks: [{ at: 0, label: '12a' }, { at: 6, label: '6a' }, { at: 12, label: '12p' }, { at: 18, label: '6p' }, { at: 24, label: '12a' }],
          xAxis: { type: 'value', grain: null, period: 0, label: 'Time of day' },
          yAxis: { dim: 'score', label: 'Score', unit: '%' },
          legend: false, valueLabels: false, gridlines: true,
          datasets: [{ id: 'd_qz', name: 'Quiz scores', source: 'quizscores', link: { sourceWidgetId: '@qz' }, points: [] }]
        }] } },
        { type: 'questboard', name: 'Study goals' }
      ]
    }
  ]
};
