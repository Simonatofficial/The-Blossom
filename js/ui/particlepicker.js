/* Particle picker (V2 §6): a grid of thumbnail cards with live 64×64 previews,
   a search box, and category filter chips — replaces the old scrolling list.
   Pointer FX and background particles draw from the same registry. */

import { store } from '../core/store.js';
import { loop } from '../fx/loop.js';
import { icon } from './icons.js';
import { el, openDrawer } from './components.js';
import { Layer } from '../fx/particles.js';
import { PRESET_PARTICLES, PRESET_POINTER_FX } from '../presets/particles.js';

/* preset id → category (Custom is derived from the themes store) */
const CATEGORY = {
  autumnLeaves: 'Nature', summerLeaves: 'Nature', cherryBlossoms: 'Nature', dandelionSeeds: 'Nature', fireflies: 'Nature', tropicalFish: 'Nature',
  starfield: 'Celestial', shootingStars: 'Celestial', comets: 'Celestial',
  snow: 'Weather', rain: 'Weather', windStreaks: 'Weather', fireEmbers: 'Weather', smokeWisps: 'Weather',
  hearts: 'Magic', bubbles: 'Magic',
  techGlyphs: 'Tech'
};
const CATS = ['All', 'Nature', 'Celestial', 'Weather', 'Magic', 'Tech', 'Custom'];

/**
 * @param {{current?: string, source?: 'particles'|'pointer', onPick: (id:string)=>void}} opts
 */
export function openParticlePicker({ current = null, source = 'particles', onPick } = {}) {
  const d = openDrawer({ title: 'Choose particles', iconName: 'sparkles' });
  const unsubs = [];
  const stopAll = () => { for (const u of unsubs) u(); unsubs.length = 0; };
  const orig = d.close;
  d.close = () => { stopAll(); orig.call(d); };

  const base = source === 'pointer' ? PRESET_POINTER_FX : PRESET_PARTICLES;
  const customs = store.all('themes').filter(t => t.type === 'particle');
  const items = [
    ...base.map(p => ({ id: p.id, name: p.name, def: p, cat: CATEGORY[p.id] || 'Magic' })),
    ...customs.map(c => ({ id: c.id, name: c.name, def: c.def, cat: 'Custom' }))
  ];

  const search = el('<input class="input" placeholder="Search particles" style="margin-bottom:10px">');
  const chips = el('<div class="pp-chips"></div>');
  let activeCat = 'All';
  for (const c of CATS) {
    const chip = el(`<button class="chip ${c === 'All' ? 'accent' : ''}">${c}</button>`);
    chip.onclick = () => { activeCat = c; chips.querySelectorAll('.chip').forEach(x => x.classList.remove('accent')); chip.classList.add('accent'); render(); };
    chips.appendChild(chip);
  }
  const grid = el('<div class="pp-grid"></div>');
  d.body.append(search, chips, grid);

  const render = () => {
    stopAll();
    grid.innerHTML = '';
    const q = search.value.trim().toLowerCase();
    const list = items.filter(it => (activeCat === 'All' || it.cat === activeCat) && (!q || it.name.toLowerCase().includes(q)));
    if (!list.length) { grid.appendChild(el('<p class="soft" style="grid-column:1/-1">No particles match.</p>')); return; }
    for (const it of list) {
      const card = el(`<button class="pp-card${it.id === current ? ' sel' : ''}"><canvas width="64" height="64"></canvas><span class="pp-name"></span></button>`);
      card.querySelector('.pp-name').textContent = it.name;
      const cv = card.querySelector('canvas');
      const L = new Layer(cv, 24);
      cv.width = 64; cv.height = 64; // Layer.resize uses the window size
      try {
        L.setDef({ ...it.def, maxCount: Math.min(12, it.def.maxCount || 10) }, it.def.color);
        for (let i = 0; i < 6; i++) L.spawnOne();
        const stop = loop.add((dt, now) => { if (!cv.isConnected) { stop(); return; } L.tick(dt, now); });
        unsubs.push(stop);
      } catch { /* a malformed custom def shouldn't break the grid */ }
      card.onclick = () => { onPick(it.id); d.close(); };
      grid.appendChild(card);
    }
  };
  search.addEventListener('input', render);
  render();
}
