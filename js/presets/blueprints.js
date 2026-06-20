/* "Help me build" blueprints + assembler (docs/13 §3c). A blueprint is pure data:
   questions (asked one per screen) that toggle BLOCKS (pages, or widget-bundles
   appended to a page-block) and fill PARAMETERS (names/counts/seed). assemble()
   turns a blueprint + the user's answers into a normal preset-def, which the
   existing instantiatePreset then mints + wires (@ref links resolve; unused ones
   drop). Blueprints are added as data over time; v1 ships Study/School. */

/** Read a question's current answer, falling back to its default. */
function answerOf(answers, q) { return answers[q.id] !== undefined ? answers[q.id] : q.default; }

/** Deep-replace exact `@p.<key>` string tokens with derived/answered params. */
function substitute(node, params) {
  if (typeof node === 'string') {
    if (node.startsWith('@p.')) { const v = params[node.slice(3)]; return v == null || v === '' ? '' : v; }
    return node;
  }
  if (Array.isArray(node)) return node.map(n => substitute(n, params));
  if (node && typeof node === 'object') {
    const o = {}; for (const [k, v] of Object.entries(node)) o[k] = substitute(v, params); return o;
  }
  return node;
}

/** Which block ids are included given the answers (always-on + toggles/choices + requires). */
export function includedBlocks(bp, answers) {
  const inc = new Set();
  for (const b of bp.blocks) if (b.always) inc.add(b.id);
  for (const q of bp.questions) {
    const v = answerOf(answers, q);
    if (q.type === 'toggle') { if (v) (q.blocks || []).forEach(id => inc.add(id)); }
    else if (q.type === 'choice') { (q.options?.find(o => o.value === v)?.blocks || []).forEach(id => inc.add(id)); }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of bp.blocks) if (inc.has(b.id)) for (const r of (b.requires || [])) if (!inc.has(r)) { inc.add(r); changed = true; }
  }
  return inc;
}

/** Assemble a blueprint + answers into a preset-def for instantiatePreset. */
export function assemble(bp, answers) {
  const params = { ...answers, ...(bp.derive ? bp.derive(answers) : {}) };
  const inc = includedBlocks(bp, answers);

  const pages = bp.blocks.filter(b => b.page && inc.has(b.id)).map(b => ({ ...structuredClone(b.page), _bid: b.id }));
  const byId = new Map(pages.map(p => [p._bid, p]));
  for (const b of bp.blocks) {
    if (b.widgets && inc.has(b.id) && byId.has(b.target)) byId.get(b.target).widgets.push(...structuredClone(b.widgets));
  }
  for (const p of pages) delete p._bid;

  const def = { key: bp.key, name: bp.base?.name || 'Module', icon: bp.base?.icon || 'circle', theme: bp.base?.theme || null, pages };
  return substitute(def, params);
}

/** A flat preview of what will be planted: [{ name, icon, tools:[…] }]. */
export function previewPages(bp, answers) {
  return assemble(bp, answers).pages.map(p => ({ name: p.name, icon: p.icon, home: !!p.home, tools: (p.widgets || []).map(w => w.name || w.type) }));
}

/* ---- Study / School blueprint (v1) ---- */
export const STUDY_BLUEPRINT = {
  key: 'study',
  title: 'Build your study space',
  intro: 'A few quick questions and we’ll plant a study loop that’s wired together — notes, flashcards, and quizzes that feed each other.',
  base: { name: '@p.modName', icon: 'book-open' },
  derive: (a) => {
    const s = (a.subject || '').trim();
    return { modName: s || 'Study', nbName: s ? `${s} Notebook` : 'Notebook', skillName: s ? `${s}` : 'Studying' };
  },
  questions: [
    { id: 'subject', type: 'text', prompt: 'What are you studying?', help: 'A subject or class — we’ll name things after it. Leave blank to keep it general.', placeholder: 'e.g. Biology' },
    { id: 'today', type: 'toggle', default: true, prompt: 'Add a daily hub?', help: 'A Today page with a study streak, reminders, and an activity feed of what’s due.', blocks: ['today'] },
    { id: 'library', type: 'toggle', default: false, prompt: 'Keep files & handouts?', help: 'A Library on the Notebook page for PDFs, slides, and documents.', blocks: ['library'] },
    { id: 'progress', type: 'toggle', default: true, prompt: 'Track your progress?', help: 'A Progress page graphing cards reviewed and quiz scores over time, plus study goals.', blocks: ['progress'] }
  ],
  blocks: [
    { id: 'today', page: { name: 'Today', icon: 'sun', home: true, widgets: [
      { type: 'overview', name: 'Today', config: { items: [{ widgetId: '@nb' }, { widgetId: '@fc' }, { widgetId: '@qz' }, { widgetId: '@sk' }, { widgetId: '@hb' }], showEmpty: false } },
      { type: 'reminder', name: 'Study reminders' },
      { type: 'skill', name: '@p.skillName', ref: 'sk', w: 'half' },
      { type: 'habit', name: 'Study every day', ref: 'hb', w: 'half' },
      { type: 'notes', name: 'Scratchpad', objects: [{ kind: 'note', data: { html: '<p>Anything on your mind for today’s study…</p>', lastOpened: null } }] }
    ] } },
    { id: 'notebook', always: true, page: { name: 'Notebook', icon: 'book-open', widgets: [
      { type: 'notebook', name: '@p.nbName', ref: 'nb' },
      { type: 'elements', name: 'Glossary', config: { sources: [{ notebookId: '@nb', on: true }] } }
    ] } },
    { id: 'library', widgets: [{ type: 'docshelf', name: 'Files & handouts', ref: 'lib' }], target: 'notebook' },
    { id: 'study', always: true, page: { name: 'Study', icon: 'layers', widgets: [
      { type: 'flashcards', name: 'Flashcards', ref: 'fc', config: { sources: [{ notebookId: '@nb', on: true }] } },
      { type: 'quiz', name: 'Quiz', ref: 'qz', config: { sources: [{ fcId: '@fc', on: true }] } }
    ] } },
    { id: 'progress', page: { name: 'Progress', icon: 'bar-chart', widgets: [
      { type: 'graph', name: 'Cards reviewed', config: { graphs: [{ id: 'g_rev', kind: 'bar', range: '30d', xAxis: { type: 'time', grain: 'week', period: 0, label: '' }, yAxis: { dim: 'completed', label: 'Cards', unit: '' }, legend: true, valueLabels: true, gridlines: true, datasets: [{ id: 'd_rev', name: 'Cards reviewed', source: 'link', link: { sourceWidgetId: '@fc', output: 'reviewsToday', transform: { scale: 1 } }, points: [] }] }] } },
      { type: 'graph', name: 'Quiz scores', config: { graphs: [{ id: 'g_qz', kind: 'line', range: '30d', xAxis: { type: 'time', grain: null, period: 0, label: '' }, yAxis: { dim: 'score', label: 'Score', unit: '%' }, legend: true, valueLabels: true, gridlines: true, smooth: true, datasets: [{ id: 'd_qz', name: 'Best quiz score', source: 'link', link: { sourceWidgetId: '@qz', output: 'scoreToday', transform: { scale: 1 } }, points: [] }] }] } },
      { type: 'questboard', name: 'Study goals' }
    ] } }
  ]
};

const BLUEPRINTS = { study: STUDY_BLUEPRINT };

/** A blueprint for a preset key, or null if none authored yet (→ one-tap plant). */
export function getBlueprint(key) { return BLUEPRINTS[key] || null; }
