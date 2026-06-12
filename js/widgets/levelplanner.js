/* LevelPlanner widget (docs/08 §4): planned choices for future levels
   (subclass at 3, feat or ASI at 4…) and the level-up button itself —
   leveling records a log entry (visible on the Story face) and checks the
   plan off. Plans live in the character object on the anchor sheet. */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el, toast, promptText, openPanel, input } from '../ui/components.js';
import { getCharacter, saveCharacter } from './dnd-shared.js';
import { todayStr } from './base.js';

registry.register({
  type: 'levelplanner',
  name: 'Level Planner',
  icon: 'target',
  description: 'Where this character is headed, level by level',
  keywords: ['dnd', 'd&d', 'level', 'plan', 'milestone', 'rpg'],
  external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget) {
    host.innerHTML = '';
    const { c } = getCharacter(widget);
    const next = c.plans.filter(p => !p.done && p.level > c.level).sort((a, b) => a.level - b.level)[0];
    host.appendChild(el(`<div><div style="font-size:1.4rem;font-weight:650">Level ${c.level}</div>
      <div class="soft" style="font-size:0.8rem"></div></div>`));
    host.querySelector('.soft').textContent = next ? `Next: Lv ${next.level} — ${next.text}` : 'No plans yet — the road is open.';
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const { obj, c } = getCharacter(widget);
    const save = () => saveCharacter(obj);
    const rerender = () => this.renderFull(host, widget, ctx);

    const head = el(`<div class="row" style="gap:8px;align-items:center;margin-bottom:12px">
      <div class="grow"><div style="font-weight:650;font-size:1.05rem">Level ${c.level}</div><div class="soft" style="font-size:0.8rem"></div></div>
      <button class="btn btn-primary">${icon('sparkles', 14)} Level up</button></div>`);
    head.querySelector('.soft').textContent = c.cls || 'Set a class on the Sheet';
    head.querySelector('button').onclick = async () => {
      if (c.level >= 20) return toast('Level 20 — the summit. Epic boons are house rules.', 'star');
      const newLevel = c.level + 1;
      const plan = c.plans.find(p => p.level === newLevel && !p.done);
      const note = await promptText({
        title: `Welcome to level ${newLevel}!`,
        label: 'What did you take?',
        value: plan?.text || '',
        confirmText: 'Record'
      });
      if (note === null) return;
      c.level = newLevel;
      if (plan) plan.done = true;
      c.levelLog.push({ level: newLevel, note: note || plan?.text || '', date: todayStr() });
      save();
      toast(`Level ${newLevel} — onward.`, 'sparkles');
      rerender();
    };
    host.appendChild(head);

    const list = el('<div></div>');
    host.appendChild(list);
    const drawPlans = () => {
      list.innerHTML = '';
      const plans = [...c.plans].sort((a, b) => a.level - b.level);
      if (!plans.length) list.appendChild(el('<div class="empty-state">' + icon('target', 26) + '<p>Plan the build: subclass at 3, feat or ASI at 4…</p></div>'));
      for (const p of plans) {
        const past = p.done || p.level <= c.level;
        const row = el(`<div class="list-item" style="cursor:default${past ? ';opacity:0.55' : ''}">
          <span class="chip${p.level === c.level + 1 ? ' accent' : ''}">Lv ${p.level}</span>
          <span class="li-main"><span class="li-title"${p.done ? ' style="text-decoration:line-through"' : ''}></span></span>
          <button class="btn-icon" title="Edit">${icon('edit', 13)}</button>
          <button class="btn-icon" title="Remove">${icon('x', 13)}</button></div>`);
        row.querySelector('.li-title').textContent = p.text;
        row.querySelector('[title="Edit"]').onclick = () => editPlan(p);
        row.querySelector('[title="Remove"]').onclick = () => { c.plans.splice(c.plans.indexOf(p), 1); save(); drawPlans(); };
        list.appendChild(row);
      }
      const add = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('plus', 15)} Plan a level</button>`);
      add.onclick = () => editPlan();
      list.appendChild(add);
    };

    const editPlan = (p = null) => {
      const d = openPanel({ title: p ? 'Edit plan' : 'Plan a level', iconName: 'target' });
      const lvl = el('<input class="input" type="number" min="2" max="20" placeholder="Level">');
      lvl.value = p ? p.level : Math.max(c.level + 1, (Math.max(c.level, ...c.plans.map(x => x.level)) + 1));
      const text = input(p?.text || '', 'Take War Caster · multiclass into…');
      text.style.marginTop = '8px';
      const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Save</button>');
      ok.onclick = () => {
        if (!text.value.trim()) return;
        const level = Math.max(2, Math.min(20, Number(lvl.value) || c.level + 1));
        if (p) Object.assign(p, { level, text: text.value.trim() });
        else c.plans.push({ level, text: text.value.trim(), done: false });
        save();
        d.close();
        drawPlans();
      };
      d.body.append(lvl, text, ok);
      setTimeout(() => text.focus(), 150);
    };
    drawPlans();
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Leveling up records the choice in the Story face’s level-up log and checks the matching plan off.</p>'));
  }
});
