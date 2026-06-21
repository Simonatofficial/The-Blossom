/* Quiz widget (V2 §W-5): tests are built from one or more linked Flashcard
   widgets (their Group/Deck tree). Multi-field Question/Answer, four question
   types (MC / True-False / Fill-blank / Dropdown), structural distractor scope,
   launchable Quiz Sets, reopenable history. Generation/grading in quiz-build.js;
   the session runtime in quiz-run.js. (Deferred: Ordering, schedules/goals.) */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, field, seg, popMenu, promptText, confirmDialog, emptyState, toast } from '../ui/components.js';
import { objectsOf, todayStr, fmtDate } from './base.js';
import { FIELDS, FIELD_LABEL, sourceFcIds, quizCards, scopeForest, buildQuestions } from './quiz-build.js';
import { runQuiz, resumeQuiz, review } from './quiz-run.js';

const TYPES = [['mc', 'Multiple choice'], ['truefalse', 'True / False'], ['fill', 'Fill the blank'], ['dropdown', 'Dropdown']];

function fcLabel(fc) {
  const page = store.all('pages').find(p => p.widgets.includes(fc.id));
  const mod = page && store.all('modules').find(m => m.pages.includes(page.id));
  return [mod?.name, page?.name, fc.name].filter(Boolean).join(' › ');
}

function multiChips(initial, onChange) {
  const chosen = new Set(initial);
  const row = el('<div class="row" style="flex-wrap:wrap;gap:6px"></div>');
  for (const f of FIELDS) {
    const b = el(`<button type="button" class="chip ${chosen.has(f) ? 'accent' : ''}">${FIELD_LABEL[f]}</button>`);
    b.onclick = () => { chosen.has(f) ? chosen.delete(f) : chosen.add(f); b.classList.toggle('accent'); onChange([...chosen]); };
    row.appendChild(b);
  }
  return row;
}

registry.register({
  type: 'quiz',
  name: 'Quiz',
  icon: 'check-square',
  description: 'Quizzes built from your Flashcard decks — MC, T/F, fill-blank, dropdown',
  keywords: ['study', 'test', 'practice', 'exam', 'questions'],
  external: true, internal: true,
  defaultConfig: () => ({ sources: [], quizSets: [], selectedDecks: [], questionFields: ['term'], answerFields: ['definition'], detailN: 1, exampleN: 1, type: 'mc', mixedTypes: true, distractorScope: 'topic', optionCount: 4, count: 0, order: 'adaptive', immediateFeedback: true }),

  outputs: (widget) => [{
    key: 'scoreToday', name: 'Best quiz score %', dayKeyed: true,
    get: (d) => { const rs = objectsOf(widget.id, 'quizResult').filter(r => r.date === (d || todayStr())); return rs.length ? Math.max(...rs.map(r => Math.round((r.data.score / r.data.total) * 100))) : 0; }
  }],

  renderCard(host, widget) {
    host.innerHTML = '';
    const last = objectsOf(widget.id, 'quizResult').sort((a, b) => b.createdAt - a.createdAt)[0];
    const lastTxt = last ? `Last: ${last.data.score}✓ · ${(last.data.total - last.data.score - (last.data.semi || 0))}✗ · ${fmtDate(last.date)}` : 'No quizzes yet';
    host.appendChild(el(`<div class="row-between"><span class="soft" style="font-size:0.88rem">${lastTxt}</span><span class="chip accent">${icon('play', 11)} quiz me</span></div>`));
  },

  renderFull(host, widget, ctx) {
    const cfg = widget.config;
    const save = () => store.put('widgets', widget);
    const env = { widget, ctx, host, render: () => setup(), canRetry: true };

    const cardsForDecks = (deckIds) => { const set = new Set(deckIds); return quizCards(widget).filter(c => set.has(c.deckId)); };
    const begin = (deckIds, conf, label) => {
      const cards = cardsForDecks(deckIds);
      if (!cards.length) { toast('No cards in the selected decks.', 'info'); return; }
      const qs = buildQuestions(conf, cards);
      if (!qs.length) { toast('Could not build questions — try different fields.', 'info'); return; }
      runQuiz(env, qs, { ...conf, label: label || 'Quiz' });
    };

    const setup = () => {
      host.innerHTML = '';
      if (!sourceFcIds(widget).length) {
        host.appendChild(el(`<div class="empty-state">${icon('check-square', 30)}<h3 style="margin:8px 0 4px">Link a Flashcard widget</h3><p>Open settings and add a Flashcard widget — its decks become your quiz pool.</p></div>`));
        return;
      }
      const cards = quizCards(widget);

      // launchable quiz sets
      const sets = widget.config.quizSets;
      if (sets.length) host.appendChild(el('<h3 class="soft" style="font-size:0.74rem;letter-spacing:.05em;margin:2px 0 6px">QUIZ SETS</h3>'));
      for (const s of sets) {
        const row = el(`<button class="list-item fc-set">${icon('check-square', 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${TYPES.find(t => t[0] === s.type)?.[1] || s.type} · ${s.contents.length} deck${s.contents.length === 1 ? '' : 's'}</span></span><span class="btn-icon set-menu">${icon('more', 14)}</span><span class="btn-icon set-go" title="Start">${icon('play', 15)}</span></button>`);
        row.querySelector('.li-title').textContent = s.name;
        const start = () => begin(s.contents, s, s.name);
        row.querySelector('.set-go').onclick = (e) => { e.stopPropagation(); start(); };
        row.onclick = (e) => { if (e.target.closest('.btn-icon')) return; start(); };
        row.querySelector('.set-menu').onclick = (e) => {
          e.stopPropagation();
          popMenu(e.currentTarget, [
            { label: 'Load into setup', iconName: 'edit', fn: () => { Object.assign(cfg, { selectedDecks: [...s.contents], questionFields: [...s.questionFields], answerFields: [...s.answerFields], detailN: s.detailN, exampleN: s.exampleN, type: s.type, mixedTypes: s.mixedTypes !== false, distractorScope: s.distractorScope, optionCount: s.optionCount, count: s.count, order: s.order, immediateFeedback: s.immediateFeedback }); save(); setup(); } },
            { label: 'Delete', iconName: 'trash', danger: true, fn: () => { widget.config.quizSets = sets.filter(x => x.id !== s.id); save(); setup(); } }
          ]);
        };
        host.appendChild(row);
      }

      // resumable
      const sessions = objectsOf(widget.id, 'quizSession');
      if (sessions.length) {
        host.appendChild(el('<h3 class="soft" style="font-size:0.74rem;letter-spacing:.05em;margin:10px 0 6px">RESUME</h3>'));
        for (const sObj of sessions) {
          const row = el(`<div class="list-item">${icon('play', 15)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${sObj.data.index} / ${sObj.data.questions.length} answered</span></span><span class="btn-icon res-del">${icon('trash', 13)}</span></div>`);
          row.querySelector('.li-title').textContent = sObj.data.label || 'Quiz';
          row.querySelector('.res-del').onclick = (e) => { e.stopPropagation(); store.trash('objects', sObj.id); setup(); };
          row.onclick = (e) => { if (e.target.closest('.res-del')) return; resumeQuiz(env, sObj); };
          host.appendChild(row);
        }
      }

      // scope picker — the full Class → Section → Unit → … → deck hierarchy, with
      // the Class as the top folder and collapsible groups at every level.
      const forest = scopeForest(widget);
      host.appendChild(el('<h3 class="soft" style="font-size:0.74rem;letter-spacing:.05em;margin:10px 0 6px">DECKS TO TEST</h3>'));
      if (!forest.length) { host.appendChild(el('<p class="soft" style="font-size:0.85rem">Linked flashcards have no cards yet.</p>')); }
      const sel = new Set(cfg.selectedDecks);
      const expand = cfg.scopeExpand || (cfg.scopeExpand = {}); // collapsed state by node id (default open)
      const treeEl = el('<div class="qz-tree"></div>');
      const deckIdsOf = (node) => node.kind === 'deck' ? [node.id] : node.children.flatMap(deckIdsOf);
      const toggle = (ids, on) => { ids.forEach(id => on ? sel.add(id) : sel.delete(id)); cfg.selectedDecks = [...sel]; save(); paintTree(); };
      const paintTree = () => {
        treeEl.innerHTML = '';
        const renderNode = (node, depth) => {
          const ids = deckIdsOf(node);
          const checked = ids.length && ids.every(id => sel.has(id));
          const pad = 8 + depth * 16;
          if (node.kind === 'deck') {
            const r = el(`<label class="qz-node row" style="gap:6px;padding-left:${pad + 18}px"><input type="checkbox" ${checked ? 'checked' : ''}><span></span><span class="soft" style="font-size:0.74rem"></span></label>`);
            r.querySelector('span').textContent = node.name; r.querySelectorAll('span')[1].textContent = node.count;
            r.querySelector('input').onchange = (e) => toggle(ids, e.target.checked);
            treeEl.appendChild(r);
            return;
          }
          const open = expand[node.id] !== false;
          const row = el(`<div class="qz-gnode row" style="gap:4px;padding-left:${pad}px"></div>`);
          const caret = el(`<button class="qz-caret btn-icon" title="${open ? 'Collapse' : 'Expand'}">${icon(open ? 'chevron-down' : 'chevron-right', 14)}</button>`);
          const box = el(`<input type="checkbox" ${checked ? 'checked' : ''}>`);
          const name = el('<strong style="flex:1"></strong>'); name.textContent = node.name;
          const cnt = el('<span class="soft" style="font-size:0.74rem"></span>'); cnt.textContent = node.count;
          caret.onclick = () => { expand[node.id] = !open; save(); paintTree(); };
          box.onchange = (e) => toggle(ids, e.target.checked);
          row.append(caret, box, name, cnt);
          treeEl.appendChild(row);
          if (open) node.children.forEach(ch => renderNode(ch, depth + 1));
        };
        forest.forEach(n => renderNode(n, 0));
      };
      paintTree();
      host.appendChild(treeEl);

      // Q/A configuration
      host.appendChild(field('Question shows', multiChips(cfg.questionFields, (v) => { cfg.questionFields = v; save(); })));
      host.appendChild(field('Correct answer is', multiChips(cfg.answerFields, (v) => { cfg.answerFields = v; save(); })));
      const countSeg = (label, key) => field(label, seg([1, 2, 3, 99].map(n => ({ value: n, label: n === 99 ? 'All' : String(n) })), cfg[key], (v) => { cfg[key] = v; save(); }));
      host.appendChild(countSeg('Details to show', 'detailN'));
      host.appendChild(countSeg('Examples to show', 'exampleN'));
      const mixOn = cfg.mixedTypes !== false;
      const mix = el(`<button class="chip ${mixOn ? 'accent' : ''}" style="cursor:pointer">${icon('shuffle', 11)} Mixed types</button>`);
      mix.onclick = () => { cfg.mixedTypes = !mixOn; save(); setup(); };
      host.appendChild(field('Question style', mix));
      host.appendChild(el(`<p class="soft" style="font-size:0.74rem;margin:-4px 0 6px">${mixOn ? 'Question style varies each card to keep it fresh.' : 'Every question uses the one type below.'}</p>`));
      if (!mixOn) host.appendChild(field('Question type', seg(TYPES.map(([v, l]) => ({ value: v, label: l })), cfg.type, (v) => { cfg.type = v; save(); setup(); })));
      if (mixOn || cfg.type === 'mc' || cfg.type === 'dropdown') {
        host.appendChild(field('Wrong answers from', seg([['topic', 'Topic'], ['unit', 'Unit'], ['class', 'Class'], ['random', 'Random']].map(([v, l]) => ({ value: v, label: l })), cfg.distractorScope, (v) => { cfg.distractorScope = v; save(); })));
        if (mixOn || cfg.type === 'mc') host.appendChild(field('Options', seg([2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) })), cfg.optionCount, (v) => { cfg.optionCount = v; save(); })));
      }
      const countIn = el('<input class="input" type="number" min="0" placeholder="All" style="width:100px">'); countIn.value = cfg.count || '';
      countIn.addEventListener('change', () => { cfg.count = Number(countIn.value) || 0; save(); });
      host.appendChild(field('How many questions (blank = all)', countIn));
      host.appendChild(field('Order', seg([['adaptive', 'Smart'], ['shuffled', 'Shuffled'], ['sequential', 'In order']].map(([v, l]) => ({ value: v, label: l })), cfg.order, (v) => { cfg.order = v; save(); })));
      if (cfg.order === 'adaptive') host.appendChild(el('<p class="soft" style="font-size:0.74rem;margin:-4px 0 6px">Eases in on what you know, weaves in weak spots, and ends on a win.</p>'));
      const fb = el(`<button class="chip ${cfg.immediateFeedback ? 'accent' : ''}" style="cursor:pointer">${icon('check', 11)} Immediate feedback</button>`);
      fb.onclick = () => { cfg.immediateFeedback = !cfg.immediateFeedback; fb.classList.toggle('accent'); save(); };
      host.appendChild(field('Feedback', fb));

      const start = el(`<button class="btn btn-primary" style="width:100%">${icon('play', 15)} Begin quiz</button>`);
      start.onclick = () => { if (!sel.size) { toast('Select at least one deck.', 'info'); return; } begin([...sel], cfg, 'Quiz'); };
      host.appendChild(start);
      const saveSet = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('plus', 15)} Save as Quiz Set</button>`);
      saveSet.onclick = async () => {
        if (!sel.size) { toast('Select decks first.', 'info'); return; }
        const name = await promptText({ title: 'New quiz set', label: 'Name' }); if (!name) return;
        widget.config.quizSets.push({ id: `qs_${Date.now()}`, name, contents: [...sel], questionFields: [...cfg.questionFields], answerFields: [...cfg.answerFields], detailN: cfg.detailN, exampleN: cfg.exampleN, type: cfg.type, mixedTypes: cfg.mixedTypes !== false, distractorScope: cfg.distractorScope, optionCount: cfg.optionCount, count: cfg.count, order: cfg.order, immediateFeedback: cfg.immediateFeedback });
        save(); setup();
      };
      host.appendChild(saveSet);

      // history + all-time tally (raw counts say more than a lone %)
      const allResults = objectsOf(widget.id, 'quizResult').sort((a, b) => b.createdAt - a.createdAt);
      if (allResults.length) {
        const tot = allResults.reduce((a, r) => {
          a.correct += r.data.score; a.semi += r.data.semi || 0;
          a.incorrect += r.data.total - r.data.score - (r.data.semi || 0); a.q += r.data.total; return a;
        }, { correct: 0, semi: 0, incorrect: 0, q: 0 });
        host.appendChild(el('<h3 class="soft" style="font-size:0.74rem;letter-spacing:.05em;margin:16px 0 6px">HISTORY</h3>'));
        host.appendChild(el(`<div class="panel" style="padding:10px 12px;margin-bottom:8px"><div class="row-between"><span style="color:var(--success)">${tot.correct} correct ✓</span><span style="color:var(--warn)">${tot.incorrect} incorrect ✗</span></div><div class="soft" style="font-size:0.74rem;margin-top:2px">${allResults.length} quiz${allResults.length === 1 ? '' : 'zes'} · ${tot.q} question${tot.q === 1 ? '' : 's'}${tot.semi ? ` · ${tot.semi} partial` : ''}</div></div>`));
        for (const r of allResults.slice(0, 8)) {
          const inc = r.data.total - r.data.score - (r.data.semi || 0);
          const row = el(`<button class="list-item"><span class="li-main"><span class="li-title">${r.data.score}✓ · ${inc}✗${r.data.semi ? ` · ${r.data.semi}~` : ''}</span><span class="li-sub">${fmtDate(r.date)} · ${r.data.total} Q${r.data.timeMs ? ` · ${Math.round(r.data.timeMs / 1000)}s` : ''}</span></span>${icon('chevron-right', 14)}</button>`);
          row.onclick = () => review({ ...env, canRetry: true }, r.data, false);
          host.appendChild(row);
        }
      }
    };

    setup();
  },

  renderSettings(host, widget, ctx) {
    if (!widget.config.quizSets) widget.config.quizSets = [];
    if (!widget.config.sources) widget.config.sources = [];
    const render = () => {
      host.innerHTML = '';
      host.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:8px">Link Flashcard widgets — their decks become the quiz pool.</p>'));
      const sources = widget.config.sources;
      const list = el('<div class="sn-sources"></div>');
      if (!sources.length) list.appendChild(el('<p class="soft" style="font-size:0.84rem">No flashcards linked.</p>'));
      const commit = () => { store.put('widgets', widget); ctx.refreshCard?.(widget); render(); };
      sources.forEach((s, i) => {
        const fc = store.get('widgets', s.fcId);
        const row = el(`<div class="row-between sn-src-row"><label class="row" style="gap:8px;min-width:0"><input type="checkbox" ${s.on ? 'checked' : ''}><span class="sn-src-name" style="overflow:hidden;text-overflow:ellipsis"></span></label><button class="btn-icon sn-rm" title="Remove">${icon('x', 14)}</button></div>`);
        row.querySelector('.sn-src-name').textContent = fc ? fcLabel(fc) : '(missing flashcards)';
        row.querySelector('input').onchange = (e) => { s.on = e.target.checked; commit(); };
        row.querySelector('.sn-rm').onclick = () => { sources.splice(i, 1); commit(); };
        list.appendChild(row);
      });
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add Flashcards</button>`);
      add.onclick = () => {
        const avail = store.all('widgets').filter(w => w.type === 'flashcards' && !sources.some(s => s.fcId === w.id));
        if (!avail.length) { toast('No other Flashcard widgets to add.', 'info'); return; }
        popMenu(add, avail.map(fc => ({ label: fcLabel(fc), fn: () => { sources.push({ fcId: fc.id, on: true }); commit(); } })));
      };
      host.append(list, add);
    };
    render();
  }
});
