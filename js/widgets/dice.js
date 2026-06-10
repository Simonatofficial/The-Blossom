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

registry.register({
  type: 'dice',
  name: 'Dice',
  icon: 'dice',
  description: 'd4 to d100, formulas, advantage',
  external: true, internal: false,
  defaultConfig: () => ({ history: [], adv: 'none' }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const cfg = widget.config;
    const card = el(`<div class="dice-widget">
      <div class="d-result">—</div>
      <div class="row" style="flex-wrap:wrap;justify-content:center;gap:6px"></div>
      <div class="row" style="margin-top:8px">
        <input class="input" placeholder="2d6+3" style="flex:1">
        <button class="btn d-adv">${{ none: 'ADV?', adv: 'ADV', dis: 'DIS' }[cfg.adv]}</button>
      </div>
      <div class="d-history soft" style="font-size:0.74rem;margin-top:8px"></div>
    </div>`);
    const result = card.querySelector('.d-result');
    const histEl = card.querySelector('.d-history');

    const renderHist = () => {
      histEl.textContent = (cfg.history || []).slice(0, 6).map(h => `${h.formula}→${h.total}`).join('  ·  ');
    };
    const doRoll = (formula) => {
      let r = rollFormula(formula);
      if (!r) { ctx.toast('Try a formula like 2d6+3', 'dice'); return; }
      if (cfg.adv !== 'none') {
        const r2 = rollFormula(formula);
        r = cfg.adv === 'adv' ? (r2.total > r.total ? r2 : r) : (r2.total < r.total ? r2 : r);
      }
      result.textContent = r.total;
      result.title = r.rolls.join(' + ') + (r.mod ? ` ${r.mod > 0 ? '+' : ''}${r.mod}` : '');
      result.classList.remove('tumble');
      void result.offsetWidth;
      result.classList.add('tumble');
      cfg.history = [{ formula: r.formula, total: r.total }, ...(cfg.history || [])].slice(0, 12);
      store.put('widgets', widget);
      renderHist();
    };

    const row = card.querySelector('.row');
    for (const d of [4, 6, 8, 10, 12, 20, 100]) {
      const b = el(`<button class="btn" style="padding:6px 10px">d${d}</button>`);
      b.onclick = () => doRoll(`1d${d}`);
      row.appendChild(b);
    }
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
