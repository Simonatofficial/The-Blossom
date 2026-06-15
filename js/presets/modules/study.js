/* Study module preset (docs/08 + V2 §25): three pages — Notes, Overview (home),
   and Study. The Overview dashboard is pre-wired to the Notebook, Flashcard, and
   Quiz widgets via @refs so it works the moment it's planted. */

export const STUDY_PRESET = {
  key: 'study',
  name: 'Study',
  icon: 'book-open',
  description: 'Classes→Units→Topics notes with key-term parsing, an Elements glossary, flashcards, quizzes, and a dashboard.',
  pages: [
    {
      name: 'Notes', icon: 'book-open',
      widgets: [
        { type: 'docshelf', name: 'Library', ref: 'lib' },
        { type: 'notebook', name: 'Notebook', ref: 'nb' },
        { type: 'elements', name: 'Elements' },
        { type: 'graph', name: 'Key terms by class', config: { graphs: [{ id: 'g_terms', kind: 'bar', range: '30d', datasets: [{ id: 'd_terms', name: 'Topics', source: 'link', link: { sourceWidgetId: '@nb', output: 'topics', transform: { scale: 1 } }, points: [] }] }] } }
      ]
    },
    {
      name: 'Overview', icon: 'grid', home: true,
      widgets: [
        { type: 'overview', name: 'Study dashboard', config: { items: [{ widgetId: '@nb' }, { widgetId: '@fc' }, { widgetId: '@qz' }] } },
        { type: 'graph', name: 'Cards reviewed', config: { graphs: [{ id: 'g_rev', kind: 'area', range: '30d', datasets: [{ id: 'd_rev', name: 'Reviews', source: 'link', link: { sourceWidgetId: '@fc', output: 'reviewsToday', transform: { scale: 1 } }, points: [] }] }] } },
        { type: 'questboard', name: 'Today’s study tasks' },
        { type: 'notes', name: 'Session notes', objects: [{ kind: 'note', data: { html: '<p>Quick reminders for today’s study session.</p>', lastOpened: null } }] }
      ]
    },
    {
      name: 'Study', icon: 'layers',
      widgets: [
        { type: 'flashcards', name: 'Flashcards', ref: 'fc' },
        { type: 'quiz', name: 'Quiz', ref: 'qz' }
      ]
    }
  ]
};
