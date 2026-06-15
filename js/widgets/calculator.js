/* Calculator widget (docs/05 + V2 §12b): a standard 4-function card with a
   last-10 history tape, and a Desmos-style graphing calculator in the internal
   view — add/remove `y = f(x)` equations (colour + visibility), on a pannable,
   zoomable coordinate plane. Safe parser (shunting-yard → RPN), no eval. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';

const FUNCS = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, log: Math.log10, ln: Math.log, abs: Math.abs };
const FNAMES = Object.keys(FUNCS);
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

/** Expression → RPN token list (numbers, 'x', function names, operators). */
function toRPN(expr) {
  const tokens = (expr || '').match(/(\d+\.?\d*|[+\-*/^()]|sin|cos|tan|sqrt|log|ln|abs|pi|e|x)/g);
  if (!tokens) return null;
  const out = [], ops = [];
  let prev = null;
  for (const t of tokens) {
    if (/^\d/.test(t)) out.push(Number(t));
    else if (t === 'pi') out.push(Math.PI);
    else if (t === 'e') out.push(Math.E);
    else if (t === 'x') out.push('x');
    else if (FNAMES.includes(t)) ops.push(t);
    else if (t === '(') ops.push(t);
    else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
      ops.pop();
      if (FNAMES.includes(ops[ops.length - 1])) out.push(ops.pop());
    } else {
      if (t === '-' && (prev == null || prev === '(' || PREC[prev])) out.push(0);
      while (ops.length && PREC[ops[ops.length - 1]] >= PREC[t] && ops[ops.length - 1] !== '^') out.push(ops.pop());
      ops.push(t);
    }
    prev = t;
  }
  while (ops.length) out.push(ops.pop());
  return out;
}
function evalRPN(rpn, x) {
  const st = [];
  for (const t of rpn) {
    if (typeof t === 'number') st.push(t);
    else if (t === 'x') st.push(x);
    else if (FUNCS[t]) st.push(FUNCS[t](st.pop()));
    else { const b = st.pop(), a = st.pop(); st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : t === '/' ? a / b : Math.pow(a, b)); }
  }
  return st[0];
}
function evaluate(expr) { const r = toRPN(expr); return r ? evalRPN(r, 0) : NaN; }
function compile(expr) { const r = toRPN(expr.replace(/^\s*y\s*=\s*/i, '')); return r ? (x) => { try { return evalRPN(r, x); } catch { return NaN; } } : null; }

function keypad(host, widget, keys, displayEl, cols, onEq) {
  const grid = el(`<div class="calc-grid" style="grid-template-columns:repeat(${cols},1fr)"></div>`);
  let expr = '';
  const show = () => { displayEl.textContent = expr || '0'; };
  const press = (k) => {
    if (k === 'C') expr = '';
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') {
      const v = evaluate(expr);
      if (!Number.isNaN(v) && v != null) {
        const r = Math.round(v * 1e10) / 1e10;
        widget.config.tape = [`${expr} = ${r}`, ...(widget.config.tape || [])].slice(0, 30);
        store.put('widgets', widget); expr = String(r); onEq?.();
      }
    } else expr += k;
    show();
  };
  for (const k of keys) { if (k === ' ') { grid.appendChild(el('<span></span>')); continue; } const b = el(`<button class="calc-key ${'0123456789.'.includes(k) ? '' : 'op'}">${k}</button>`); b.onclick = () => press(k); grid.appendChild(b); }
  host.appendChild(grid); show();
  return { setExpr: (v) => { expr = v; show(); } };
}

/* ---------- graphing calculator ---------- */
function mountGrapher(host, widget) {
  widget.config.equations = widget.config.equations || [{ id: ulid(), expr: 'sin(x)', color: '#a78bfa', visible: true }];
  const view = { cx: 0, cy: 0, scale: 36 }; // px per unit
  const wrap = el('<div class="calc-graph"></div>');
  const canvas = el('<canvas class="calc-graph-cv"></canvas>');
  const tools = el(`<div class="row" style="gap:6px;margin:8px 0"><button class="btn-icon" title="Zoom in">${icon('plus', 16)}</button><button class="btn-icon" title="Zoom out">${icon('minus', 16)}</button><button class="btn" style="padding:4px 10px">Reset</button></div>`);
  const eqList = el('<div class="calc-eqs"></div>');
  wrap.append(canvas, tools, eqList);
  host.appendChild(wrap);
  const g = canvas.getContext('2d');
  let W = 320, H = 320, dpr = Math.min(2, devicePixelRatio || 1);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const fit = () => { W = Math.max(260, wrap.clientWidth || 320); H = Math.min(380, Math.round(W * 0.9)); canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const sx = (wx) => W / 2 + (wx - view.cx) * view.scale;
  const sy = (wy) => H / 2 - (wy - view.cy) * view.scale;

  const niceStep = () => { const target = 70 / view.scale; const p = Math.pow(10, Math.floor(Math.log10(target))); const m = target / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };

  const draw = () => {
    g.clearRect(0, 0, W, H); g.fillStyle = css('--surface-alt'); g.fillRect(0, 0, W, H);
    const step = niceStep();
    const left = view.cx - W / 2 / view.scale, right = view.cx + W / 2 / view.scale;
    const bottom = view.cy - H / 2 / view.scale, top = view.cy + H / 2 / view.scale;
    g.strokeStyle = css('--border'); g.fillStyle = css('--text-soft'); g.font = '9px system-ui'; g.lineWidth = 1;
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) { g.globalAlpha = 0.4; g.beginPath(); g.moveTo(sx(x), 0); g.lineTo(sx(x), H); g.stroke(); g.globalAlpha = 1; if (Math.abs(x) > 1e-9) g.fillText(+x.toFixed(4), sx(x) + 2, sy(0) - 2); }
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) { g.globalAlpha = 0.4; g.beginPath(); g.moveTo(0, sy(y)); g.lineTo(W, sy(y)); g.stroke(); g.globalAlpha = 1; if (Math.abs(y) > 1e-9) g.fillText(+y.toFixed(4), sx(0) + 3, sy(y) - 2); }
    // axes
    g.strokeStyle = css('--text-soft'); g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, sy(0)); g.lineTo(W, sy(0)); g.moveTo(sx(0), 0); g.lineTo(sx(0), H); g.stroke();
    // curves
    for (const eq of widget.config.equations) {
      if (!eq.visible) continue;
      const f = compile(eq.expr); if (!f) continue;
      g.strokeStyle = eq.color; g.lineWidth = 2; g.beginPath();
      let pen = false, lastY = null;
      for (let px = 0; px <= W; px++) {
        const wx = view.cx + (px - W / 2) / view.scale; const wy = f(wx);
        if (!Number.isFinite(wy)) { pen = false; continue; }
        const py = sy(wy);
        if (pen && lastY != null && Math.abs(py - lastY) > H * 2) { pen = false; } // asymptote break
        if (!pen) { g.moveTo(px, py); pen = true; } else g.lineTo(px, py);
        lastY = py;
      }
      g.stroke();
    }
  };

  const renderEqs = () => {
    eqList.innerHTML = '';
    for (const eq of widget.config.equations) {
      const row = el(`<div class="calc-eq row" style="gap:6px"><span class="calc-eq-dot" style="background:${eq.color}"></span><span class="soft" style="font-size:0.8rem">y =</span><input class="input" style="flex:1"><button class="btn-icon calc-eq-vis" style="opacity:${eq.visible ? 1 : 0.35}">${icon('eye', 14)}</button><button class="btn-icon calc-eq-del">${icon('trash', 13)}</button></div>`);
      const inp = row.querySelector('input'); inp.value = eq.expr;
      inp.addEventListener('input', () => { eq.expr = inp.value; store.put('widgets', widget); draw(); });
      row.querySelector('.calc-eq-vis').onclick = () => { eq.visible = !eq.visible; store.put('widgets', widget); renderEqs(); draw(); };
      row.querySelector('.calc-eq-del').onclick = () => { widget.config.equations = widget.config.equations.filter(e => e.id !== eq.id); store.put('widgets', widget); renderEqs(); draw(); };
      row.querySelector('.calc-eq-dot').onclick = () => { const colors = ['#a78bfa', '#7cc4ff', '#9be3b4', '#ffd28a', '#f6a5c0']; eq.color = colors[(colors.indexOf(eq.color) + 1) % colors.length]; store.put('widgets', widget); renderEqs(); draw(); };
      eqList.appendChild(row);
    }
    const add = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('plus', 14)} Add equation</button>`);
    add.onclick = () => { widget.config.equations.push({ id: ulid(), expr: '', color: '#7cc4ff', visible: true }); store.put('widgets', widget); renderEqs(); };
    eqList.appendChild(add);
  };

  // pan + zoom
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; view.cx -= (e.clientX - drag.x) / view.scale; view.cy += (e.clientY - drag.y) / view.scale; drag = { x: e.clientX, y: e.clientY }; draw(); });
  canvas.addEventListener('pointerup', () => drag = null);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; const wx = view.cx + (mx - W / 2) / view.scale, wy = view.cy - (my - H / 2) / view.scale; view.scale *= e.deltaY < 0 ? 1.12 : 0.89; view.cx = wx - (mx - W / 2) / view.scale; view.cy = wy + (my - H / 2) / view.scale; draw(); }, { passive: false });
  tools.querySelectorAll('.btn-icon')[0].onclick = () => { view.scale *= 1.2; draw(); };
  tools.querySelectorAll('.btn-icon')[1].onclick = () => { view.scale *= 0.83; draw(); };
  tools.querySelector('.btn').onclick = () => { view.cx = 0; view.cy = 0; view.scale = 36; draw(); };

  fit(); renderEqs(); draw();
}

registry.register({
  type: 'calculator',
  name: 'Calculator',
  icon: 'calculator',
  description: 'Standard calculator; graphing inside',
  external: true, internal: true,
  defaultConfig: () => ({ tape: [], equations: null }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const hist = el('<div class="calc-history"></div>');
    const renderHist = () => { hist.innerHTML = ''; for (const line of (widget.config.tape || []).slice(0, 10).reverse()) { const r = el('<div class="calc-hline"></div>'); r.textContent = line; hist.appendChild(r); } };
    renderHist();
    const display = el('<div class="calc-display">0</div>');
    host.append(hist, display);
    keypad(host, widget, ['C', '(', ')', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '⌫', '='], display, 4, renderHist);
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    mountGrapher(host, widget);
  }
});
