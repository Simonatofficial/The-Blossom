/* First-launch guided tour (docs/01): six soft, skippable spotlight cards.
   Replayable from Settings → About. */

import { store } from '../core/store.js';
import { icon } from './icons.js';
import { el, toast } from './components.js';
import { applyGlobalTheme } from '../fx/themes.js';
import { getTheme } from '../fx/themes.js';

export function initOnboarding(force = false) {
  if (!force && store.getMeta('onboarded')) return;

  let step = 0;
  let card = null;

  const steps = [
    {
      title: 'Welcome to My Blossom',
      body: 'Build a space that’s yours.',
      content(host, next) {
        const nameIn = el('<input class="input" placeholder="What should we call you? (optional)">');
        nameIn.value = store.getMeta('userName') || '';
        nameIn.addEventListener('change', () => store.setMeta('userName', nameIn.value.trim()));
        host.appendChild(nameIn);
      }
    },
    {
      title: 'Pick a starting theme',
      body: 'Tap to try one on — you can change it any time.',
      content(host) {
        const row = el('<div class="row" style="margin-top:4px"></div>');
        for (const id of ['flower', 'space']) {
          const t = getTheme(id);
          const c = el(`<button class="btn grow" style="flex-direction:column;padding:12px">
            <span style="display:flex;gap:4px">${['bg', 'accent', 'highlight'].map(k => `<span style="width:16px;height:16px;border-radius:50%;background:${t.colors[k]};border:1px solid var(--border)"></span>`).join('')}</span>
            <span>${t.name}</span></button>`);
          c.onclick = () => applyGlobalTheme(id);
          row.appendChild(c);
        }
        host.appendChild(row);
      }
    },
    {
      title: 'Meet Modules',
      body: 'Modules are whole apps inside My Blossom. The switcher lives up here — your garden is pre-planted.',
      spotlight: '#btn-modules'
    },
    {
      title: 'Meet Widgets',
      body: 'Every card is a widget: drag the dots to reorder, the chevron to fold it away, ··· for everything else.',
      spotlight: '.widget-card'
    },
    {
      title: 'The COSMOS method',
      body: 'Habits take root when they’re tiny and attached to your day. Plant your first habit?',
      content(host, next, close) {
        const b = el(`<button class="btn">${icon('cosmos', 16)} Plant your first habit</button>`);
        b.onclick = async () => {
          const mod = await import('../widgets/habit.js').catch(() => null);
          if (mod?.openCosmosWizard) { close(); mod.openCosmosWizard(); }
          else toast('The COSMOS wizard blooms in a later phase.', 'cosmos');
        };
        host.appendChild(b);
      }
    },
    {
      title: 'Your data is yours',
      body: 'Everything lives on your device. Back up anytime in Settings → Saves.',
      spotlight: '#btn-settings'
    }
  ];

  function show() {
    card?.remove();
    document.querySelectorAll('.focus-glow').forEach(c => c.classList.remove('focus-glow'));
    if (step >= steps.length) return finish();
    const s = steps[step];

    card = el(`<div class="tour-card" role="dialog">
      <h3></h3><p></p><div class="tc-extra col"></div>
      <div class="row-between" style="margin-top:14px">
        <div class="tour-dots">${steps.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>
        <div class="row">
          <button class="btn-ghost btn" data-skip>Skip tour</button>
          <button class="btn btn-primary" data-next>${step === steps.length - 1 ? 'Begin' : 'Next'}</button>
        </div>
      </div></div>`);
    card.querySelector('h3').textContent = s.title;
    card.querySelector('p').textContent = s.body;
    s.content?.(card.querySelector('.tc-extra'), () => advance(), () => finish());
    card.querySelector('[data-skip]').onclick = finish;
    card.querySelector('[data-next]').onclick = advance;
    document.body.appendChild(card);

    // place near the spotlit element, or centered
    const target = s.spotlight && document.querySelector(s.spotlight);
    if (target) {
      target.classList.add('focus-glow');
      const r = target.getBoundingClientRect();
      const cw = card.offsetWidth, ch = card.offsetHeight;
      let x = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), window.innerWidth - cw - 12);
      let y = r.bottom + 12;
      if (y + ch > window.innerHeight - 12) y = Math.max(12, r.top - ch - 12);
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
    } else {
      card.style.left = `${(window.innerWidth - card.offsetWidth) / 2}px`;
      card.style.top = `${Math.max(40, window.innerHeight * 0.3)}px`;
    }
  }

  function advance() { step += 1; show(); }

  function finish() {
    card?.remove();
    document.querySelectorAll('.focus-glow').forEach(c => c.classList.remove('focus-glow'));
    store.setMeta('onboarded', true);
  }

  show();
}
