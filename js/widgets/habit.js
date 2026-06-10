/* Habit widget (docs/05 + docs/06): a Quest with the COSMOS method built in.
   Creation runs the six-step COSMOS wizard. Card = trigger sentence + one-tap
   tier buttons (MVV always counts). Weekly review with A/B/C/R grading. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { el, field, input, seg, openDrawer, toast } from '../ui/components.js';
import { todayStr, dateAdd, bloomBurst, createWidget, fmtDate, createObject } from './base.js';
import * as q from './questops.js';

const TIERS = [
  { key: 'mvv', label: 'MVV', hint: 'tiny — saves the streak' },
  { key: 'standard', label: 'Standard', hint: 'a normal day' },
  { key: 'stretch', label: 'Stretch', hint: 'when inspired (+25% coins)' }
];

function triggerSentence(c) {
  if (!c.anchor) return '';
  const bits = [`After ${c.anchor}`];
  if (c.place) bits.push(`at ${c.place}`);
  if (c.time) bits.push(`around ${c.time}`);
  return `${bits.join(', ')} — ${c.tiers?.mvv || c.tiers?.standard || 'begin'}`;
}

function adherence(widget) {
  const target = widget.config.weeklyTarget || 7;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    if (q.repsDone(widget, dateAdd(todayStr(), -i)) >= 1) done++;
  }
  return Math.min(100, Math.round((done / target) * 100));
}

registry.register({
  type: 'habit',
  name: 'Habit',
  icon: 'cosmos',
  description: 'A habit planted with the COSMOS method',
  external: true, internal: true,
  wizard: (opts) => openCosmosWizard(opts),
  defaultConfig: () => ({
    schedule: { kind: 'daily', days: [0, 1, 2, 3, 4, 5, 6] },
    reps: 1,
    difficulty: 'bloom',
    startDate: todayStr(),
    state: { streak: 0, best: 0, lastRolled: null },
    purpose: '', goal: '', metric: '',
    time: '', place: '', feeling: '', anchor: '',
    frictions: ['', ''], rewards: ['', ''], backup: '',
    tiers: { mvv: '', standard: '', stretch: '' },
    milestones: [], weeklyTarget: 5, reviewDay: 0, reviews: []
  }),

  outputs: (widget) => [
    { key: 'completionsToday', name: 'Done today', dayKeyed: true, get: (d) => q.repsDone(widget, d || todayStr()) },
    { key: 'completionPct', name: 'Completion %', dayKeyed: true, get: (d) => q.completionPct(widget, d || todayStr()) },
    { key: 'streak', name: 'Streak', dayKeyed: false, get: () => q.streakState(widget).streak },
    { key: 'adherence', name: 'COSMOS adherence', dayKeyed: false, get: () => adherence(widget) }
  ],

  onDayRolled(widget, ctx, info) { q.rollQuestDay(widget, info?.from); },

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const c = widget.config;
    const today = todayStr();
    const log = q.readLog(widget, today);
    const doneTier = log?.data.tier;
    const sentence = triggerSentence(c);

    const card = el(`<div class="habit-widget">
      ${sentence ? `<p class="h-trigger"></p>` : ''}
      <div class="h-tiers"></div>
      <div class="row" style="justify-content:center;gap:10px;margin-top:8px">
        <span class="chip">${icon('leaf', 11)} ${q.streakState(widget).streak}</span>
        <span class="chip">${adherence(widget)}% this week</span>
      </div>
      <p class="h-backup soft hidden" style="font-size:0.8rem;margin-top:8px"></p>
    </div>`);
    if (sentence) card.querySelector('.h-trigger').textContent = sentence;

    const tierHost = card.querySelector('.h-tiers');
    const renderTiers = () => {
      tierHost.innerHTML = '';
      const tier = q.readLog(widget, today)?.data.tier;
      for (const t of TIERS) {
        const b = el(`<button class="h-tier ${tier === t.key ? 'on' : ''}"><span class="ht-label">${t.label}</span><span class="ht-text"></span></button>`);
        b.querySelector('.ht-text').textContent = widget.config.tiers?.[t.key] || t.hint;
        b.onclick = () => {
          const current = q.readLog(widget, today)?.data.tier;
          if (current === t.key) return;
          const res = q.addRep(widget, 1 - q.repsDone(widget, today), today, {
            tier: t.key, bonusMult: t.key === 'stretch' ? 1.25 : 1
          });
          renderTiers();
          if (res.completedNow) {
            bloomBurst(b);
            ctx.toast(`${widget.name} — ${t.label} · +${res.coins}c`, 'cosmos');
          }
        };
        tierHost.appendChild(b);
      }
    };
    renderTiers();

    // never-miss-twice: surface the backup plan gently after a missed day (docs/06)
    const yesterday = dateAdd(today, -1);
    if (c.backup && q.scheduledOn(widget, yesterday) && q.repsDone(widget, yesterday) === 0 && !doneTier) {
      const p = card.querySelector('.h-backup');
      p.textContent = `Yesterday slipped. Your backup: ${c.backup} — still within reach?`;
      p.classList.remove('hidden');
    }
    host.appendChild(card);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const c = widget.config;

    // week at a glance (7 dots, tier-colored, wilted for misses)
    const dots = el('<div class="row" style="justify-content:center;gap:8px;margin-bottom:14px"></div>');
    for (let i = 6; i >= 0; i--) {
      const ds = dateAdd(todayStr(), -i);
      const tier = q.readLog(widget, ds)?.data.tier;
      const colors = { mvv: 'var(--success)', standard: 'var(--accent)', stretch: 'var(--highlight)' };
      dots.appendChild(el(`<span class="h-dot" title="${fmtDate(ds)}" style="background:${tier ? colors[tier] : 'var(--surface-alt)'};${!tier && q.scheduledOn(widget, ds) && ds !== todayStr() ? 'filter:saturate(0.3);opacity:0.5' : ''}"></span>`));
    }
    host.appendChild(dots);

    // grade & adapt (docs/06 rubric)
    const rate = q.completionRate(widget, 28);
    let grade = null, advice = '';
    if (rate != null) {
      if (rate >= 90) { grade = 'A'; advice = 'Thriving — consider raising your Standard.'; }
      else if (rate >= 75) { grade = 'B'; advice = 'Steady; carry on.'; }
      else if (rate >= 60) { grade = 'C'; advice = 'Try shrinking the MVV and removing one more friction.'; }
      else { grade = 'R'; advice = 'Time to re-root: a new anchor, time, or place might suit this better.'; }
    }
    if (grade) {
      host.appendChild(el(`<div class="panel" style="padding:14px;margin-bottom:14px">
        <div class="row"><span class="sk-badge">${grade}</span><p class="soft" style="font-size:0.86rem;flex:1">${advice}</p></div></div>`));
    }

    // weekly review prompts (saved as a dated reflection — journalable)
    const review = el(`<div class="panel" style="padding:14px;margin-bottom:14px">
      <h3 class="soft" style="font-size:0.78rem;margin-bottom:8px">WEEKLY REVIEW</h3>
      <textarea class="textarea" rows="2" placeholder="What grew strongest this week?"></textarea>
      <textarea class="textarea" rows="2" placeholder="What wilted or needs pruning?" style="margin-top:6px"></textarea>
      <textarea class="textarea" rows="2" placeholder="What will I carry forward?" style="margin-top:6px"></textarea>
      <button class="btn" style="margin-top:8px">${icon('save', 14)} Save review</button></div>`);
    review.querySelector('.btn').onclick = () => {
      const [a, b, cEl] = review.querySelectorAll('textarea');
      createObject(widget.id, 'reflection', { grew: a.value, wilted: b.value, forward: cEl.value, grade }, todayStr());
      toast('Review saved — well tended.', 'leaf');
      a.value = b.value = cEl.value = '';
    };
    host.appendChild(review);

    // the COSMOS sheet (editable)
    const sheet = el('<div class="panel" style="padding:14px"><h3 class="soft" style="font-size:0.78rem;margin-bottom:10px">THE COSMOS SHEET</h3></div>');
    const fields = [
      ['purpose', 'Clarify — why it matters'], ['goal', 'Clarify — what you want'], ['metric', 'Clarify — how you’ll know'],
      ['anchor', 'Stack — after I…'], ['place', 'Orient — where'], ['time', 'Orient — when'], ['feeling', 'Orient — desired feeling'],
      ['backup', 'If I miss my window, I will…']
    ];
    for (const [key, label] of fields) {
      const i = input(c[key] || '', '');
      i.addEventListener('change', () => { c[key] = i.value; store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); });
      sheet.appendChild(field(label, i));
    }
    for (const t of TIERS) {
      const i = input(c.tiers?.[t.key] || '', t.hint);
      i.addEventListener('change', () => { c.tiers[t.key] = i.value; store.put('widgets', widget); });
      sheet.appendChild(field(`Observe — ${t.label}`, i));
    }
    host.appendChild(sheet);

    // quick-start card (copyable one-line summary, docs/06)
    const quick = el(`<div class="panel" style="padding:12px;margin-top:14px"><p class="soft" style="font-size:0.84rem;font-style:italic"></p>
      <button class="btn-ghost btn" style="margin-top:6px">${icon('copy', 13)} Copy</button></div>`);
    const line = `After I ${c.anchor || '…'}${c.time ? ` at ${c.time}` : ''}${c.place ? ` (${c.place})` : ''}, I'll ${c.tiers?.mvv || '…'} → ${c.tiers?.standard || '…'}. If I miss: ${c.backup || '…'}.`;
    quick.querySelector('p').textContent = line;
    quick.querySelector('button').onclick = async () => { await navigator.clipboard.writeText(line); toast('Copied', 'copy'); };
    host.appendChild(quick);
  },

  renderSettings(host, widget, ctx) {
    const c = widget.config;
    const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
    host.appendChild(field('Weekly target', seg(
      [3, 4, 5, 6, 7].map(n => ({ value: n, label: `${n}/7` })),
      c.weeklyTarget, (v) => { c.weeklyTarget = v; save(); })));
    host.appendChild(field('Difficulty', seg(
      Object.entries(q.DIFFICULTY).map(([value, d]) => ({ value, label: d.label })),
      c.difficulty, (v) => { c.difficulty = v; save(); })));
  }
});

/* ---------- the COSMOS wizard (docs/06): one step per screen ---------- */

export function openCosmosWizard(opts = {}) {
  const d = openDrawer({ title: 'Plant a habit', iconName: 'cosmos' });
  const data = registry.get('habit').defaultConfig();
  let name = '';
  let step = 0;

  const steps = [
    { // 1 Clarify
      title: 'Clarify', sub: 'What exactly am I growing, and why does it matter?',
      fields: [
        { key: '_name', label: 'Habit name', ph: 'Morning pushups', example: 'Required — everything else is optional.' },
        { key: 'purpose', label: 'Why it matters', ph: 'one sentence', example: 'e.g. strength for the climbing trip' },
        { key: 'goal', label: 'What you want', ph: '', example: 'e.g. 20 clean pushups by autumn' },
        { key: 'metric', label: 'How you’ll know', ph: '', example: 'links naturally to a Tracker later' }
      ]
    },
    { // 2 Orient
      title: 'Orient', sub: 'When, where, and in what state will I do it?',
      fields: [
        { key: 'time', label: 'Time window', ph: '7:00–7:20 AM', example: '' },
        { key: 'place', label: 'Place', ph: 'kitchen doorway', example: '' },
        { key: 'feeling', label: 'Desired feeling', ph: 'steady · grounded · luminous · playful', example: 'pick a word or write your own' }
      ],
      days: true
    },
    { // 3 Stack
      title: 'Stack', sub: 'What existing moment will it attach to?',
      fields: [
        { key: 'anchor', label: 'After I…', ph: 'put the breakfast mug in the sink', example: 'Required. Recipes: after watering plants → 1 MVV; after first phone unlock → 1 breath; after keys hit the bowl → 2-min prep.' }
      ],
      preview: true
    },
    { // 4 Motivate
      title: 'Motivate', sub: 'Remove friction, add reward.',
      fields: [
        { key: 'frictions.0', label: 'Friction to remove #1', ph: 'lay out chalk & timer the night before', example: '' },
        { key: 'frictions.1', label: 'Friction to remove #2', ph: 'phone on Do Not Disturb', example: '' },
        { key: 'rewards.0', label: 'Instant reward', ph: '5 min of favorite music', example: '' },
        { key: 'rewards.1', label: 'Meaningful reward', ph: 'can reference a Market custom reward', example: '' },
        { key: 'backup', label: 'If I miss my window, I’ll…', ph: '2 tiny sets at 5:30 PM', example: '…within 24h. The never-miss-twice net.' }
      ]
    },
    { // 5 Observe
      title: 'Observe', sub: 'What does tiny / normal / inspired look like?',
      fields: [
        { key: 'tiers.mvv', label: 'MVV — minimum viable version', ph: '2–5 minutes, saves the streak', example: '' },
        { key: 'tiers.standard', label: 'Standard — a normal day', ph: '', example: '' },
        { key: 'tiers.stretch', label: 'Stretch — when inspired', ph: '', example: '' }
      ]
    },
    { // 6 Study
      title: 'Study', sub: 'When will I reflect and adjust?',
      fields: [],
      study: true
    }
  ];

  const setPath = (key, value) => {
    if (key === '_name') { name = value; return; }
    const path = key.split('.');
    let o = data;
    while (path.length > 1) o = o[path.shift()];
    o[path[0]] = value;
  };
  const getPath = (key) => {
    if (key === '_name') return name;
    return key.split('.').reduce((o, k) => o?.[k], data) || '';
  };

  const render = () => {
    const s = steps[step];
    d.setTitle(`${s.title} — ${step + 1} of 6`);
    d.body.innerHTML = '';
    d.body.appendChild(el(`<p class="soft" style="margin-bottom:14px">${s.sub}</p>`));

    for (const f of s.fields) {
      const i = input(getPath(f.key), f.ph);
      i.addEventListener('input', () => { setPath(f.key, i.value); if (s.preview) updatePreview(); });
      d.body.appendChild(field(f.label, i, f.example));
    }

    if (s.days) {
      const row = el('<div class="row" style="flex-wrap:wrap;margin-bottom:14px"></div>');
      ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'].forEach((n, i) => {
        const on = data.schedule.days.includes(i);
        const b = el(`<button class="chip ${on ? 'accent' : ''}" style="cursor:pointer">${n}</button>`);
        b.onclick = () => {
          const set = new Set(data.schedule.days);
          set.has(i) ? set.delete(i) : set.add(i);
          data.schedule.days = [...set].sort();
          data.schedule.kind = data.schedule.days.length === 7 ? 'daily' : 'weekly';
          b.classList.toggle('accent');
        };
        row.appendChild(b);
      });
      d.body.insertBefore(field('Days', row), d.body.children[1]);
    }

    if (s.preview) {
      d.body.appendChild(el('<div class="panel h-preview" style="padding:12px;margin-bottom:14px"><p class="soft" style="font-style:italic;font-size:0.88rem"></p></div>'));
      updatePreview();
    }

    if (s.study) {
      d.body.appendChild(field('Weekly target', seg(
        [3, 4, 5, 6, 7].map(n => ({ value: n, label: `${n}/7` })),
        data.weeklyTarget, (v) => { data.weeklyTarget = v; })));
      const daySel = el('<select class="select"></select>');
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach((n, i) => daySel.appendChild(new Option(n, i)));
      daySel.value = data.reviewDay;
      daySel.onchange = () => { data.reviewDay = Number(daySel.value); };
      d.body.appendChild(field('Review day', daySel));
      d.body.appendChild(el(`<div class="panel" style="padding:12px;margin-bottom:14px"><p class="soft" style="font-size:0.85rem"><strong>3-2-1 Bloom Start:</strong> 3 minutes — do the MVV right now · 2 frictions — clear them before you begin · 1 reward — take it when done. Starting today, however small, beats starting perfectly.</p></div>`));
    }

    const nav = el('<div class="row" style="margin-top:6px"></div>');
    if (step > 0) {
      const back = el(`<button class="btn">${icon('arrow-left', 14)} Back</button>`);
      back.onclick = () => { step--; render(); };
      nav.appendChild(back);
    }
    const next = el(`<button class="btn btn-primary grow">${step === 5 ? 'Plant it' : 'Next'}</button>`);
    next.onclick = () => {
      if (step === 0 && !name.trim()) { toast('Give your habit a name first.', 'info'); return; }
      if (step === 2 && !data.anchor.trim()) { toast('Pick an anchor — the trigger is the root.', 'info'); return; }
      if (step === 5) return finish();
      step++;
      render();
    };
    nav.appendChild(next);
    d.body.appendChild(nav);

    const dotsRow = el(`<div class="tour-dots" style="justify-content:center;display:flex;margin-top:14px">${steps.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>`);
    d.body.appendChild(dotsRow);
  };

  const updatePreview = () => {
    const p = d.body.querySelector('.h-preview p');
    if (p) p.textContent = triggerSentence(data) || 'After I [anchor], at [place] around [time], I will [tiny action]. Then I’ll [reward].';
  };

  const finish = () => {
    const pageId = opts.pageId || router.current().pageId;
    const w = createWidget('habit', { ...opts, pageId: opts.parentWidgetId ? null : pageId, name: name.trim(), config: data });
    d.close();
    toast(`${w.name} planted — help your future blossom.`, 'cosmos');
    opts.onCreated?.(w);
  };

  render();
}
