/* Flashcard widget (V2 §W-4): Groups contain Groups or Decks; Decks hold cards.
   Linked Notebooks contribute a live read-only auto-tree (Notebook→Class→Unit→
   Topic). Study Sets are saved, launchable configurations. Data + resolution live
   in flashcards-model.js; the study runtime in flashcards-study.js. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, promptText, confirmDialog, emptyState, toast, openDrawer, seg } from '../ui/components.js';
import { objectsOf, todayStr } from './base.js';
import { topicsOf } from './notebook.js';
import { moduleElements } from './notebook-parse.js';
import * as M from './flashcards-model.js';
import { startStudy, resumeSession, openStudySetEditor } from './flashcards-study.js';
import { renderStudyGuide, renderFocus, renderBookmarks, needsWorkCards } from './flashcards-focus.js';
import { studyStreak } from './study-streak.js';

function dueCount(widget) { const t = todayStr(); return objectsOf(widget.id, 'flashcard').filter(c => (c.data.due || t) <= t).length; }
function nbLabel(nb) {
  const page = store.all('pages').find(p => p.widgets.includes(nb.id));
  const mod = page && store.all('modules').find(m => m.pages.includes(page.id));
  return [mod?.name, page?.name, nb.name].filter(Boolean).join(' › ');
}

registry.register({
  type: 'flashcards',
  name: 'Flashcards',
  icon: 'layers',
  description: 'Groups & decks, grown from your notes; Study Sets; Hard/Good/Easy',
  keywords: ['study', 'srs', 'memorize', 'deck', 'anki', 'review'],
  external: true, internal: true,
  defaultConfig: () => ({ nodes: [], sources: [], studySets: [], fcV2: true }),

  outputs: (widget) => [
    { key: 'reviewsToday', name: 'Cards reviewed', dayKeyed: true, get: (d) => store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'studyDay' && o.date === (d || todayStr()))?.data.reviews || 0 },
    { key: 'dueNow', name: 'Cards due', dayKeyed: false, get: () => dueCount(widget) }
  ],

  renderCard(host, widget) {
    M.ensureModel(widget);
    host.innerHTML = '';
    const all = M.allNodes(widget);
    const roots = M.childNodes(all, null);
    if (!roots.length) { host.appendChild(el('<p class="soft">Tap to plant your first deck, or link a Notebook.</p>')); return; }
    const cards = objectsOf(widget.id, 'flashcard').length;
    const sets = M.studySets(widget).length;
    const streak = studyStreak();
    const leaf = streak.current > 0 ? `<span class="chip study-streak" title="${streak.todayDone ? 'Tended today' : 'Keep your streak alive'}" style="${streak.todayDone ? 'color:var(--success)' : 'color:var(--text-soft)'}">${icon('leaf', 12)} ${streak.current}</span>` : '';
    host.appendChild(el(`<div class="row-between"><span style="font-size:0.92rem">${roots.length} top-level · ${cards} cards${sets ? ` · ${sets} set${sets === 1 ? '' : 's'}` : ''}</span><span class="row" style="gap:6px">${leaf}<span class="chip ${dueCount(widget) ? 'accent' : ''}">${dueCount(widget)} due</span></span></div>`));
  },

  renderFull(host, widget, ctx) {
    M.ensureModel(widget);
    const env = { widget, ctx, host, render: () => render() };
    let stack = [null];
    const cur = () => stack[stack.length - 1];

    const setCardsFor = (set) => {
      const all = M.allNodes(widget);
      const out = []; const seen = new Set();
      for (const id of set.contents) { const n = all.find(x => x.id === id); if (!n) continue; for (const c of M.collectCards(widget, n, all)) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } }
      return out;
    };

    // Quick 5 (docs/16 §2, anti-burnout law #1): a tiny, low-pressure session —
    // weak cards first, then topped up to five, adaptive order, one tap to start.
    const renderQuick5 = (all) => {
      const everything = [], seen = new Set();
      for (const n of M.childNodes(all, null)) for (const c of M.collectCards(widget, n, all)) if (!seen.has(c.id)) { seen.add(c.id); everything.push(c); }
      if (everything.length < 2) return;
      const pick = needsWorkCards(everything).slice(0, 5);
      const have = new Set(pick.map(c => c.id));
      for (const c of M.shuffle([...everything])) { if (pick.length >= 5) break; if (!have.has(c.id)) { have.add(c.id); pick.push(c); } }
      const row = el(`<button class="list-item fc-set" style="margin-bottom:10px"><span style="color:var(--highlight)">${icon('zap', 16)}</span><span class="li-main"><span class="li-title">Quick 5</span><span class="li-sub">A short, low-pressure session</span></span><span class="btn-icon set-go" title="Start">${icon('play', 15)}</span></button>`);
      const go = () => startStudy(env, { label: 'Quick 5', cards: pick.map(c => ({ ...c, result: undefined })), front: ['term'], back: ['definition'], order: 'adaptive', startNow: true });
      row.querySelector('.set-go').onclick = (e) => { e.stopPropagation(); go(); };
      row.onclick = (e) => { if (e.target.closest('.btn-icon')) return; go(); };
      host.appendChild(row);
    };

    const render = () => {
      host.innerHTML = '';
      const all = M.allNodes(widget);
      const parentId = cur();
      const node = parentId ? all.find(n => n.id === parentId) : null;

      if (parentId) {
        const back = el(`<button class="btn btn-ghost" style="margin-bottom:8px">${icon('arrow-left', 14)} Back</button>`);
        back.onclick = () => { stack.pop(); render(); };
        host.appendChild(back);
        host.appendChild(el('<h2 style="margin-bottom:10px"></h2>')).textContent = node?.name || '';
        if (node?.kind === 'deck') return renderDeck(node);
      }

      if (!parentId) { renderQuick5(all); renderStudyGuide(env, all); renderFocus(env, all); renderBookmarks(env, all); renderStudySets(); renderResumable(); }

      for (const n of M.childNodes(all, parentId)) {
        const cnt = M.cardCount(widget, n, all), sub = n.kind === 'group' ? `${M.childNodes(all, n.id).length} inside · ${cnt} cards` : `${cnt} card${cnt === 1 ? '' : 's'}`;
        const li = el(`<button class="list-item">${icon(n.auto ? 'book-open' : (n.kind === 'group' ? 'layers' : 'note'), 18)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${sub}${n.auto ? ' · auto' : ''}</span></span>
          <span class="btn-icon n-study" title="Study">${icon('play', 15)}</span>${n.auto ? '' : `<span class="btn-icon n-menu">${icon('more', 14)}</span>`}</button>`);
        li.querySelector('.li-title').textContent = n.name;
        li.onclick = (e) => { if (e.target.closest('.btn-icon')) return; stack.push(n.id); render(); };
        li.querySelector('.n-study').addEventListener('click', (e) => { e.stopPropagation(); startStudy(env, { label: n.name, cards: M.collectCards(widget, n, all) }); });
        li.querySelector('.n-menu')?.addEventListener('click', (e) => { e.stopPropagation(); nodeMenu(e.currentTarget, n); });
        host.appendChild(li);
      }

      // actions (groups/root can hold groups & decks; you can't add into an auto node)
      if (!node?.auto) {
        const addGroup = el(`<button class="btn-soft-wide">${icon('plus', 15)} New group</button>`);
        addGroup.onclick = async () => { const n = await promptText({ title: 'New group', label: 'Name' }); if (n) { M.addNode(widget, parentId, n, 'group'); render(); } };
        const addDeck = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('note', 15)} New deck</button>`);
        addDeck.onclick = async () => { const n = await promptText({ title: 'New deck', label: 'Name' }); if (n) { M.addNode(widget, parentId, n, 'deck'); render(); } };
        host.append(addGroup, addDeck);
      }
      const gen = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('wand', 15)} Generate deck from Notebook</button>`);
      gen.onclick = () => generate(node?.auto ? null : parentId);
      host.appendChild(gen);
    };

    const nodeMenu = (anchor, n) => popMenu(anchor, [
      { label: 'Rename', iconName: 'edit', fn: async () => { const nm = await promptText({ title: 'Rename', value: n.name }); if (nm) { n.name = nm; store.put('widgets', widget); render(); } } },
      { label: 'Delete', iconName: 'trash', danger: true, fn: async () => { if (await confirmDialog({ title: `Delete “${n.name}”?`, message: 'Its contents go to the trash.' })) { M.deleteNode(widget, n.id); render(); } } }
    ]);

    const renderDeck = (node) => {
      const cards = M.deckCards(widget, node);
      if (!node.auto) {
        const study = el(`<button class="btn-soft-wide" style="margin-bottom:8px">${icon('play', 15)} Study deck</button>`);
        study.onclick = () => startStudy(env, { label: node.name, cards });
        host.appendChild(study);
      } else host.appendChild(el('<p class="soft" style="font-size:0.82rem;margin-bottom:8px">Auto-generated from your Notebook — study it directly, or use “Generate deck” for an editable copy.</p>'));
      for (const c of cards) {
        const faces = M.cardFaces(c, ['term'], ['definition']);
        const row = el(`<div class="list-item" style="cursor:${node.auto ? 'default' : 'pointer'}">${icon('note', 15)}<span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>${c.bucket ? `<span class="chip">${c.bucket}</span>` : ''}${node.auto ? '' : `<span class="btn-icon fc-del">${icon('trash', 13)}</span>`}</div>`);
        row.querySelector('.li-title').textContent = faces.front || '(card)';
        row.querySelector('.li-sub').textContent = faces.back;
        if (!node.auto) { row.querySelector('.fc-del').onclick = (e) => { e.stopPropagation(); store.trash('objects', c.real); render(); }; row.onclick = () => editCard(node, c); }
        host.appendChild(row);
      }
      if (!node.auto) {
        const add = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('plus', 15)} Add card</button>`);
        add.onclick = () => editCard(node, null);
        host.appendChild(add);
        if (cards.length) { const s2 = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('play', 15)} Study deck</button>`); s2.onclick = () => startStudy(env, { label: node.name, cards: M.deckCards(widget, node) }); host.appendChild(s2); }
      }
    };

    const editCard = async (deck, card) => {
      const front = await promptText({ title: card ? 'Edit front' : 'Card front', label: 'Front', value: card?.front || card?.term || '', confirmText: 'Next' }); if (front == null) return;
      const back = await promptText({ title: card ? 'Edit back' : 'Card back', label: 'Back', value: card?.back || card?.definition || '', confirmText: 'Save' }); if (back == null) return;
      if (card?.real) { const o = store.get('objects', card.real); o.data.front = front; o.data.back = back; delete o.data.term; delete o.data.definition; delete o.data.details; delete o.data.examples; store.put('objects', o); }
      else M.addCard(widget, deck.id, { front, back });
      render();
    };

    const renderStudySets = () => {
      const sets = M.studySets(widget);
      if (sets.length) {
        host.appendChild(el('<h3 class="soft" style="font-size:0.74rem;letter-spacing:.05em;margin:2px 0 6px">STUDY SETS</h3>'));
        for (const set of sets) {
          const n = setCardsFor(set).length;
          const row = el(`<button class="list-item fc-set">${icon('layers', 16)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${n} card${n === 1 ? '' : 's'} · ${set.front.join('+')} → ${set.back.join('+')}</span></span><span class="btn-icon set-edit">${icon('edit', 14)}</span><span class="btn-icon set-go" title="Start">${icon('play', 15)}</span></button>`);
          row.querySelector('.li-title').textContent = set.name;
          row.querySelector('.set-edit').onclick = (e) => { e.stopPropagation(); openStudySetEditor(env, set); };
          const start = () => startStudy(env, { label: set.name, cards: setCardsFor(set), front: set.front, back: set.back, order: set.order, startNow: true });
          row.querySelector('.set-go').onclick = (e) => { e.stopPropagation(); start(); };
          row.onclick = (e) => { if (e.target.closest('.btn-icon')) return; start(); };
          host.appendChild(row);
        }
      }
      const add = el(`<button class="btn-soft-wide" style="margin-bottom:10px">${icon('plus', 15)} New study set</button>`);
      add.onclick = () => openStudySetEditor(env, null);
      host.appendChild(add);
    };

    const renderResumable = () => {
      const sessions = M.savedSessions(widget);
      if (!sessions.length) return;
      host.appendChild(el('<h3 class="soft" style="font-size:0.74rem;letter-spacing:.05em;margin:6px 0 6px">RESUME</h3>'));
      for (const s of sessions) {
        const row = el(`<div class="list-item">${icon('play', 15)}<span class="li-main"><span class="li-title"></span><span class="li-sub">${s.data.index} / ${s.data.cards.length} done</span></span><span class="btn-icon res-del">${icon('trash', 13)}</span></div>`);
        row.querySelector('.li-title').textContent = s.data.label || 'Study session';
        row.querySelector('.res-del').onclick = (e) => { e.stopPropagation(); store.trash('objects', s.id); render(); };
        row.onclick = (e) => { if (e.target.closest('.res-del')) return; resumeSession(env, s); };
        host.appendChild(row);
      }
    };

    const generate = (intoParent) => {
      const topics = moduleTopics();
      if (!topics.length) { toast('No notebook topics found. Link or fill a Notebook first.', 'info'); return; }
      const d = openDrawer({ title: 'Generate decks from Notebook', iconName: 'wand' });
      d.body.appendChild(el('<p class="soft" style="font-size:0.8rem;margin-bottom:8px">Tick any classes, units, or topics — each ticked topic becomes a deck.</p>'));

      // Class → Unit → Topic tree from the linked notebooks; tick at any level.
      const tree = new Map();
      for (const t of topics) {
        const ck = `${t.classId || ''}|${t.className}`;
        if (!tree.has(ck)) tree.set(ck, { name: t.className || 'Class', units: new Map() });
        const uk = `${t.unitId || ''}|${t.unitName}`;
        const units = tree.get(ck).units;
        if (!units.has(uk)) units.set(uk, { name: t.unitName || 'Unit', topics: [] });
        units.get(uk).topics.push(t);
      }
      const sel = new Set();
      const treeEl = el('<div class="qz-tree"></div>');
      const refresh = () => { for (const cb of treeEl.querySelectorAll('input[data-tids]')) { const tids = cb.dataset.tids.split(','); cb.checked = tids.every(id => sel.has(id)); cb.indeterminate = !cb.checked && tids.some(id => sel.has(id)); } };
      const toggle = (tids, on) => { tids.forEach(id => on ? sel.add(id) : sel.delete(id)); refresh(); };
      for (const [, cl] of tree) {
        const clTids = [...cl.units.values()].flatMap(u => u.topics.map(t => t.id));
        const clRow = el(`<label class="qz-node row" style="gap:6px"><input type="checkbox" data-tids="${clTids.join(',')}"><strong></strong></label>`);
        clRow.querySelector('strong').textContent = cl.name;
        clRow.querySelector('input').onchange = (e) => toggle(clTids, e.target.checked);
        treeEl.appendChild(clRow);
        for (const [, u] of cl.units) {
          const uTids = u.topics.map(t => t.id);
          const uRow = el(`<label class="qz-node row" style="gap:6px;padding-left:18px"><input type="checkbox" data-tids="${uTids.join(',')}"><span></span></label>`);
          uRow.querySelector('span').textContent = u.name;
          uRow.querySelector('input').onchange = (e) => toggle(uTids, e.target.checked);
          treeEl.appendChild(uRow);
          for (const t of u.topics) {
            const tRow = el(`<label class="qz-node row" style="gap:6px;padding-left:36px"><input type="checkbox" data-tids="${t.id}"><span></span><span class="soft" style="font-size:0.74rem"></span></label>`);
            tRow.querySelector('span').textContent = t.name;
            tRow.querySelectorAll('span')[1].textContent = moduleElements(widget, { type: 'term' }).filter(e => e.topicId === t.id).length;
            tRow.querySelector('input').onchange = (e) => { e.target.checked ? sel.add(t.id) : sel.delete(t.id); refresh(); };
            treeEl.appendChild(tRow);
          }
        }
      }
      d.body.appendChild(treeEl);
      const go = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Generate selected</button>');
      go.onclick = () => {
        if (!sel.size) { toast('Tick at least one class, unit, or topic.', 'info'); return; }
        const byId = new Map(topics.map(t => [t.id, t]));
        let madeDecks = 0, madeCards = 0, lastPath = null;
        for (const tid of sel) {
          const t = byId.get(tid); if (!t) continue;
          const terms = moduleElements(widget, { type: 'term' }).filter(e => e.topicId === t.id);
          if (!terms.length) continue;
          const ids = [null];
          let parent = M.ensureChild(widget, intoParent || null, t.className || 'Class', 'group'); ids.push(parent.id);
          if (t.sectionName) { parent = M.ensureChild(widget, parent.id, t.sectionName, 'group'); ids.push(parent.id); }
          if (t.unitName) { parent = M.ensureChild(widget, parent.id, t.unitName, 'group'); ids.push(parent.id); }
          const deck = M.ensureChild(widget, parent.id, t.name, 'deck'); ids.push(deck.id);
          const existing = new Set(M.deckCards(widget, deck).map(c => c.term || c.front));
          for (const e of terms) { if (existing.has(e.term)) continue; M.addCard(widget, deck.id, { term: e.term, definition: e.definition, details: e.details || [], examples: e.examples || [], tip: e.tip || '' }); madeCards++; }
          madeDecks++; lastPath = ids;
        }
        d.close();
        toast(`Generated ${madeDecks} deck${madeDecks === 1 ? '' : 's'} · ${madeCards} card${madeCards === 1 ? '' : 's'}`, 'layers');
        if (lastPath && sel.size === 1) stack = lastPath;
        render();
      };
      d.body.appendChild(go);
    };
    const moduleTopics = () => {
      const mod = store.all('modules').find(m => m.pages.some(p => store.get('pages', p)?.widgets.includes(widget.id)));
      const fromModule = mod ? mod.pages.flatMap(pid => store.get('pages', pid)?.widgets || []).map(id => store.get('widgets', id)).filter(w => w?.type === 'notebook') : [];
      const fromSources = M.sourceIds(widget).map(id => store.get('widgets', id)).filter(Boolean);
      const nbs = [...new Set([...fromModule, ...fromSources])];
      return nbs.flatMap(nb => topicsOf(nb));
    };

    render();
  },

  renderSettings(host, widget, ctx) {
    M.ensureModel(widget);
    const render = () => {
      host.innerHTML = '';
      host.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:8px">Link Notebook widgets to auto-generate a Class→Unit→Topic deck tree.</p>'));
      const sources = widget.config.sources;
      const list = el('<div class="sn-sources"></div>');
      if (!sources.length) list.appendChild(el('<p class="soft" style="font-size:0.84rem">No notebooks linked.</p>'));
      const commit = () => { store.put('widgets', widget); ctx.refreshCard?.(widget); render(); };
      sources.forEach((s, i) => {
        const nb = store.get('widgets', s.notebookId);
        const row = el(`<div class="row-between sn-src-row"><label class="row" style="gap:8px;min-width:0"><input type="checkbox" ${s.on ? 'checked' : ''}><span class="sn-src-name" style="overflow:hidden;text-overflow:ellipsis"></span></label><button class="btn-icon sn-rm" title="Remove">${icon('x', 14)}</button></div>`);
        row.querySelector('.sn-src-name').textContent = nb ? nbLabel(nb) : '(missing notebook)';
        row.querySelector('input').onchange = (e) => { s.on = e.target.checked; commit(); };
        row.querySelector('.sn-rm').onclick = () => { sources.splice(i, 1); commit(); };
        list.appendChild(row);
      });
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add Notebook</button>`);
      add.onclick = () => {
        const avail = store.all('widgets').filter(w => w.type === 'notebook' && !sources.some(s => s.notebookId === w.id));
        if (!avail.length) { toast('No other Notebook widgets to add.', 'info'); return; }
        popMenu(add, avail.map(nb => ({ label: nbLabel(nb), fn: () => { sources.push({ notebookId: nb.id, on: true }); commit(); } })));
      };
      host.append(list, add);
    };
    render();
  }
});
