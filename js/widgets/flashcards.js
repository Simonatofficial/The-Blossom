/* FlashcardDeck widget (docs/08 §6): decks of front/back cards with SM-2
   light spaced repetition (again/hard/good/easy). "Generate from notes"
   harvests key-term marks and Q:/A: pairs from Notebook topics — proposals
   are reviewed card by card, never added silently. Due counts and reviews
   are value outputs (studying literally levels you up). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, toast, promptText, confirmDialog, emptyState } from '../ui/components.js';
import { objectsOf, createObject, saveObject, dayObject, todayStr, dateAdd, bloomBurst } from './base.js';
import { topicNote, topicsOf } from './notebook.js';

function decks(widget) { return widget.config.decks || (widget.config.decks = []); }
function cards(widget, deckId = null) {
  return objectsOf(widget.id, 'flashcard').filter(c => !deckId || c.data.deckId === deckId);
}
function dueCards(widget, deckId = null) {
  const today = todayStr();
  return cards(widget, deckId).filter(c => (c.data.due || today) <= today);
}

/* ---- SM-2 light (docs/08): intervals in days, ease 1.3–3.0 ---- */
export function gradeCard(card, grade) {
  const d = card.data;
  d.ease = d.ease ?? 2.3;
  d.interval = d.interval ?? 0;
  d.reps = (d.reps || 0) + 1;
  if (grade === 'again') { d.interval = 0; d.ease = Math.max(1.3, d.ease - 0.2); }
  else if (grade === 'hard') { d.interval = Math.max(1, Math.round(d.interval * 1.2)) || 1; d.ease = Math.max(1.3, d.ease - 0.05); }
  else if (grade === 'good') { d.interval = d.interval ? Math.round(d.interval * d.ease) : 1; }
  else { d.interval = Math.max(2, Math.round((d.interval || 1) * d.ease * 1.3)); d.ease = Math.min(3, d.ease + 0.1); }
  d.due = d.interval === 0 ? todayStr() : dateAdd(todayStr(), d.interval);
  saveObject(card);
}

/* ---- generate proposals from notebook topics ---- */
function harvest(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  const proposals = [];
  // key-term marks: "term — definition" (also ':' and ' - ')
  for (const mark of div.querySelectorAll('mark.key-term')) {
    const txt = mark.textContent.trim();
    const m = txt.split(/\s*(?:—|–| - |:)\s*/);
    if (m.length >= 2 && m[0] && m[1]) proposals.push({ front: m[0], back: m.slice(1).join(' — ') });
  }
  // Q:/A: line pairs (block tags become line breaks — innerText is unreliable
  // on detached elements, so lines are derived from the markup itself)
  const text = (html || '')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const decode = document.createElement('textarea');
  decode.innerHTML = text;
  const lines = decode.value.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    const q = lines[i].match(/^Q[:.)]\s*(.+)/i);
    const a = lines[i + 1].match(/^A[:.)]\s*(.+)/i);
    if (q && a) proposals.push({ front: q[1], back: a[1] });
  }
  return proposals;
}

function moduleNotebooks(widget) {
  const mod = store.all('modules').find(m => m.pages.some(p => store.get('pages', p)?.widgets.includes(widget.id)));
  if (!mod) return [];
  return mod.pages.flatMap(pid => (store.get('pages', pid)?.widgets || []))
    .map(id => store.get('widgets', id))
    .filter(w => w?.type === 'notebook');
}

registry.register({
  type: 'flashcards',
  name: 'Flashcards',
  icon: 'layers',
  description: 'Spaced-repetition decks; grow cards from your notes',
  keywords: ['study', 'srs', 'memorize', 'deck', 'anki', 'review'],
  external: true, internal: true,
  defaultConfig: () => ({ decks: [] }),

  outputs: (widget) => [
    { key: 'reviewsToday', name: 'Cards reviewed', dayKeyed: true,
      get: (d) => store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'studyDay' && o.date === (d || todayStr()))?.data.reviews || 0 },
    { key: 'dueNow', name: 'Cards due', dayKeyed: false, get: () => dueCards(widget).length }
  ],

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const due = dueCards(widget).length;
    if (!decks(widget).length) {
      host.appendChild(el('<p class="soft">Tap to plant your first deck.</p>'));
      return;
    }
    host.appendChild(el(`<div class="row-between">
      <span style="font-size:0.92rem">${decks(widget).length} deck${decks(widget).length === 1 ? '' : 's'} · ${cards(widget).length} cards</span>
      <span class="chip ${due ? 'accent' : ''}">${due} due</span></div>`));
  },

  renderFull(host, widget, ctx) {
    const save = () => store.put('widgets', widget);

    const renderDecks = () => {
      host.innerHTML = '';
      if (!decks(widget).length) host.appendChild(emptyState('layers', 'No decks yet. Make one, or grow cards from your notes.'));
      for (const deck of decks(widget)) {
        const due = dueCards(widget, deck.id).length;
        const total = cards(widget, deck.id).length;
        const li = el(`<button class="list-item">${icon('layers', 18)}
          <span class="li-main"><span class="li-title"></span><span class="li-sub">${total} cards</span></span>
          ${due ? `<span class="chip accent">${due} due</span>` : ''}
          <span class="btn-icon d-study" title="Study">${icon('play', 15)}</span>
          <span class="btn-icon d-add" title="Add card">${icon('plus', 15)}</span>
          <span class="btn-icon d-del" title="Delete">${icon('trash', 14)}</span></button>`);
        li.querySelector('.li-title').textContent = deck.name;
        li.onclick = (e) => { if (e.target.closest('.btn-icon')) return; study(deck); };
        li.querySelector('.d-study').addEventListener('click', (e) => { e.stopPropagation(); study(deck); });
        li.querySelector('.d-add').addEventListener('click', async (e) => {
          e.stopPropagation();
          const front = await promptText({ title: 'Card front', label: 'Question / term', confirmText: 'Next' });
          if (!front) return;
          const back = await promptText({ title: 'Card back', label: 'Answer / definition', confirmText: 'Add card' });
          if (!back) return;
          createObject(widget.id, 'flashcard', { deckId: deck.id, front, back, due: todayStr(), ease: 2.3, interval: 0, reps: 0 });
          renderDecks();
        });
        li.querySelector('.d-del').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (await confirmDialog({ title: `Delete “${deck.name}”?`, message: 'Its cards rest in the trash.' })) {
            for (const c of cards(widget, deck.id)) store.trash('objects', c.id);
            widget.config.decks = decks(widget).filter(d => d.id !== deck.id);
            save();
            renderDecks();
          }
        });
        host.appendChild(li);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} New deck</button>`);
      add.onclick = async () => {
        const name = await promptText({ title: 'New deck', label: 'Deck name', placeholder: 'Biology — cells' });
        if (name) { decks(widget).push({ id: ulid(), name }); save(); renderDecks(); }
      };
      const gen = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('wand', 15)} Generate from notes</button>`);
      gen.onclick = () => generate();
      host.append(add, gen);
    };

    /* ---- study session: flip, grade, garden summary ---- */
    const study = (deck) => {
      const queue = dueCards(widget, deck.id);
      if (!queue.length) { toast('Nothing due — the garden rests.', 'leaf'); return; }
      let i = 0, reviewed = 0, flipped = false;
      host.innerHTML = '';
      const stage = el('<div class="fc-stage"></div>');
      const renderCardFace = () => {
        const c = queue[i];
        stage.innerHTML = `
          <div class="soft" style="text-align:center;font-size:0.78rem;margin-bottom:8px">${i + 1} / ${queue.length} · ${deck.name}</div>
          <div class="fc-card ${flipped ? 'flipped' : ''}"><div class="fc-inner">
            <div class="fc-face fc-front"></div>
            <div class="fc-face fc-back"></div>
          </div></div>
          <div class="fc-grades ${flipped ? '' : 'hidden'}">
            <button class="btn" data-g="again">Again</button>
            <button class="btn" data-g="hard">Hard</button>
            <button class="btn" data-g="good">Good</button>
            <button class="btn" data-g="easy">Easy</button>
          </div>
          ${flipped ? '' : '<p class="soft" style="text-align:center;font-size:0.8rem;margin-top:10px">Tap the card to flip</p>'}`;
        stage.querySelector('.fc-front').textContent = c.data.front;
        stage.querySelector('.fc-back').textContent = c.data.back;
        stage.querySelector('.fc-card').onclick = () => { flipped = !flipped; renderCardFace(); };
        for (const b of stage.querySelectorAll('[data-g]')) {
          b.onclick = () => {
            gradeCard(c, b.dataset.g);
            reviewed++;
            const day = dayObject(widget.id, 'studyDay', todayStr(), { reviews: 0 });
            day.data.reviews += 1;
            saveObject(day);
            flipped = false;
            i++;
            if (i >= queue.length) return summary();
            renderCardFace();
          };
        }
      };
      const summary = () => {
        stage.innerHTML = `<div class="empty-state">${icon('sprout', 32)}
          <h3 style="margin:8px 0 4px">The garden grew</h3>
          <p>You tended ${reviewed} card${reviewed === 1 ? '' : 's'}. ${dueCards(widget, deck.id).length} still due today.</p>
          <button class="btn btn-primary">Back to decks</button></div>`;
        stage.querySelector('button').onclick = renderDecks;
        bloomBurst(stage);
      };
      host.appendChild(stage);
      renderCardFace();
    };

    /* ---- generate-from-notes review flow (assistive, never silent) ---- */
    const generate = () => {
      host.innerHTML = '';
      const notebooks = moduleNotebooks(widget);
      const topics = notebooks.flatMap(nb => topicsOf(nb).map(t => ({ ...t, nb })));
      if (!topics.length) {
        host.appendChild(emptyState('book-open', 'No notebook topics in this module yet.', 'Back', renderDecks));
        return;
      }
      host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:8px">HARVEST FROM…</h3>'));
      for (const t of topics) {
        const li = el(`<button class="list-item">${icon('note', 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${t.subject}</span></span>${icon('chevron-right', 14)}</button>`);
        li.querySelector('.li-title').textContent = t.name;
        li.onclick = () => review(t);
        host.appendChild(li);
      }
      const back = el('<button class="btn-soft-wide">Back</button>');
      back.onclick = renderDecks;
      host.appendChild(back);

      const review = (t) => {
        const proposals = harvest(topicNote(t.nb, t.id).data.html);
        host.innerHTML = '';
        if (!proposals.length) {
          host.appendChild(emptyState('wand', 'No key terms or Q/A pairs found in this topic yet.', 'Back', generate));
          return;
        }
        host.appendChild(el(`<h3 class="soft" style="font-size:0.8rem;margin-bottom:8px">${proposals.length} PROPOSED — ACCEPT, EDIT, OR SKIP</h3>`));
        const listHost = el('<div></div>');
        let deck = decks(widget).find(d => d.name === t.name);
        const renderProposals = () => {
          listHost.innerHTML = '';
          for (const [idx, p] of proposals.entries()) {
            const row = el(`<div class="panel" style="padding:10px;margin-bottom:8px">
              <input class="input" style="margin-bottom:6px"><input class="input">
              <div class="row" style="margin-top:8px;justify-content:flex-end">
                <button class="btn btn-ghost">Skip</button><button class="btn btn-primary">Accept</button></div></div>`);
            const [fIn, bIn] = row.querySelectorAll('input');
            fIn.value = p.front;
            bIn.value = p.back;
            row.querySelector('.btn-ghost').onclick = () => { proposals.splice(idx, 1); renderProposals(); };
            row.querySelector('.btn-primary').onclick = () => {
              if (!deck) { deck = { id: ulid(), name: t.name }; decks(widget).push(deck); save(); }
              createObject(widget.id, 'flashcard', { deckId: deck.id, front: fIn.value.trim(), back: bIn.value.trim(), due: todayStr(), ease: 2.3, interval: 0, reps: 0 });
              proposals.splice(idx, 1);
              toast('Card planted', 'layers');
              if (!proposals.length) renderDecks();
              else renderProposals();
            };
            listHost.appendChild(row);
          }
        };
        renderProposals();
        host.appendChild(listHost);
        const done = el('<button class="btn-soft-wide">Done</button>');
        done.onclick = renderDecks;
        host.appendChild(done);
      };
    };

    renderDecks();
  }
});
