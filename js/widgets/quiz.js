/* Quiz widget (docs/08 §6): practice quizzes built from flashcard decks —
   multiple choice (distractors from sibling cards), true/false, type-the-
   answer (fuzzy match), match-pairs. Results are day-keyed objects:
   graphable and linkable to Skills. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, field, seg, emptyState } from '../ui/components.js';
import { objectsOf, createObject, todayStr, fmtDate, bloomBurst } from './base.js';

const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

/* fuzzy answer match: case/space-insensitive, small typo tolerance */
function fuzzyMatch(answer, truth) {
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const a = norm(answer), t = norm(truth);
  if (!a) return false;
  if (a === t || t.includes(a) && a.length >= t.length * 0.7) return true;
  if (Math.abs(a.length - t.length) > 3) return false;
  // tiny levenshtein with early exit
  const m = a.length, n = t.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === t[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n] <= Math.max(1, Math.floor(t.length / 5));
}

function moduleDecks(widget) {
  const mod = store.all('modules').find(m => m.pages.some(p => store.get('pages', p)?.widgets.includes(widget.id)));
  if (!mod) return [];
  const out = [];
  for (const pid of mod.pages) {
    for (const wid of (store.get('pages', pid)?.widgets || [])) {
      const w = store.get('widgets', wid);
      if (w?.type !== 'flashcards') continue;
      for (const deck of (w.config.decks || [])) {
        out.push({ deck, cards: objectsOf(w.id, 'flashcard').filter(c => c.data.deckId === deck.id) });
      }
    }
  }
  return out;
}

/** Build a question list from the chosen decks. */
function buildQuiz(widget) {
  const cfg = widget.config;
  const pools = moduleDecks(widget).filter(d => !cfg.deckIds.length || cfg.deckIds.includes(d.deck.id));
  const all = pools.flatMap(p => p.cards.map(c => ({ card: c, deck: p.deck })));
  if (all.length < 2) return [];
  const picked = shuffle(all).slice(0, cfg.length || 10);
  const types = ['mc', 'tf', 'type', 'match'].filter(t => cfg.types[t]);
  if (!types.length) types.push('mc');
  const questions = [];
  const matchPool = [];
  for (const { card, deck } of picked) {
    const t = types[Math.floor(Math.random() * types.length)];
    if (t === 'match') { matchPool.push({ card, deck }); continue; }
    if (t === 'mc') {
      const distractors = shuffle(all.filter(x => x.card.id !== card.id)).slice(0, 3).map(x => x.card.data.back);
      questions.push({ kind: 'mc', deck, card, prompt: card.data.front, options: shuffle([card.data.back, ...distractors]), answer: card.data.back });
    } else if (t === 'tf') {
      const lie = Math.random() < 0.5;
      const other = shuffle(all.filter(x => x.card.id !== card.id))[0];
      questions.push({ kind: 'tf', deck, card, prompt: `${card.data.front} — ${lie ? other.card.data.back : card.data.back}`, answer: !lie });
    } else {
      questions.push({ kind: 'type', deck, card, prompt: card.data.front, answer: card.data.back });
    }
  }
  // group match-pairs into one question per 3–4 pairs
  for (let i = 0; i < matchPool.length; i += 4) {
    const pairs = matchPool.slice(i, i + 4);
    if (pairs.length >= 2) questions.push({ kind: 'match', deck: pairs[0].deck, pairs: pairs.map(p => ({ front: p.card.data.front, back: p.card.data.back })) });
  }
  return shuffle(questions);
}

registry.register({
  type: 'quiz',
  name: 'Quiz',
  icon: 'check-square',
  description: 'Practice quizzes grown from your decks',
  keywords: ['study', 'test', 'practice', 'exam', 'questions'],
  external: true, internal: true,
  defaultConfig: () => ({ length: 10, types: { mc: true, tf: true, type: true, match: false }, deckIds: [] }),

  outputs: (widget) => [{
    key: 'scoreToday', name: 'Best quiz score %', dayKeyed: true,
    get: (d) => {
      const rs = objectsOf(widget.id, 'quizResult').filter(r => r.date === (d || todayStr()));
      return rs.length ? Math.max(...rs.map(r => Math.round((r.data.score / r.data.total) * 100))) : 0;
    }
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const last = objectsOf(widget.id, 'quizResult').sort((a, b) => b.createdAt - a.createdAt)[0];
    host.appendChild(el(`<div class="row-between">
      <span class="soft" style="font-size:0.88rem">${last ? `Last: ${last.data.score}/${last.data.total} · ${fmtDate(last.date)}` : 'No quizzes taken yet'}</span>
      <span class="chip accent">${icon('play', 11)} quiz me</span></div>`));
  },

  renderFull(host, widget, ctx) {
    const cfg = widget.config;
    const save = () => store.put('widgets', widget);

    const setup = () => {
      host.innerHTML = '';
      const deckList = moduleDecks(widget);
      if (!deckList.length) {
        host.appendChild(emptyState('layers', 'No flashcard decks in this module yet — grow some first.'));
        return;
      }
      host.appendChild(field('Length', seg([5, 10, 20].map(n => ({ value: n, label: String(n) })), cfg.length, (v) => { cfg.length = v; save(); })));
      const typeRow = el('<div class="row" style="flex-wrap:wrap;margin-bottom:14px"></div>');
      for (const [key, label] of [['mc', 'Choice'], ['tf', 'True/false'], ['type', 'Type it'], ['match', 'Match pairs']]) {
        const chip = el(`<button class="chip ${cfg.types[key] ? 'accent' : ''}" style="cursor:pointer">${label}</button>`);
        chip.onclick = () => { cfg.types[key] = !cfg.types[key]; chip.classList.toggle('accent'); save(); };
        typeRow.appendChild(chip);
      }
      host.appendChild(field('Question types', typeRow));
      const deckRow = el('<div class="row" style="flex-wrap:wrap;margin-bottom:14px"></div>');
      for (const { deck, cards } of deckList) {
        const on = !cfg.deckIds.length || cfg.deckIds.includes(deck.id);
        const chip = el(`<button class="chip ${on ? 'accent' : ''}" style="cursor:pointer">${deck.name} (${cards.length})</button>`);
        chip.onclick = () => {
          const set = new Set(cfg.deckIds.length ? cfg.deckIds : deckList.map(d => d.deck.id));
          set.has(deck.id) ? set.delete(deck.id) : set.add(deck.id);
          cfg.deckIds = [...set];
          save();
          setup();
        };
        deckRow.appendChild(chip);
      }
      host.appendChild(field('Decks', deckRow));
      const start = el(`<button class="btn btn-primary" style="width:100%">${icon('play', 15)} Begin</button>`);
      start.onclick = () => {
        const qs = buildQuiz(widget);
        if (qs.length < 1) { ctx.toast('Need at least 2 cards to quiz.', 'info'); return; }
        run(qs);
      };
      host.appendChild(start);

      const results = objectsOf(widget.id, 'quizResult').sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
      if (results.length) {
        host.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin:16px 0 6px">RECENT</h3>'));
        for (const r of results) {
          host.appendChild(el(`<div class="list-item" style="cursor:default"><span class="li-main"><span class="li-title">${r.data.score} / ${r.data.total}</span><span class="li-sub">${fmtDate(r.date)}${r.data.weakest ? ` · tend: ${r.data.weakest}` : ''}</span></span></div>`));
        }
      }
    };

    const run = (questions) => {
      let i = 0;
      const record = [];
      const next = (correct, given) => {
        record.push({ prompt: questions[i].prompt || 'match pairs', correct, given, deck: questions[i].deck?.name });
        i++;
        i < questions.length ? ask() : finish();
      };

      const ask = () => {
        const q = questions[i];
        host.innerHTML = '';
        host.appendChild(el(`<div class="soft" style="text-align:center;font-size:0.78rem;margin-bottom:10px">${i + 1} / ${questions.length}</div>`));
        const panel = el('<div class="panel" style="padding:16px"></div>');
        host.appendChild(panel);

        if (q.kind === 'mc') {
          panel.appendChild(el(`<h3 style="margin-bottom:12px"></h3>`)).textContent = q.prompt;
          for (const opt of q.options) {
            const b = el('<button class="list-item"><span class="li-main"><span class="li-title" style="font-weight:400"></span></span></button>');
            b.querySelector('.li-title').textContent = opt;
            b.onclick = () => next(opt === q.answer, opt);
            panel.appendChild(b);
          }
        } else if (q.kind === 'tf') {
          panel.appendChild(el('<h3 style="margin-bottom:12px"></h3>')).textContent = q.prompt;
          const row = el('<div class="row"></div>');
          for (const [label, val] of [['True', true], ['False', false]]) {
            const b = el(`<button class="btn grow">${label}</button>`);
            b.onclick = () => next(val === q.answer, label);
            row.appendChild(b);
          }
          panel.appendChild(row);
        } else if (q.kind === 'type') {
          panel.appendChild(el('<h3 style="margin-bottom:12px"></h3>')).textContent = q.prompt;
          const input = el('<input class="input" placeholder="Type your answer…">');
          const go = el('<button class="btn btn-primary" style="width:100%;margin-top:8px">Check</button>');
          const check = () => next(fuzzyMatch(input.value, q.answer), input.value);
          go.onclick = check;
          input.onkeydown = (e) => { if (e.key === 'Enter') check(); };
          panel.append(input, go);
        } else { // match-pairs
          panel.appendChild(el('<h3 style="margin-bottom:12px">Match the pairs</h3>'));
          const left = shuffle(q.pairs.map(p => p.front));
          const right = shuffle(q.pairs.map(p => p.back));
          const grid = el('<div class="qz-match"></div>');
          let pickL = null;
          let solved = 0, misses = 0;
          const cells = [];
          const mk = (txt, side) => {
            const c = el('<button class="qz-cell"></button>');
            c.textContent = txt;
            c.onclick = () => {
              if (c.classList.contains('done')) return;
              if (side === 'L') {
                cells.forEach(x => x.classList.remove('sel'));
                c.classList.add('sel');
                pickL = txt;
              } else if (pickL != null) {
                const pair = q.pairs.find(p => p.front === pickL);
                if (pair?.back === txt) {
                  solved++;
                  cells.find(x => x.textContent === pickL && !x.classList.contains('done'))?.classList.add('done');
                  c.classList.add('done');
                  if (solved === q.pairs.length) next(misses === 0, `${misses} misses`);
                } else misses++;
                pickL = null;
                cells.forEach(x => x.classList.remove('sel'));
              }
            };
            cells.push(c);
            return c;
          };
          for (let r = 0; r < q.pairs.length; r++) {
            grid.appendChild(mk(left[r], 'L'));
            grid.appendChild(mk(right[r], 'R'));
          }
          panel.appendChild(grid);
        }
      };

      const finish = () => {
        const score = record.filter(r => r.correct).length;
        // weakest deck = most misses
        const missByDeck = {};
        for (const r of record) if (!r.correct && r.deck) missByDeck[r.deck] = (missByDeck[r.deck] || 0) + 1;
        const weakest = Object.entries(missByDeck).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        createObject(widget.id, 'quizResult', { score, total: record.length, perQuestion: record, weakest }, todayStr());
        host.innerHTML = '';
        const sum = el(`<div class="empty-state">${icon(score / record.length >= 0.7 ? 'flower' : 'sprout', 32)}
          <h3 style="margin:8px 0 4px">${score} / ${record.length}</h3>
          <p>${weakest ? `Worth tending: ${weakest}.` : 'A well-kept garden.'}</p>
          <button class="btn btn-primary">Done</button></div>`);
        sum.querySelector('button').onclick = setup;
        host.appendChild(sum);
        if (score / record.length >= 0.7) bloomBurst(sum);
        host.appendChild(el('<h3 class="soft" style="font-size:0.78rem;margin:10px 0 6px">REVIEW</h3>'));
        for (const r of record) {
          const row = el(`<div class="list-item" style="cursor:default">
            <span style="color:${r.correct ? 'var(--success)' : 'var(--warn)'}">${icon(r.correct ? 'check-circle' : 'x', 15)}</span>
            <span class="li-main"><span class="li-title" style="font-weight:400"></span>${r.correct ? '' : '<span class="li-sub"></span>'}</span></div>`);
          row.querySelector('.li-title').textContent = r.prompt;
          if (!r.correct) row.querySelector('.li-sub').textContent = `you said: ${r.given}`;
          host.appendChild(row);
        }
      };

      ask();
    };

    setup();
  }
});
