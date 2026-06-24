/* Companion widget (docs/17 §4) — Liri's vignette: a living portrait of your five aspects.
   Self-contained: it reads the Liri state + growth ledger and renders. Undiscovered → it runs
   the element quiz inline (shared helper) so it works alone on any page. Discovered → the
   procedural Liri, its element/sub, a bond bar, and the five aspect levels feeding it. */

import { registry } from './registry.js';
import { el } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { events } from '../core/events.js';
import { liriSVG } from './liri-render.js';
import { renderElementQuiz } from './liri-quiz.js';
import { getLiri, isDiscovered, liriAppearance, bondPct, setForm, feed, play, isFedToday } from '../core/liri.js';
import { ELEMENTS, FORMS } from '../presets/liri-content.js';

const ASPECT_COLOR = { mental: '#6b8cff', physical: '#ff7a6b', emotional: '#56c2a6', social: '#e6b45a', recreation: '#c07ad6' };

function liveRedraw(host, draw) {
  const off = events.on('liri:changed', () => { host.isConnected ? draw() : off(); });
  const off2 = events.on('growth:changed', () => { host.isConnected ? draw() : off2(); });
}

registry.register({
  type: 'companion',
  name: 'Liri',
  icon: 'sparkles',
  description: 'Your soul-bonded companion, grown from your aspects',
  category: 'Growth & Rewards',
  external: true, internal: true,
  keywords: ['liri', 'companion', 'creature', 'pet', 'elemental', 'soul'],
  defaultConfig: () => ({}),

  renderCard(host, widget, ctx) {
    const draw = () => {
      host.innerHTML = '';
      if (!isDiscovered()) {
        host.appendChild(el(`<div style="text-align:center;padding:6px 0">
          <div style="opacity:0.5;filter:saturate(0.4)">${liriSVG({ form: 'flying-fox', color: '#b9c2d6', deep: '#8a90a6', size: 0.4, colorDepth: 0, abilities: 0, adornment: 0, liveliness: 0.2, name: 'Liri' }, { px: 110 })}</div>
          <p class="soft" style="font-size:0.84rem;margin:4px 0 8px">Liri is waiting to be discovered.</p></div>`));
        const go = el(`<button class="btn btn-primary" style="width:100%">${icon('sparkles', 15)} Discover Liri</button>`);
        go.onclick = () => ctx.openInternal(widget);
        host.appendChild(go);
        return;
      }
      const app = liriAppearance();
      const elDef = ELEMENTS[app.element];
      const wrap = el('<div style="text-align:center"></div>');
      wrap.appendChild(el(`<div class="liri-vig">${liriSVG(app, { px: 150 })}</div>`));
      wrap.appendChild(el(`<div class="row" style="gap:6px;justify-content:center;align-items:center;margin-top:2px">
        <strong>${app.name}</strong>
        <span class="chip" style="background:${elDef.color}22;color:${elDef.deep}">${icon(elDef.icon, 11)} ${app.sub ? app.sub + ' ' : ''}${elDef.name}</span></div>`));
      wrap.appendChild(el(`<div class="row-between" style="font-size:0.74rem;margin-top:6px"><span class="soft">Bond Lv ${getLiri().bond.level}</span><span class="soft">${isFedToday() ? 'fed today' : 'hungry'}</span></div>`));
      wrap.appendChild(el(`<div class="sk-bar"><span class="sk-fill" style="width:${Math.round(bondPct() * 100)}%"></span></div>`));
      host.appendChild(wrap);
    };
    draw();
    liveRedraw(host, draw);
  },

  renderFull(host, widget, ctx) {
    const draw = () => {
      host.innerHTML = '';
      if (!isDiscovered()) { renderElementQuiz(host, () => draw()); return; }
      const app = liriAppearance();
      const elDef = ELEMENTS[app.element];

      host.appendChild(el(`<div style="text-align:center"><div class="liri-vig">${liriSVG(app, { px: 220 })}</div>
        <div class="row" style="gap:6px;justify-content:center;align-items:center;margin-top:4px">
          <strong style="font-size:1.05rem">${app.name}</strong>
          <span class="chip" style="background:${elDef.color}22;color:${elDef.deep}">${icon(elDef.icon, 12)} ${app.sub ? app.sub + ' ' : ''}${elDef.name}</span></div>
        <p class="soft" style="font-size:0.8rem;margin-top:2px">Total growth ${app.totalLevel} · Bond Lv ${getLiri().bond.level}${app.subLocked ? ' · nature settled' : ''}</p></div>`));

      // quick care
      const care = el('<div class="row" style="gap:8px;justify-content:center;margin:10px 0"></div>');
      const feedBtn = el(`<button class="btn-soft-wide" style="width:auto;flex:1">${icon('gift', 14)} Feed (10c)</button>`);
      feedBtn.onclick = () => { if (feed(ctx.wallet)) { ctx.toast(`${app.name} is happy!`, 'sparkles'); } else ctx.toast('Not enough coins.', 'info'); draw(); };
      const playBtn = el(`<button class="btn-soft-wide" style="width:auto;flex:1">${icon('smile', 14)} Play</button>`);
      playBtn.onclick = () => { play(); ctx.toast(`${app.name} loved that.`, 'smile'); draw(); };
      care.append(feedBtn, playBtn);
      host.appendChild(care);

      // the five aspects feeding Liri
      host.appendChild(el('<p class="soft" style="font-size:0.78rem;margin:6px 0 4px">What grows Liri</p>'));
      const grid = el('<div class="col" style="gap:7px"></div>');
      const FEEDS = { physical: 'size & strength', mental: 'abilities', emotional: 'colour', social: 'finery', recreation: 'sparkle' };
      for (const a of app.aspects) {
        const row = el(`<div>
          <div class="row-between" style="font-size:0.82rem"><span style="font-weight:600;color:${ASPECT_COLOR[a.id]}">${a.name}</span><span class="soft">Lv ${a.level} · ${FEEDS[a.id]}</span></div>
          <div class="sk-bar" style="margin-top:2px"><span class="sk-fill" style="width:${Math.min(100, a.level / 12 * 100)}%;background:${ASPECT_COLOR[a.id]}"></span></div></div>`);
        grid.appendChild(row);
      }
      host.appendChild(grid);

      // change form (until it locks)
      if (!app.formLocked) {
        const formRow = el('<div style="margin-top:12px"><p class="soft" style="font-size:0.78rem;margin-bottom:4px">Change form</p><div class="row" style="gap:6px;flex-wrap:wrap"></div></div>');
        const fwrap = formRow.querySelector('.row');
        for (const f of FORMS) {
          const b = el(`<button class="chip" style="${f.id === app.form ? `background:${elDef.color}22;color:${elDef.deep};font-weight:600` : ''}">${f.name}</button>`);
          b.onclick = () => { setForm(f.id); draw(); };
          fwrap.appendChild(b);
        }
        host.appendChild(formRow);
      } else {
        host.appendChild(el(`<p class="soft" style="font-size:0.76rem;margin-top:10px;text-align:center">${app.name}'s form has settled for good 🌿</p>`));
      }
    };
    draw();
    liveRedraw(host, draw);
  }
});
