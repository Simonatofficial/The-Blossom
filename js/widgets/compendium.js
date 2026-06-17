/* Compendium widget (V2 §12e/§13): a browsable, searchable 5e SRD reference —
   spells, monsters, classes, races, backgrounds, weapons, armor, gear, magic
   items, and conditions. Offline, system-accurate, D&D-Beyond-style lookup.
   Pure reference: holds no character data, so it can live on any page. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { el } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { COMPENDIUM, searchCompendium } from '../presets/tabletop/srd5e-index.js';
import { entryDetail, entrySubtitle } from './tabletop-compendium.js';

registry.register({
  type: 'compendium',
  name: 'Compendium',
  icon: 'book',
  description: 'Searchable 5e SRD — spells, monsters, gear, rules',
  keywords: ['dnd', 'd&d', 'srd', 'reference', 'spells', 'monsters', 'rules', 'bestiary', 'rpg', 'tabletop'],
  category: 'Tabletop',
  external: true, internal: true,
  defaultConfig: () => ({ cat: 'spells', q: '' }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const total = COMPENDIUM.reduce((n, c) => n + c.items().length, 0);
    host.appendChild(el(`<div><div class="row" style="gap:8px;align-items:center">
      <span style="color:var(--accent)">${icon('book', 22)}</span>
      <div><div style="font-weight:650">Compendium</div>
      <div class="soft" style="font-size:0.8rem">${total} entries · tap to search</div></div></div></div>`));
  },

  renderFull(host, widget) {
    host.innerHTML = '';
    const cfg = widget.config;
    const save = () => store.put('widgets', widget);

    // search bar
    const search = el(`<div class="row" style="gap:6px;margin-bottom:8px;align-items:center">
      <span class="soft" style="display:flex">${icon('search', 16)}</span>
      <input class="input grow" placeholder="Search the compendium…" autocomplete="off"></div>`);
    const searchIn = search.querySelector('input');
    searchIn.value = cfg.q || '';
    host.appendChild(search);

    // category chips
    const cats = el('<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:10px"></div>');
    const mkCat = (id, label) => {
      const b = el(`<button class="chip${cfg.cat === id ? ' accent' : ''}">${label}</button>`);
      b.onclick = () => { cfg.cat = id; save(); [...cats.children].forEach(c => c.classList.remove('accent')); b.classList.add('accent'); draw(); };
      cats.appendChild(b);
    };
    mkCat(null, 'All');
    for (const c of COMPENDIUM) mkCat(c.id, c.label);
    host.appendChild(cats);

    const list = el('<div class="cmp-list"></div>');
    host.appendChild(list);

    let openId = null;
    const draw = () => {
      list.innerHTML = '';
      const results = searchCompendium(cfg.q, cfg.cat);
      const count = el(`<div class="soft" style="font-size:0.78rem;margin-bottom:6px">${results.length} result${results.length === 1 ? '' : 's'}</div>`);
      list.appendChild(count);
      for (const e of results.slice(0, 200)) {
        const id = `${e._cat}:${e.name}`;
        const row = el(`<div class="cmp-row">
          <button class="list-item cmp-head" style="width:100%;text-align:left;cursor:pointer">
            <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
            <span class="cmp-tag"></span></button>
          <div class="cmp-body" style="display:none"></div></div>`);
        row.querySelector('.li-title').textContent = e.name;
        row.querySelector('.li-sub').textContent = entrySubtitle(e);
        row.querySelector('.cmp-tag').textContent = COMPENDIUM.find(c => c.id === e._cat)?.label || '';
        const body = row.querySelector('.cmp-body');
        row.querySelector('.cmp-head').onclick = () => {
          const isOpen = openId === id;
          openId = isOpen ? null : id;
          // collapse siblings
          list.querySelectorAll('.cmp-body').forEach(b => { b.style.display = 'none'; b.innerHTML = ''; });
          if (!isOpen) { body.appendChild(entryDetail(e)); body.style.display = ''; }
        };
        list.appendChild(row);
      }
      if (results.length > 200) list.appendChild(el('<p class="soft" style="font-size:0.78rem;padding:6px">Showing first 200 — refine your search.</p>'));
    };

    searchIn.oninput = () => { cfg.q = searchIn.value; save(); draw(); };
    draw();
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">The Compendium is drawn from the 5e System Reference Document (CC-BY-4.0). It works fully offline. Tap any entry to read its full details.</p>'));
  }
});
