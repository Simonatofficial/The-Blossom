/* Snake game widget (V2 §21). Classic snake on a square grid — swipe to turn on
   touch, arrow keys on desktop. Score shown; high score persists in the widget.
   Card view is a compact board; the full page gives a bigger playfield. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { el } from '../ui/components.js';

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function mount(host, widget, ctx, big) {
  host.innerHTML = '';
  const N = big ? 20 : 14;            // grid cells per side
  const wrap = el(`<div class="snake-wrap${big ? ' big' : ''}"></div>`);
  const score = el(`<div class="snake-score row-between"><span class="s-cur">Score 0</span><span class="s-best">Best ${widget.config.highScore || 0}</span></div>`);
  const cv = el('<canvas class="snake-cv"></canvas>');
  const overlay = el('<button class="snake-overlay">Tap to play</button>');
  wrap.append(score, el('<div class="snake-board"></div>'));
  wrap.querySelector('.snake-board').append(cv, overlay);
  host.appendChild(wrap);

  const g = cv.getContext('2d');
  let size, cell, dpr = Math.min(2, devicePixelRatio || 1);
  const fit = () => {
    size = Math.max(160, Math.min(big ? 460 : 300, wrap.clientWidth || 280));
    cell = Math.floor(size / N);
    size = cell * N;
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = cv.style.height = size + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  let snake, dir, nextDir, food, alive = false, timer = null, sc = 0;
  const rndCell = () => ({ x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) });
  const placeFood = () => { do { food = rndCell(); } while (snake.some(s => s.x === food.x && s.y === food.y)); };

  const draw = () => {
    g.clearRect(0, 0, size, size);
    g.fillStyle = css('--surface-alt'); g.fillRect(0, 0, size, size);
    // food
    g.fillStyle = css('--highlight');
    g.beginPath(); g.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * 0.36, 0, Math.PI * 2); g.fill();
    // snake
    snake.forEach((s, i) => {
      g.fillStyle = i === 0 ? css('--accent') : css('--accent');
      g.globalAlpha = i === 0 ? 1 : 0.55 + 0.45 * (1 - i / snake.length);
      g.beginPath(); g.roundRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2, 4); g.fill();
    });
    g.globalAlpha = 1;
  };

  const stop = () => { if (timer) clearInterval(timer); timer = null; alive = false; };
  const step = () => {
    if (!cv.isConnected) { stop(); window.removeEventListener('keydown', onKey); return; }
    if (document.hidden) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || snake.some(s => s.x === head.x && s.y === head.y)) return gameOver();
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) { sc++; score.querySelector('.s-cur').textContent = `Score ${sc}`; placeFood(); }
    else snake.pop();
    draw();
  };

  const gameOver = () => {
    stop();
    if (sc > (widget.config.highScore || 0)) { widget.config.highScore = sc; store.put('widgets', widget); score.querySelector('.s-best').textContent = `Best ${sc}`; }
    overlay.textContent = `Game over · ${sc} · Tap to retry`;
    overlay.classList.remove('hidden');
  };

  const start = () => {
    fit();
    snake = [{ x: (N / 2) | 0, y: (N / 2) | 0 }]; dir = { x: 1, y: 0 }; nextDir = dir; sc = 0;
    score.querySelector('.s-cur').textContent = 'Score 0';
    placeFood(); draw();
    overlay.classList.add('hidden'); alive = true;
    stop(); timer = setInterval(step, big ? 130 : 150);
  };

  overlay.onclick = start;
  const turn = (x, y) => { if (!alive) return; if (x === -dir.x && y === -dir.y) return; nextDir = { x, y }; };
  const onKey = (e) => {
    const k = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (k && cv.isConnected) { e.preventDefault(); turn(k[0], k[1]); }
  };
  window.addEventListener('keydown', onKey);
  // swipe
  let sx = 0, sy = 0;
  cv.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  cv.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { if (!alive) start(); return; }
    if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0); else turn(0, Math.sign(dy));
  });

  fit(); snake = [{ x: 2, y: (N / 2) | 0 }]; placeFood(); draw();
}

registry.register({
  type: 'snake',
  name: 'Snake',
  icon: 'zap',
  description: 'Classic snake — swipe or arrow keys',
  keywords: ['game', 'arcade', 'play', 'fun'],
  external: true, internal: true,
  defaultConfig: () => ({ highScore: 0 }),
  outputs: (widget) => [{ key: 'highScore', name: 'High score', dayKeyed: false, get: () => widget.config.highScore || 0 }],
  renderCard(host, widget, ctx) { mount(host, widget, ctx, false); },
  renderFull(host, widget, ctx) { mount(host, widget, ctx, true); }
});
