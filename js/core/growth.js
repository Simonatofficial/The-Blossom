/* The Blossom growth loop (docs/17 §3). A persistent ledger that turns real activity
   into aspect growth: tools emit contributions → attributes (petals) gain XP and level
   on the shared curve → the aspect levels as the mean of its petals → Liri reads it.

   PURE STATE + LOGIC. No DOM. The ledger lives in the synced `meta` blob (key
   `growthLedger`), so it accumulates alongside — never overwrites — existing widget data
   (docs/17 §9). The curve is the *same* one Skills use (reused from skill.js), so an
   aspect petal levels exactly like a Skill widget. */

import { store } from './store.js';
import { events } from './events.js';
import { xpToNext } from '../widgets/skill.js';
import { registry } from '../widgets/registry.js';
import { ASPECTS, ASPECT_BY_MODULE, findAttribute, findSkill, aspectById } from '../presets/aspects.js';

const META_KEY = 'growthLedger';
const LOG_CAP = 200;   // recent growth events, for delight + the aspect tool's "recent" face
const SEEN_CAP = 400;  // idempotency keys, so a re-applied action can't double-count

/** Ledger shape: { aspects:{ [aspectId]:{ [attrId]:{level,xp} } }, skills:{ [skillId]:{level,xp} }, log:[], seen:[] } */
function blank() { return { aspects: {}, skills: {}, log: [], seen: [] }; }

/** The live ledger (a fresh blank if none saved yet). */
export function getLedger() {
  const l = store.getMeta(META_KEY, null);
  return l && typeof l === 'object' ? { ...blank(), ...l } : blank();
}
function saveLedger(l) { store.setMeta(META_KEY, l); events.emit('growth:changed', {}); }

/* ---- the curve (shared with Skills) ---- */

/** Add XP to one {level,xp} track, rolling levels with the shared curve. Returns levels gained. */
function levelUp(track, amount) {
  track.level = track.level || 1;
  track.xp = (track.xp || 0) + amount;
  let gained = 0;
  while (track.xp >= xpToNext(track.level)) { track.xp -= xpToNext(track.level); track.level++; gained++; }
  return gained;
}

/** The aspect's first attribute id — the cozy default when a contribution names no (or an
    unknown) attribute, so growth is never lost on a mapping gap. */
function defaultAttrId(aspect) { return aspect?.attributes?.[0]?.id || null; }

/** Resolve a contribution to a concrete { aspect, attribute } petal.
    Order: explicit attribute → module's aspect default → null. */
function resolvePetal(c, moduleKey) {
  if (c.attribute) {
    const byPair = c.aspect && findAttribute(`${c.aspect}:${c.attribute}`);
    const hit = byPair || findAttribute(c.attribute);
    if (hit) return hit;
  }
  // unknown/absent attribute: route to the module's (or named) aspect's first petal
  const aspect = aspectById(c.aspect) || aspectById(ASPECT_BY_MODULE[moduleKey]);
  const aid = defaultAttrId(aspect);
  return aid ? findAttribute(`${aspect.id}:${aid}`) : null;
}

/* ---- applying growth ---- */

/**
 * Apply ONE contribution to a ledger in place. Low-level; most callers use grow().
 * @param {object} ledger
 * @param {{aspect?:string, attribute?:string, amount:number, skill?:string}} c
 * @param {string} [moduleKey] the module the emitting tool lives in (routes to its aspect)
 * @returns {{aspectId,attrId,skill,attrLevels,skillLevels,amount}|null}
 */
export function applyGrowth(ledger, c, moduleKey) {
  const amount = Number(c?.amount) || 0;
  if (amount <= 0) return null;
  const petal = resolvePetal(c, moduleKey);
  if (!petal) return null;
  const aspectId = petal.aspect.id, attrId = petal.attribute.id;

  const aspectTracks = ledger.aspects[aspectId] || (ledger.aspects[aspectId] = {});
  const track = aspectTracks[attrId] || (aspectTracks[attrId] = { level: 1, xp: 0 });
  const attrLevels = levelUp(track, amount);

  // a skill tag (a star) levels its own 1:1 track for the orbiting-star glow
  let skillLevels = 0;
  const skillId = c.skill && (findSkill(c.skill) ? c.skill : null);
  if (skillId) {
    const st = ledger.skills[skillId] || (ledger.skills[skillId] = { level: 1, xp: 0 });
    skillLevels = levelUp(st, amount);
  }
  return { aspectId, attrId, skill: skillId, attrLevels, skillLevels, amount };
}

/**
 * Apply a list of contributions to the persistent ledger and save once.
 * @param {Array<{aspect?:string, attribute?:string, amount:number, skill?:string}>} contributions
 * @param {{module?:string, key?:string}} [opts] module routes contributions to an aspect;
 *        key is an idempotency token — a repeated key is ignored so growth can't double-apply.
 * @returns {Array} the applied results (empty when nothing grew)
 */
export function grow(contributions, opts = {}) {
  const list = (contributions || []).filter(c => c && Number(c.amount) > 0);
  if (!list.length) return [];
  const ledger = getLedger();

  if (opts.key) {
    if ((ledger.seen || []).includes(opts.key)) return []; // already counted
    ledger.seen = (ledger.seen || []).concat(opts.key).slice(-SEEN_CAP);
  }

  const results = [];
  for (const c of list) {
    const r = applyGrowth(ledger, c, opts.module);
    if (r) results.push(r);
  }
  if (!results.length) { if (opts.key) saveLedger(ledger); return []; }

  const now = Date.now();
  ledger.log = (ledger.log || []).concat(results.map(r => ({ ...r, at: now }))).slice(-LOG_CAP);
  saveLedger(ledger);
  return results;
}

/* ---- the grows() bridge (docs/17 §3): tools emit, growth applies ---- */

/** The preset key of the module a widget lives in (walks up nested widgets to its page). */
function moduleKeyOf(widget) {
  let w = widget, guard = 0;
  while (w && !w.pageId && w.parentWidgetId && guard++ < 20) w = store.get('widgets', w.parentWidgetId);
  const page = w?.pageId ? store.get('pages', w.pageId) : null;
  const mod = page && store.get('modules', page.moduleId);
  return mod?.presetKey || null;
}

/**
 * Run a tool's optional, idempotent grows(before, after, action) and apply the result.
 * Per-instance `config.growthAttribute` overrides the petal; the module routes the aspect.
 * @returns {Array} the applied growth results
 */
export function runGrows(widget, before, after, action) {
  const def = registry.get(widget?.type);
  if (!def?.grows) return [];
  let contribs;
  try { contribs = def.grows(before, after, action) || []; } catch { return []; }
  if (!contribs.length) return [];
  const override = widget.config?.growthAttribute;
  if (override) contribs = contribs.map(c => (c.attribute ? c : { ...c, attribute: override }));
  return grow(contribs, { module: moduleKeyOf(widget), key: action?.key });
}

let bridged = false;
/** Subscribe the growth bridge to the `growth:emit` channel. Safe to call once at startup. */
export function initGrowth() {
  if (bridged) return; bridged = true;
  events.on('growth:emit', ({ widget, before = null, after = null, action }) => {
    if (widget && action) runGrows(widget, before, after || widget, action);
  });
}

/* ---- reading the ledger (for the Aspect tool + Liri) ---- */

/** A petal's {level,xp} (defaults to level 1 for an untouched attribute). */
export function attrTrack(ledger, aspectId, attrId) {
  return (ledger.aspects[aspectId]?.[attrId]) || { level: 1, xp: 0 };
}

/** Aspect level = rounded mean of all its attribute levels (untouched petals count as 1). */
export function aspectLevel(ledger, aspectId) {
  const aspect = aspectById(aspectId);
  if (!aspect) return 1;
  const sum = aspect.attributes.reduce((s, a) => s + attrTrack(ledger, aspectId, a.id).level, 0);
  return Math.max(1, Math.round(sum / aspect.attributes.length));
}

/**
 * A render-ready snapshot of one aspect for the Aspect tool / Liri: the aspect level plus
 * each attribute's level, xp progress (0–1), and each skill's level (star glow).
 * @returns {{id,name,color,icon,level,attributes:Array,recent:Array}|null}
 */
export function aspectState(aspectId, ledger = getLedger()) {
  const aspect = aspectById(aspectId);
  if (!aspect) return null;
  const attributes = aspect.attributes.map(a => {
    const t = attrTrack(ledger, aspectId, a.id);
    const need = xpToNext(t.level);
    return {
      id: a.id, name: a.name, level: t.level, xp: t.xp, need,
      pct: need ? Math.min(1, t.xp / need) : 0,
      skills: a.skills.map(s => ({ id: s.id, name: s.name, level: (ledger.skills[s.id]?.level) || 1 }))
    };
  });
  const recent = (ledger.log || []).filter(e => e.aspectId === aspectId).slice(-8).reverse();
  return { id: aspect.id, name: aspect.name, color: aspect.color, icon: aspect.icon, blurb: aspect.blurb,
    level: aspectLevel(ledger, aspectId), attributes, recent };
}

/** Every aspect's level, for the My Blossom hub overview + Liri growth inputs. */
export function allAspectLevels(ledger = getLedger()) {
  return ASPECTS.map(a => ({ id: a.id, name: a.name, color: a.color, level: aspectLevel(ledger, a.id) }));
}
