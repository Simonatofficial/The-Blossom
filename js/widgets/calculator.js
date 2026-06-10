/* Calculator widget (docs/05): 4-function mini card; scientific internal view
   with a history tape (tap a line to reuse). Safe parser — no eval. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { el } from '../ui/components.js';

/* tiny shunting-yard evaluator with functions */
function evaluate(expr) {
  const tokens = expr.match(/(\d+\.?\d*|[+\-*/^()]|sin|cos|tan|sqrt|log|ln|pi|e)/g);
  if (!tokens) return NaN;
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
  const out = [], ops = [];
  let prev = null;
  for (let t of tokens) {
    if (/^\d/.test(t)) out.push(Number(t));
    else if (t === 'pi') out.push(Math.PI);
    else if (t === 'e') out.push(Math.E);
    else if (['sin', 'cos', 'tan', 'sqrt', 'log', 'ln'].includes(t)) ops.push(t);
    else if (t === '(') ops.push(t);
    else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
      ops.pop();
      if (['sin', 'cos', 'tan', 'sqrt', 'log', 'ln'].includes(ops[ops.length - 1])) out.push(ops.pop());
    } else {
      if (t === '-' && (prev == null || prev === '(' || prec[prev])) { out.push(0); }
      while (ops.length && prec[ops[ops.length - 1]] >= prec[t] && ops[ops.length - 1] !== '^') out.push(ops.pop());
      ops.push(t);
    }
    prev = t;
  }
  while (ops.length) out.push(ops.pop());
  const st = [];
  for (const t of out) {
    if (typeof t === 'number') { st.push(t); continue; }
    if (['sin', 'cos', 'tan', 'sqrt', 'log', 'ln'].includes(t)) {
      const a = st.pop();
      st.push({ sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, log: Math.log10, ln: Math.log }[t](a));
      continue;
    }
    const b = st.pop(), a = st.pop();
    st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : t === '/' ? a / b : Math.pow(a, b));
  }
  return st[0];
}

function keypad(host, widget, keys, displayEl, cols) {
  const grid = el(`<div class="calc-grid" style="grid-template-columns:repeat(${cols},1fr)"></div>`);
  let expr = '';
  const show = () => { displayEl.textContent = expr || '0'; };
  const press = (k) => {
    if (k === 'C') expr = '';
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') {
      const v = evaluate(expr);
      if (!Number.isNaN(v) && v != null) {
        widget.config.tape = [`${expr} = ${Math.round(v * 1e10) / 1e10}`, ...(widget.config.tape || [])].slice(0, 30);
        store.put('widgets', widget);
        expr = String(Math.round(v * 1e10) / 1e10);
      }
    } else expr += k;
    show();
  };
  for (const k of keys) {
    const b = el(`<button class="calc-key ${'0123456789.'.includes(k) ? '' : 'op'}">${k}</button>`);
    b.onclick = () => press(k);
    grid.appendChild(b);
  }
  host.appendChild(grid);
  show();
  return { setExpr: (v) => { expr = v; show(); } };
}

registry.register({
  type: 'calculator',
  name: 'Calculator',
  icon: 'calculator',
  description: 'Quick math, scientific inside',
  external: true, internal: true,
  defaultConfig: () => ({ tape: [] }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const display = el('<div class="calc-display">0</div>');
    host.appendChild(display);
    keypad(host, widget, ['C', '(', ')', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '⌫', '='], display, 4);
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    const display = el('<div class="calc-display" style="font-size:1.6rem">0</div>');
    host.appendChild(display);
    const pad = keypad(host, widget,
      ['sin', 'cos', 'tan', 'sqrt', 'C', '7', '8', '9', '/', '⌫', '4', '5', '6', '*', '^', '1', '2', '3', '-', 'log', '0', '.', '(', ')', 'ln', 'pi', 'e', '+', '=', ' '],
      display, 5);
    const tape = el('<div style="margin-top:14px"></div>');
    const renderTape = () => {
      tape.innerHTML = '<h3 class="soft" style="font-size:0.78rem;margin-bottom:6px">TAPE</h3>';
      for (const line of (widget.config.tape || []).slice(0, 12)) {
        const row = el('<button class="list-item" style="font-variant-numeric:tabular-nums"></button>');
        row.textContent = line;
        row.onclick = () => { pad.setExpr(line.split(' = ')[1]); renderTape(); };
        tape.appendChild(row);
      }
    };
    renderTape();
    host.appendChild(tape);
  }
});
