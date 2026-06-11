/* Market widget (docs/05 + docs/07): the reward shop. Wallet is one raw
   copper integer; denominations are display-only (so no exchange row is
   needed — conversion is automatic; noted in docs/07). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { wallet } from '../core/wallet.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, field, input, toast, openDrawer, confirmDialog } from '../ui/components.js';
import { todayStr, dateAdd, createObject, objectsOf, fmtDate } from './base.js';
import * as q from './questops.js';

const CATALOG = [
  { key: 'smallSkip', name: 'Small Quest Skip', tier: 'Copper', price: 25, icon: 'skip-forward', effect: 'Marks 1 rep of one quest complete today. No coin payout.' },
  { key: 'bigSkip', name: 'Big Quest Skip', tier: 'Silver', price: 80, icon: 'zap', effect: 'Marks one quest fully complete today. No coin payout.' },
  { key: 'streakRestore', name: 'Streak Restore', tier: 'Gold', price: 500, icon: 'rotate-ccw', effect: 'Repair a streak broken within the last 7 days.' },
  { key: 'streakFreeze', name: 'Streak Freeze', tier: 'Platinum', price: 3000, icon: 'snowflake', effect: 'Shields one quest’s streak for up to 7 missed days.' }
];

const COIN_TINTS = { c: '#b87333', s: '#9fa8b3', g: '#d4a942', p: '#9adbe8' };

function coinRow(copper) {
  const split = wallet.split(copper);
  return ['p', 'g', 's', 'c'].map(k =>
    `<span class="m-coin" style="color:${COIN_TINTS[k]}">${icon('coins', 14)}<b>${split[k]}</b></span>`).join('');
}

function owned(widget) { return widget.config.owned || (widget.config.owned = []); }

function questPicker(title, filter, onPick) {
  const d = openDrawer({ title, iconName: 'flag' });
  const quests = store.all('widgets').filter(w => (w.type === 'quest' || w.type === 'habit') && filter(w));
  if (!quests.length) d.body.appendChild(el('<p class="soft">No matching quests right now.</p>'));
  for (const w of quests) {
    const li = el(`<button class="list-item">${icon(w.type === 'habit' ? 'cosmos' : 'flag', 16)}<span class="li-main"><span class="li-title"></span></span></button>`);
    li.querySelector('.li-title').textContent = w.name;
    li.onclick = () => { d.close(); onPick(w); };
    d.body.appendChild(li);
  }
}

function useItem(widget, item, ctx, rerender) {
  const today = todayStr();
  const spend = () => {
    owned(widget).splice(owned(widget).indexOf(item), 1);
    createObject(widget.id, 'rewardLog', { item: item.name, used: true }, today);
    store.put('widgets', widget);
    rerender();
  };
  if (item.key === 'smallSkip') {
    questPicker('Skip one rep of…', w => q.scheduledOn(w, today) && q.repsDone(w, today) < (w.config.reps || 1), (w) => {
      q.addRep(w, 1, today, { noPayout: true });
      toast(`${w.name}: 1 rep covered.`, 'skip-forward');
      spend();
    });
  } else if (item.key === 'bigSkip') {
    questPicker('Complete a quest…', w => q.scheduledOn(w, today) && q.repsDone(w, today) < (w.config.reps || 1), (w) => {
      q.addRep(w, (w.config.reps || 1) - q.repsDone(w, today), today, { noPayout: true });
      toast(`${w.name}: covered for today.`, 'zap');
      spend();
    });
  } else if (item.key === 'streakRestore') {
    questPicker('Restore whose streak?', w => {
      const s = q.streakState(w);
      return s.brokenOn && s.brokenOn >= dateAdd(today, -7);
    }, (w) => {
      const s = q.streakState(w);
      s.streak = (s.prevStreak || 0) + s.streak;
      s.brokenOn = null;
      s.prevStreak = 0;
      store.put('widgets', w);
      ctx.events.emit('widget:changed', { widgetId: w.id });
      toast(`${w.name}: streak restored to ${s.streak}.`, 'rotate-ccw');
      spend();
    });
  } else if (item.key === 'streakFreeze') {
    questPicker('Shield whose streak?', () => true, (w) => {
      const freezes = store.getMeta('freezes', {});
      freezes[w.id] = { until: dateAdd(today, 7) };
      store.setMeta('freezes', freezes);
      toast(`${w.name}: shielded until ${fmtDate(dateAdd(today, 7))}.`, 'snowflake');
      spend();
    });
  }
}

registry.register({
  type: 'market',
  name: 'Market',
  icon: 'bag',
  description: 'Spend your coins on kind rewards',
  external: true, internal: true,
  defaultConfig: () => ({ owned: [], customRewards: [] }),

  renderCard(host, widget) {
    host.innerHTML = '';
    host.appendChild(el(`<div class="market-card">
      <div class="m-coins">${coinRow(wallet.get())}</div>
      <div class="soft" style="text-align:center;font-size:0.78rem;margin-top:4px">${owned(widget).length} owned reward${owned(widget).length === 1 ? '' : 's'}</div>
    </div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const render = () => {
      host.innerHTML = '';
      host.appendChild(el(`<div class="panel" style="padding:12px;margin-bottom:16px;text-align:center">
        <div class="m-coins" style="justify-content:center">${coinRow(wallet.get())}</div>
        <div class="soft" style="font-size:0.78rem;margin-top:2px">${wallet.format()}</div></div>`));

      // owned shelf
      if (owned(widget).length) {
        host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin-bottom:6px">OWNED</h3>'));
        for (const item of [...owned(widget)]) {
          const row = el(`<button class="list-item">${icon(item.icon, 16)}<span class="li-main"><span class="li-title"></span></span><span class="chip accent">use</span></button>`);
          row.querySelector('.li-title').textContent = item.name;
          row.onclick = () => useItem(widget, item, ctx, render);
          host.appendChild(row);
        }
      }

      // shop
      host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:14px 0 6px">SHOP</h3>'));
      for (const c of CATALOG) {
        const afford = wallet.get() >= c.price;
        const row = el(`<div class="list-item" style="cursor:default">
          <span style="color:var(--accent)">${icon(c.icon, 18)}</span>
          <span class="li-main"><span class="li-title">${c.name}</span><span class="li-sub">${c.effect}</span></span>
          <button class="btn" ${afford ? '' : 'disabled'}>${wallet.format(c.price)}</button></div>`);
        row.querySelector('.btn').onclick = () => {
          if (!wallet.spend(c.price)) return;
          owned(widget).push({ id: ulid(), key: c.key, name: c.name, icon: c.icon, date: todayStr() });
          createObject(widget.id, 'rewardLog', { item: c.name, bought: true }, todayStr());
          store.put('widgets', widget);
          render();
          toast(`${c.name} — yours.`, 'gift');
        };
        host.appendChild(row);
      }

      // custom rewards (docs/07: user-defined real-life treats)
      host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:14px 0 6px">YOUR REWARDS</h3>'));
      for (const r of (widget.config.customRewards || [])) {
        const afford = wallet.get() >= r.price;
        const row = el(`<div class="list-item" style="cursor:default">
          <span style="color:var(--highlight)">${icon('gift', 18)}</span>
          <span class="li-main"><span class="li-title"></span></span>
          <button class="btn" ${afford ? '' : 'disabled'}>${wallet.format(r.price)}</button>
          <button class="btn-icon">${icon('x', 13)}</button></div>`);
        row.querySelector('.li-title').textContent = r.name;
        row.querySelector('.btn').onclick = () => {
          if (!wallet.spend(r.price)) return;
          createObject(widget.id, 'rewardLog', { item: r.name, custom: true }, todayStr());
          render();
          toast(`${r.name} — enjoy it, you earned it.`, 'gift');
        };
        row.querySelector('.btn-icon').onclick = async () => {
          if (await confirmDialog({ title: `Remove “${r.name}”?` })) {
            widget.config.customRewards = widget.config.customRewards.filter(x => x.id !== r.id);
            store.put('widgets', widget);
            render();
          }
        };
        host.appendChild(row);
      }
      const addForm = el(`<div class="row" style="margin-top:8px">
        <input class="input" placeholder="Movie night" style="flex:2">
        <input class="input" type="number" placeholder="200" title="price in copper" style="flex:1">
        <button class="btn">${icon('plus', 14)}</button></div>`);
      addForm.querySelector('.btn').onclick = () => {
        const [nameIn, priceIn] = addForm.querySelectorAll('input');
        if (!nameIn.value.trim() || !Number(priceIn.value)) return;
        widget.config.customRewards.push({ id: ulid(), name: nameIn.value.trim(), price: Math.round(Number(priceIn.value)) });
        store.put('widgets', widget);
        render();
      };
      host.appendChild(addForm);
      host.appendChild(el('<p class="soft" style="font-size:0.74rem;margin-top:4px">Price is in copper (10c = 1s, 100c = 1g, 1000c = 1p).</p>'));

      // reward journal
      const logs = objectsOf(widget.id, 'rewardLog').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
      if (logs.length) {
        host.appendChild(el('<h3 class="soft" style="font-size:0.8rem;margin:14px 0 6px">REWARD JOURNAL</h3>'));
        for (const log of logs) {
          host.appendChild(el(`<div class="list-item" style="cursor:default"><span class="li-main"><span class="li-title">${log.data.item}</span><span class="li-sub">${fmtDate(log.date)} · ${log.data.used ? 'used' : 'enjoyed'}</span></span></div>`));
        }
      }
    };
    render();
    const off = ctx.events.on('wallet:changed', () => {
      if (!host.isConnected) { off(); return; }
      render();
    });
  }
});
