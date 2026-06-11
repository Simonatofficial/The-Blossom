/* Quest widget (docs/05): one-tap rep completion, difficulty, streaks.
   Mechanics live in questops.js; economy rules in docs/07. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg, promptText } from '../ui/components.js';
import { todayStr, dateAdd, bloomBurst, fmtDate } from './base.js';
import * as q from './questops.js';

registry.register({
  type: 'quest',
  name: 'Quest',
  icon: 'flag',
  description: 'A repeatable task with streaks and coin rewards',
  external: true, internal: true,
  defaultConfig: () => ({
    schedule: { kind: 'daily', days: [1, 2, 3, 4, 5] },
    reps: 1,
    difficulty: 'sprout',
    startDate: todayStr(),
    endDate: null,
    timeWindow: null,
    state: { streak: 0, best: 0, lastRolled: null }
  }),

  outputs: (widget) => [
    { key: 'completionsToday', name: 'Completions', dayKeyed: true, get: (d) => q.repsDone(widget, d || todayStr()) },
    { key: 'completionPct', name: 'Completion %', dayKeyed: true, get: (d) => q.completionPct(widget, d || todayStr()) },
    { key: 'streak', name: 'Streak', dayKeyed: false, get: () => q.streakState(widget).streak }
  ],

  onDayRolled(widget, ctx, info) { q.rollQuestDay(widget, info?.from); },

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const today = todayStr();
    const scheduled = q.scheduledOn(widget, today);
    const reps = widget.config.reps || 1;
    const done = q.repsDone(widget, today);
    const diff = q.DIFFICULTY[widget.config.difficulty] || q.DIFFICULTY.sprout;
    const state = q.streakState(widget);

    const card = el(`<div class="quest-widget ${done >= reps ? 'done' : ''} ${scheduled ? '' : 'resting'}">
      <div class="q-counter">
        <button class="q-step" data-d="-1" aria-label="Undo rep">−</button>
        <div class="q-progress"><span class="q-done"></span><span class="q-of">/ ${reps} today</span></div>
        <button class="q-step q-plus" data-d="1" aria-label="Complete rep">+</button>
      </div>
      <div class="row" style="justify-content:center;gap:10px;margin-top:6px">
        <span class="chip">${diff.label}</span>
        <span class="chip">${icon('leaf', 11)} <span class="q-streak"></span></span>
        ${scheduled ? '' : '<span class="chip">resting today</span>'}
      </div>
    </div>`);
    card.querySelector('.q-done').textContent = done;
    card.querySelector('.q-streak').textContent = state.streak;

    const refresh = () => {
      const n = q.repsDone(widget, today);
      card.querySelector('.q-done').textContent = n;
      card.classList.toggle('done', n >= reps);
    };
    for (const btn of card.querySelectorAll('.q-step')) {
      btn.onclick = () => {
        const res = q.addRep(widget, Number(btn.dataset.d));
        refresh();
        if (res.completedNow) {
          bloomBurst(card);
          ctx.toast(`${widget.name} complete · +${res.coins}c`, 'flag');
        }
      };
    }
    // long-press + to set the exact count (docs/05)
    let timer = null;
    card.querySelector('.q-plus').addEventListener('pointerdown', () => {
      timer = setTimeout(async () => {
        const v = await promptText({ title: 'Set completions', label: `Done today (of ${reps})`, value: String(q.repsDone(widget, today)), confirmText: 'Set' });
        if (v != null && !Number.isNaN(Number(v))) {
          q.addRep(widget, Number(v) - q.repsDone(widget, today));
          refresh();
        }
      }, 550);
    });
    for (const evt of ['pointerup', 'pointercancel', 'pointermove']) {
      card.querySelector('.q-plus').addEventListener(evt, () => clearTimeout(timer), { passive: true });
    }
    host.appendChild(card);
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    const state = q.streakState(widget);
    const rate = q.completionRate(widget, 30);
    host.appendChild(el(`<div class="row" style="gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <div class="panel stat-tile"><div class="st-num">${state.streak}</div><div class="st-label">streak</div></div>
      <div class="panel stat-tile"><div class="st-num">${state.best}</div><div class="st-label">best</div></div>
      <div class="panel stat-tile"><div class="st-num">${rate == null ? '—' : rate + '%'}</div><div class="st-label">30-day rate</div></div>
    </div>`));

    // calendar heatmap, last 10 weeks (docs/05)
    const heat = el('<div class="heatmap"></div>');
    const reps = widget.config.reps || 1;
    for (let i = 69; i >= 0; i--) {
      const ds = dateAdd(todayStr(), -i);
      const cell = el('<span class="heat-cell"></span>');
      if (q.scheduledOn(widget, ds)) {
        const pct = Math.min(1, q.repsDone(widget, ds) / reps);
        cell.style.background = pct > 0 ? `color-mix(in srgb, var(--accent) ${20 + pct * 80}%, transparent)` : 'var(--surface-alt)';
      } else cell.style.opacity = '0.25';
      cell.title = `${fmtDate(ds)} — ${q.repsDone(widget, ds)}/${reps}`;
      heat.appendChild(cell);
    }
    host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:8px">LAST 10 WEEKS</h3>'));
    host.appendChild(heat);

    // history list
    const hist = el('<div style="margin-top:18px"></div>');
    const logs = store.all('objects')
      .filter(o => o.widgetId === widget.id && o.kind === 'questLog' && o.data.done > 0)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    for (const log of logs) {
      hist.appendChild(el(`<div class="list-item" style="cursor:default">
        <span style="color:var(--accent)">${icon(log.data.done >= reps ? 'check-circle' : 'circle', 16)}</span>
        <span class="li-main"><span class="li-title">${fmtDate(log.date)}</span></span>
        <span class="soft">${log.data.done}/${reps}</span></div>`));
    }
    host.appendChild(hist);
  },

  renderSettings(host, widget, ctx) {
    const cfg = widget.config;
    const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };

    host.appendChild(field('Schedule', seg([
      { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Days' }, { value: 'once', label: 'One-off' }
    ], cfg.schedule.kind === 'custom' ? 'weekly' : cfg.schedule.kind, (v) => { cfg.schedule.kind = v; save(); dayRow.classList.toggle('hidden', v !== 'weekly'); })));

    const dayRow = el('<div class="row" style="flex-wrap:wrap;margin-bottom:14px"></div>');
    const names = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
    names.forEach((n, i) => {
      const b = el(`<button class="chip ${cfg.schedule.days?.includes(i) ? 'accent' : ''}" style="cursor:pointer">${n}</button>`);
      b.onclick = () => {
        const days = new Set(cfg.schedule.days || []);
        days.has(i) ? days.delete(i) : days.add(i);
        cfg.schedule.days = [...days].sort();
        b.classList.toggle('accent');
        save();
      };
      dayRow.appendChild(b);
    });
    dayRow.classList.toggle('hidden', cfg.schedule.kind === 'daily' || cfg.schedule.kind === 'once');
    host.appendChild(dayRow);

    const repsIn = input(String(cfg.reps), '1');
    repsIn.type = 'number';
    repsIn.min = '1';
    repsIn.addEventListener('change', () => { cfg.reps = Math.max(1, Number(repsIn.value) || 1); save(); });
    host.appendChild(field('Reps per day', repsIn));

    host.appendChild(field('Difficulty', seg(
      Object.entries(q.DIFFICULTY).map(([value, d]) => ({ value, label: d.label })),
      cfg.difficulty, (v) => { cfg.difficulty = v; save(); }
    ), 'Sprout ×1 · Bloom ×2 · Flourish ×4 · Radiant ×8 coins'));

    const endIn = input(cfg.endDate || '', 'open-ended');
    endIn.type = 'date';
    endIn.addEventListener('change', () => { cfg.endDate = endIn.value || null; save(); });
    host.appendChild(field('Ends (optional)', endIn));
  }
});
