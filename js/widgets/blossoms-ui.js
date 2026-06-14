/* Blossoms — full-page game UI (docs/13 §21 MVP). Renders the HUD, tap target,
   upgrades, settlement plot grid, and the per-plot build/manage sheet. Live
   numbers refresh from the shared game tick; structure re-renders after actions. */

import { el, toast, confirmDialog } from '../ui/components.js';
import { BUILDINGS, RESOURCES, TIERS, TAP_UPGRADES, VILLAGER } from './blossoms-data.js';
import * as E from './blossoms-engine.js';
import { fmt, blossomSVG, doTap, subscribe, save } from './blossoms.js';

const resEmoji = (k) => RESOURCES[k]?.emoji || (k === 'blossom' ? '🌸' : k);
const costStr = (cost) => Object.entries(cost).map(([k, v]) => `${fmt(v)} ${resEmoji(k)}`).join(' ');
const nope = (b) => { b.classList.remove('bl-nope'); void b.offsetWidth; b.classList.add('bl-nope'); };

export function renderGame(host, ctl, ctx) {
  const g = ctl.g;
  host.innerHTML = '';
  const root = el('<div class="bl-game"></div>');

  const tier = el('<div class="bl-tier"></div>');
  const hud = el('<div class="bl-hud"></div>');
  const tapZone = el(`<div class="bl-tapzone"><button class="bl-tap bl-tap-lg" aria-label="Tap the Blossom">${blossomSVG(124)}</button><div class="bl-tapval soft"></div></div>`);
  const tapBtn = tapZone.querySelector('.bl-tap');
  tapBtn.addEventListener('click', () => doTap(ctl, tapBtn, tapZone));
  const ups = el('<div class="bl-ups"></div>');
  const vbar = el('<div class="bl-vbar"></div>');
  const grid = el('<div class="bl-grid"></div>');
  const sheet = el('<div class="bl-sheet"></div>');
  let selected = null;

  root.append(tier, hud, tapZone, ups, el('<h4 class="bl-h">Your settlement</h4>'), vbar, grid, sheet);
  host.appendChild(root);

  function paintNumbers() {
    const r = E.rates(g);
    const rate = (x) => (x >= 0 ? '+' : '') + (Math.abs(x) < 10 ? x.toFixed(1) : Math.round(x));
    hud.innerHTML = [
      `<span class="bl-hud-it">🌸 <b>${fmt(g.blossom)}</b></span>`,
      `<span class="bl-hud-it">🍎 <b>${fmt(g.food)}</b><span class="soft">${rate(r.food)}/s</span></span>`,
      `<span class="bl-hud-it">🪵 <b>${fmt(g.wood)}</b><span class="soft">${rate(r.wood)}/s</span></span>`,
      `<span class="bl-hud-it">⛏️ <b>${fmt(g.ore)}</b><span class="soft">${rate(r.ore)}/s</span></span>`,
      `<span class="bl-hud-it">🏠 <b>${E.population(g)}/${E.housingCap(g)}</b></span>`
    ].join('');
    tapZone.querySelector('.bl-tapval').textContent = `+${fmt(E.tapValue(g))} per tap` + (E.autoTapRate(g) ? ` · ${E.autoTapRate(g).toFixed(1)}/s auto` : '');
    ups.querySelectorAll('[data-up]').forEach(b => { b.disabled = !E.canAfford(g, E.tapUpgradeCost(g, b.dataset.up)); });
    const rb = vbar.querySelector('[data-recruit]');
    if (rb) rb.disabled = E.population(g) >= E.housingCap(g) || !E.canAfford(g, VILLAGER.recruitCost);
  }

  function paintStructure() {
    const t = TIERS[g.tier], next = TIERS[g.tier + 1];
    tier.innerHTML = `<span class="bl-tier-name">${t.emoji} ${t.name}</span>` +
      (next ? `<span class="soft" style="font-size:0.8rem">${E.buildingCount(g)}/${next.needs.buildings} buildings → ${next.emoji} ${next.name}</span>`
            : `<span class="soft" style="font-size:0.8rem">fully grown 🌟</span>`);

    ups.innerHTML = '';
    for (const key of ['tap', 'auto']) {
      const u = TAP_UPGRADES[key];
      const b = el(`<button class="btn bl-up" data-up="${key}"><span>${u.emoji} ${u.name}</span><span class="soft" style="font-size:0.72rem">${u.hint} · ${costStr(E.tapUpgradeCost(g, key))}</span></button>`);
      b.onclick = () => { if (E.buyTapUpgrade(g, key)) { save(ctl); paintStructure(); paintNumbers(); } else nope(b); };
      ups.appendChild(b);
    }

    vbar.innerHTML = `<span>🧑‍🌾 Peasants <b>${E.population(g)}</b> <span class="soft">(${E.idleVillagers(g)} idle)</span></span>`;
    const rec = el(`<button class="btn" data-recruit><span>Recruit</span> <span class="soft" style="font-size:0.72rem">${costStr(VILLAGER.recruitCost)}</span></button>`);
    rec.onclick = () => { if (E.recruit(g)) { save(ctl); paintStructure(); paintNumbers(); } else nope(rec); };
    vbar.appendChild(rec);

    grid.innerHTML = '';
    const unlocked = E.unlockedPlots(g);
    const total = TIERS[TIERS.length - 1].plots;
    for (let i = 0; i < total; i++) {
      if (i >= unlocked) { grid.appendChild(el('<div class="bl-plot bl-locked">🔒</div>')); continue; }
      const p = g.plots[i];
      const tile = el(`<button class="bl-plot ${p ? 'built' : 'empty'} ${selected === i ? 'sel' : ''}"></button>`);
      if (p) {
        const def = BUILDINGS[p.type];
        tile.innerHTML = `<span class="bl-pemoji">${def.emoji}</span><span class="bl-plvl">${def.name}${p.level ? ' ·L' + (p.level + 1) : ''}</span>${E.villagersOn(g, i) ? `<span class="bl-pv">🧑‍🌾${E.villagersOn(g, i)}</span>` : ''}`;
      } else tile.innerHTML = '<span class="bl-padd">＋</span>';
      tile.onclick = () => { selected = i; paintStructure(); sheet.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
      grid.appendChild(tile);
    }
    renderSheet();
  }

  function renderSheet() {
    sheet.innerHTML = '';
    if (selected == null) { sheet.classList.remove('open'); return; }
    sheet.classList.add('open');
    const i = selected, p = g.plots[i];
    const head = el('<div class="row-between bl-sheet-head"><b></b><button class="btn-icon bl-sheet-x" aria-label="Close">✕</button></div>');
    head.querySelector('.bl-sheet-x').onclick = () => { selected = null; paintStructure(); };
    sheet.appendChild(head);

    if (!p) {
      head.querySelector('b').textContent = 'Build here';
      for (const type in BUILDINGS) {
        const def = BUILDINGS[type], cost = E.buildCost(g, type), ok = E.canAfford(g, cost);
        const sub = def.produces ? `+${def.rate}/s ${resEmoji(def.produces)}` : `+${def.housing} 🏠`;
        const b = el(`<button class="btn bl-buildopt ${ok ? '' : 'cant'}"><span>${def.emoji} ${def.name} <span class="soft" style="font-size:0.72rem">${sub}</span></span><span class="soft" style="font-size:0.72rem">${costStr(cost)}</span></button>`);
        b.onclick = () => { if (E.build(g, i, type)) { save(ctl); paintStructure(); paintNumbers(); } else nope(b); };
        sheet.appendChild(b);
      }
    } else {
      const def = BUILDINGS[p.type];
      head.querySelector('b').textContent = `${def.emoji} ${def.name}` + (p.level ? ` · Level ${p.level + 1}` : '');
      const uc = E.upgradeCost(g, i);
      const ub = el(`<button class="btn bl-buildopt"><span>⬆️ Upgrade <span class="soft" style="font-size:0.72rem">+50% output</span></span><span class="soft" style="font-size:0.72rem">${costStr(uc)}</span></button>`);
      ub.onclick = () => { if (E.upgradeBuilding(g, i)) { save(ctl); paintStructure(); paintNumbers(); } else nope(ub); };
      sheet.appendChild(ub);

      if (def.produces) {
        const row = el(`<div class="row-between bl-assign"><span>🧑‍🌾 here: <b>${E.villagersOn(g, i)}</b> <span class="soft">(+${Math.round(VILLAGER.boost * 100)}% each)</span></span><span class="row" style="gap:8px"></span></div>`);
        const minus = el('<button class="btn-icon bl-step">−</button>');
        const plus = el('<button class="btn-icon bl-step">＋</button>');
        minus.onclick = () => { if (E.unassignFrom(g, i)) { save(ctl); paintStructure(); paintNumbers(); } };
        plus.onclick = () => { if (E.assignTo(g, i)) { save(ctl); paintStructure(); paintNumbers(); } else toast(E.idleVillagers(g) ? 'No idle Peasants' : 'Recruit a Peasant first', 'leaf'); };
        row.querySelector('span.row').append(minus, plus);
        sheet.appendChild(row);
      }

      const dem = el('<button class="btn-ghost btn bl-demo">Demolish</button>');
      dem.onclick = async () => {
        if (await confirmDialog({ title: `Demolish ${def.name}?`, message: 'The plot is cleared (no refund).', confirmText: 'Demolish' })) {
          E.demolish(g, i); save(ctl); selected = null; paintStructure(); paintNumbers();
        }
      };
      sheet.appendChild(dem);
    }
  }

  paintStructure();
  paintNumbers();
  subscribe(ctl, root, paintNumbers);
}
