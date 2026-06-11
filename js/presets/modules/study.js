/* Study Guide preset module (docs/08 §6): Notes · Flashcards · Quizzes · Library. */

export const STUDY_PRESET = {
  key: 'study',
  name: 'Study Guide',
  icon: 'book-open',
  description: 'Notes by subject, flashcards with spaced repetition, quizzes, and a document shelf.',
  pages: [
    {
      name: 'Notes', icon: 'book-open',
      widgets: [
        { type: 'notebook', name: 'Notebook' },
        { type: 'notes', name: 'How studying grows here', objects: [{ kind: 'note', data: { html: '<p>Write notes by <b>subject → topic</b>. Mark “term — definition” lines with the <b>key</b> icon, then visit Flashcards → <i>Generate from notes</i>. Reviews and quiz scores are linkable values — feed them into a Skill and studying literally levels you up.</p>', lastOpened: null } }] }
      ]
    },
    {
      name: 'Flashcards', icon: 'layers',
      widgets: [{ type: 'flashcards', name: 'Decks' }]
    },
    {
      name: 'Quizzes', icon: 'check-square',
      widgets: [
        { type: 'quiz', name: 'Practice quiz' },
        { type: 'graph', name: 'Scores', config: { graphs: [{ id: 'g1', kind: 'line', range: 'month', aggregate: 'raw', series: [] }] } }
      ]
    },
    {
      name: 'Library', icon: 'archive',
      widgets: [{ type: 'docshelf', name: 'Library' }]
    }
  ]
};
