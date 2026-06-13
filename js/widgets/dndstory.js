/* CharacterSheet "story/details" face (docs/08 §4), split out of dndsheet.js
   to keep each file within budget. Holds the non-mechanical-but-essential 5e
   sections: personality, Features & Traits (class features / racial traits /
   feats), other proficiencies & languages, physical description, faction
   reputation, and the level-up log. Shared by the player's Story page and the
   DM's imported full PC sheet. */

import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';
import { getCharacter, saveCharacter } from './dnd-shared.js';

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

export function renderStory(host, env) {
  const { widget } = env;
  const { obj, c } = getCharacter(widget);
  const saveChar = () => saveCharacter(obj);

  const section = (title, build, open = true) => {
    const sec = el(`<details class="wb-sec" ${open ? 'open' : ''}><summary>${title}</summary><div class="wb-sec-body"></div></details>`);
    build(sec.querySelector('.wb-sec-body'));
    host.appendChild(sec);
  };

  section('Personality', (body) => {
    for (const [key, label] of [['traits', 'Traits'], ['ideals', 'Ideals'], ['bonds', 'Bonds'], ['flaws', 'Flaws']]) {
      const f = el(`<div class="field"><label>${label}</label><textarea class="input" rows="2"></textarea></div>`);
      const ta = f.querySelector('textarea');
      ta.value = c.persona[key] || '';
      ta.onchange = () => { c.persona[key] = ta.value; saveChar(); };
      body.appendChild(f);
    }
  });

  /* Features & Traits — class features, racial traits, feats (5e core). */
  section('Features & Traits', (body) => {
    const list = el('<div></div>');
    body.appendChild(list);
    const render = () => {
      list.innerHTML = '';
      if (!c.features.length) list.appendChild(el('<p class="soft" style="font-size:0.82rem;margin:2px 0">Class features, racial traits, and feats — e.g. Second Wind, Darkvision, Lucky.</p>'));
      for (const ft of c.features) {
        const row = el(`<div class="dnd-box" style="margin-bottom:6px"><div class="row" style="gap:6px"><input class="input grow" style="font-weight:600" placeholder="Feature"><input class="input" placeholder="Source" style="width:110px"><button class="btn-icon" title="Remove">${icon('x', 13)}</button></div><textarea class="input" rows="2" placeholder="What it does" style="margin-top:5px"></textarea></div>`);
        const [nm, src] = row.querySelectorAll('input');
        const ta = row.querySelector('textarea');
        nm.value = ft.name || ''; src.value = ft.source || ''; ta.value = ft.text || '';
        nm.onchange = () => { ft.name = nm.value; saveChar(); };
        src.onchange = () => { ft.source = src.value; saveChar(); };
        ta.onchange = () => { ft.text = ta.value; saveChar(); };
        row.querySelector('[title="Remove"]').onclick = () => { c.features.splice(c.features.indexOf(ft), 1); saveChar(); render(); };
        list.appendChild(row);
      }
      const add = el(`<button class="btn-soft-wide" style="margin-top:6px">${icon('plus', 14)} Add feature</button>`);
      add.onclick = () => { c.features.push({ name: '', source: '', text: '' }); saveChar(); render(); };
      list.appendChild(add);
    };
    render();
  }, !!c.features.length);

  /* Other proficiencies & languages (5e sheet section). */
  section('Proficiencies & Languages', (body) => {
    for (const [key, label, ph] of [
      ['armor', 'Armor', 'Light, medium, shields'],
      ['weapons', 'Weapons', 'Simple, martial, longsword'],
      ['tools', 'Tools', "Thieves' tools, smith's tools"],
      ['languages', 'Languages', 'Common, Elvish, Draconic']
    ]) {
      const f = el(`<div class="field"><label>${label}</label><textarea class="input" rows="2" placeholder="${ph}"></textarea></div>`);
      const ta = f.querySelector('textarea');
      ta.value = c.proficiencies[key] || '';
      ta.onchange = () => { c.proficiencies[key] = ta.value; saveChar(); };
      body.appendChild(f);
    }
  }, !!(c.proficiencies.armor || c.proficiencies.weapons || c.proficiencies.tools || c.proficiencies.languages));

  /* Physical description + senses. */
  section('Description', (body) => {
    const grid = el('<div class="dnd-desc-grid"></div>');
    const sizeF = el('<div class="field"><label>Size</label><select class="select"></select></div>');
    const sel = sizeF.querySelector('select');
    for (const s of SIZES) sel.appendChild(new Option(s, s));
    sel.value = c.appearance.size || 'Medium';
    sel.onchange = () => { c.appearance.size = sel.value; saveChar(); };
    grid.appendChild(sizeF);
    for (const [key, label] of [['age', 'Age'], ['height', 'Height'], ['weight', 'Weight'], ['eyes', 'Eyes'], ['skin', 'Skin'], ['hair', 'Hair'], ['faith', 'Faith']]) {
      const f = el(`<div class="field"><label>${label}</label><input class="input"></div>`);
      const i = f.querySelector('input');
      i.value = c.appearance[key] || '';
      i.onchange = () => { c.appearance[key] = i.value; saveChar(); };
      grid.appendChild(f);
    }
    body.appendChild(grid);
    const sf = el('<div class="field" style="margin-top:8px"><label>Senses (darkvision, etc.)</label><input class="input"></div>');
    const si = sf.querySelector('input');
    si.value = c.senses || '';
    si.onchange = () => { c.senses = si.value; saveChar(); };
    body.appendChild(sf);
  }, !!(c.appearance.age || c.appearance.height || c.senses));

  section('Faction reputation', (body) => {
    const list = el('<div></div>');
    body.appendChild(list);
    const render = () => {
      list.innerHTML = '';
      for (const rep of c.reputations) {
        const row = el(`<div class="list-item" style="cursor:default"><span class="li-main"><span class="li-title"></span></span>
          <button class="btn-icon" title="Lower">${icon('minus', 13)}</button><b style="min-width:28px;text-align:center"></b><button class="btn-icon" title="Raise">${icon('plus', 13)}</button>
          <button class="btn-icon" title="Remove">${icon('x', 13)}</button></div>`);
        row.querySelector('.li-title').textContent = rep.name;
        row.querySelector('b').textContent = rep.value;
        const [minus, , plus, x] = row.querySelectorAll('button');
        minus.onclick = () => { rep.value--; saveChar(); render(); };
        plus.onclick = () => { rep.value++; saveChar(); render(); };
        x.onclick = () => { c.reputations.splice(c.reputations.indexOf(rep), 1); saveChar(); render(); };
        list.appendChild(row);
      }
      const addRow = el(`<div class="row" style="gap:6px;margin-top:6px"><input class="input grow" placeholder="Faction or person"><button class="btn">${icon('plus', 14)}</button></div>`);
      const [input, btn] = addRow.children;
      btn.onclick = () => {
        if (!input.value.trim()) return;
        c.reputations.push({ name: input.value.trim(), value: 0 });
        saveChar();
        render();
      };
      addRow.querySelector('input').onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
      list.appendChild(addRow);
    };
    render();
  }, !!c.reputations.length);

  section('Level-up log', (body) => {
    if (!c.levelLog.length) body.appendChild(el('<p class="soft" style="font-size:0.82rem">Level-ups recorded in the Level Planner appear here.</p>'));
    for (const entry of [...c.levelLog].reverse()) {
      const row = el(`<div class="list-item" style="cursor:default"><span class="chip">Lv ${entry.level}</span><span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span></div>`);
      row.querySelector('.li-title').textContent = entry.note || 'Leveled up';
      row.querySelector('.li-sub').textContent = entry.date || '';
      body.appendChild(row);
    }
  }, !!c.levelLog.length);

  host.appendChild(el('<p class="soft" style="font-size:0.76rem;margin-top:8px">Backstory lives best in a Notes widget beside this card; session memories in a Journal.</p>'));
}
