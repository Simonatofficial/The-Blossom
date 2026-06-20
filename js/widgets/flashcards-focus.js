/* Study focus (A3 + A4): the "What to work on" section at the top of the
   Flashcards view. Reads card mastery (study-mastery.js), aggregates it up the
   Class → Unit → Topic tree to surface weak areas, and offers smart, dynamic
   study sets ("Needs work" overall + per weak area) that reuse the normal study
   runtime. Quiet by design — nothing shows until you've actually studied. */

import { el } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import * as M from './flashcards-model.js';
import { masteryFor, struggle, level } from './study-mastery.js';
import { startStudy } from './flashcards-study.js';

/** Every real (non-auto) study-card under the widget, scope-tagged. */
function realCards(widget, all) {
  const out = [];
  for (const deck of all.filter(n => n.kind === 'deck' && !n.auto)) {
    for (const c of M.collectCards(widget, deck, all)) out.push(c);
  }
  return out;
}

/** Cards that need work: weak first, widened to shaky when too few to be useful. */
export function needsWorkCards(cards) {
  const weak = cards.filter(c => level(masteryFor(c.real)) === 'weak');
  if (weak.length >= 4) return weak;
  const shaky = cards.filter(c => level(masteryFor(c.real)) === 'shaky');
  return [...weak, ...shaky];
}

/** Ranked weak areas (nodes seen ≥ once, with room to grow, lowest recall first). */
function weakAreas(widget, all) {
  const stat = new Map();
  const bump = (node) => { let a = stat.get(node.id); if (!a) stat.set(node.id, a = { node, seen: 0, sum: 0, weak: 0 }); return a; };
  for (const deck of all.filter(n => n.kind === 'deck' && !n.auto)) {
    const unit = all.find(n => n.id === deck.parentId);
    const cls = unit && all.find(n => n.id === unit.parentId);
    const chain = [deck, unit, cls].filter(Boolean);
    for (const c of M.deckCards(widget, deck)) {
      const m = masteryFor(c.real), s = struggle(m);
      if (s < 0) continue; // unseen
      for (const node of chain) { const a = bump(node); a.seen++; a.sum += s; if (level(m) === 'weak') a.weak++; }
    }
  }
  return [...stat.values()]
    .filter(a => a.seen > 0)
    .map(a => ({ node: a.node, accuracy: 1 - a.sum / a.seen, weak: a.weak, seen: a.seen }))
    .filter(a => a.accuracy < 0.8)
    .sort((x, y) => x.accuracy - y.accuracy);
}

/** Append the Focus section to env.host, if there's anything worth surfacing. */
export function renderFocus(env, all) {
  const { widget, host } = env;
  const cards = realCards(widget, all);
  if (!cards.some(c => struggle(masteryFor(c.real)) >= 0)) return; // nothing studied yet

  const needs = needsWorkCards(cards);
  const areas = weakAreas(widget, all).slice(0, 4);
  if (!needs.length && !areas.length) return;

  host.appendChild(el('<h3 class="soft" style="font-size:0.74rem;letter-spacing:.05em;margin:2px 0 6px">FOCUS — WHAT TO WORK ON</h3>'));

  const studyRow = (iconName, color, title, sub, chip, getCards) => {
    const row = el(`<button class="list-item fc-set"><span style="color:${color}">${icon(iconName, 16)}</span><span class="li-main"><span class="li-title"></span><span class="li-sub"></span></span>${chip ? '<span class="chip"></span>' : ''}<span class="btn-icon set-go" title="Study">${icon('play', 15)}</span></button>`);
    row.querySelector('.li-title').textContent = title;
    row.querySelector('.li-sub').textContent = sub;
    if (chip) row.querySelector('.chip').textContent = chip;
    const go = () => { const cs = getCards(); if (cs.length) startStudy(env, { label: title, cards: cs.map(c => ({ ...c, result: undefined })) }); };
    row.querySelector('.set-go').onclick = (e) => { e.stopPropagation(); go(); };
    row.onclick = (e) => { if (e.target.closest('.btn-icon')) return; go(); };
    host.appendChild(row);
  };

  if (needs.length) {
    studyRow('target', 'var(--accent)', 'Needs work', `${needs.length} card${needs.length === 1 ? '' : 's'} you've missed lately`, '', () => needs);
  }
  for (const a of areas) {
    const kind = a.node.kind === 'deck' ? 'Topic' : 'Area';
    studyRow('flag', 'var(--warn)', a.node.name, `${Math.round(a.accuracy * 100)}% recall · ${a.weak} weak`, kind,
      () => { const w = needsWorkCards(M.collectCards(widget, a.node, all)); return w.length ? w : M.collectCards(widget, a.node, all); });
  }
}
