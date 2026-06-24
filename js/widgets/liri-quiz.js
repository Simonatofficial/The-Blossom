/* The element-discovery quiz UI (docs/17 §4). Shared by the companion + elementquiz widgets so
   neither depends on the other — both import this and the pure content. 15 gentle questions →
   reveal the fixed element → pick a starting form → bond. Calm, one question at a time. */

import { el } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { QUIZ, scoreQuiz, ELEMENTS, FORMS } from '../presets/liri-content.js';
import { discover, liriAppearance } from '../core/liri.js';
import { liriSVG } from './liri-render.js';

/**
 * Render the quiz into `host`. Calls onDone(element) once Liri is discovered.
 * @param {HTMLElement} host
 * @param {() => void} [onDone]
 */
export function renderElementQuiz(host, onDone) {
  const answers = [];
  let i = 0;

  const ask = () => {
    host.innerHTML = '';
    const q = QUIZ[i];
    host.appendChild(el(`<div class="row-between" style="margin-bottom:6px">
      <span class="soft" style="font-size:0.78rem">Question ${i + 1} of ${QUIZ.length}</span>
      <span class="soft" style="font-size:0.78rem">Discovering Liri…</span></div>`));
    host.appendChild(el(`<div class="sk-bar" style="margin-bottom:12px"><span class="sk-fill" style="width:${(i / QUIZ.length) * 100}%"></span></div>`));
    host.appendChild(el(`<p style="font-weight:600;margin-bottom:12px">${q.q}</p>`));
    for (const key of ['a', 'b']) {
      const opt = el(`<button class="btn-soft-wide" style="text-align:left;margin-bottom:8px;white-space:normal">${q[key].label}</button>`);
      opt.onclick = () => { answers[i] = key; i++; if (i < QUIZ.length) ask(); else reveal(); };
      host.appendChild(opt);
    }
    if (i > 0) {
      const back = el(`<button class="soft" style="background:none;border:none;cursor:pointer;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;margin-top:2px">${icon('arrow-left', 13)} Back</button>`);
      back.onclick = () => { i--; ask(); };
      host.appendChild(back);
    }
  };

  const reveal = () => {
    const { element } = scoreQuiz(answers);
    const elDef = ELEMENTS[element];
    host.innerHTML = '';
    host.appendChild(el(`<div style="text-align:center">
      <p class="soft" style="font-size:0.82rem">Liri's nature is…</p>
      <p style="font-size:1.4rem;font-weight:700;color:${elDef.color};margin:2px 0">${icon(elDef.icon, 22)} ${elDef.name}</p>
      <p class="soft" style="font-size:0.84rem;margin-bottom:10px">${elDef.word}</p>
      <p style="font-size:0.86rem;margin-bottom:8px">Now choose a form for your companion:</p></div>`));
    const grid = el('<div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center"></div>');
    for (const f of FORMS) {
      const pick = el(`<button class="panel" style="padding:8px;width:130px;cursor:pointer;border:1px solid var(--border)">
        <div class="liri-form-art"></div>
        <div style="font-weight:600;font-size:0.82rem;margin-top:4px">${f.name}</div>
        <div class="soft" style="font-size:0.72rem;white-space:normal">${f.blurb}</div></button>`);
      // preview each form in the chosen element
      pick.querySelector('.liri-form-art').innerHTML = liriSVG({ element, color: elDef.color, deep: elDef.deep, form: f.id, size: 0.5, colorDepth: 0.3, abilities: 0, adornment: 0, liveliness: 0.5, name: f.name }, { px: 96 });
      pick.onclick = () => { discover(element, f.id); done(element); };
      grid.appendChild(pick);
    }
    host.appendChild(grid);
  };

  const done = (element) => {
    const app = liriAppearance();
    host.innerHTML = '';
    host.appendChild(el(`<div style="text-align:center">
      <div class="liri-born"></div>
      <p style="font-weight:700;margin-top:6px">${app.name} is with you 🌱</p>
      <p class="soft" style="font-size:0.84rem">Live your five aspects and ${app.name} will grow — bigger, brighter, more itself.</p></div>`));
    host.querySelector('.liri-born').innerHTML = liriSVG(app, { px: 150 });
    onDone?.(element);
  };

  ask();
}
