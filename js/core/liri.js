/* Liri — the soul-bonded companion (docs/17 §4, Transfer Pack §9 LOCKED). Pure state + logic,
   no DOM. One persistent record in synced `meta.liri`. Liri is a *living portrait* of the five
   aspects: it READS the growth ledger (js/core/growth.js) and derives its look — Physical → size,
   Mental → abilities, Emotional → backgrounds/colour depth, Social → outfits, Recreation → liveliness.
   Element is fixed (set by the 15-q quiz); the sub-element evolves with your most-levelled aspect
   and locks; forms are swappable until a cap, then permanent. (Cosmos-tier overrides come in §8.) */

import { store } from './store.js';
import { events } from './events.js';
import { xpToNext } from '../widgets/skill.js';
import { allAspectLevels } from './growth.js';
import { ELEMENTS, FORMS, formById, SUBELEMENT_BY_ASPECT } from '../presets/liri-content.js';

const KEY = 'liri';
export const FORM_CAP_LEVEL = 50;   // total aspect-levels at which the form locks permanently
export const SUB_LOCK_LEVEL = 30;   // …at which the sub-element locks
const FOOD_COST = 10, TOY_COST = 25; // copper

/** Which of an element's 4 sub-elements a dominant aspect points to. */
const SUB_INDEX = { mental: 0, physical: 1, emotional: 2, social: 2, recreation: 3 };

function blank() {
  return {
    element: null, subElement: null, subLocked: false,
    form: 'flying-fox', formLocked: false, name: 'Liri',
    bond: { level: 1, xp: 0 },
    hunger: 1, lastFed: null,
    moodLog: [], journal: [], milestones: [],
    inventory: { toys: 0 }, createdAt: Date.now()
  };
}

export function getLiri() {
  const l = store.getMeta(KEY, null);
  return l && typeof l === 'object' ? { ...blank(), ...l, bond: { ...blank().bond, ...(l.bond || {}) }, inventory: { ...blank().inventory, ...(l.inventory || {}) } } : blank();
}
function save(l) { store.setMeta(KEY, l); events.emit('liri:changed', {}); }

export function isDiscovered() { return !!getLiri().element; }

/* ---- discovery (the quiz sets the fixed element + a starting form) ---- */
export function discover(element, formId) {
  if (!ELEMENTS[element]) return;
  const l = getLiri();
  l.element = element;
  l.form = formById(formId).id;
  l.discoveredAt = Date.now();
  save(l);
}
/** Re-discover (gentle ceremony / Cosmos): change the fixed element. */
export function setElement(element) { if (!ELEMENTS[element]) return; const l = getLiri(); l.element = element; save(l); }

/** Swap the physical form — allowed until the cap level, then permanent. */
export function setForm(formId) {
  const l = getLiri();
  if (l.formLocked) return false;
  l.form = formById(formId).id; save(l); return true;
}

/* ---- the living portrait: appearance derived from the growth ledger ---- */

const norm = (lvl, full = 12) => Math.max(0, Math.min(1, lvl / full));

/**
 * Liri's current look, derived from aspects + the saved element/form.
 * @returns {{element, form, name, sub, subLocked, totalLevel, formLocked,
 *   size, abilities, colorDepth, adornment, liveliness, aspects, color, deep}}
 */
export function liriAppearance() {
  const l = getLiri();
  const levels = Object.fromEntries(allAspectLevels().map(a => [a.id, a.level]));
  const lv = (id) => levels[id] || 1;
  const total = Object.values(levels).reduce((s, n) => s + n, 0);

  // sub-element follows the most-levelled aspect until it locks (persisted by maybeEvolve)
  const el = ELEMENTS[l.element] || ELEMENTS.air;
  let sub = l.subElement;
  if (!l.subLocked && l.element) {
    const dom = allAspectLevels().slice().sort((a, b) => b.level - a.level)[0];
    sub = el.subs[SUB_INDEX[dom.id] ?? 0];
  }

  return {
    element: l.element, form: l.form, name: l.name,
    color: el.color, deep: el.deep,
    sub, subLocked: l.subLocked, totalLevel: total,
    formLocked: l.formLocked || total >= FORM_CAP_LEVEL,
    size: 0.35 + 0.65 * norm(lv('physical')),       // Physical → size
    abilities: Math.floor(lv('mental') / 4),          // Mental → abilities (count)
    colorDepth: norm(lv('emotional')),                // Emotional → colour depth / backgrounds
    adornment: Math.floor(lv('social') / 4),          // Social → outfits (count)
    liveliness: norm(lv('recreation')),               // Recreation → Liri-Life sparkle
    aspects: allAspectLevels()
  };
}

/** Persist sub-element evolution + form/sub locks once thresholds are crossed (call on growth changes). */
export function maybeEvolve() {
  const l = getLiri();
  if (!l.element) return;
  const aspects = allAspectLevels();
  const total = aspects.reduce((s, a) => s + a.level, 0);
  const el = ELEMENTS[l.element];
  let changed = false;
  if (!l.subLocked) {
    const dom = aspects.slice().sort((a, b) => b.level - a.level)[0];
    const next = el.subs[SUB_INDEX[dom.id] ?? 0];
    if (next !== l.subElement) { l.subElement = next; changed = true; }
    if (total >= SUB_LOCK_LEVEL) { l.subLocked = true; changed = true; }
  }
  if (!l.formLocked && total >= FORM_CAP_LEVEL) { l.formLocked = true; changed = true; }
  if (changed) save(l);
}

/* ---- bond, care, mood, journal (Liri Life) ---- */

export function bondPct() { const b = getLiri().bond; return Math.min(1, b.xp / xpToNext(b.level)); }
export function addBond(xp) {
  if (!xp) return null;
  const l = getLiri(); const b = l.bond;
  b.xp += xp; let leveled = 0;
  while (b.xp >= xpToNext(b.level)) { b.xp -= xpToNext(b.level); b.level++; leveled++; }
  save(l); return { level: b.level, leveled };
}

/** Has Liri been fed today? (gentle, never punishing — just a nudge.) */
export function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function isFedToday() { return getLiri().lastFed === todayStr(); }

/** Feed Liri with coins → fills hunger + a little bond. @returns {boolean} false if too few coins. */
export function feed(wallet) {
  if (!wallet.spend(FOOD_COST)) return false;
  const l = getLiri(); l.hunger = 1; l.lastFed = todayStr(); save(l);
  addBond(6); return true;
}
/** Play with Liri → bond + a brighter mood. Free, once-a-day big beat handled by caller. */
export function play() { addBond(4); return true; }
/** Buy a toy with coins. */
export function buyToy(wallet) {
  if (!wallet.spend(TOY_COST)) return false;
  const l = getLiri(); l.inventory.toys = (l.inventory.toys || 0) + 1; save(l);
  addBond(8); return true;
}
export const COSTS = { food: FOOD_COST, toy: TOY_COST };

export function setMood(score) {
  const l = getLiri(); const today = todayStr();
  l.moodLog = (l.moodLog || []).filter(m => m.date !== today).concat({ date: today, score });
  l.moodLog = l.moodLog.slice(-60); save(l);
}
export function recentMood() { const log = getLiri().moodLog || []; return log.length ? log[log.length - 1].score : null; }

export function addJournal(text) {
  const t = (text || '').trim(); if (!t) return;
  const l = getLiri(); l.journal = [{ date: todayStr(), text: t, at: Date.now() }, ...(l.journal || [])].slice(0, 100); save(l);
}
export function renameLiri(name) { const l = getLiri(); l.name = (name || '').trim() || 'Liri'; save(l); }

let bonded = false;
/** Keep Liri's evolution + bond in step with real growth. Safe to call once at startup. */
export function initLiri() {
  if (bonded) return; bonded = true;
  events.on('growth:changed', () => { addBond(2); maybeEvolve(); }); // living anything nudges the bond
}
