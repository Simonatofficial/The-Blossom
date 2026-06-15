/* Flashcard widget (docs/05 + V2 §26): cards live in infinitely-nested groups
   (Deck → Group → Subgroup → …). "Generate from Notebook" mirrors a topic's
   Class→Unit→Topic structure and builds cards from its parsed Elements with a
   chosen field mapping. After flipping, rate Hard / Good / Easy; a follow-up
   session can be filtered to just one bucket. SM-2 light still schedules due. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, toast, promptText, confirmDialog, emptyState, openDrawer, seg, popMenu } from '../ui/components.js';
import { objectsOf, createObject, saveObject, dayObject, todayStr, dateAdd, bloomBurst } from './base.js';
import { topicsOf } from './notebook.js';
import { moduleElements } from './notebook-parse.js';

/* ---- node tree (flat list with parentId; null = a root deck) ---- */
function nodes(widget) {
  const c = widget.config;
  if (!c.nodes) { c.nodes = (c.decks || []).map(d => ({ id: d.id, name: d.name, parentId: null })); delete c.decks; store.put('widgets', widget); }
  return c.nodes;
}
function childrenOf(widget, parentId) { return nodes(widget).filter(n => (n.parentId || null) === (parentId || null)); }
function descendantIds(widget, id) {
  const out = [id]; const walk = (p) => { for (const n of nodes(widget)) if (n.parentId === p) { out.push(n.id); walk(n.id); } }; walk(id); return out;
}
function cardsIn(widget, ids) { const set = new Set(ids); return objectsOf(widget.id, 'flashcard').filter(c => set.has(c.data.nodeId || c.data.deckId)); }
function nodeCards(widget, id) { return cardsIn(widget, descendantIds(widget, id)); }
function dueIn(widget, ids) { const t = todayStr(); return cardsIn(widget, ids).filter(c => (c.data.due || t) <= t); }
function ensureChild(widget, parentId, name) {
  let n = childrenOf(widget, parentId).find(x => x.name === name);
  if (!n) { n = { id: ulid(), name, parentId: parentId || null }; nodes(widget).push(n); }
  return n;
}

/* ---- SM-2 light + Hard/Good/Easy bucket ---- */
export function gradeCard(card, grade) {
  const d = card.data;
  d.ease = d.ease ?? 2.3; d.interval = d.interval ?? 0; d.reps = (d.reps || 0) + 1;
  if (grade === 'hard') { d.interval = Math.max(1, Math.round(d.interval * 1.2)) || 1; d.ease = Math.max(1.3, d.ease - 0.15); }
  else if (grade === 'good') { d.interval = d.interval ? Math.round(d.interval * d.ease) : 1; }
  else { d.interval = Math.max(2, Math.round((d.interval || 1) * d.ease * 1.3)); d.ease = Math.min(3, d.ease + 0.1); } // easy
  d.bucket = grade;
  d.due = dateAdd(todayStr(), d.interval);
  saveObject(card);
}

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

registry.register({
  type: 'flashcards',
  name: 'Flashcards',
  icon: 'layers',
  description: 'Nested decks; grow cards from your notes; Hard/Good/Easy',
  keywords: ['study', 'srs', 'memorize', 'deck', 'anki', 'review'],
  external: true, internal: true,
  defaultConfig: () => ({ nodes: [] }),

  outputs: (widget) => [
    { key: 'reviewsToday', name: 'Cards reviewed', dayKeyed: true, get: (d) => store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'studyDay' && o.date === (d || todayStr()))?.data.reviews || 0 },
    { key: 'dueNow', name: 'Cards due', dayKeyed: false, get: () => dueIn(widget, nodes(widget).map(n => n.id)).length }
  ],

  renderCard(host, widget) {
    host.innerHTML = '';
    const roots = childrenOf(widget, null);
    if (!roots.length) { host.appendChild(el('<p class="soft">Tap to plant your first deck.</p>')); return; }
    const due = dueIn(widget, nodes(widget).map(n => n.id)).length;
    host.appendChild(el(`<div class="row-between"><span style="font-size:0.92rem">${roots.length} deck${roots.length === 1 ? '' : 's'} · ${objectsOf(widget.id, 'flashcard').length} cards</span><span class="chip ${due ? 'accent' : ''}">${due} due</span></div>`));
  },

  renderFull(host, widget, ctx) {
    const save = () => store.put('widgets', widget);
    let parentStack = [null]; // breadcrumb of node ids

    const cur = () => parentStack[parentStack.length - 1];

    const render = () => {
      host.innerHTML = '';
      const parentId = cur();
      if (parentId) {
        const node = nodes(widget).find(n => n.id === parentId);
        const back = el(`<button class="btn btn-ghost" style="margin-bottom:8px">${icon('arrow-left', 14)} Back</button>`);
        back.onclick = () => { parentStack.pop(); render(); };
        host.appendChild(back);
        host.appendChild(el(`<h2 style="margin-bottom:10px"></h2>`)).textContent = node?.name || 'Deck';
      }

      // child groups
      for (const n of childrenOf(widget, parentId)) {
        const total = nodeCards(widget, n.id).length, due = dueIn(widget, descendantIds(widget, n.id)).length;
        const li = el(`<button class="list-item">${icon('layers', 18)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${total} cards · ${childrenOf(widget, n.id).length} groups</span></span>
          ${due ? `<span class="chip accent">${due} due</span>` : ''}
          <span class="btn-icon n-study" title="Study">${icon('play', 15)}</span>
          <span class="btn-icon n-menu">${icon('more', 14)}</span></button>`);
        li.querySelector('.li-title').textContent = n.name;
        li.onclick = (e) => { if (e.target.closest('.btn-icon')) return; parentStack.push(n.id); render(); };
        li.querySelector('.n-study').addEventListener('click', (e) => { e.stopPropagation(); sessionSetup([n.id], n.name); });
        li.querySelector('.n-menu').addEventListener('click', (e) => { e.stopPropagation(); nodeMenu(e.currentTarget, n); });
        host.appendChild(li);
      }

      // cards directly in this node
      const here = cardsIn(widget, [parentId]).filter(c => (c.data.nodeId || c.data.deckId) === parentId);
      for (const c of here) {
        const row = el(`<div class="list-item" style="cursor:default">${icon('note', 15)}<span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>${c.data.bucket ? `<span class="chip">${c.data.bucket}</span>` : ''}<span class="btn-icon fc-del">${icon('trash', 13)}</span></div>`);
        row.querySelector('.li-title').textContent = c.data.front;
        row.querySelector('.li-sub').textContent = c.data.back;
        row.querySelector('.fc-del').onclick = () => { store.trash('objects', c.id); render(); };
        host.appendChild(row);
      }

      // actions
      const addGroup = el(`<button class="btn-soft-wide">${icon('plus', 15)} ${parentId ? 'Add subgroup' : 'New deck'}</button>`);
      addGroup.onclick = async () => { const n = await promptText({ title: parentId ? 'New subgroup' : 'New deck', label: 'Name' }); if (n) { ensureChild(widget, parentId, n); save(); render(); } };
      host.appendChild(addGroup);
      if (parentId) {
        const addCard = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('note', 15)} Add card</button>`);
        addCard.onclick = async () => {
          const front = await promptText({ title: 'Card front', label: 'Question / term', confirmText: 'Next' }); if (!front) return;
          const back = await promptText({ title: 'Card back', label: 'Answer / definition', confirmText: 'Add' }); if (!back) return;
          createObject(widget.id, 'flashcard', { nodeId: parentId, front, back, due: todayStr(), ease: 2.3, interval: 0, reps: 0 });
          render();
        };
        host.appendChild(addCard);
      }
      const study = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('play', 15)} Study ${parentId ? 'this group' : 'decks…'}</button>`);
      study.onclick = () => parentId ? sessionSetup([parentId], nodes(widget).find(n => n.id === parentId)?.name) : multiDeckPicker();
      host.appendChild(study);
      const gen = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('wand', 15)} Generate from Notebook</button>`);
      gen.onclick = () => generate(parentId);
      host.appendChild(gen);
    };

    const nodeMenu = (anchor, n) => popMenu(anchor, [
      { label: 'Rename', iconName: 'edit', fn: async () => { const nm = await promptText({ title: 'Rename', value: n.name }); if (nm) { n.name = nm; save(); render(); } } },
      { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${n.name}”?`, message: 'Its subgroups and cards go to the trash.' })) {
        const ids = descendantIds(widget, n.id);
        for (const c of cardsIn(widget, ids)) store.trash('objects', c.id);
        widget.config.nodes = nodes(widget).filter(x => !ids.includes(x.id)); save(); render();
      } } }
    ]);

    /* ---- multi-deck picker (any combination) ---- */
    const multiDeckPicker = () => {
      const d = openDrawer({ title: 'Study decks', iconName: 'layers' });
      const chosen = new Set();
      const list = el('<div></div>');
      for (const n of nodes(widget)) {
        const depth = (() => { let p = n.parentId, k = 0; while (p) { k++; p = nodes(widget).find(x => x.id === p)?.parentId; } return k; })();
        const row = el(`<label class="row" style="gap:8px;padding:5px 0;padding-left:${depth * 16}px"><input type="checkbox"><span></span><span class="soft" style="font-size:0.76rem">${nodeCards(widget, n.id).length}</span></label>`);
        row.querySelector('span').textContent = n.name;
        row.querySelector('input').onchange = (e) => { e.target.checked ? chosen.add(n.id) : chosen.delete(n.id); };
        list.appendChild(row);
      }
      d.body.appendChild(list);
      const go = el('<button class="btn btn-primary" style="width:100%;margin-top:10px">Study selected</button>');
      go.onclick = () => { if (!chosen.size) { toast('Pick at least one deck.', 'info'); return; } d.close(); sessionSetup([...chosen], `${chosen.size} decks`); };
      d.body.appendChild(go);
    };

    /* ---- session setup: count, shuffle, bucket filter, flip style ---- */
    const sessionSetup = (nodeIds, label) => {
      const ids = nodeIds.flatMap(id => descendantIds(widget, id));
      const pool = cardsIn(widget, ids);
      if (!pool.length) { toast('No cards here yet.', 'info'); return; }
      const opts = { count: 0, shuffle: true, bucket: 'all', anim: 'flip' };
      const d = openDrawer({ title: `Study — ${label || ''}`, iconName: 'play' });
      d.body.appendChild(el(`<p class="soft" style="font-size:0.85rem;margin-bottom:8px">${pool.length} cards available.</p>`));
      const countIn = el(`<input class="input" type="number" min="0" placeholder="All" style="width:100px">`);
      d.body.appendChild((() => { const f = el('<div style="margin-bottom:10px"></div>'); f.appendChild(el('<label class="soft" style="font-size:0.8rem">How many (blank = all)</label>')); f.appendChild(countIn); return f; })());
      d.body.appendChild(el('<label class="soft" style="font-size:0.8rem">Only cards rated</label>'));
      d.body.appendChild(seg([['all', 'All'], ['hard', 'Hard'], ['good', 'Good'], ['easy', 'Easy']].map(([value, l]) => ({ value, label: l })), 'all', (v) => opts.bucket = v));
      let shuffleOn = true;
      const sh = el(`<button class="chip accent" style="cursor:pointer;margin:8px 0">${icon('check', 11)} Shuffle</button>`);
      sh.onclick = () => { shuffleOn = !shuffleOn; sh.classList.toggle('accent', shuffleOn); };
      d.body.appendChild(sh);
      d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block">Flip animation</label>'));
      d.body.appendChild(seg([['flip', 'Flip'], ['fade', 'Fade'], ['slide', 'Slide']].map(([value, l]) => ({ value, label: l })), 'flip', (v) => opts.anim = v));
      const go = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Start</button>');
      go.onclick = () => { opts.count = Number(countIn.value) || 0; opts.shuffle = shuffleOn; d.close(); runSession(ids, opts); };
      d.body.appendChild(go);
    };

    const runSession = (ids, opts) => {
      let queue = cardsIn(widget, ids);
      if (opts.bucket !== 'all') queue = queue.filter(c => (c.data.bucket || '') === opts.bucket);
      if (!queue.length) { toast('No cards match that filter.', 'info'); return; }
      if (opts.shuffle) shuffle(queue);
      if (opts.count) queue = queue.slice(0, opts.count);
      let i = 0, reviewed = 0, flipped = false; const tally = { hard: 0, good: 0, easy: 0 };
      host.innerHTML = '';
      const stage = el('<div class="fc-stage"></div>');
      const face = () => {
        const c = queue[i];
        stage.innerHTML = `
          <div class="soft" style="text-align:center;font-size:0.78rem;margin-bottom:8px">${i + 1} / ${queue.length}</div>
          <div class="fc-card anim-${opts.anim} ${flipped ? 'flipped' : ''}"><div class="fc-inner">
            <div class="fc-face fc-front"></div><div class="fc-face fc-back"></div></div></div>
          <div class="fc-grades ${flipped ? '' : 'hidden'}">
            <button class="btn" data-g="hard">Hard</button><button class="btn" data-g="good">Good</button><button class="btn" data-g="easy">Easy</button></div>
          ${flipped ? '' : '<p class="soft" style="text-align:center;font-size:0.8rem;margin-top:10px">Tap the card to flip</p>'}`;
        stage.querySelector('.fc-front').textContent = c.data.front;
        stage.querySelector('.fc-back').textContent = c.data.back;
        stage.querySelector('.fc-card').onclick = () => { flipped = !flipped; face(); };
        for (const b of stage.querySelectorAll('[data-g]')) b.onclick = () => {
          gradeCard(c, b.dataset.g); tally[b.dataset.g]++; reviewed++;
          const day = dayObject(widget.id, 'studyDay', todayStr(), { reviews: 0 }); day.data.reviews += 1; saveObject(day);
          flipped = false; i++;
          if (i >= queue.length) return summary(); face();
        };
      };
      const summary = () => {
        stage.innerHTML = `<div class="empty-state">${icon('sprout', 32)}<h3 style="margin:8px 0 4px">The garden grew</h3>
          <p>You tended ${reviewed} card${reviewed === 1 ? '' : 's'} — ${tally.hard} hard · ${tally.good} good · ${tally.easy} easy.</p></div>`;
        const wrap = el('<div class="row" style="justify-content:center;gap:8px;margin-top:10px"></div>');
        if (tally.hard) { const h = el('<button class="btn">Redo Hard cards</button>'); h.onclick = () => runSession(ids, { ...opts, bucket: 'hard' }); wrap.appendChild(h); }
        const back = el('<button class="btn btn-primary">Back to decks</button>'); back.onclick = render; wrap.appendChild(back);
        stage.appendChild(wrap); bloomBurst(stage);
      };
      host.appendChild(stage); face();
    };

    /* ---- generate from notebook (mirrors Class→Unit→Topic, maps fields) ---- */
    const FIELD = { term: d => d.term, definition: d => d.definition, details: d => (d.details || []).join('; '), examples: d => (d.examples || []).join('; ') };
    const generate = (intoParent) => {
      const topics = moduleTopics();
      if (!topics.length) { host.innerHTML = ''; host.appendChild(emptyState('book-open', 'No notebook topics in this module yet.', 'Back', render)); return; }
      const d = openDrawer({ title: 'Generate from Notebook', iconName: 'wand' });
      d.body.appendChild(el('<label class="soft" style="font-size:0.8rem">Topic</label>'));
      const topicSel = el('<select class="select"></select>');
      topics.forEach((t, i) => topicSel.appendChild(new Option(`${t.className} › ${t.unitName} › ${t.name}`, i)));
      d.body.appendChild(topicSel);
      const map = { front: 'term', back: 'definition' };
      d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block;margin-top:8px">Card front</label>'));
      d.body.appendChild(seg(Object.keys(FIELD).map(k => ({ value: k, label: k })), 'term', (v) => map.front = v));
      d.body.appendChild(el('<label class="soft" style="font-size:0.8rem;display:block;margin-top:8px">Card back</label>'));
      d.body.appendChild(seg(Object.keys(FIELD).map(k => ({ value: k, label: k })), 'definition', (v) => map.back = v));
      const go = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Generate</button>');
      go.onclick = () => {
        const t = topics[Number(topicSel.value)];
        const terms = moduleElements(widget, { type: 'term' }).filter(e => e.topicId === t.id);
        if (!terms.length) { toast('That topic has no key terms yet.', 'info'); return; }
        // mirror structure: class → unit → topic (under the current parent)
        const cls = ensureChild(widget, intoParent || null, t.className);
        const unit = ensureChild(widget, cls.id, t.unitName);
        const topicNode = ensureChild(widget, unit.id, t.name);
        let made = 0;
        for (const e of terms) {
          const front = FIELD[map.front](e), back = FIELD[map.back](e);
          if (!front || !back) continue;
          createObject(widget.id, 'flashcard', { nodeId: topicNode.id, front, back, due: todayStr(), ease: 2.3, interval: 0, reps: 0 });
          made++;
        }
        save(); d.close();
        toast(`Generated ${made} card${made === 1 ? '' : 's'}`, 'layers');
        parentStack = [null, cls.id, unit.id, topicNode.id]; render();
      };
      d.body.appendChild(go);
    };
    const moduleTopics = () => {
      const mod = store.all('modules').find(m => m.pages.some(p => store.get('pages', p)?.widgets.includes(widget.id)));
      if (!mod) return [];
      return mod.pages.flatMap(pid => store.get('pages', pid)?.widgets || []).map(id => store.get('widgets', id))
        .filter(w => w?.type === 'notebook').flatMap(nb => topicsOf(nb));
    };

    render();
  }
});
