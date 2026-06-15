/* Solitaire (Klondike) game widget (V2 §21). Tap a card to pick it up (with the
   run beneath it), tap a destination pile to drop it; double-tap sends a card to
   its foundation. Auto-complete appears once the board is all face-up. The game
   state is saved with the widget so it resumes. Card view shows progress and
   opens the full board on tap. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, confirmDialog } from '../ui/components.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [null, 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const isRed = (s) => s === 1 || s === 2;

function freshDeal() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s, up: false });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const tableau = [[], [], [], [], [], [], []];
  for (let c = 0; c < 7; c++) for (let k = 0; k <= c; k++) { const card = deck.pop(); card.up = k === c; tableau[c].push(card); }
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau };
}

const topOf = (a) => a[a.length - 1] || null;
const canFoundation = (card, f) => { const t = topOf(f); return t ? (t.s === card.s && card.r === t.r + 1) : card.r === 1; };
const canTableau = (card, t) => { const top = topOf(t); return top ? (isRed(card.s) !== isRed(top.s) && card.r === top.r - 1) : card.r === 13; };
const isWon = (g) => g.foundations.every(f => f.length === 13);

function mountCard(host, widget) {
  host.innerHTML = '';
  const g = widget.config.game;
  const onF = g ? g.foundations.reduce((a, f) => a + f.length, 0) : 0;
  host.appendChild(el(`<div class="row-between"><span style="font-size:0.92rem">${icon('grid', 14)} Klondike</span><span class="chip ${onF === 52 ? 'accent' : ''}">${g ? `${onF}/52` : 'tap to play'}</span></div>`));
}

function mountFull(host, widget, ctx) {
  const save = () => store.put('widgets', widget);
  if (!widget.config.game) { widget.config.game = freshDeal(); save(); }
  let g = widget.config.game;
  let sel = null; // { kind:'tableau'|'waste'|'foundation', pile, idx }

  const board = el('<div class="sol-board"></div>');
  const bar = el(`<div class="row" style="gap:8px;margin-bottom:10px"><button class="btn s-new">${icon('rotate-ccw', 14)} New game</button><span class="grow"></span><button class="btn s-auto hidden">${icon('sparkles', 14)} Auto-finish</button></div>`);
  host.innerHTML = '';
  host.append(bar, board);

  bar.querySelector('.s-new').onclick = async () => { if (await confirmDialog({ title: 'New game?', message: 'The current game is discarded.' })) { widget.config.game = g = freshDeal(); sel = null; save(); render(); } };
  bar.querySelector('.s-auto').onclick = () => autoFinish();

  const pileOfSel = () => { if (sel.kind === 'tableau') return g.tableau[sel.pile]; if (sel.kind === 'waste') return g.waste; return g.foundations[sel.pile]; };
  const run = () => { const p = pileOfSel(); return sel.kind === 'tableau' ? p.slice(sel.idx) : [topOf(p)]; };

  const tryDrop = (destKind, destPile) => {
    const r = run(); if (!r.length || !r[0]) return false;
    const dest = destKind === 'foundation' ? g.foundations[destPile] : g.tableau[destPile];
    const ok = destKind === 'foundation' ? (r.length === 1 && canFoundation(r[0], dest)) : canTableau(r[0], dest);
    if (!ok) return false;
    const src = pileOfSel();
    src.splice(sel.kind === 'tableau' ? sel.idx : src.length - 1);
    dest.push(...r);
    if (sel.kind === 'tableau' && src.length && !topOf(src).up) topOf(src).up = true;
    sel = null; save(); render();
    if (isWon(g)) setTimeout(() => toast('You won! 🌸', 'flower'), 60);
    return true;
  };

  const toFoundation = (kind, pile, idx) => {
    const arr = kind === 'tableau' ? g.tableau[pile] : kind === 'waste' ? g.waste : g.foundations[pile];
    if (idx != null && idx !== arr.length - 1) return false; // only the top card auto-sends
    const card = topOf(arr); if (!card) return false;
    for (let f = 0; f < 4; f++) if (canFoundation(card, g.foundations[f])) { arr.pop(); g.foundations[f].push(card); if (kind === 'tableau' && arr.length && !topOf(arr).up) topOf(arr).up = true; sel = null; save(); render(); if (isWon(g)) setTimeout(() => toast('You won! 🌸', 'flower'), 60); return true; }
    return false;
  };

  const autoFinish = () => {
    let moved = true; let guard = 0;
    while (moved && guard++ < 200) { moved = false; for (let t = 0; t < 7; t++) if (toFoundation('tableau', t)) moved = true; if (g.waste.length && toFoundation('waste')) moved = true; }
  };

  const cardEl = (card, faceDown) => {
    if (faceDown || !card.up) return el('<div class="sol-card down"></div>');
    const c = el(`<div class="sol-card ${isRed(card.s) ? 'red' : 'black'}"><span class="sc-r"></span><span class="sc-s"></span></div>`);
    c.querySelector('.sc-r').textContent = RANKS[card.r];
    c.querySelector('.sc-s').textContent = SUITS[card.s];
    return c;
  };

  const drawStock = () => { if (g.stock.length) { const c = g.stock.pop(); c.up = true; g.waste.push(c); } else { g.stock = g.waste.reverse().map(c => (c.up = false, c)); g.waste = []; } sel = null; save(); render(); };

  const render = () => {
    board.innerHTML = '';
    bar.querySelector('.s-auto').classList.toggle('hidden', g.tableau.some(t => t.some(c => !c.up)) || isWon(g));

    // top row: stock, waste, foundations
    const top = el('<div class="sol-top"></div>');
    const stock = el(`<div class="sol-pile sol-stock"></div>`);
    stock.appendChild(g.stock.length ? el('<div class="sol-card down"></div>') : el(`<div class="sol-empty">${icon('rotate-ccw', 16)}</div>`));
    stock.onclick = drawStock;
    top.appendChild(stock);
    const waste = el('<div class="sol-pile sol-waste"></div>');
    if (g.waste.length) { const ce = cardEl(topOf(g.waste)); if (sel?.kind === 'waste') ce.classList.add('sel'); ce.onclick = () => clickPile('waste', 0, g.waste.length - 1); ce.ondblclick = () => toFoundation('waste'); waste.appendChild(ce); }
    else { waste.appendChild(el('<div class="sol-empty"></div>')); waste.onclick = () => sel && clearSel(); }
    top.appendChild(waste);
    top.appendChild(el('<div class="sol-gap"></div>'));
    for (let f = 0; f < 4; f++) {
      const fp = el('<div class="sol-pile sol-foundation"></div>');
      if (g.foundations[f].length) { const ce = cardEl(topOf(g.foundations[f])); ce.onclick = () => clickPile('foundation', f, g.foundations[f].length - 1); fp.appendChild(ce); }
      else fp.appendChild(el(`<div class="sol-empty">${SUITS[f]}</div>`));
      fp.onclick = (e) => { if (e.target === fp || e.target.classList.contains('sol-empty')) clickDest('foundation', f); };
      top.appendChild(fp);
    }
    board.appendChild(top);

    // tableau
    const tab = el('<div class="sol-tableau"></div>');
    for (let t = 0; t < 7; t++) {
      const col = el('<div class="sol-col"></div>');
      col.onclick = (e) => { if (e.target === col) clickDest('tableau', t); };
      if (!g.tableau[t].length) { const e0 = el('<div class="sol-empty sol-col-empty"></div>'); e0.onclick = () => clickDest('tableau', t); col.appendChild(e0); }
      g.tableau[t].forEach((card, idx) => {
        const ce = cardEl(card);
        ce.style.marginTop = idx ? `${card.up ? -68 : -82}px` : '0';
        if (sel?.kind === 'tableau' && sel.pile === t && idx >= sel.idx) ce.classList.add('sel');
        ce.onclick = (e) => { e.stopPropagation(); clickPile('tableau', t, idx); };
        ce.ondblclick = (e) => { e.stopPropagation(); if (idx === g.tableau[t].length - 1) toFoundation('tableau', t, idx); };
        col.appendChild(ce);
      });
      tab.appendChild(col);
    }
    board.appendChild(tab);
  };

  const clearSel = () => { sel = null; render(); };
  const clickDest = (kind, pile) => { if (sel) { if (!tryDrop(kind, pile)) clearSel(); } };
  const clickPile = (kind, pile, idx) => {
    if (sel) { // destination first
      if (tryDrop(kind, pile)) return;
    }
    // (re)select if selectable
    if (kind === 'tableau') { if (!g.tableau[pile][idx]?.up) { clearSel(); return; } sel = { kind, pile, idx }; }
    else if (kind === 'waste') sel = { kind, pile: 0, idx };
    else sel = { kind, pile, idx };
    render();
  };

  render();
}

registry.register({
  type: 'solitaire',
  name: 'Solitaire',
  icon: 'grid',
  description: 'Klondike solitaire — tap to move, double-tap to foundation',
  keywords: ['game', 'cards', 'klondike', 'patience', 'play'],
  external: true, internal: true,
  defaultConfig: () => ({ game: null }),
  renderCard(host, widget) { mountCard(host, widget); },
  renderFull(host, widget, ctx) { mountFull(host, widget, ctx); }
});
