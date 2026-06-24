/* Liri Life widget (docs/17 §4) — the gentle, duck-life-style care loop: bond, mood, feed/play,
   toys, and a little journal. Never punishing (anti-burnout, docs/16): hunger is a soft nudge, not
   a guilt meter. Spends the shared coin wallet. Self-contained; reads the Liri state. */

import { registry } from './registry.js';
import { el } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { events } from '../core/events.js';
import { liriSVG } from './liri-render.js';
import { getLiri, isDiscovered, liriAppearance, bondPct, feed, play, buyToy, setMood, recentMood, addJournal, isFedToday, COSTS } from '../core/liri.js';

const MOODS = [{ s: 1, e: '😟', l: 'low' }, { s: 2, e: '😕', l: 'meh' }, { s: 3, e: '🙂', l: 'okay' }, { s: 4, e: '😊', l: 'good' }, { s: 5, e: '🤩', l: 'great' }];

function liveRedraw(host, draw) {
  const off = events.on('liri:changed', () => { host.isConnected ? draw() : off(); });
}

registry.register({
  type: 'lirilife',
  name: 'Liri Life',
  icon: 'heart',
  description: 'Tend, feed, and play with Liri',
  category: 'Growth & Rewards',
  external: true, internal: true,
  keywords: ['liri', 'life', 'care', 'pet', 'bond', 'mood', 'feed', 'play'],
  defaultConfig: () => ({}),

  renderCard(host, widget, ctx) {
    const draw = () => {
      host.innerHTML = '';
      if (!isDiscovered()) { host.appendChild(el('<p class="soft" style="font-size:0.86rem">Discover Liri first to begin tending it.</p>')); return; }
      const app = liriAppearance(), l = getLiri();
      host.appendChild(el(`<div class="row" style="gap:10px;align-items:center">
        <div style="flex-shrink:0">${liriSVG(app, { px: 64 })}</div>
        <div style="flex:1;min-width:0">
          <div class="row-between" style="font-size:0.8rem"><strong>Bond Lv ${l.bond.level}</strong><span class="soft">${isFedToday() ? 'fed today 🌸' : 'hungry'}</span></div>
          <div class="sk-bar" style="margin:3px 0"><span class="sk-fill" style="width:${Math.round(bondPct() * 100)}%"></span></div>
          <div class="soft" style="font-size:0.76rem">${recentMood() ? `mood today: ${MOODS.find(m => m.s === recentMood())?.e || ''}` : 'how is Liri feeling today?'}</div>
        </div></div>`));
    };
    draw();
    liveRedraw(host, draw);
  },

  renderFull(host, widget, ctx) {
    const draw = () => {
      host.innerHTML = '';
      if (!isDiscovered()) { host.appendChild(el('<p class="soft">Discover Liri first (take the element quiz) to begin tending it.</p>')); return; }
      const app = liriAppearance(), l = getLiri();

      host.appendChild(el(`<div style="text-align:center"><div>${liriSVG(app, { px: 160 })}</div>
        <p style="font-weight:700;margin-top:2px">${app.name}</p>
        <div class="row-between" style="font-size:0.78rem;margin-top:6px"><span class="soft">Bond level ${l.bond.level}</span><span class="soft">${getWalletLabel(ctx)}</span></div>
        <div class="sk-bar" style="margin-top:3px"><span class="sk-fill" style="width:${Math.round(bondPct() * 100)}%"></span></div></div>`));

      // care actions
      const acts = el('<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px"></div>');
      const mk = (label, ic, fn) => { const b = el(`<button class="btn-soft-wide" style="width:auto;flex:1;min-width:120px">${icon(ic, 14)} ${label}</button>`); b.onclick = fn; return b; };
      acts.append(
        mk(`Feed (${COSTS.food}c)`, 'gift', () => { feed(ctx.wallet) ? ctx.toast(`${app.name} is full and happy!`, 'sparkles') : ctx.toast('Not enough coins.', 'info'); draw(); }),
        mk('Play', 'smile', () => { play(); ctx.toast(`${app.name} loved playing.`, 'smile'); draw(); }),
        mk(`Toy (${COSTS.toy}c)`, 'shapes', () => { buyToy(ctx.wallet) ? ctx.toast(`A new toy! ${app.name} is delighted.`, 'gift') : ctx.toast('Not enough coins.', 'info'); draw(); })
      );
      host.appendChild(acts);
      if (l.inventory?.toys) host.appendChild(el(`<p class="soft" style="font-size:0.74rem;margin-top:4px">${app.name} has ${l.inventory.toys} toy${l.inventory.toys === 1 ? '' : 's'} 🧸</p>`));

      // mood today
      host.appendChild(el('<p class="soft" style="font-size:0.78rem;margin:14px 0 4px">How is Liri today?</p>'));
      const moodRow = el('<div class="row" style="gap:6px"></div>');
      for (const m of MOODS) {
        const b = el(`<button class="chip" style="font-size:1.1rem;${recentMood() === m.s ? 'background:var(--accent-soft);outline:2px solid var(--accent)' : ''}" title="${m.l}">${m.e}</button>`);
        b.onclick = () => { setMood(m.s); draw(); };
        moodRow.appendChild(b);
      }
      host.appendChild(moodRow);

      // tiny journal
      host.appendChild(el('<p class="soft" style="font-size:0.78rem;margin:14px 0 4px">A note with Liri</p>'));
      const jin = el('<textarea class="input" rows="2" placeholder="A small moment from today…" style="resize:vertical"></textarea>');
      const jbtn = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('feather', 14)} Save note</button>`);
      jbtn.onclick = () => { if (jin.value.trim()) { addJournal(jin.value); jin.value = ''; ctx.toast('Saved.', 'feather'); draw(); } };
      host.append(jin, jbtn);
      for (const j of (l.journal || []).slice(0, 5)) {
        const row = el(`<div class="panel" style="padding:8px;margin-top:6px"><div class="soft" style="font-size:0.72rem">${j.date}</div><div style="font-size:0.86rem"></div></div>`);
        row.querySelector('div:last-child').textContent = j.text;
        host.appendChild(row);
      }
    };
    draw();
    liveRedraw(host, draw);
  }
});

function getWalletLabel(ctx) {
  try { return `${ctx.wallet.format()} in your purse`; } catch { return ''; }
}
