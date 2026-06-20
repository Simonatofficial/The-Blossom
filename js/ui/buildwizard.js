/* "Help me build" wizard (docs/13 §3c). A calm step-by-step flow over a
   blueprint: one question per screen with Back / progress dots, then a preview
   of the pages + tools it will plant. Assembles a preset-def and hands it to
   instantiatePreset. Opens as a Panel (CR-11). */

import { router } from '../core/router.js';
import { icon } from './icons.js';
import { el, openPanel, seg, toast } from './components.js';
import { instantiatePreset } from '../presets/modules/index.js';
import { assemble, previewPages } from '../presets/blueprints.js';

/**
 * @param {object} blueprint
 * @param {{fullPreset?: object}} opts — fullPreset enables the "plant full preset" escape.
 */
export function openBuildWizard(blueprint, opts = {}) {
  const d = openPanel({ title: blueprint.title || 'Help me build', iconName: 'wand' });
  const answers = {};
  for (const q of blueprint.questions) if (q.default !== undefined) answers[q.id] = q.default;
  const total = blueprint.questions.length;
  let step = 0; // 0..total-1 = questions, total = preview

  const plant = (def) => { const mod = instantiatePreset(def); d.close(); toast(`${def.name || 'Module'} planted`, 'sprout'); router.go(mod.id); };

  const dots = () => {
    const row = el('<div class="row bw-dots" style="justify-content:center;gap:6px;margin-bottom:14px"></div>');
    for (let k = 0; k <= total; k++) row.appendChild(el(`<span class="bw-dot${k === step ? ' active' : k < step ? ' done' : ''}"></span>`));
    return row;
  };

  const nav = (onBack, onNext, nextLabel) => {
    const row = el('<div class="row" style="gap:8px;margin-top:18px"></div>');
    if (onBack) { const b = el(`<button class="btn">${icon('chevron-left', 15)} Back</button>`); b.onclick = onBack; row.appendChild(b); }
    const n = el(`<button class="btn btn-primary grow">${nextLabel}</button>`); n.onclick = onNext; row.appendChild(n);
    return row;
  };

  const renderQuestion = (q) => {
    d.body.appendChild(el('<h3 style="margin-bottom:4px"></h3>')).textContent = q.prompt;
    if (q.help) d.body.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:12px"></p>')).textContent = q.help;

    if (q.type === 'text' || q.type === 'number') {
      const inp = el(`<input class="input"${q.type === 'number' ? ' type="number"' : ''}>`);
      if (q.placeholder) inp.placeholder = q.placeholder;
      inp.value = answers[q.id] ?? '';
      inp.addEventListener('input', () => { answers[q.id] = q.type === 'number' ? Number(inp.value) : inp.value; });
      d.body.appendChild(inp);
    } else if (q.type === 'toggle') {
      d.body.appendChild(seg([{ value: true, label: 'Yes, add it' }, { value: false, label: 'No thanks' }], answers[q.id] ?? q.default ?? false, (v) => answers[q.id] = v));
    } else if (q.type === 'choice') {
      const wrap = el('<div></div>');
      const paint = () => {
        wrap.innerHTML = '';
        for (const o of q.options) {
          const sel = answers[q.id] === o.value;
          const b = el(`<button class="list-item${sel ? ' bw-sel' : ''}"><span class="li-main"><span class="li-title"></span></span>${sel ? icon('check', 16) : ''}</button>`);
          b.querySelector('.li-title').textContent = o.label;
          b.onclick = () => { answers[q.id] = o.value; paint(); };
          wrap.appendChild(b);
        }
      };
      paint(); d.body.appendChild(wrap);
    }

    d.body.appendChild(nav(step > 0 ? () => { step--; render(); } : null, () => { step++; render(); }, step + 1 < total ? 'Next' : 'Preview build'));
    if (step === 0 && opts.fullPreset) {
      const esc = el(`<button class="btn-soft-wide" style="margin-top:10px">${icon('gift', 14)} Plant the full preset instead</button>`);
      esc.onclick = () => plant(opts.fullPreset);
      d.body.appendChild(esc);
    }
  };

  const renderPreview = () => {
    d.body.appendChild(el('<h3 style="margin-bottom:4px">Here’s your build</h3>'));
    d.body.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:12px">These pages and tools will be planted, wired together. You can change anything later.</p>'));
    for (const p of previewPages(blueprint, answers)) {
      const card = el(`<div class="panel" style="padding:10px 12px;margin-bottom:8px"><div class="row" style="gap:6px;margin-bottom:4px"><span style="color:var(--accent)">${icon(p.icon || 'circle', 16)}</span><strong class="bw-pn"></strong>${p.home ? '<span class="chip">home</span>' : ''}</div><div class="soft bw-tools" style="font-size:0.82rem"></div></div>`);
      card.querySelector('.bw-pn').textContent = p.name;
      card.querySelector('.bw-tools').textContent = p.tools.join(' · ');
      d.body.appendChild(card);
    }
    d.body.appendChild(nav(() => { step--; render(); }, () => plant(assemble(blueprint, answers)), `${icon('sprout', 15)} Plant it`));
  };

  const render = () => {
    d.body.innerHTML = '';
    d.body.appendChild(dots());
    if (step < total) renderQuestion(blueprint.questions[step]); else renderPreview();
  };

  render();
}
