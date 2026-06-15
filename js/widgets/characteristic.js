/* Characteristics widget (V2 §24): a meta-skill whose level is derived from the
   levels of the Skill widgets it contains or references. Default formula: every
   3 contributing skill levels = 1 Characteristic level (configurable). As those
   skills level up, the Characteristic rises with them. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, field, input, toast } from '../ui/components.js';
import { childWidgetsOf } from './base.js';
import { openWidgetGallery, openNodePicker } from '../ui/picker.js';

/** Skills feeding this characteristic: nested skills + referenced skills. */
function contributors(widget) {
  const nested = childWidgetsOf(widget.id).filter(w => w.type === 'skill');
  const refs = (widget.config.skillRefs || []).map(id => store.get('widgets', id)).filter(w => w?.type === 'skill');
  const map = new Map();
  for (const w of [...nested, ...refs]) map.set(w.id, w);
  return [...map.values()];
}

function level(widget) {
  const per = Math.max(1, widget.config.perLevel || 3);
  const skills = contributors(widget);
  const sum = skills.reduce((a, s) => a + (s.config.level || 1), 0);
  return { skills, sum, per, level: Math.max(1, Math.floor(sum / per)), pct: ((sum % per) / per) * 100, toNext: per - (sum % per) };
}

registry.register({
  type: 'characteristic',
  name: 'Characteristic',
  icon: 'award',
  description: 'A meta-skill that grows with your skills',
  container: true, external: true, internal: true,
  defaultConfig: () => ({ perLevel: 3, skillRefs: [] }),

  outputs: (widget) => [
    { key: 'level', name: 'Level', dayKeyed: false, get: () => level(widget).level },
    { key: 'skillLevels', name: 'Total skill levels', dayKeyed: false, get: () => level(widget).sum }
  ],

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const L = level(widget);
    const card = el(`<div class="char-widget">
      <div class="row"><span class="sk-badge">${L.level}</span>
        <div class="grow">
          <div class="sk-bar"><span class="sk-fill" style="width:${L.pct}%"></span></div>
          <div class="soft" style="font-size:0.76rem;margin-top:3px">${L.sum} skill levels · ${L.toNext} to level ${L.level + 1}</div>
        </div></div>
      <div class="char-skills"></div></div>`);
    const sk = card.querySelector('.char-skills');
    if (!L.skills.length) sk.appendChild(el('<p class="soft" style="font-size:0.82rem;margin-top:8px">Tap to add contributing skills.</p>'));
    for (const s of L.skills) sk.appendChild(el(`<span class="chip">${icon('sparkles', 11)} ${s.name} · L${s.config.level || 1}</span>`));
    host.appendChild(card);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const save = () => store.put('widgets', widget);
    const render = () => {
      host.innerHTML = '';
      const L = level(widget);
      host.appendChild(el(`<div class="panel" style="padding:14px;margin-bottom:14px">
        <div class="row"><span class="sk-badge" style="font-size:1.1rem">${L.level}</span>
        <div class="grow"><div class="sk-bar"><span class="sk-fill" style="width:${L.pct}%"></span></div>
        <div class="soft" style="font-size:0.8rem;margin-top:4px">${L.sum} total skill levels · ${L.toNext} more to reach level ${L.level + 1}</div></div></div></div>`));

      // formula
      const formula = el('<div class="panel" style="padding:12px;margin-bottom:14px"><h3 class="soft" style="font-size:0.78rem;margin-bottom:8px">FORMULA</h3></div>');
      const perIn = input(widget.config.perLevel || 3, 'skill levels per characteristic level'); perIn.type = 'number'; perIn.min = 1;
      perIn.addEventListener('change', () => { widget.config.perLevel = Math.max(1, Number(perIn.value) || 3); save(); render(); });
      formula.appendChild(field(`Skill levels per level`, perIn, `Currently: every ${L.per} skill levels = 1 level.`));
      host.appendChild(formula);

      // contributing skills with level bars
      const list = el('<div class="panel" style="padding:12px;margin-bottom:14px"><h3 class="soft" style="font-size:0.78rem;margin-bottom:8px">CONTRIBUTING SKILLS</h3></div>');
      if (!L.skills.length) list.appendChild(el('<p class="soft" style="font-size:0.85rem">No skills yet — link or nest a Skill widget below.</p>'));
      const maxL = Math.max(1, ...L.skills.map(s => s.config.level || 1));
      for (const s of L.skills) {
        const isRef = (widget.config.skillRefs || []).includes(s.id);
        const row = el(`<div class="row-between" style="margin-bottom:8px;gap:8px">
          <span style="min-width:90px">${icon('sparkles', 12)} <span class="cs-name"></span></span>
          <span class="sk-bar grow"><span class="sk-fill" style="width:${((s.config.level || 1) / maxL) * 100}%"></span></span>
          <span class="chip">L${s.config.level || 1}</span>${isRef ? '<button class="btn-icon cs-unlink" title="Unlink">' + icon('x', 14) + '</button>' : ''}</div>`);
        row.querySelector('.cs-name').textContent = s.name;
        row.querySelector('.cs-unlink')?.addEventListener('click', () => { widget.config.skillRefs = widget.config.skillRefs.filter(id => id !== s.id); save(); render(); });
        list.appendChild(row);
      }
      host.appendChild(list);

      const linkBtn = el(`<button class="btn-soft-wide" style="margin-bottom:8px">${icon('link', 15)} Link an existing Skill</button>`);
      linkBtn.onclick = () => openNodePicker({ onPick: ({ kind, id }) => {
        const w = store.get('widgets', id);
        if (kind !== 'widget' || w?.type !== 'skill') { toast('Pick a Skill widget.', 'info'); return; }
        widget.config.skillRefs = [...new Set([...(widget.config.skillRefs || []), id])]; save(); render();
      } });
      host.appendChild(linkBtn);
      const nestBtn = el(`<button class="btn-soft-wide">${icon('plus', 15)} Nest a new Skill</button>`);
      nestBtn.onclick = () => openWidgetGallery({ parentWidgetId: widget.id, onCreated: render });
      host.appendChild(nestBtn);
    };
    render();
  }
});
