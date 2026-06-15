/* Quiz widget (docs/05 + V2 §27): multiple-choice quizzes built from Notebook
   Elements (Term / Definition / Detail / Example), organised by Class → Unit →
   Topic. No question cap; decks are explicitly chosen (none by default);
   distractors come from the same topic (widening if scarce); three session
   formats; results split Correct / Semi-correct / Incorrect with retry; every
   quiz is saved to history and re-openable. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, field, seg, emptyState, toast } from '../ui/components.js';
import { objectsOf, createObject, todayStr, fmtDate, bloomBurst } from './base.js';
import { moduleElements } from './notebook-parse.js';

const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const FIELD = { term: t => t.term, definition: t => t.definition, detail: t => (t.details || []).join('; '), example: t => (t.examples || []).join('; ') };
const FIELD_LABELS = [['term', 'Key Term'], ['definition', 'Definition'], ['detail', 'Detail'], ['example', 'Example']];

function terms(widget) { return moduleElements(widget, { type: 'term' }); }

/** Distractor candidates for a term within a scope. */
function scopePool(all, t, scope) {
  if (scope === 'topic') return all.filter(x => x.topicId === t.topicId && x !== t);
  if (scope === 'unit') return all.filter(x => x.unitId === t.unitId && x !== t);
  if (scope === 'class') return all.filter(x => x.classId === t.classId && x !== t);
  return all.filter(x => x !== t);
}

function buildQuiz(widget) {
  const cfg = widget.config;
  const all = terms(widget);
  const sel = new Set(cfg.selectedTopics || []);
  let pool = all.filter(t => sel.has(t.topicId));
  if (cfg.order === 'shuffled') pool = shuffle(pool);
  if (cfg.count) pool = pool.slice(0, cfg.count);
  const Q = FIELD[cfg.questionField] || FIELD.term, A = FIELD[cfg.answerField] || FIELD.definition;
  const want = Math.max(2, Math.min(8, cfg.optionCount || 4));
  const out = [];
  for (const t of pool) {
    const prompt = Q(t), answer = A(t);
    if (!prompt || !answer) continue;
    let cands = [...new Set(scopePool(all, t, cfg.distractorScope || 'topic').map(A).filter(x => x && x !== answer))];
    for (const wider of ['unit', 'class', 'random']) {
      if (cands.length >= want - 1) break;
      cands = [...new Set([...cands, ...scopePool(all, t, wider).map(A).filter(x => x && x !== answer)])];
    }
    const options = shuffle([answer, ...shuffle(cands).slice(0, want - 1)]);
    out.push({ prompt, answer, options, context: `${t.className} › ${t.topicName}` });
  }
  return out;
}

/* group elements into a Class → Unit → Topic tree for the scope picker */
function scopeTree(widget) {
  const map = new Map();
  for (const t of terms(widget)) {
    if (!map.has(t.classId)) map.set(t.classId, { name: t.className, units: new Map() });
    const u = map.get(t.classId).units;
    if (!u.has(t.unitId)) u.set(t.unitId, { name: t.unitName, topics: new Map() });
    const tp = u.get(t.unitId).topics;
    if (!tp.has(t.topicId)) tp.set(t.topicId, { name: t.topicName, count: 0 });
    tp.get(t.topicId).count++;
  }
  return map;
}

registry.register({
  type: 'quiz',
  name: 'Quiz',
  icon: 'check-square',
  description: 'Multiple-choice quizzes grown from your notes',
  keywords: ['study', 'test', 'practice', 'exam', 'questions'],
  external: true, internal: true,
  defaultConfig: () => ({ selectedTopics: [], count: 0, questionField: 'term', answerField: 'definition', distractorScope: 'topic', optionCount: 4, immediateFeedback: true, order: 'shuffled', format: 'one' }),

  outputs: (widget) => [{
    key: 'scoreToday', name: 'Best quiz score %', dayKeyed: true,
    get: (d) => { const rs = objectsOf(widget.id, 'quizResult').filter(r => r.date === (d || todayStr())); return rs.length ? Math.max(...rs.map(r => Math.round((r.data.score / r.data.total) * 100))) : 0; }
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const last = objectsOf(widget.id, 'quizResult').sort((a, b) => b.createdAt - a.createdAt)[0];
    host.appendChild(el(`<div class="row-between"><span class="soft" style="font-size:0.88rem">${last ? `Last: ${last.data.score}/${last.data.total} · ${fmtDate(last.date)}` : 'No quizzes taken yet'}</span><span class="chip accent">${icon('play', 11)} quiz me</span></div>`));
  },

  renderFull(host, widget, ctx) {
    const cfg = widget.config;
    const save = () => store.put('widgets', widget);

    const setup = () => {
      host.innerHTML = '';
      const tree = scopeTree(widget);
      if (!tree.size) { host.appendChild(emptyState('book-open', 'No key terms in this module yet — add “Term: definition” lines in a Notebook.')); return; }
      const sel = new Set(cfg.selectedTopics || []);

      // scope picker (Class → Unit → Topic, deselectable, group select)
      host.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin:4px 0 6px">DECKS TO TEST (none selected by default)</h3>'));
      const treeEl = el('<div class="qz-tree"></div>');
      const toggle = (ids, on) => { ids.forEach(id => on ? sel.add(id) : sel.delete(id)); cfg.selectedTopics = [...sel]; save(); setup(); };
      for (const [, cl] of tree) {
        const unitTopicIds = [...cl.units.values()].flatMap(u => [...u.topics.keys()]);
        const clOn = unitTopicIds.every(id => sel.has(id));
        const clRow = el(`<label class="qz-node row" style="gap:6px"><input type="checkbox" ${clOn ? 'checked' : ''}><strong></strong></label>`);
        clRow.querySelector('strong').textContent = cl.name;
        clRow.querySelector('input').onchange = (e) => toggle(unitTopicIds, e.target.checked);
        treeEl.appendChild(clRow);
        for (const [, u] of cl.units) {
          const uTopicIds = [...u.topics.keys()];
          const uOn = uTopicIds.every(id => sel.has(id));
          const uRow = el(`<label class="qz-node row" style="gap:6px;padding-left:18px"><input type="checkbox" ${uOn ? 'checked' : ''}><span></span></label>`);
          uRow.querySelector('span').textContent = u.name;
          uRow.querySelector('input').onchange = (e) => toggle(uTopicIds, e.target.checked);
          treeEl.appendChild(uRow);
          for (const [tid, tp] of u.topics) {
            const tRow = el(`<label class="qz-node row" style="gap:6px;padding-left:36px"><input type="checkbox" ${sel.has(tid) ? 'checked' : ''}><span></span><span class="soft" style="font-size:0.74rem"></span></label>`);
            tRow.querySelector('span').textContent = tp.name;
            tRow.querySelectorAll('span')[1].textContent = `${tp.count}`;
            tRow.querySelector('input').onchange = (e) => toggle([tid], e.target.checked);
            treeEl.appendChild(tRow);
          }
        }
      }
      host.appendChild(treeEl);

      // config
      host.appendChild(field('Question shows', seg(FIELD_LABELS.map(([v, l]) => ({ value: v, label: l })), cfg.questionField, (v) => { cfg.questionField = v; save(); })));
      host.appendChild(field('Correct answer is', seg(FIELD_LABELS.map(([v, l]) => ({ value: v, label: l })), cfg.answerField, (v) => { cfg.answerField = v; save(); })));
      host.appendChild(field('Wrong answers from', seg([['topic', 'Same topic'], ['unit', 'Same unit'], ['class', 'Same class'], ['random', 'Random']].map(([v, l]) => ({ value: v, label: l })), cfg.distractorScope, (v) => { cfg.distractorScope = v; save(); })));
      host.appendChild(field('Options', seg([2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) })), cfg.optionCount, (v) => { cfg.optionCount = v; save(); })));
      const countIn = el(`<input class="input" type="number" min="0" placeholder="All" style="width:100px">`); countIn.value = cfg.count || '';
      countIn.addEventListener('change', () => { cfg.count = Number(countIn.value) || 0; save(); });
      host.appendChild(field('How many questions (blank = all)', countIn));
      host.appendChild(field('Order', seg([['shuffled', 'Shuffled'], ['sequential', 'In order']].map(([v, l]) => ({ value: v, label: l })), cfg.order, (v) => { cfg.order = v; save(); })));
      host.appendChild(field('Format', seg([['one', 'One at a time'], ['list', 'List'], ['scroll', 'Scroll']].map(([v, l]) => ({ value: v, label: l })), cfg.format, (v) => { cfg.format = v; save(); })));
      const fb = el(`<button class="chip ${cfg.immediateFeedback ? 'accent' : ''}" style="cursor:pointer">${icon('check', 11)} Immediate feedback</button>`);
      fb.onclick = () => { cfg.immediateFeedback = !cfg.immediateFeedback; fb.classList.toggle('accent'); save(); };
      host.appendChild(field('Feedback', fb));

      const start = el(`<button class="btn btn-primary" style="width:100%">${icon('play', 15)} Begin quiz</button>`);
      start.onclick = () => {
        if (!sel.size) { toast('Select at least one deck first.', 'info'); return; }
        const qs = buildQuiz(widget);
        if (!qs.length) { toast('No questions could be built — add more terms.', 'info'); return; }
        cfg.format === 'one' ? runOne(qs) : runAll(qs);
      };
      host.appendChild(start);

      // history
      const results = objectsOf(widget.id, 'quizResult').sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
      if (results.length) {
        host.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin:16px 0 6px">HISTORY</h3>'));
        for (const r of results) {
          const row = el(`<button class="list-item"><span class="li-main"><span class="li-title">${r.data.score} / ${r.data.total} (${Math.round(r.data.score / r.data.total * 100)}%)</span><span class="li-sub">${fmtDate(r.date)}${r.data.timeMs ? ` · ${Math.round(r.data.timeMs / 1000)}s` : ''}</span></span>${icon('chevron-right', 14)}</button>`);
          row.onclick = () => review(r.data, () => setup());
          host.appendChild(row);
        }
      }
    };

    /* ---- one-at-a-time ---- */
    const runOne = (questions) => {
      let i = 0; const record = []; const startT = Date.now();
      const ask = () => {
        const q = questions[i];
        host.innerHTML = '';
        host.appendChild(el(`<div class="soft" style="text-align:center;font-size:0.78rem;margin-bottom:10px">${i + 1} / ${questions.length}</div>`));
        const panel = el('<div class="panel" style="padding:16px"></div>');
        panel.appendChild(el('<div class="soft" style="font-size:0.74rem;margin-bottom:6px"></div>')).textContent = q.context;
        panel.appendChild(el('<h3 style="margin-bottom:12px"></h3>')).textContent = q.prompt;
        let answered = false;
        for (const opt of q.options) {
          const b = el('<button class="list-item qz-opt"><span class="li-main"><span class="li-title" style="font-weight:400"></span></span></button>');
          b.querySelector('.li-title').textContent = opt;
          b.onclick = () => {
            if (answered && cfg.immediateFeedback) return;
            const correct = opt === q.answer;
            record.push({ ...q, given: opt, correct });
            if (cfg.immediateFeedback) {
              answered = true;
              for (const x of panel.querySelectorAll('.qz-opt')) { const t = x.querySelector('.li-title').textContent; if (t === q.answer) x.classList.add('qz-correct'); else if (t === opt && !correct) x.classList.add('qz-wrong'); x.disabled = true; }
              const nx = el(`<button class="btn btn-primary" style="width:100%;margin-top:10px">${i + 1 < questions.length ? 'Next' : 'Finish'}</button>`);
              nx.onclick = () => { i++; i < questions.length ? ask() : finish(record, startT); };
              panel.appendChild(nx);
            } else { i++; i < questions.length ? ask() : finish(record, startT); }
          };
          panel.appendChild(b);
        }
        host.appendChild(panel);
      };
      ask();
    };

    /* ---- list / scroll: all visible, submit at end ---- */
    const runAll = (questions) => {
      host.innerHTML = '';
      const startT = Date.now();
      const chosen = new Array(questions.length).fill(null);
      const bookmarks = new Set();
      if (cfg.format === 'list') {
        const nav = el('<div class="qz-jump row" style="flex-wrap:wrap;gap:4px;margin-bottom:10px"></div>');
        questions.forEach((_, idx) => { const c = el(`<button class="chip">${idx + 1}</button>`); c.onclick = () => document.getElementById(`qz-q${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); nav.appendChild(c); });
        host.appendChild(nav);
      }
      questions.forEach((q, idx) => {
        const panel = el(`<div class="panel" id="qz-q${idx}" style="padding:14px;margin-bottom:12px"></div>`);
        const head = el(`<div class="row-between" style="margin-bottom:6px"><span class="soft" style="font-size:0.74rem"></span></div>`);
        head.querySelector('span').textContent = `${idx + 1}. ${q.context}`;
        if (cfg.format === 'list') { const bm = el(`<button class="btn-icon">${icon('star', 14)}</button>`); bm.onclick = () => { bookmarks.has(idx) ? bookmarks.delete(idx) : bookmarks.add(idx); bm.classList.toggle('accent'); }; head.appendChild(bm); }
        panel.appendChild(head);
        panel.appendChild(el('<h3 style="margin-bottom:10px"></h3>')).textContent = q.prompt;
        for (const opt of q.options) {
          const b = el('<button class="list-item qz-opt"><span class="li-main"><span class="li-title" style="font-weight:400"></span></span></button>');
          b.querySelector('.li-title').textContent = opt;
          b.onclick = () => { chosen[idx] = opt; for (const x of panel.querySelectorAll('.qz-opt')) x.classList.remove('qz-sel'); b.classList.add('qz-sel'); };
          panel.appendChild(b);
        }
        host.appendChild(panel);
      });
      const submit = el(`<button class="btn btn-primary" style="width:100%">Submit quiz</button>`);
      submit.onclick = () => {
        const record = questions.map((q, idx) => ({ ...q, given: chosen[idx], correct: chosen[idx] === q.answer }));
        finish(record, startT);
      };
      host.appendChild(submit);
    };

    const finish = (record, startT) => {
      const score = record.filter(r => r.correct).length;
      const data = { score, total: record.length, semi: 0, timeMs: Date.now() - startT, questions: record };
      createObject(widget.id, 'quizResult', data, todayStr());
      review(data, () => setup(), true);
    };

    /* ---- review (shared by finish + history reopen) ---- */
    const review = (data, back, justFinished) => {
      host.innerHTML = '';
      const pct = data.total ? data.score / data.total : 0;
      const incorrect = data.questions.filter(q => !q.correct);
      const sum = el(`<div class="empty-state">${icon(pct >= 0.7 ? 'flower' : 'sprout', 32)}
        <h3 style="margin:8px 0 4px">${data.score} / ${data.total} · ${Math.round(pct * 100)}%</h3>
        <p>${data.timeMs ? `${Math.round(data.timeMs / 1000)}s · ` : ''}${incorrect.length} to revisit${data.semi ? ` · ${data.semi} semi-correct` : ''}.</p></div>`);
      host.appendChild(sum);
      if (justFinished && pct >= 0.7) bloomBurst(sum);

      const actions = el('<div class="row" style="justify-content:center;gap:8px;margin:6px 0 12px;flex-wrap:wrap"></div>');
      if (incorrect.length) { const r = el('<button class="btn">Retry incorrect</button>'); r.onclick = () => { cfg.format === 'one' ? runOne(shuffle(incorrect)) : runAll(shuffle(incorrect)); }; actions.appendChild(r); }
      const done = el('<button class="btn btn-primary">Done</button>'); done.onclick = back; actions.appendChild(done);
      host.appendChild(actions);

      host.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin:6px 0 6px">REVIEW</h3>'));
      for (const q of data.questions) {
        const panel = el(`<div class="panel" style="padding:12px;margin-bottom:8px"></div>`);
        panel.appendChild(el(`<div class="row" style="gap:6px;margin-bottom:4px"><span style="color:${q.correct ? 'var(--success)' : 'var(--warn)'}">${icon(q.correct ? 'check-circle' : 'x', 15)}</span><strong class="qz-q"></strong></div>`)).querySelector('.qz-q').textContent = q.prompt;
        panel.appendChild(el(`<div class="qz-rev-given"></div>`)).textContent = `Your answer: ${q.given ?? '—'}`;
        if (!q.correct) panel.appendChild(el(`<div class="qz-rev-ans" style="color:var(--success)"></div>`)).textContent = `Correct: ${q.answer}`;
        host.appendChild(panel);
      }
    };

    setup();
  }
});
