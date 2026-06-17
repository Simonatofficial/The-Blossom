/* CharacterSheet widget (docs/08 §4): one character, three faces — the
   widget's config.section picks which page-face it renders: 'sheet'
   (abilities/saves/skills/passives, play vs edit mode), 'combat'
   (HP/death saves/attacks/resources/rests — dndcombat.js), or 'story'
   (personality cards, faction reputation, level log). Everything tappable
   in play mode rolls with a result toast. The 'sheet' instance anchors all
   character data, so one widget Blossom code exports the whole character. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, popMenu, seg, toast, promptText, confirmDialog } from '../ui/components.js';
import { ABILITIES, SKILLS, XP_LEVELS, mod, fmtMod, profBonus, skillBonus, saveBonus, getCharacter, saveCharacter, rollD20, listCharacters, setActiveCharacter, createCharacter } from './dnd-shared.js';
import { renderCombat } from './dndcombat.js';
import { renderStory } from './dndstory.js';
import { getStamp, openStampPicker } from './wb-stamps.js';
import { openCharacterCreator } from './character-creator.js';

registry.register({
  type: 'charsheet',
  name: 'Character Sheet',
  icon: 'shield',
  description: 'A 5e-style character — tap anything to roll it',
  keywords: ['dnd', 'd&d', 'character', 'sheet', 'rpg', 'stats'],
  external: true, internal: true,
  defaultConfig: () => ({ section: 'sheet', playMode: true }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const { c } = getCharacter(widget);
    const card = el(`<div>
      <div class="row" style="gap:10px"><span class="wc-portrait dnd-card-portrait"></span>
        <div class="grow"><div style="font-weight:650"></div><div class="soft" style="font-size:0.8rem"></div></div>
        <span class="chip" title="Armor class">${icon('shield', 12)} <b class="dnd-ac"></b></span></div>
      <div class="hp-bar" style="margin-top:10px"><i></i></div>
      <div class="soft" style="font-size:0.78rem;margin-top:4px;text-align:center"></div></div>`);
    const s = c.stampId && getStamp(c.stampId);
    const port = card.querySelector('.wc-portrait');
    if (s) { port.innerHTML = '<img alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">'; port.querySelector('img').src = s.img; }
    else port.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
    card.querySelector('[style*="weight:650"]').textContent = c.name;
    card.querySelector('.soft').textContent = [c.cls && `${c.cls} ${c.level}`, c.race].filter(Boolean).join(' · ') || `Level ${c.level}`;
    card.querySelector('.dnd-ac').textContent = c.ac;
    card.querySelector('.hp-bar i').style.width = `${Math.max(0, Math.min(100, (c.hp.cur / Math.max(1, c.hp.max)) * 100))}%`;
    card.querySelector('div.soft[style*="text-align"]').textContent = `${c.hp.cur}/${c.hp.max} HP${c.hp.temp ? ` +${c.hp.temp} temp` : ''}`;
    host.appendChild(card);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const env = { widget, ctx, render: () => this.renderFull(host, widget, ctx) };
    const section = widget.config.section || 'sheet';
    if (section === 'combat') return renderCombat(host, env);
    if (section === 'story') return renderStory(host, env);
    renderSheet(host, env);
  },

  renderSettings(host, widget) {
    const wrap = el('<div class="field"><label>This card shows</label></div>');
    wrap.appendChild(seg([
      { value: 'sheet', label: 'Sheet' }, { value: 'combat', label: 'Combat' }, { value: 'story', label: 'Story' }
    ], widget.config.section || 'sheet', (v) => { widget.config.section = v; store.put('widgets', widget); }));
    host.appendChild(wrap);
    host.appendChild(el('<p class="soft" style="font-size:0.8rem">All faces share one character. The Sheet face holds the data — copy ITS widget code to hand the whole character to a DM.</p>'));
  }
});

/* ---------- the Sheet face ---------- */

export function renderSheet(host, env) {
  const { widget } = env;
  const { owner, obj, c } = getCharacter(widget);
  const play = widget.config.playMode !== false;
  const save = () => saveCharacter(obj);
  const rerender = () => env.render();

  // header: portrait · identity · play/edit · menu
  const head = el(`<div class="row" style="gap:10px;margin-bottom:10px;align-items:flex-start">
    <button class="wc-portrait dnd-portrait" title="Portrait"></button>
    <div class="grow dnd-identity"></div>
    <button class="btn dnd-mode" style="font-size:0.78rem;padding:4px 10px"></button>
    <button class="btn-icon" title="More">${icon('more', 16)}</button></div>`);
  const port = head.querySelector('.dnd-portrait');
  const drawPort = () => {
    const s = c.stampId && getStamp(c.stampId);
    if (s) { port.innerHTML = '<img alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">'; port.querySelector('img').src = s.img; }
    else port.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
  };
  drawPort();
  port.onclick = (e) => openStampPicker(e.currentTarget, { title: 'Portrait', onPick: (s) => { c.stampId = s.id; save(); drawPort(); } });

  const idBox = head.querySelector('.dnd-identity');
  if (play) {
    idBox.innerHTML = '<div style="font-weight:650;font-size:1.05rem"></div><div class="soft" style="font-size:0.82rem"></div>';
    idBox.firstChild.textContent = c.name;
    idBox.lastChild.textContent = [c.cls && `${c.cls}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`, c.race, c.background, c.alignment].filter(Boolean).join(' · ') || `Level ${c.level}`;
  } else {
    idBox.innerHTML = '<input class="input" style="font-weight:650"><div class="row" style="gap:4px;margin-top:4px;flex-wrap:wrap"></div>';
    const nameIn = idBox.querySelector('input');
    nameIn.value = c.name;
    nameIn.onchange = () => { c.name = nameIn.value.trim() || 'Unnamed'; save(); };
    const row = idBox.querySelector('.row');
    for (const [key, ph, w] of [['cls', 'Class', 90], ['subclass', 'Subclass', 100], ['level', 'Lv', 48], ['race', 'Race', 90], ['background', 'Background', 110], ['alignment', 'Alignment', 90]]) {
      const i = el(`<input class="input" placeholder="${ph}" style="width:${w}px;padding:4px 8px;font-size:0.8rem"${key === 'level' ? ' type="number" min="1" max="20"' : ''}>`);
      i.value = c[key] || (key === 'level' ? 1 : '');
      i.onchange = () => { c[key] = key === 'level' ? Math.max(1, Math.min(20, Number(i.value) || 1)) : i.value.trim(); save(); rerender(); };
      row.appendChild(i);
    }
    // guided setup launches the step-by-step Character Creator
    const guide = el(`<button class="btn" style="font-size:0.78rem;padding:4px 10px;margin-top:6px">${icon('sparkles', 13)} Guided setup</button>`);
    guide.onclick = () => openCharacterCreator({ widget, onDone: rerender });
    idBox.appendChild(guide);
  }
  const modeBtn = head.querySelector('.dnd-mode');
  modeBtn.textContent = play ? 'Edit' : 'Done';
  modeBtn.onclick = () => { widget.config.playMode = !play; store.put('widgets', widget); rerender(); };
  head.querySelector('[title="More"]').onclick = (e) => {
    const roster = listCharacters(widget);
    const items = [];
    // switch between saved characters (all linked widgets follow the active one)
    for (const ch of roster) {
      const active = ch.id === obj.id;
      items.push({ label: `${active ? '✓ ' : ''}${ch.data.name || 'Unnamed'}`, iconName: 'shield', fn: () => { if (!active) { setActiveCharacter(widget, ch.id); rerender(); } } });
    }
    items.push('sep');
    items.push({ label: 'New character (guided)', iconName: 'sparkles', fn: () => openCharacterCreator({ widget, onDone: rerender }) });
    items.push({ label: 'New blank character', iconName: 'plus', fn: () => { createCharacter(widget); rerender(); } });
    items.push('sep');
    items.push({ label: 'Rename character', iconName: 'edit', fn: async () => {
      const name = await promptText({ title: 'Rename character', label: 'Name', value: c.name, confirmText: 'Save' });
      if (name) { c.name = name.trim() || c.name; save(); rerender(); }
    } });
    items.push({ label: 'Copy character code', iconName: 'code', fn: async () => {
      const { copyNodeCode } = await import('../ui/settings.js');
      copyNodeCode('wgt', owner.id, c.name); // the anchor carries everything
    } });
    if (roster.length > 1) items.push({ label: 'Delete this character', iconName: 'trash', danger: true, fn: async () => {
      if (await confirmDialog({ title: `Delete “${c.name}”?`, message: 'It rests in the trash for 30 days.' })) {
        store.trash('objects', obj.id);
        const left = listCharacters(widget).filter(x => x.id !== obj.id);
        setActiveCharacter(widget, left[0]?.id || null);
        toast('Character filed away', 'leaf');
        rerender();
      }
    } });
    popMenu(e.currentTarget, items);
  };
  host.appendChild(head);

  // AC · initiative · speed · proficiency — tap initiative to roll
  const tiles = el('<div class="dnd-tiles"></div>');
  const tile = (label, value, onTap = null, editKey = null) => {
    const t = el(`<button class="dnd-tile${onTap ? '' : ' static'}"><b></b><span>${label}</span></button>`);
    if (!play && editKey) {
      const i = el('<input class="input" type="number" style="width:54px;padding:2px 6px;text-align:center">');
      i.value = c[editKey];
      i.onchange = () => { c[editKey] = Number(i.value) || 0; save(); rerender(); };
      t.querySelector('b').replaceWith(i);
    } else t.querySelector('b').textContent = value;
    if (onTap && play) t.onclick = onTap;
    tiles.appendChild(t);
  };
  const init = mod(c.abilities.dex) + (c.initMisc || 0);
  tile('AC', c.ac, null, 'ac');
  tile('Initiative', fmtMod(init), () => rollD20(widget, 'Initiative', init));
  tile('Speed', c.speed, null, 'speed');
  tile('Proficiency', fmtMod(profBonus(c.level)));
  host.appendChild(tiles);

  // inspiration (tap to toggle) + experience points
  const meta = el('<div class="row" style="gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap"></div>');
  const insp = el(`<button class="chip${c.inspiration ? ' accent' : ''}">${icon('sparkles', 12)} Inspiration${c.inspiration ? ' ✓' : ''}</button>`);
  insp.onclick = () => { c.inspiration = !c.inspiration; save(); rerender(); };
  meta.appendChild(insp);
  if (play) {
    const next = XP_LEVELS[c.level]; // XP needed for the next level (levels are 1-based)
    const chip = el('<span class="chip"></span>');
    chip.textContent = next != null ? `${c.xp || 0} XP · ${Math.max(0, next - (c.xp || 0))} to Lv ${c.level + 1}` : `${c.xp || 0} XP`;
    meta.appendChild(chip);
  } else {
    const wrap = el('<span class="row" style="gap:5px;align-items:center"><span class="soft" style="font-size:0.8rem">XP</span><input class="input" type="number" min="0" style="width:96px;padding:2px 6px"></span>');
    const xi = wrap.querySelector('input');
    xi.value = c.xp || 0;
    xi.onchange = () => { c.xp = Math.max(0, Number(xi.value) || 0); save(); };
    meta.appendChild(wrap);
  }
  host.appendChild(meta);

  // abilities: score + big modifier (tap = ability check)
  const grid = el('<div class="dnd-abilities"></div>');
  for (const [key, label] of ABILITIES) {
    const m = mod(c.abilities[key]);
    const a = el(`<button class="dnd-ability"><span>${label.slice(0, 3).toUpperCase()}</span><b>${fmtMod(m)}</b><i></i></button>`);
    if (play) {
      a.querySelector('i').textContent = c.abilities[key];
      a.onclick = () => rollD20(widget, `${label} check`, m);
    } else {
      const i = el('<input class="input" type="number" min="1" max="30" style="width:50px;padding:2px 4px;text-align:center">');
      i.value = c.abilities[key];
      i.onchange = () => { c.abilities[key] = Math.max(1, Math.min(30, Number(i.value) || 10)); save(); rerender(); };
      a.querySelector('i').appendChild(i);
    }
    grid.appendChild(a);
  }
  host.appendChild(grid);

  // saving throws: tap to roll (play) · tap to toggle proficiency (edit)
  const saves = el('<div class="row" style="flex-wrap:wrap;gap:5px;margin:10px 0"></div>');
  saves.appendChild(el('<span class="soft" style="font-size:0.8rem;align-self:center">Saves</span>'));
  for (const [key, label] of ABILITIES) {
    const prof = c.saveProfs.includes(key);
    const chip = el(`<button class="chip${prof ? ' accent' : ''}">${label.slice(0, 3)} ${fmtMod(saveBonus(c, key))}</button>`);
    chip.onclick = () => {
      if (play) return rollD20(widget, `${label} save`, saveBonus(c, key));
      c.saveProfs = prof ? c.saveProfs.filter(s => s !== key) : [...c.saveProfs, key];
      save();
      rerender();
    };
    saves.appendChild(chip);
  }
  host.appendChild(saves);

  // skills: ○ none · ◐ proficient · ● expertise; tap row to roll
  const skills = el('<div class="dnd-skills"></div>');
  for (const [key, label, ab] of SKILLS) {
    const p = c.skillProfs[key] || 0;
    const row = el(`<button class="dnd-skill"><i>${p === 2 ? '●' : p === 1 ? '◐' : '○'}</i><span></span><em>${ab.toUpperCase()}</em><b>${fmtMod(skillBonus(c, key))}</b></button>`);
    row.querySelector('span').textContent = label;
    row.onclick = () => {
      if (play) return rollD20(widget, label, skillBonus(c, key));
      c.skillProfs[key] = (p + 1) % 3;
      save();
      rerender();
    };
    skills.appendChild(row);
  }
  host.appendChild(skills);

  // passive scores
  const passives = el('<div class="row" style="gap:5px;margin-top:10px;flex-wrap:wrap"></div>');
  for (const key of ['perception', 'investigation', 'insight']) {
    const [, label] = SKILLS.find(s => s[0] === key);
    passives.appendChild(el(`<span class="chip">Passive ${label} ${10 + skillBonus(c, key)}</span>`));
  }
  host.appendChild(passives);
  if (play) host.appendChild(el('<p class="soft" style="font-size:0.76rem;margin-top:8px">Tap any ability, save, or skill to roll it. Edit unlocks the numbers.</p>'));
}
