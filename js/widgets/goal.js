/* Goal widget (docs/05): a seed that matures as progress grows.
   Progress = weighted average of linked Quests/Habits (30-day completion
   rate — sticky, not daily-noisy; decision noted in docs) and milestones. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { wallet } from '../core/wallet.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input } from '../ui/components.js';
import { todayStr, fmtDate, childWidgetsOf, bloomBurst, objectsOf, createObject, saveObject } from './base.js';
import * as q from './questops.js';

function parts(widget) {
  const list = [];
  for (const link of (widget.links || [])) {
    const w = store.get('widgets', link.sourceWidgetId);
    if (w && (w.type === 'quest' || w.type === 'habit')) {
      list.push({ kind: 'quest', label: w.name, pct: q.completionRate(w, 30) ?? 0, weight: link.transform?.scale || 1, widget: w });
    }
  }
  for (const w of childWidgetsOf(widget.id)) {
    if (w.type === 'quest' || w.type === 'habit') {
      list.push({ kind: 'quest', label: w.name, pct: q.completionRate(w, 30) ?? 0, weight: 1, widget: w });
    }
  }
  for (const m of (widget.config.milestones || [])) {
    list.push({ kind: 'milestone', label: m.name, pct: m.done ? 100 : 0, weight: m.weight || 1, milestone: m });
  }
  return list;
}

function progress(widget) {
  const list = parts(widget);
  if (!list.length) return 0;
  const wsum = list.reduce((a, p) => a + p.weight, 0);
  return Math.round(list.reduce((a, p) => a + p.pct * p.weight, 0) / (wsum || 1));
}

function stageIcon(pct) {
  if (pct >= 100) return 'flower';
  if (pct >= 60) return 'sprout';
  if (pct >= 25) return 'leaf';
  return 'circle';
}

function checkCompletion(widget, ctx, anchorEl) {
  if (progress(widget) < 100 || widget.config.completedPaid) return;
  widget.config.completedPaid = true;
  const quests = parts(widget).filter(p => p.widget);
  const avgMult = quests.length
    ? quests.reduce((a, p) => a + (q.DIFFICULTY[p.widget.config.difficulty]?.mult || 1), 0) / quests.length
    : 1;
  const coins = Math.round(500 * avgMult);
  wallet.add(coins, `goal:${widget.id}`);
  store.put('widgets', widget);
  if (anchorEl) bloomBurst(anchorEl);
  ctx?.toast?.(`${widget.name} bloomed · +${coins}c`, 'flower');
}

registry.register({
  type: 'goal',
  name: 'Goal',
  icon: 'target',
  description: 'A seed that blooms as linked work completes',
  container: true, linkable: true,
  external: true, internal: true,
  defaultConfig: () => ({ purpose: '', targetDate: null, milestones: [], completedPaid: false }),

  outputs: (widget) => [{
    key: 'progressPct', name: 'Progress %', dayKeyed: false, get: () => progress(widget)
  }],

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const pct = progress(widget);
    const size = 78, r = 33, c = 2 * Math.PI * r;
    let countdown = '';
    if (widget.config.targetDate) {
      const days = Math.ceil((new Date(widget.config.targetDate) - new Date()) / 86400000);
      countdown = days >= 0 ? `${days} days left` : 'past its season';
    }
    host.appendChild(el(`<div class="goal-widget">
      <div class="g-ring-host">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="4"/>
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="4"
            stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"
            transform="rotate(-90 ${size / 2} ${size / 2})"/>
        </svg>
        <span class="g-seed">${icon(stageIcon(pct), 26)}</span>
      </div>
      <div class="g-meta"><div class="g-pct">${pct}%</div>
      ${countdown ? `<div class="soft" style="font-size:0.78rem">${countdown}</div>` : ''}</div>
    </div>`));
    checkCompletion(widget, ctx, host);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    if (widget.config.purpose) {
      host.appendChild(el(`<div class="panel" style="padding:14px;margin-bottom:14px"><div class="soft" style="font-size:0.75rem;margin-bottom:4px">WHY</div><p style="font-style:italic"></p></div>`));
      host.querySelector('p').textContent = widget.config.purpose;
    }

    host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:8px 0 6px">LINKED WORK</h3>'));
    const linked = parts(widget).filter(p => p.kind === 'quest');
    for (const p of linked) {
      const row = el(`<button class="list-item">${icon('flag', 15)}<span class="li-main"><span class="li-title"></span></span><span class="chip accent">${p.pct}%</span></button>`);
      row.querySelector('.li-title').textContent = p.label;
      row.onclick = () => ctx.goWidget(p.widget.id);
      host.appendChild(row);
    }
    if (!linked.length) host.appendChild(el('<p class="soft" style="font-size:0.85rem">Link quests/habits in settings → Linked values, or nest them here.</p>'));

    host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:14px 0 6px">MILESTONES</h3>'));
    const msHost = el('<div></div>');
    const renderMs = () => {
      msHost.innerHTML = '';
      for (const m of (widget.config.milestones || [])) {
        const row = el(`<button class="list-item">
          <span style="color:${m.done ? 'var(--success)' : 'var(--text-soft)'}">${icon(m.done ? 'check-circle' : 'circle', 17)}</span>
          <span class="li-main"><span class="li-title"></span>${m.date ? `<span class="li-sub">${fmtDate(m.date)}</span>` : ''}</span></button>`);
        row.querySelector('.li-title').textContent = m.name;
        row.onclick = () => {
          m.done = !m.done;
          store.put('widgets', widget);
          renderMs();
          checkCompletion(widget, ctx, msHost);
          ctx.events.emit('object:changed', { widgetId: widget.id });
        };
        msHost.appendChild(row);
      }
    };
    renderMs();
    host.appendChild(msHost);
    const addMs = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('plus', 14)} Add milestone</button>`);
    addMs.onclick = () => {
      const form = el(`<div class="row" style="margin-top:8px"><input class="input" placeholder="Milestone" style="flex:2"><input class="input" type="date" style="flex:1"><button class="btn btn-primary">Add</button></div>`);
      form.querySelector('.btn-primary').onclick = () => {
        const [nameIn, dateIn] = form.querySelectorAll('input');
        if (!nameIn.value.trim()) return;
        widget.config.milestones.push({ id: ulid(), name: nameIn.value.trim(), date: dateIn.value || null, done: false, weight: 1 });
        store.put('widgets', widget);
        form.remove();
        renderMs();
      };
      addMs.after(form);
    };
    host.appendChild(addMs);

    // reflection notes
    host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:16px 0 6px">REFLECTION</h3>'));
    const refl = objectsOf(widget.id, 'reflection')[0] || createObject(widget.id, 'reflection', { text: '' });
    const ta = el('<textarea class="textarea" rows="3" placeholder="How is this goal growing?"></textarea>');
    ta.value = refl.data.text || '';
    ta.addEventListener('change', () => { refl.data.text = ta.value; saveObject(refl); });
    host.appendChild(ta);

    // nested widgets
    host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:16px 0 6px">INSIDE THIS GOAL</h3>'));
    const grid = el('<div class="col"></div>');
    for (const child of childWidgetsOf(widget.id)) grid.appendChild(ctx.renderWidgetCard(child));
    host.appendChild(grid);
    const add = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('plus', 15)} Nest a widget</button>`);
    add.onclick = async () => {
      const { openWidgetGallery } = await import('../ui/picker.js');
      openWidgetGallery({ parentWidgetId: widget.id, onCreated: (w) => grid.appendChild(ctx.renderWidgetCard(w)) });
    };
    host.appendChild(add);
  },

  renderSettings(host, widget, ctx) {
    const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
    const purposeIn = el('<textarea class="textarea" rows="2" placeholder="Why does this matter?"></textarea>');
    purposeIn.value = widget.config.purpose || '';
    purposeIn.addEventListener('change', () => { widget.config.purpose = purposeIn.value; save(); });
    host.appendChild(field('Purpose', purposeIn));

    const dateIn = input(widget.config.targetDate || '', '');
    dateIn.type = 'date';
    dateIn.addEventListener('change', () => { widget.config.targetDate = dateIn.value || null; save(); });
    host.appendChild(field('Target date', dateIn));
  }
});
