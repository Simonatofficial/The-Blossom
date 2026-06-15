/* PC Sheet widget (docs/08 §3 — DM Players page): import a player's D&D
   Character Blossom code (a 'wgt' export) and view their COMPLETE sheet on the
   DM's table. Self-contained (config.selfContained) so each imported PC owns
   its own data — a party of many PCs never collides on a shared anchor. The
   full view reuses the exact player-side faces (sheet / combat / spells /
   inventory / story+features) so what the DM sees matches the player's sheet. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { ulid } from '../core/ids.js';
import { icon } from '../ui/icons.js';
import { el, toast, promptText, confirmDialog } from '../ui/components.js';
import { objectsOf } from './base.js';
import { getCharacter } from './dnd-shared.js';
import { renderSheet } from './dndsheet.js';
import { renderCombat } from './dndcombat.js';
import { renderStory } from './dndstory.js';
import { getStamp } from './wb-stamps.js';
import { decode } from '../core/codes.js';

const hasCharacter = (widget) => objectsOf(widget.id, 'character').length > 0;

function setPortrait(span, c) {
  const s = c.stampId && getStamp(c.stampId);
  if (s) { span.innerHTML = '<img alt="" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">'; span.querySelector('img').src = s.img; }
  else span.textContent = (c.name || '?').trim().charAt(0).toUpperCase() || '?';
}

/** Pull a character out of a pasted 'wgt' code and reparent its objects here. */
async function importCharacter(widget, onDone) {
  const code = await promptText({ title: 'Import a character', label: 'Paste the player’s character Blossom code', confirmText: 'Import' });
  if (!code) return;
  let decoded;
  try { decoded = await decode(code); } catch { return toast('That doesn’t look like a Blossom code.', 'info'); }
  if (decoded.type !== 'wgt') return toast('That code isn’t a character (expected a Sheet widget code).', 'info');
  const objs = (decoded.payload.children || []).filter(r => r._s === 'objects' && ['character', 'item', 'spell'].includes(r.kind));
  const charObj = objs.find(o => o.kind === 'character');
  if (!charObj) return toast('No character data found in that code.', 'info');
  if (hasCharacter(widget) && !await confirmDialog({ title: 'Replace this character?', message: 'The current imported sheet will be overwritten.', confirmText: 'Replace' })) return;
  for (const o of objectsOf(widget.id)) store.del('objects', o.id); // clear the slot
  for (const o of objs) {
    store.put('objects', { id: ulid(), widgetId: widget.id, kind: o.kind, date: o.date || null, data: structuredClone(o.data) });
  }
  widget.name = charObj.data?.name || 'Player character';
  store.put('widgets', widget);
  toast(`${widget.name} imported`, 'shield');
  onDone();
}

registry.register({
  type: 'pcsheet',
  name: 'PC Sheet',
  icon: 'shield',
  description: 'Import a player’s character code and see their full sheet',
  keywords: ['dnd', 'd&d', 'pc', 'player', 'character', 'import', 'sheet', 'dm'],
  external: true, internal: true,
  defaultConfig: () => ({ selfContained: true, playMode: true, filter: 'all' }),

  renderCard(host, widget) {
    host.innerHTML = '';
    if (!hasCharacter(widget)) {
      host.appendChild(el(`<div class="soft" style="font-size:0.84rem">${icon('shield', 14)} No character yet — open to import a player’s code.</div>`));
      return;
    }
    const { c } = getCharacter(widget);
    const card = el(`<div>
      <div class="row" style="gap:10px"><span class="wc-portrait dnd-card-portrait"></span>
        <div class="grow"><div style="font-weight:650"></div><div class="soft" style="font-size:0.8rem"></div></div>
        <span class="chip" title="Armor class">${icon('shield', 12)} <b class="dnd-ac"></b></span></div>
      <div class="hp-bar" style="margin-top:10px"><i></i></div>
      <div class="soft" style="font-size:0.78rem;margin-top:4px;text-align:center"></div></div>`);
    setPortrait(card.querySelector('.wc-portrait'), c);
    card.querySelector('[style*="weight:650"]').textContent = c.name;
    card.querySelector('.soft').textContent = [c.cls && `${c.cls}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`, c.race].filter(Boolean).join(' · ') || `Level ${c.level}`;
    card.querySelector('.dnd-ac').textContent = c.ac;
    card.querySelector('.hp-bar i').style.width = `${Math.max(0, Math.min(100, (c.hp.cur / Math.max(1, c.hp.max)) * 100))}%`;
    card.querySelector('div.soft[style*="text-align"]').textContent = `${c.hp.cur}/${c.hp.max} HP${c.hp.temp ? ` +${c.hp.temp} temp` : ''}`;
    host.appendChild(card);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const rerender = () => this.renderFull(host, widget, ctx);

    if (!hasCharacter(widget)) {
      const empty = el(`<div class="empty-state">${icon('shield', 30)}<p>Import a player’s character to see their full sheet here — they copy their character code from the Sheet page (⋯ → Copy character code) and paste it in.</p></div>`);
      const row = el('<div class="row" style="gap:8px;justify-content:center;margin-top:4px"></div>');
      const imp = el(`<button class="btn btn-primary">${icon('download', 15)} Import a code</button>`);
      imp.onclick = () => importCharacter(widget, rerender);
      const blank = el('<button class="btn">Start a blank sheet</button>');
      blank.onclick = () => { getCharacter(widget); store.put('widgets', widget); rerender(); }; // getCharacter lazily creates one
      row.append(imp, blank);
      empty.appendChild(row);
      host.appendChild(empty);
      return;
    }

    const { c } = getCharacter(widget);

    // header: portrait · identity · import/replace
    const head = el(`<div class="row" style="gap:10px;margin-bottom:10px;align-items:center">
      <span class="wc-portrait dnd-portrait" style="cursor:default"></span>
      <div class="grow"><div style="font-weight:650;font-size:1.05rem"></div><div class="soft" style="font-size:0.82rem"></div></div>
      <button class="btn" style="font-size:0.78rem;padding:4px 10px">${icon('refresh', 13)} Replace</button></div>`);
    setPortrait(head.querySelector('.wc-portrait'), c);
    head.querySelector('[style*="weight:650"]').textContent = c.name;
    head.querySelector('.soft').textContent = [c.cls && `${c.cls}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`, c.race, c.background, c.alignment].filter(Boolean).join(' · ') || `Level ${c.level}`;
    head.querySelector('button').onclick = () => importCharacter(widget, rerender);
    host.appendChild(head);

    // each face in its own collapsible section, re-rendered in place so open
    // state survives interactions; all read the SAME self-contained character
    const section = (title, open, fill) => {
      const sec = el(`<details class="wb-sec" ${open ? 'open' : ''}><summary>${title}</summary><div class="wb-sec-body"></div></details>`);
      const body = sec.querySelector('.wb-sec-body');
      const env = { widget, ctx, render: () => { body.innerHTML = ''; fill(body, env); } };
      fill(body, env);
      host.appendChild(sec);
    };

    section('Abilities, saves & skills', true, (b, env) => renderSheet(b, env));
    section('Combat', false, (b, env) => renderCombat(b, env));
    if (objectsOf(widget.id, 'spell').length || c.spellAbility || Object.keys(c.slots || {}).length) {
      section('Spells', false, (b) => registry.get('spellbook').renderFull(b, widget, ctx));
    }
    section('Inventory', false, (b) => registry.get('dndinventory').renderFull(b, widget, ctx));
    section('Story & features', false, (b, env) => renderStory(b, env));
  },

  renderSettings(host) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Each PC Sheet holds one imported character. Add another PC Sheet widget for each player. Players export their code on the Character module’s Sheet page (⋯ menu → Copy character code).</p>'));
  }
});
