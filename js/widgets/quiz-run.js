/* Quiz session runtime (V2 §W-5): one question at a time across all four types
   (MC / True-False / Fill-blank / Dropdown), immediate or end feedback, progress
   bar, pause/resume snapshot, results grouped Correct/Semi/Incorrect with
   Restart / Redo Incorrect / Redo Incorrect+Semi / Done, and the shared review
   (also used to reopen history). Generation/grading live in quiz-build.js. */

import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast } from '../ui/components.js';
import { createObject, saveObject, todayStr, bloomBurst } from './base.js';
import { gradeQuestion, correctText, givenText } from './quiz-build.js';
import { recordOutcome } from './study-mastery.js';
import { isBookmarked, toggleBookmark } from './flashcards-model.js';
import { breakReason, showBreakNudge } from './study-break.js';
import { makeCombo } from './study-combo.js';

const STATUS_COLOR = { correct: 'var(--success)', semi: 'var(--highlight)', incorrect: 'var(--warn)' };

export function resumeQuiz(env, sessionObj) {
  const s = sessionObj.data;
  runQuiz(env, s.questions, s.cfg, { index: s.index, record: s.record, sessionId: sessionObj.id, label: s.label });
}

export function runQuiz(env, questions, cfg, resume) {
  const { widget, host } = env;
  if (!questions.length) { env.render(); return; }
  let i = resume?.index || 0;
  const record = resume?.record || []; // [{q, given, status}]
  const startT = Date.now() - (resume?.elapsed || 0);
  let sessionId = resume?.sessionId || null;
  const label = resume?.label || cfg.label || 'Quiz';
  let breakOffered = false; // anti-burnout breather (study-break.js)

  const snapshot = () => {
    const data = { label, questions, cfg, index: i, record, ts: Date.now() };
    if (sessionId) { const o = store.get('objects', sessionId); if (o) { o.data = data; saveObject(o); } }
    else sessionId = createObject(widget.id, 'quizSession', data).id;
  };
  const clearSnapshot = () => { if (sessionId) store.trash('objects', sessionId); sessionId = null; };

  const wrap = el('<div class="qz-run"></div>');
  host.innerHTML = ''; host.appendChild(wrap);
  const combo = makeCombo(wrap);

  const head = () => {
    const q = questions[i];
    return `
    <div class="row-between" style="margin-bottom:8px">
      <span class="row" style="gap:8px;align-items:center"><span class="soft" style="font-size:0.78rem">${label} · ${i + 1} / ${questions.length}</span>${combo.count() >= 2 ? `<span class="study-combo-chip">${icon('sprout', 12)} ${combo.count()}</span>` : ''}</span>
      <span class="row" style="gap:4px">${q && q.real ? `<button class="btn-icon qz-bm" title="Bookmark" style="${isBookmarked(q.real) ? 'color:var(--highlight)' : ''}">${icon('star', 15)}</button>` : ''}<button class="btn-icon qz-pause" title="Pause">${icon('pause', 15)}</button><button class="btn-icon qz-quit" title="Close">${icon('x', 15)}</button></span>
    </div>
    <div class="fc-progress"><span style="width:${Math.round(i / questions.length * 100)}%"></span></div>`;
  };

  const ask = () => {
    const q = questions[i];
    wrap.innerHTML = head();
    wrap.querySelector('.qz-pause').onclick = () => { snapshot(); env.render(); };
    wrap.querySelector('.qz-quit').onclick = () => { snapshot(); env.render(); };
    const bm = wrap.querySelector('.qz-bm');
    if (bm) bm.onclick = () => { const on = toggleBookmark(q.real); bm.style.color = on ? 'var(--highlight)' : ''; toast(on ? 'Bookmarked' : 'Removed bookmark', 'star'); };
    const panel = el('<div class="panel" style="padding:16px"></div>');
    panel.appendChild(el('<div class="soft" style="font-size:0.74rem;margin-bottom:6px"></div>')).textContent = q.context;
    wrap.appendChild(panel);

    const commit = (given) => {
      const status = gradeQuestion(q, given);
      record.push({ q, given, status });
      combo.hit(status === 'correct'); // earned glow on a run of correct answers
      const advance = () => {
        i++; snapshot();
        if (i >= questions.length) return finish();
        const misses = record.slice(-5).filter(r => r.status === 'incorrect' || r.status === 'semi').length;
        const reason = breakOffered ? null : breakReason(i, misses);
        if (reason) { breakOffered = true; return showBreakNudge(wrap, { reason, count: i, onBreak: () => env.render(), onContinue: () => ask() }); }
        ask();
      };
      if (!cfg.immediateFeedback) return advance();
      showFeedback(panel, q, given, status);
      const nx = el(`<button class="btn btn-primary" style="width:100%;margin-top:12px">${i + 1 < questions.length ? 'Next' : 'Finish'}</button>`);
      nx.onclick = advance; panel.appendChild(nx);
    };

    if (q.type === 'mc') {
      panel.appendChild(el('<h3 style="margin-bottom:12px;white-space:pre-wrap"></h3>')).textContent = q.qText;
      for (const opt of q.options) {
        const b = el('<button class="list-item qz-opt"><span class="li-main"><span class="li-title" style="font-weight:400;white-space:pre-wrap"></span></span></button>');
        b.querySelector('.li-title').textContent = opt;
        b.onclick = () => { for (const x of panel.querySelectorAll('.qz-opt')) x.disabled = true; commit(opt); };
        panel.appendChild(b);
      }
    } else if (q.type === 'truefalse') {
      panel.appendChild(el('<h3 style="margin-bottom:12px;white-space:pre-wrap"></h3>')).textContent = q.statement;
      const row = el('<div class="row" style="gap:8px"></div>');
      for (const [val, lbl] of [[true, 'True'], [false, 'False']]) {
        const b = el(`<button class="btn" style="flex:1">${lbl}</button>`);
        b.onclick = () => { for (const x of row.querySelectorAll('button')) x.disabled = true; commit(val); };
        row.appendChild(b);
      }
      panel.appendChild(row);
    } else { // fill / dropdown
      panel.appendChild(el('<h3 style="margin-bottom:10px;white-space:pre-wrap"></h3>')).textContent = q.qText;
      const inputs = [];
      for (const b of q.blanks) {
        panel.appendChild(el('<label class="soft" style="font-size:0.78rem;display:block;margin-top:6px"></label>')).textContent = b.label;
        if (q.type === 'dropdown') {
          const sel = el('<select class="select"></select>'); sel.appendChild(new Option('— choose —', ''));
          for (const o of b.options) sel.appendChild(new Option(o, o));
          panel.appendChild(sel); inputs.push(() => sel.value);
        } else {
          const inp = el('<input class="input" placeholder="Your answer">'); panel.appendChild(inp); inputs.push(() => inp.value);
        }
      }
      const submit = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Submit</button>');
      submit.onclick = () => { submit.disabled = true; commit(inputs.map(g => g())); };
      panel.appendChild(submit);
    }
  };

  const showFeedback = (panel, q, given, status) => {
    if (q.type === 'mc') {
      for (const x of panel.querySelectorAll('.qz-opt')) { const t = x.querySelector('.li-title').textContent; if (t === q.correct) x.classList.add('qz-correct'); else if (t === given) x.classList.add('qz-wrong'); }
    } else {
      const fb = el('<div class="qz-fb" style="margin-top:10px"></div>');
      fb.style.color = STATUS_COLOR[status];
      fb.textContent = status === 'correct' ? '✓ Correct' : `${status === 'semi' ? '~ Partly right' : '✗ Incorrect'} · Answer: ${correctText(q)}`;
      panel.appendChild(fb);
    }
  };

  const finish = () => {
    clearSnapshot(); combo.clear();
    for (const r of record) recordOutcome(r.q.real, r.status === 'semi' ? 'partial' : r.status); // A2: weak-spot tracking
    const score = record.filter(r => r.status === 'correct').length;
    const semi = record.filter(r => r.status === 'semi').length;
    const data = { score, semi, total: record.length, timeMs: Date.now() - startT, cfg, label, questions: record.map(r => ({ ...r.q, given: r.given, status: r.status })) };
    createObject(widget.id, 'quizResult', data, todayStr());
    review(env, data, true);
  };

  ask();
}

/** Results + full review; reused by finish and history reopen. */
export function review(env, data, justFinished) {
  const { host } = env;
  const pct = data.total ? data.score / data.total : 0;
  host.innerHTML = '';
  const incorrect = data.total - data.score - (data.semi || 0);
  const sum = el(`<div class="empty-state">${icon(pct >= 0.7 ? 'flower' : 'sprout', 32)}
    <h3 style="margin:8px 0 4px">${data.score} correct ✓ · ${incorrect} incorrect ✗</h3>
    <p>${Math.round(pct * 100)}% · ${data.total} question${data.total === 1 ? '' : 's'}${data.semi ? ` · ${data.semi} partial` : ''}${data.timeMs ? ` · ${Math.round(data.timeMs / 1000)}s` : ''}</p></div>`);
  host.appendChild(sum);
  if (justFinished && pct >= 0.7) bloomBurst(sum);

  // A6: per-part % by scope (Class › Unit › Topic) — worst first
  const parts = new Map();
  for (const q of data.questions) {
    const label = q.context || 'Questions';
    if (!parts.has(label)) parts.set(label, { correct: 0, total: 0 });
    const g = parts.get(label); g.total++; if (q.status === 'correct') g.correct++;
  }
  if (parts.size > 1) {
    const box = el('<div class="panel" style="padding:12px;margin:0 0 12px"></div>');
    box.appendChild(el('<h3 class="soft" style="font-size:0.72rem;letter-spacing:.05em;margin:0 0 6px">BY PART</h3>'));
    for (const [label, g] of [...parts].sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))) {
      const ppct = Math.round(g.correct / g.total * 100);
      const row = el(`<div style="margin-bottom:6px"><div class="row-between" style="font-size:0.82rem;gap:8px"><span class="qz-part-lbl" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span><span class="soft" style="white-space:nowrap">${g.correct}/${g.total} · ${ppct}%</span></div><div class="fc-progress" style="margin-top:3px"><span style="width:${ppct}%"></span></div></div>`);
      row.querySelector('.qz-part-lbl').textContent = label;
      box.appendChild(row);
    }
    host.appendChild(box);
  }

  const cfg = data.cfg || {};
  const actions = el('<div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap;margin:6px 0 12px"></div>');
  const redo = (label, filter) => {
    const subset = data.questions.filter(filter).map(q => { const { given, status, ...rest } = q; return rest; });
    if (!subset.length) return;
    const b = el(`<button class="btn">${label}</button>`); b.onclick = () => runQuiz(env, subset, cfg); actions.appendChild(b);
  };
  if (justFinished || env.canRetry) {
    const restart = el('<button class="btn">Restart</button>');
    restart.onclick = () => runQuiz(env, data.questions.map(q => { const { given, status, ...rest } = q; return rest; }), cfg);
    actions.appendChild(restart);
    redo('Redo Incorrect', q => q.status === 'incorrect');
    redo('Redo Incorrect + Semi', q => q.status === 'incorrect' || q.status === 'semi');
  }
  const done = el('<button class="btn btn-primary">Done</button>'); done.onclick = () => env.render(); actions.appendChild(done);
  host.appendChild(actions);

  for (const group of ['incorrect', 'semi', 'correct']) {
    const items = data.questions.filter(q => q.status === group);
    if (!items.length) continue;
    host.appendChild(el(`<h3 class="soft" style="font-size:0.76rem;margin:10px 0 6px;text-transform:uppercase">${group}</h3>`));
    for (const q of items) {
      const panel = el('<div class="panel" style="padding:12px;margin-bottom:8px"></div>');
      panel.appendChild(el(`<div class="row" style="gap:6px;margin-bottom:4px"><span style="color:${STATUS_COLOR[q.status]}">${icon(q.status === 'correct' ? 'check-circle' : q.status === 'semi' ? 'circle' : 'x', 15)}</span><strong class="qz-q" style="white-space:pre-wrap"></strong></div>`)).querySelector('.qz-q').textContent = q.qText || q.statement;
      panel.appendChild(el('<div class="qz-rev-given"></div>')).textContent = `Your answer: ${givenText(q, q.given)}`;
      if (q.status !== 'correct') panel.appendChild(el('<div class="qz-rev-ans" style="color:var(--success)"></div>')).textContent = `Correct: ${correctText(q)}`;
      host.appendChild(panel);
    }
  }
}
