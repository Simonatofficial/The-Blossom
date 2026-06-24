/* Element Quiz widget (docs/17 §4) — a standalone surface for the 15-question discovery.
   Self-contained: reuses the shared quiz helper + pure content. Element is fixed once chosen;
   a gentle "re-discover" is offered (a Cosmos-gated ceremony later, §8). */

import { registry } from './registry.js';
import { el } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { events } from '../core/events.js';
import { renderElementQuiz } from './liri-quiz.js';
import { isDiscovered, liriAppearance } from '../core/liri.js';
import { ELEMENTS } from '../presets/liri-content.js';

registry.register({
  type: 'elementquiz',
  name: 'Element Quiz',
  icon: 'wand',
  description: "Discover Liri's element",
  category: 'Growth & Rewards',
  external: true, internal: true,
  keywords: ['quiz', 'element', 'liri', 'discover', 'personality', 'air', 'water', 'earth', 'fire'],
  defaultConfig: () => ({}),

  renderCard(host, widget, ctx) {
    const draw = () => {
      host.innerHTML = '';
      if (isDiscovered()) {
        const app = liriAppearance(); const e = ELEMENTS[app.element];
        host.appendChild(el(`<div class="row-between">
          <span class="row" style="gap:7px"><span style="color:${e.color}">${icon(e.icon, 16)}</span><span>${app.name} is <strong>${e.name}</strong></span></span>
          <span class="chip" style="background:${e.color}22;color:${e.deep}">${e.word}</span></div>`));
        return;
      }
      host.appendChild(el(`<p class="soft" style="font-size:0.86rem;margin-bottom:8px">A gentle 15-question quiz reveals Liri's element.</p>`));
      const go = el(`<button class="btn btn-primary" style="width:100%">${icon('wand', 15)} Discover Liri's element</button>`);
      go.onclick = () => ctx.openInternal(widget);
      host.appendChild(go);
    };
    draw();
    const off = events.on('liri:changed', () => { host.isConnected ? draw() : off(); });
  },

  renderFull(host, widget) {
    const draw = () => {
      host.innerHTML = '';
      if (!isDiscovered()) { renderElementQuiz(host, () => draw()); return; }
      const app = liriAppearance(); const e = ELEMENTS[app.element];
      host.appendChild(el(`<div style="text-align:center">
        <p style="font-size:1.3rem;font-weight:700;color:${e.color}">${icon(e.icon, 20)} ${e.name}</p>
        <p class="soft" style="font-size:0.86rem">${app.name}'s nature is ${e.word}. ${app.sub ? `Its sub-element has grown into <strong>${app.sub}</strong>.` : ''}</p></div>`));
      const re = el(`<button class="btn-soft-wide" style="margin-top:12px">${icon('refresh', 14)} Re-discover (changes Liri's element)</button>`);
      re.onclick = () => { host.innerHTML = ''; renderElementQuiz(host, () => draw()); };
      host.appendChild(re);
      host.appendChild(el(`<p class="soft" style="font-size:0.74rem;text-align:center;margin-top:6px">Your element is usually fixed — re-discovering is a gentle exception.</p>`));
    };
    draw();
  }
});
