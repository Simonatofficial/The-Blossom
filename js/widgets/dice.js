/* Dice widget (docs/05): d4–d100, custom formulas (2d6+3), advantage /
   disadvantage, roll history with a tiny tumble. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { el, input } from '../ui/components.js';

function rollFormula(formula) {
  const m = formula.replace(/\s/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const n = Math.min(99, Number(m[1] || 1));
  const sides = Number(m[2]);
  const mod = Number(m[3] || 0);
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
  return { rolls, mod, total: rolls.reduce((a, b) => a + b, 0) + mod, formula: `${n}d${sides}${mod ? (mod > 0 ? '+' + mod : mod) : ''}` };
}

/** Roll a configured dice pool (e.g. {6:3, 100:2} → 3d6 + 2d100). */
function rollPool(widget, pool) {
  const parts = [], detail = [];
  let total = 0;
  for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
    const n = pool?.[sides] || 0;
    if (n <= 0) continue;
    const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
    total += rolls.reduce((a, b) => a + b, 0);
    parts.push(`${n}d${sides}`);
    detail.push(`${n}d${sides}: ${rolls.join('+')}`);
  }
  if (!parts.length) return null;
  const formula = parts.join('+');
  const cfg = widget.config;
  cfg.history = [{ formula, total }, ...(cfg.history || [])].slice(0, 12);
  store.put('widgets', widget);
  return { total, formula, detail };
}

/** Roll a formula (applying advantage), record it to history, persist. */
function rollAndRecord(widget, formula, ctx) {
  let r = rollFormula(formula);
  if (!r) return null;
  const cfg = widget.config;
  if (cfg.adv !== 'none') {
    const r2 = rollFormula(formula);
    r = cfg.adv === 'adv' ? (r2.total > r.total ? r2 : r) : (r2.total < r.total ? r2 : r);
  }
  cfg.lastFormula = formula;
  cfg.history = [{ formula: r.formula, total: r.total }, ...(cfg.history || [])].slice(0, 12);
  store.put('widgets', widget);
  return r;
}

registry.register({
  type: 'dice',
  name: 'Dice',
  icon: 'dice',
  description: 'd4 to d100, formulas, advantage',
  external: true, internal: false,
  defaultConfig: () => ({ history: [], adv: 'none', lastFormula: '1d20', pool: {} }),

  // P-2: tapping the card body re-rolls the last formula (defaults to d20).
  primaryTap(widget, ctx) {
    if (rollAndRecord(widget, widget.config.lastFormula || '1d20', ctx)) ctx.refreshCard(widget);
  },

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const cfg = widget.config;
    const card = el(`<div class="dice-widget">
      <div class="d-result">—</div>
      <div class="row" style="flex-wrap:wrap;justify-content:center;gap:6px"></div>
      <div class="d-pool"></div>
      <div class="row" style="margin-top:8px">
        <input class="input" placeholder="2d6+3" style="flex:1">
        <button class="btn d-adv">${{ none: 'ADV?', adv: 'ADV', dis: 'DIS' }[cfg.adv]}</button>
      </div>
      <div class="d-history soft" style="font-size:0.74rem;margin-top:8px"></div>
    </div>`);
    const result = card.querySelector('.d-result');
    const histEl = card.querySelector('.d-history');
    cfg.pool = cfg.pool || {};

    const renderHist = () => {
      histEl.textContent = (cfg.history || []).slice(0, 6).map(h => `${h.formula}→${h.total}`).join('  ·  ');
    };
    const doRoll = (formula) => {
      const r = rollAndRecord(widget, formula, ctx);
      if (!r) { ctx.toast('Try a formula like 2d6+3', 'dice'); return; }
      result.textContent = r.total;
      result.title = r.rolls.join(' + ') + (r.mod ? ` ${r.mod > 0 ? '+' : ''}${r.mod}` : '');
      result.classList.remove('tumble');
      void result.offsetWidth;
      result.classList.add('tumble');
      renderHist();
    };

    const row = card.querySelector('.row');
    for (const d of [4, 6, 8, 10, 12, 20, 100]) {
      const b = el(`<button class="btn" style="padding:6px 10px">d${d}</button>`);
      b.onclick = () => doRoll(`1d${d}`);
      row.appendChild(b);
    }

    // dice pool: tap a die to add one, right-click to remove, then roll them all
    const poolEl = card.querySelector('.d-pool');
    const poolSummary = () => [4, 6, 8, 10, 12, 20, 100].filter(d => cfg.pool[d] > 0).map(d => `${cfg.pool[d]}d${d}`).join(' + ');
    const drawPool = () => {
      poolEl.innerHTML = '';
      const label = el('<span class="d-pool-label soft">Pool</span>');
      poolEl.appendChild(label);
      for (const d of [4, 6, 8, 10, 12, 20, 100]) {
        const n = cfg.pool[d] || 0;
        const chip = el(`<button class="d-pool-die${n ? ' on' : ''}" title="Tap +1 · right-click −1">d${d}${n ? `<b>${n}</b>` : ''}</button>`);
        chip.onclick = () => { cfg.pool[d] = (cfg.pool[d] || 0) + 1; store.put('widgets', widget); drawPool(); };
        chip.oncontextmenu = (e) => { e.preventDefault(); cfg.pool[d] = Math.max(0, (cfg.pool[d] || 0) - 1); store.put('widgets', widget); drawPool(); };
        poolEl.appendChild(chip);
      }
      const count = [4, 6, 8, 10, 12, 20, 100].reduce((a, d) => a + (cfg.pool[d] || 0), 0);
      const rollB = el(`<button class="btn btn-primary d-pool-roll">Roll ${count ? poolSummary() : 'pool'}</button>`);
      rollB.disabled = !count;
      rollB.onclick = () => {
        const r = rollPool(widget, cfg.pool);
        if (!r) return;
        result.textContent = r.total;
        result.title = r.detail.join('   ');
        result.classList.remove('tumble'); void result.offsetWidth; result.classList.add('tumble');
        renderHist();
      };
      poolEl.appendChild(rollB);
      if (count) {
        const clear = el('<button class="btn d-pool-clear" title="Clear pool">✕</button>');
        clear.onclick = () => { cfg.pool = {}; store.put('widgets', widget); drawPool(); };
        poolEl.appendChild(clear);
      }
    };
    drawPool();

    const formulaIn = card.querySelector('input');
    formulaIn.onkeydown = (e) => { if (e.key === 'Enter') doRoll(formulaIn.value); };
    card.querySelector('.d-adv').onclick = (e) => {
      cfg.adv = { none: 'adv', adv: 'dis', dis: 'none' }[cfg.adv];
      e.currentTarget.textContent = { none: 'ADV?', adv: 'ADV', dis: 'DIS' }[cfg.adv];
      store.put('widgets', widget);
    };
    renderHist();
    host.appendChild(card);
  }
});
