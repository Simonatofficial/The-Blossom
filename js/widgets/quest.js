/* Quest widget (docs/05 + V2 §20). A quest is now a step-based mission: banner,
   title, description, a reorderable step checklist with a progress bar, a
   difficulty badge, optional due date, and an XP reward. Completing every step
   fires the celebration. Step completion bridges to questops (so Health, the
   Quest Board, and Skills still see the quest complete + coins still pay).
   Legacy rep-based quests (no `config.steps`) render exactly as before. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg, promptText, confirmDialog, toast } from '../ui/components.js';
import { todayStr, dateAdd, bloomBurst, fmtDate } from './base.js';
import * as q from './questops.js';

const DIFF_DISPLAY = { sprout: 'Easy', bloom: 'Medium', flourish: 'Hard', radiant: 'Legendary' };
const isMission = (w) => Array.isArray(w.config.steps);
const stepStats = (w) => { const total = w.config.steps.length; const done = w.config.steps.filter(s => s.done).length; return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }; };
const isFailed = (w) => w.config.dueDate && w.config.dueDate < todayStr() && stepStats(w).pct < 100;
const suggestedXp = (w) => w.config.xp != null ? w.config.xp : w.config.steps.length * 10;

/** Mirror "all steps done" into today's questLog so questops consumers agree. */
function bridge(widget, ctx) {
  const { total, done } = stepStats(widget);
  const complete = total > 0 && done === total;
  const reps = widget.config.reps || 1;
  const cur = q.repsDone(widget, todayStr());
  const want = complete ? reps : 0;
  if (cur !== want) { const res = q.addRep(widget, want - cur); if (res.completedNow) ctx?.toast?.(`${widget.name} complete · +${res.coins}c`, 'flag'); return res; }
  return null;
}

/* ---------- step-mission rendering ---------- */
function missionCard(host, widget, ctx) {
  host.innerHTML = '';
  const { total, done, pct } = stepStats(widget);
  const failed = isFailed(widget);
  const card = el(`<div class="quest-mission ${pct === 100 ? 'done' : ''} ${failed ? 'failed' : ''}">
    ${widget.config.banner ? `<div class="qm-banner">${widget.config.banner}</div>` : ''}
    <div class="qm-meta row" style="gap:6px;flex-wrap:wrap">
      <span class="chip qm-diff">${DIFF_DISPLAY[widget.config.difficulty] || 'Easy'}</span>
      <span class="chip">${icon('sparkles', 11)} ${suggestedXp(widget)} XP</span>
      ${widget.config.dueDate ? `<span class="chip ${failed ? 'qm-overdue' : ''}">${icon('calendar', 11)} ${fmtDate(widget.config.dueDate)}</span>` : ''}
    </div>
    ${widget.config.description ? `<p class="qm-desc soft"></p>` : ''}
    <div class="qm-prog"><div class="qm-bar"><span style="width:${pct}%"></span></div><span class="qm-prog-n">${done} of ${total || 0}</span></div>
    <div class="qm-steps"></div>
    ${failed ? `<button class="btn qm-react" style="margin-top:8px">${icon('rotate-ccw', 13)} Reactivate</button>` : ''}
  </div>`);
  if (widget.config.description) card.querySelector('.qm-desc').textContent = widget.config.description;
  const stepsEl = card.querySelector('.qm-steps');
  if (!total) stepsEl.appendChild(el('<p class="soft" style="font-size:0.82rem">No steps yet — tap to add some.</p>'));
  for (const s of widget.config.steps) {
    const row = el(`<button class="qm-step ${s.done ? 'on' : ''}"><span class="qm-check">${icon(s.done ? 'check-circle' : 'circle', 18)}</span><span class="qm-step-text"></span></button>`);
    row.querySelector('.qm-step-text').textContent = s.text;
    row.onclick = (e) => {
      e.stopPropagation();
      s.done = !s.done; store.put('widgets', widget);
      const res = bridge(widget, ctx);
      const after = stepStats(widget);
      if (after.pct === 100) bloomBurst(card);
      ctx.refreshCard(widget);
    };
    stepsEl.appendChild(row);
  }
  card.querySelector('.qm-react')?.addEventListener('click', (e) => { e.stopPropagation(); widget.config.dueDate = dateAdd(todayStr(), 7); store.put('widgets', widget); ctx.refreshCard(widget); toast('Reactivated — due in a week.', 'leaf'); });
  host.appendChild(card);
}

function missionFull(host, widget, ctx) {
  const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
  const render = () => {
    host.innerHTML = '';
    const { total, done, pct } = stepStats(widget);
    host.appendChild(el(`<div class="panel" style="padding:14px;margin-bottom:14px">
      <div class="qm-prog"><div class="qm-bar"><span style="width:${pct}%"></span></div><span class="qm-prog-n">${done} of ${total} · ${pct}%</span></div></div>`));

    // steps manager
    const sec = el('<div class="panel" style="padding:12px;margin-bottom:14px"><h3 class="soft" style="font-size:0.78rem;margin-bottom:8px">STEPS</h3></div>');
    widget.config.steps.forEach((s, i) => {
      const row = el(`<div class="row" style="gap:6px;margin-bottom:6px"><button class="btn-icon qm-c">${icon(s.done ? 'check-circle' : 'circle', 18)}</button><input class="input" style="flex:1"><button class="btn-icon qm-up">${icon('chevron-up', 14)}</button><button class="btn-icon qm-dn">${icon('chevron-down', 14)}</button><button class="btn-icon qm-x">${icon('trash', 13)}</button></div>`);
      const inp = row.querySelector('input'); inp.value = s.text;
      inp.addEventListener('change', () => { s.text = inp.value; save(); });
      row.querySelector('.qm-c').onclick = () => { s.done = !s.done; save(); bridge(widget, ctx); render(); };
      row.querySelector('.qm-up').onclick = () => { if (i > 0) { [widget.config.steps[i - 1], widget.config.steps[i]] = [widget.config.steps[i], widget.config.steps[i - 1]]; save(); render(); } };
      row.querySelector('.qm-dn').onclick = () => { if (i < widget.config.steps.length - 1) { [widget.config.steps[i + 1], widget.config.steps[i]] = [widget.config.steps[i], widget.config.steps[i + 1]]; save(); render(); } };
      row.querySelector('.qm-x').onclick = () => { widget.config.steps.splice(i, 1); save(); bridge(widget, ctx); render(); };
      sec.appendChild(row);
    });
    const add = el(`<button class="btn-soft-wide">${icon('plus', 14)} Add step</button>`);
    add.onclick = async () => { const t = await promptText({ title: 'New step', label: 'Step', placeholder: 'Draft the outline' }); if (t) { widget.config.steps.push({ id: ulid(), text: t, done: false }); save(); render(); } };
    sec.appendChild(add);
    host.appendChild(sec);

    // details
    const det = el('<div class="panel" style="padding:12px"><h3 class="soft" style="font-size:0.78rem;margin-bottom:8px">DETAILS</h3></div>');
    const descIn = el('<textarea class="textarea" rows="2" placeholder="What is this quest about?"></textarea>'); descIn.value = widget.config.description || '';
    descIn.addEventListener('change', () => { widget.config.description = descIn.value; save(); });
    det.appendChild(field('Description', descIn));
    det.appendChild(field('Difficulty', seg(Object.entries(DIFF_DISPLAY).map(([v, l]) => ({ value: v, label: l })), widget.config.difficulty, (v) => { widget.config.difficulty = v; save(); })));
    const dueIn = input(widget.config.dueDate || ''); dueIn.type = 'date';
    dueIn.addEventListener('change', () => { widget.config.dueDate = dueIn.value || null; save(); });
    det.appendChild(field('Due date (optional)', dueIn));
    const xpIn = input(widget.config.xp ?? '', `auto: ${widget.config.steps.length * 10}`); xpIn.type = 'number';
    xpIn.addEventListener('change', () => { widget.config.xp = xpIn.value === '' ? null : Number(xpIn.value); save(); });
    det.appendChild(field('XP reward', xpIn));
    const banIn = input(widget.config.banner || '', 'an emoji, e.g. 🏔️');
    banIn.addEventListener('change', () => { widget.config.banner = banIn.value.trim() || null; save(); });
    det.appendChild(field('Banner emoji (optional)', banIn));
    host.appendChild(det);
  };
  render();
}

registry.register({
  type: 'quest',
  name: 'Quest',
  icon: 'flag',
  description: 'A step-by-step mission with XP and a progress bar',
  external: true, internal: true,
  defaultConfig: () => ({
    steps: [], description: '', banner: null, difficulty: 'sprout', dueDate: null, xp: null,
    reps: 1, schedule: { kind: 'daily', days: [0, 1, 2, 3, 4, 5, 6] }, startDate: todayStr(), endDate: null,
    state: { streak: 0, best: 0, lastRolled: null }
  }),

  outputs: (widget) => isMission(widget) ? [
    { key: 'completionPct', name: 'Completion %', dayKeyed: true, get: () => stepStats(widget).pct },
    { key: 'stepsDone', name: 'Steps done', dayKeyed: false, get: () => stepStats(widget).done }
  ] : [
    { key: 'completionsToday', name: 'Completions', dayKeyed: true, get: (d) => q.repsDone(widget, d || todayStr()) },
    { key: 'completionPct', name: 'Completion %', dayKeyed: true, get: (d) => q.completionPct(widget, d || todayStr()) },
    { key: 'streak', name: 'Streak', dayKeyed: false, get: () => q.streakState(widget).streak }
  ],

  onDayRolled(widget, ctx, info) { if (!isMission(widget)) q.rollQuestDay(widget, info?.from); },

  // V3 growth (docs/17 §3): completing the quest feeds the module's aspect (+10).
  grows: (before, after, action) => (action?.kind === 'complete' ? [{ amount: 10 }] : []),

  renderCard(host, widget, ctx) {
    if (isMission(widget)) return missionCard(host, widget, ctx);
    legacyCard(host, widget, ctx);
  },

  renderFull(host, widget, ctx) {
    if (isMission(widget)) return missionFull(host, widget, ctx);
    legacyFull(host, widget);
  },

  renderSettings(host, widget, ctx) {
    if (isMission(widget)) { host.appendChild(el('<p class="soft" style="font-size:0.84rem">Edit steps, difficulty, due date and XP inside the quest (tap the card).</p>')); return; }
    legacySettings(host, widget, ctx);
  }
});

/* ---------- legacy rep-based quest (unchanged behaviour) ---------- */
function legacyCard(host, widget, ctx) {
  host.innerHTML = '';
  const today = todayStr();
  const scheduled = q.scheduledOn(widget, today);
  const reps = widget.config.reps || 1;
  const done = q.repsDone(widget, today);
  const diff = q.DIFFICULTY[widget.config.difficulty] || q.DIFFICULTY.sprout;
  const state = q.streakState(widget);
  const card = el(`<div class="quest-widget ${done >= reps ? 'done' : ''} ${scheduled ? '' : 'resting'}">
    <div class="q-counter"><button class="q-step" data-d="-1">−</button>
      <div class="q-progress"><span class="q-done"></span><span class="q-of">/ ${reps} today</span></div>
      <button class="q-step q-plus" data-d="1">+</button></div>
    <div class="row" style="justify-content:center;gap:10px;margin-top:6px">
      <span class="chip">${diff.label}</span><span class="chip">${icon('leaf', 11)} <span class="q-streak"></span></span>
      ${scheduled ? '' : '<span class="chip">resting today</span>'}</div></div>`);
  card.querySelector('.q-done').textContent = done;
  card.querySelector('.q-streak').textContent = state.streak;
  const refresh = () => { const n = q.repsDone(widget, today); card.querySelector('.q-done').textContent = n; card.classList.toggle('done', n >= reps); };
  for (const btn of card.querySelectorAll('.q-step')) btn.onclick = () => { const res = q.addRep(widget, Number(btn.dataset.d)); refresh(); if (res.completedNow) { bloomBurst(card); ctx.toast(`${widget.name} complete · +${res.coins}c`, 'flag'); } };
  host.appendChild(card);
}
function legacyFull(host, widget) {
  host.innerHTML = '';
  const state = q.streakState(widget); const rate = q.completionRate(widget, 30);
  host.appendChild(el(`<div class="row" style="gap:10px;margin-bottom:16px;flex-wrap:wrap">
    <div class="panel stat-tile"><div class="st-num">${state.streak}</div><div class="st-label">streak</div></div>
    <div class="panel stat-tile"><div class="st-num">${state.best}</div><div class="st-label">best</div></div>
    <div class="panel stat-tile"><div class="st-num">${rate == null ? '—' : rate + '%'}</div><div class="st-label">30-day rate</div></div></div>`));
  const heat = el('<div class="heatmap"></div>'); const reps = widget.config.reps || 1;
  for (let i = 69; i >= 0; i--) { const ds = dateAdd(todayStr(), -i); const cell = el('<span class="heat-cell"></span>'); if (q.scheduledOn(widget, ds)) { const pct = Math.min(1, q.repsDone(widget, ds) / reps); cell.style.background = pct > 0 ? `color-mix(in srgb, var(--accent) ${20 + pct * 80}%, transparent)` : 'var(--surface-alt)'; } else cell.style.opacity = '0.25'; heat.appendChild(cell); }
  host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:8px">LAST 10 WEEKS</h3>')); host.appendChild(heat);
}
function legacySettings(host, widget, ctx) {
  const cfg = widget.config; const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
  const repsIn = input(String(cfg.reps), '1'); repsIn.type = 'number'; repsIn.min = '1';
  repsIn.addEventListener('change', () => { cfg.reps = Math.max(1, Number(repsIn.value) || 1); save(); });
  host.appendChild(field('Reps per day', repsIn));
  host.appendChild(field('Difficulty', seg(Object.entries(q.DIFFICULTY).map(([value, d]) => ({ value, label: d.label })), cfg.difficulty, (v) => { cfg.difficulty = v; save(); })));
}
