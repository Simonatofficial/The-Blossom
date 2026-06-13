/* SpellBook widget (docs/08 §4): spell objects with full 5e fields,
   level/prepared filters, per-level slot pips (tap to expend, rests
   restore), prepared count vs limit. Spells live under the module's anchor
   CharacterSheet so the character exports as one code. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, popMenu, openPanel, input } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { SCHOOLS, ABILITIES, fmtMod, spellSaveDC, spellAttackBonus, getCharacter, saveCharacter } from './dnd-shared.js';

const LV_NAME = (n) => n === 0 ? 'Cantrips' : `Level ${n}`;

registry.register({
  type: 'spellbook',
  name: 'Spell Book',
  icon: 'sparkles',
  description: 'Spells, slots, and what you have prepared',
  keywords: ['dnd', 'd&d', 'spells', 'magic', 'slots', 'rpg'],
  external: true, internal: true,
  defaultConfig: () => ({ filter: 'all' }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const { owner, c } = getCharacter(widget);
    const spells = objectsOf(owner.id, 'spell');
    const prepared = spells.filter(s => s.data.prepared).length;
    const slotsLeft = Object.values(c.slots).reduce((n, s) => n + Math.max(0, s.max - s.used), 0);
    host.appendChild(el(`<div><div style="font-size:1.4rem;font-weight:650">${spells.length}</div>
      <div class="soft" style="font-size:0.8rem">spell${spells.length === 1 ? '' : 's'} · ${prepared} prepared · ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left</div></div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const { owner, obj, c } = getCharacter(widget);
    const cfg = widget.config;
    const spells = () => objectsOf(owner.id, 'spell');
    const saveChar = () => saveCharacter(obj);

    /* ---- spellcasting ability · save DC · spell attack bonus (5e) ---- */
    const castHead = el(`<div class="dnd-box" style="margin-bottom:10px"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
      <span class="soft" style="font-size:0.74rem;text-transform:uppercase;letter-spacing:0.05em">Spellcasting</span>
      <select class="select cast-ab" style="padding:4px 8px;width:auto"></select>
      <span class="chip">Save DC <b class="cast-dc"></b></span>
      <span class="chip">Spell atk <b class="cast-atk"></b></span></div></div>`);
    const abSel = castHead.querySelector('.cast-ab');
    abSel.appendChild(new Option('No ability', ''));
    for (const [key, label] of ABILITIES) abSel.appendChild(new Option(label, key));
    abSel.value = c.spellAbility || '';
    const drawCast = () => {
      const dc = spellSaveDC(c), atk = spellAttackBonus(c);
      castHead.querySelector('.cast-dc').textContent = dc != null ? dc : '—';
      castHead.querySelector('.cast-atk').textContent = atk != null ? fmtMod(atk) : '—';
    };
    abSel.onchange = () => { c.spellAbility = abSel.value; saveChar(); drawCast(); };
    drawCast();
    host.appendChild(castHead);

    /* ---- slot pips per level (tap to expend / restore) ---- */
    const slotBox = el(`<div class="dnd-box" style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><span class="soft">Spell slots</span><button class="btn" style="font-size:0.74rem;padding:2px 9px">Set slots</button></div><div class="slot-rows"></div></div>`);
    const slotRows = slotBox.querySelector('.slot-rows');
    const drawSlots = () => {
      slotRows.innerHTML = '';
      const levels = Object.keys(c.slots).map(Number).filter(l => c.slots[l].max > 0).sort((a, b) => a - b);
      if (!levels.length) slotRows.appendChild(el('<p class="soft" style="font-size:0.8rem;margin:4px 0">No slots yet — “Set slots” to match your class table.</p>'));
      for (const lv of levels) {
        const s = c.slots[lv];
        const row = el(`<div class="row" style="gap:8px;align-items:center;padding:3px 0"><span class="chip">L${lv}</span><span class="dnd-pips"></span></div>`);
        const pips = row.querySelector('.dnd-pips');
        for (let i = 0; i < s.max; i++) {
          const p = el(`<button class="pip${i < s.max - s.used ? ' on' : ''}"></button>`);
          p.onclick = () => { const left = s.max - s.used; s.used = i < left ? s.max - i : s.max - i - 1; saveChar(); drawSlots(); };
          pips.appendChild(p);
        }
        slotRows.appendChild(row);
      }
    };
    slotBox.querySelector('button').onclick = () => {
      const d = openPanel({ title: 'Spell slots per level', iconName: 'sparkles' });
      for (let lv = 1; lv <= 9; lv++) {
        const row = el(`<div class="ic-frow"><span>Level ${lv}</span><input class="input" type="number" min="0" max="6" style="width:64px;padding:4px 8px"></div>`);
        const i = row.querySelector('input');
        i.value = c.slots[lv]?.max || 0;
        i.onchange = () => {
          const max = Math.max(0, Math.min(6, Number(i.value) || 0));
          c.slots[lv] = { max, used: Math.min(c.slots[lv]?.used || 0, max) };
          saveChar();
          drawSlots();
        };
        d.body.appendChild(row);
      }
    };
    drawSlots();
    host.appendChild(slotBox);

    /* ---- prepared count + filters ---- */
    const bar = el(`<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <span class="chip prep-count"></span>
      <span class="soft" style="font-size:0.78rem">limit</span><input class="input prep-lim" type="number" style="width:52px;padding:2px 6px">
      <span class="grow"></span><button class="btn btn-primary" style="font-size:0.8rem;padding:4px 11px">${icon('plus', 13)} Spell</button></div>`);
    const limIn = bar.querySelector('.prep-lim');
    limIn.value = c.preparedLimit || 0;
    limIn.onchange = () => { c.preparedLimit = Math.max(0, Number(limIn.value) || 0); saveChar(); drawList(); };
    bar.querySelector('.btn-primary').onclick = () => editSpell();
    host.appendChild(bar);

    const filters = el('<div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px"></div>');
    host.appendChild(filters);
    const list = el('<div></div>');
    host.appendChild(list);

    const drawFilters = () => {
      filters.innerHTML = '';
      const levels = [...new Set(spells().map(s => s.data.level))].sort((a, b) => a - b);
      const chips = [['all', 'All'], ['prep', 'Prepared'], ...levels.map(l => [String(l), l === 0 ? 'Cantrips' : `L${l}`])];
      for (const [val, label] of chips) {
        const b = el(`<button class="chip${cfg.filter === val ? ' accent' : ''}">${label}</button>`);
        b.onclick = () => { cfg.filter = val; store.put('widgets', widget); drawFilters(); drawList(); };
        filters.appendChild(b);
      }
    };

    const castSpell = (sp) => {
      const lv = sp.data.level;
      if (lv === 0) return toast(`${sp.data.name} — cantrips are free.`, 'sparkles');
      const slot = c.slots[lv];
      if (!slot || slot.used >= slot.max) return toast(`No level-${lv} slots left.`, 'sparkles');
      slot.used++;
      saveChar();
      drawSlots();
      toast(`${sp.data.name} cast — level-${lv} slot spent (${slot.max - slot.used} left).`, 'sparkles');
    };

    const drawList = () => {
      list.innerHTML = '';
      const prepared = spells().filter(s => s.data.prepared).length;
      bar.querySelector('.prep-count').textContent = `${prepared}${c.preparedLimit ? ` / ${c.preparedLimit}` : ''} prepared`;
      bar.querySelector('.prep-count').classList.toggle('accent', !!c.preparedLimit && prepared > c.preparedLimit);
      let shown = spells();
      if (cfg.filter === 'prep') shown = shown.filter(s => s.data.prepared);
      else if (cfg.filter !== 'all') shown = shown.filter(s => s.data.level === Number(cfg.filter));
      if (!shown.length) list.appendChild(el('<div class="empty-state">' + icon('sparkles', 26) + '<p>No spells here yet — scribe the first one.</p></div>'));
      const byLevel = new Map();
      for (const s of shown.sort((a, b) => a.data.level - b.data.level || a.data.name.localeCompare(b.data.name))) {
        if (!byLevel.has(s.data.level)) byLevel.set(s.data.level, []);
        byLevel.get(s.data.level).push(s);
      }
      for (const [lv, group] of byLevel) {
        list.appendChild(el(`<div class="soft" style="font-size:0.78rem;font-weight:600;margin:8px 0 2px">${LV_NAME(lv)}</div>`));
        for (const sp of group) {
          const row = el(`<div class="list-item" style="cursor:pointer;flex-wrap:wrap">
            <button class="btn-icon sp-prep" title="Prepared">${icon('star', 14)}</button>
            <span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>
            <button class="chip" title="Cast (spend a slot)">Cast</button>
            <button class="btn-icon" title="More">${icon('more', 13)}</button>
            <div class="sp-detail" style="display:none;width:100%"></div></div>`);
          row.querySelector('.li-title').textContent = sp.data.name + (sp.data.ritual ? ' (R)' : '') + (sp.data.concentration ? ' (C)' : '');
          row.querySelector('.li-sub').textContent = [sp.data.school, sp.data.time, sp.data.range,
            sp.data.concentration && 'Concentration', sp.data.ritual && 'Ritual'].filter(Boolean).join(' · ');
          const prepBtn = row.querySelector('.sp-prep');
          prepBtn.style.color = sp.data.prepared ? 'var(--accent)' : 'var(--text-soft)';
          prepBtn.onclick = (e) => { e.stopPropagation(); sp.data.prepared = !sp.data.prepared; saveObject(sp); drawList(); };
          row.querySelector('.chip').onclick = (e) => { e.stopPropagation(); castSpell(sp); };
          row.querySelector('[title="More"]').onclick = (e) => {
            e.stopPropagation();
            popMenu(e.currentTarget, [
              { label: 'Edit', iconName: 'edit', fn: () => editSpell(sp) },
              { label: 'Remove', iconName: 'trash', danger: true, fn: () => { store.del('objects', sp.id); drawFilters(); drawList(); } }
            ]);
          };
          const detail = row.querySelector('.sp-detail');
          row.onclick = () => {
            const open = detail.style.display !== 'none';
            detail.style.display = open ? 'none' : '';
            if (!open) {
              detail.innerHTML = '<p class="soft" style="font-size:0.8rem;margin:6px 0 2px"></p><p style="font-size:0.86rem;white-space:pre-wrap"></p>';
              detail.firstChild.textContent = [sp.data.comps && `Components ${sp.data.comps}`, sp.data.duration && `Duration ${sp.data.duration}`].filter(Boolean).join(' · ');
              detail.lastChild.textContent = sp.data.text || '';
            }
          };
          list.appendChild(row);
        }
      }
    };

    const editSpell = (sp = null) => {
      const d = openPanel({ title: sp ? 'Edit spell' : 'New spell', iconName: 'sparkles' });
      const f = (ph, val = '') => { const i = input(val, ph); i.style.marginTop = '8px'; return i; };
      const name = input(sp?.data.name || '', 'Spell name');
      const lvl = el('<input class="input" type="number" min="0" max="9" placeholder="Level (0 = cantrip)" style="margin-top:8px">');
      lvl.value = sp ? sp.data.level : '';
      const school = el('<select class="select" style="margin-top:8px"></select>');
      school.appendChild(new Option('School…', ''));
      for (const s of SCHOOLS) school.appendChild(new Option(s, s));
      school.value = sp?.data.school || '';
      const time = f('Casting time (1 action)', sp?.data.time);
      const range = f('Range (60 ft)', sp?.data.range);
      const comps = f('Components (V, S, M)', sp?.data.comps);
      const duration = f('Duration (1 minute)', sp?.data.duration);
      const flags = el(`<div class="row" style="gap:18px;margin-top:8px"><label class="row" style="gap:6px;align-items:center;font-size:0.86rem"><input type="checkbox" class="sp-conc"> Concentration</label><label class="row" style="gap:6px;align-items:center;font-size:0.86rem"><input type="checkbox" class="sp-rit"> Ritual</label></div>`);
      flags.querySelector('.sp-conc').checked = !!sp?.data.concentration;
      flags.querySelector('.sp-rit').checked = !!sp?.data.ritual;
      const text = el('<textarea class="input" rows="5" placeholder="What it does…" style="margin-top:8px"></textarea>');
      text.value = sp?.data.text || '';
      const ok = el('<button class="btn btn-primary" style="width:100%;margin-top:12px">Save</button>');
      ok.onclick = () => {
        if (!name.value.trim()) return;
        const data = {
          name: name.value.trim(), level: Math.max(0, Math.min(9, Number(lvl.value) || 0)),
          school: school.value, time: time.value.trim(), range: range.value.trim(),
          comps: comps.value.trim(), duration: duration.value.trim(), text: text.value,
          concentration: flags.querySelector('.sp-conc').checked, ritual: flags.querySelector('.sp-rit').checked,
          prepared: sp?.data.prepared || false
        };
        if (sp) { sp.data = data; saveObject(sp); }
        else createObject(owner.id, 'spell', data);
        d.close();
        drawFilters();
        drawList();
      };
      d.body.append(name, lvl, school, time, range, comps, duration, flags, ok);
      d.body.insertBefore(text, ok);
      setTimeout(() => name.focus(), 150);
    };

    drawFilters();
    drawList();
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Slots and prepared limit follow your class table — set them once, rests restore them. Casting a spell spends a slot of its level.</p>'));
  }
});
