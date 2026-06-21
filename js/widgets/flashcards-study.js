/* Flashcard study runtime (V2 §W-4): the Study Options sheet, the one-card-at-a-
   time session (flip + Hard/Good/Easy, progress, pause/resume via a saved
   snapshot), the results screen (Restart / Redo Missed / Redo Hard+Good / Done),
   and the Study Set editor. Browsing UI lives in flashcards.js; data in
   flashcards-model.js. */

import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, openDrawer, seg, toast, confirmDialog, promptText } from '../ui/components.js';
import { createObject, saveObject, bloomBurst } from './base.js';
import * as M from './flashcards-model.js';

const ORDER_OPTS = [['adaptive', 'Smart'], ['inorder', 'In order'], ['random', 'Random'], ['hardest', 'Hardest first'], ['easiest', 'Easiest first']];

/** A6: group a graded queue by its scope path → [label, {got,total}] worst-first.
    "Got it" = a Good/Easy grade; a Hard grade counts as missed. */
function partBreakdown(cards) {
  const groups = new Map();
  for (const c of cards) {
    const sc = c.scope || {};
    const label = [sc.className, sc.unitName, sc.deckName].filter(Boolean).join(' › ') || 'Cards';
    if (!groups.has(label)) groups.set(label, { got: 0, total: 0 });
    const g = groups.get(label); g.total++; if (c.result === 'good' || c.result === 'easy') g.got++;
  }
  return [...groups.entries()].sort((a, b) => (a[1].got / a[1].total) - (b[1].got / b[1].total));
}

/** A6: render a "BY PART" panel of label · got/total · % with a soft bar each. */
function partPanel(rows, valOf) {
  const box = el('<div class="panel" style="padding:12px;margin-top:10px"></div>');
  box.appendChild(el('<h3 class="soft" style="font-size:0.72rem;letter-spacing:.05em;margin:0 0 6px">BY PART</h3>'));
  for (const [label, g] of rows) {
    const got = valOf(g), pct = Math.round(got / g.total * 100);
    const row = el(`<div style="margin-bottom:6px"><div class="row-between" style="font-size:0.82rem;gap:8px"><span class="fc-part-lbl" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span><span class="soft" style="white-space:nowrap">${got}/${g.total} · ${pct}%</span></div><div class="fc-progress" style="margin-top:3px"><span style="width:${pct}%"></span></div></div>`);
    row.querySelector('.fc-part-lbl').textContent = label;
    box.appendChild(row);
  }
  return box;
}

/** Multi-select chips for the four card fields. */
function fieldChips(initial) {
  const chosen = new Set(initial);
  const row = el('<div class="row fc-fieldchips" style="flex-wrap:wrap;gap:6px"></div>');
  for (const f of M.FIELDS) {
    const b = el(`<button type="button" class="chip ${chosen.has(f) ? 'accent' : ''}">${M.FIELD_LABEL[f]}</button>`);
    b.onclick = () => { chosen.has(f) ? chosen.delete(f) : chosen.add(f); b.classList.toggle('accent'); };
    row.appendChild(b);
  }
  return { row, get: () => M.FIELDS.filter(f => chosen.has(f)) };
}

/**
 * Show the Study Options sheet, or start immediately when a config is supplied.
 * @param {{widget,ctx,host,render}} env
 * @param {{label,cards,front?,back?,order?,startNow?}} opts
 */
export function startStudy(env, opts) {
  if (!opts.cards.length) { toast('No cards here yet.', 'info'); return; }
  if (opts.startNow && opts.front && opts.back) {
    runSession(env, { label: opts.label, cards: opts.cards, front: opts.front, back: opts.back, order: opts.order || 'inorder' });
    return;
  }
  const d = openDrawer({ title: `Study — ${opts.label || ''}`, iconName: 'play' });
  d.body.appendChild(el(`<p class="soft" style="font-size:0.85rem;margin-bottom:8px">${opts.cards.length} card${opts.cards.length === 1 ? '' : 's'}.</p>`));
  d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block">Front of card</label>'));
  const front = fieldChips(opts.front || ['term']); d.body.appendChild(front.row);
  d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block;margin-top:10px">Back of card</label>'));
  const back = fieldChips(opts.back || ['definition']); d.body.appendChild(back.row);
  d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block;margin-top:10px">Card order</label>'));
  let order = opts.order || 'adaptive';
  d.body.appendChild(seg(ORDER_OPTS.map(([value, label]) => ({ value, label })), order, (v) => order = v));
  d.body.appendChild(el('<p class="soft" style="font-size:0.74rem;margin-top:4px">Smart eases you in on cards you know, weaves in the tricky ones, and ends on a win.</p>'));
  const go = el('<button class="btn btn-primary" style="width:100%;margin-top:14px">Start</button>');
  go.onclick = () => {
    const f = front.get(), b = back.get();
    if (!f.length || !b.length) { toast('Pick at least one field for each side.', 'info'); return; }
    d.close();
    runSession(env, { label: opts.label, cards: opts.cards, front: f, back: b, order });
  };
  d.body.appendChild(go);
}

/** Resume a paused session from its saved snapshot. */
export function resumeSession(env, sessionObj) {
  const s = sessionObj.data;
  runSession(env, { label: s.label, cards: s.cards, front: s.front, back: s.back, order: 'inorder', startIndex: s.index, tally: s.tally, sessionId: sessionObj.id });
}

function runSession(env, opts) {
  const { widget, host } = env;
  let queue = opts.startIndex != null ? opts.cards : M.orderCards(opts.cards, opts.order);
  let i = opts.startIndex || 0, flipped = false;
  const tally = opts.tally || { hard: 0, good: 0, easy: 0 };
  let sessionId = opts.sessionId || null;

  const snapshot = () => {
    const data = { label: opts.label, cards: queue, front: opts.front, back: opts.back, index: i, tally, ts: Date.now() };
    if (sessionId) { const o = store.get('objects', sessionId); if (o) { o.data = data; saveObject(o); } }
    else { sessionId = createObject(widget.id, 'fcSession', data).id; }
  };
  const clearSnapshot = () => { if (sessionId) store.trash('objects', sessionId); sessionId = null; };

  const stage = el('<div class="fc-stage"></div>');
  host.innerHTML = ''; host.appendChild(stage);

  const face = () => {
    const card = queue[i];
    const f = M.cardFaces(card, opts.front, opts.back);
    stage.innerHTML = `
      <div class="row-between" style="margin-bottom:8px">
        <span class="soft" style="font-size:0.78rem">${opts.label || 'Study'} · ${i + 1} / ${queue.length}</span>
        <span class="row" style="gap:4px">${card.real ? `<button class="btn-icon fc-bm" title="Bookmark" style="${M.isBookmarked(card.real) ? 'color:var(--highlight)' : ''}">${icon('star', 15)}</button>` : ''}<button class="btn-icon fc-pause" title="Pause">${icon('pause', 15)}</button><button class="btn-icon fc-close" title="Close">${icon('x', 15)}</button></span>
      </div>
      <div class="fc-progress"><span style="width:${Math.round(i / queue.length * 100)}%"></span></div>
      <div class="fc-card anim-flip ${flipped ? 'flipped' : ''}"><div class="fc-inner">
        <div class="fc-face fc-front"></div><div class="fc-face fc-back"></div></div></div>
      <div class="fc-grades ${flipped ? '' : 'hidden'}">
        <button class="btn" data-g="hard">Hard</button><button class="btn" data-g="good">Good</button><button class="btn" data-g="easy">Easy</button></div>
      ${flipped ? '' : '<p class="soft" style="text-align:center;font-size:0.8rem;margin-top:10px">Tap the card to flip</p>'}`;
    stage.querySelector('.fc-front').textContent = f.front;
    stage.querySelector('.fc-back').textContent = f.back;
    stage.querySelector('.fc-card').onclick = () => { flipped = !flipped; face(); };
    const bm = stage.querySelector('.fc-bm');
    if (bm) bm.onclick = () => { const on = M.toggleBookmark(card.real); bm.style.color = on ? 'var(--highlight)' : ''; toast(on ? 'Bookmarked' : 'Removed bookmark', 'star'); };
    stage.querySelector('.fc-pause').onclick = () => { snapshot(); toast('Session saved — resume from the deck list.', 'check'); env.render(); };
    stage.querySelector('.fc-close').onclick = () => { snapshot(); env.render(); };
    for (const b of stage.querySelectorAll('[data-g]')) b.onclick = () => {
      const g = b.dataset.g;
      M.gradeCard(widget, card, g); card.result = g; tally[g]++;
      flipped = false; i++;
      if (i >= queue.length) { snapshot(); return results(); }
      snapshot(); face();
    };
  };

  const results = () => {
    clearSnapshot();
    stage.innerHTML = `<div class="empty-state">${icon('sprout', 32)}<h3 style="margin:8px 0 4px">The garden grew</h3>
      <p>You tended ${queue.length} card${queue.length === 1 ? '' : 's'} — ${tally.hard} hard · ${tally.good} good · ${tally.easy} easy.</p></div>`;
    const parts = partBreakdown(queue);
    if (parts.length > 1) stage.appendChild(partPanel(parts, g => g.got));
    const wrap = el('<div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px"></div>');
    const redo = (label, filter) => {
      const sub = queue.filter(filter);
      if (!sub.length) return;
      const b = el(`<button class="btn">${label}</button>`);
      b.onclick = () => runSession(env, { label: opts.label, cards: sub.map(c => ({ ...c, result: undefined })), front: opts.front, back: opts.back, order: opts.order });
      wrap.appendChild(b);
    };
    const restart = el('<button class="btn">Restart</button>');
    restart.onclick = () => runSession(env, { label: opts.label, cards: queue.map(c => ({ ...c, result: undefined })), front: opts.front, back: opts.back, order: opts.order });
    wrap.appendChild(restart);
    redo('Redo Missed', c => c.result === 'hard');
    redo('Redo Hard + Good', c => c.result === 'hard' || c.result === 'good');
    const done = el('<button class="btn btn-primary">Done</button>');
    done.onclick = () => env.render();
    wrap.appendChild(done);
    stage.appendChild(wrap); bloomBurst(stage);
  };

  face();
}

/* ---- Study Set editor ---- */
export function openStudySetEditor(env, existing) {
  const { widget } = env;
  const set = existing || { id: ulid(), name: '', color: '', contents: [], front: ['term'], back: ['definition'], order: 'inorder' };
  const d = openDrawer({ title: existing ? 'Edit study set' : 'New study set', iconName: 'layers' });

  const nameIn = el('<input class="input" placeholder="Set name">'); nameIn.value = set.name;
  d.body.appendChild(el('<label class="soft" style="font-size:0.8rem">Name</label>')); d.body.appendChild(nameIn);

  d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block;margin-top:12px">Contents (groups & decks)</label>'));
  const chosen = new Set(set.contents);
  const tree = el('<div class="fc-set-tree"></div>');
  const all = M.allNodes(widget);
  const depthOf = (n) => { let p = n.parentId, k = 0; while (p) { k++; p = all.find(x => x.id === p)?.parentId; } return k; };
  for (const n of all) {
    const row = el(`<label class="row" style="gap:8px;padding:4px 0;padding-left:${depthOf(n) * 16}px"><input type="checkbox" ${chosen.has(n.id) ? 'checked' : ''}><span>${n.kind === 'group' ? icon('layers', 13) : icon('note', 13)} <span class="fc-nn"></span></span></label>`);
    row.querySelector('.fc-nn').textContent = n.name;
    row.querySelector('input').onchange = (e) => { e.target.checked ? chosen.add(n.id) : chosen.delete(n.id); };
    tree.appendChild(row);
  }
  d.body.appendChild(tree);

  d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block;margin-top:12px">Front</label>'));
  const front = fieldChips(set.front); d.body.appendChild(front.row);
  d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block;margin-top:10px">Back</label>'));
  const back = fieldChips(set.back); d.body.appendChild(back.row);
  d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block;margin-top:10px">Card order</label>'));
  let order = set.order;
  d.body.appendChild(seg(ORDER_OPTS.map(([value, label]) => ({ value, label })), order, (v) => order = v));

  const save = el('<button class="btn btn-primary" style="width:100%;margin-top:14px">Save set</button>');
  save.onclick = () => {
    if (!nameIn.value.trim()) { toast('Name the set.', 'info'); return; }
    if (!chosen.size) { toast('Pick at least one group or deck.', 'info'); return; }
    Object.assign(set, { name: nameIn.value.trim(), contents: [...chosen], front: front.get(), back: back.get(), order });
    if (!existing) M.studySets(widget).push(set);
    store.put('widgets', widget); d.close(); env.render();
  };
  d.body.appendChild(save);

  if (existing) {
    const del = el(`<button class="btn" style="width:100%;margin-top:8px;color:var(--warn)">${icon('trash', 15)} Delete set</button>`);
    del.onclick = async () => { if (await confirmDialog({ title: `Delete “${set.name}”?` })) { widget.config.studySets = M.studySets(widget).filter(s => s.id !== set.id); store.put('widgets', widget); d.close(); env.render(); } };
    d.body.appendChild(del);
  }
}
