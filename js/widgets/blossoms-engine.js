/* Blossoms game — engine (docs/13 §21 MVP). Pure state + rules, no DOM, no store.
   The whole game is a plain JSON object so it serialises straight into widget
   config and a `blm:` save code. */

import { BUILDINGS, BUILD_COST_GROWTH, BUILDING_UPGRADE, VILLAGER, TAP_UPGRADES, TIERS, GRID, OFFLINE_CAP_SECONDS } from './blossoms-data.js';

/** A fresh game. Starts as a Camp with a little Food/Wood to get going. */
export function createGame() {
  return {
    v: 1,
    blossom: 0, food: 25, wood: 8, ore: 0,
    tapLevel: 0, autoLevel: 0,
    plots: Array.from({ length: GRID.max }, () => null), // null | { type, level }
    villagers: [], // [{ plot: index|null }]
    tier: 0,
    lastTick: Date.now(),
    totalTaps: 0
  };
}

/* ---- derived values ---- */
export const tapValue = (g) => 1 + g.tapLevel;
export const autoTapRate = (g) => g.autoLevel * 0.5;
export const housingCap = (g) => g.plots.reduce((n, p) => n + (p?.type === 'home' ? BUILDINGS.home.housing : 0), 0);
export const population = (g) => g.villagers.length;
export const buildingCount = (g) => g.plots.filter(Boolean).length;
export const unlockedPlots = (g) => TIERS[g.tier].plots;
export const idleVillagers = (g) => g.villagers.filter(v => v.plot == null).length;
export const villagersOn = (g, i) => g.villagers.filter(v => v.plot === i).length;

/* ---- costs ---- */
export function buildCost(g, type) {
  const owned = g.plots.filter(p => p?.type === type).length;
  const f = Math.pow(BUILD_COST_GROWTH, owned);
  const out = {};
  for (const k in BUILDINGS[type].cost) out[k] = Math.ceil(BUILDINGS[type].cost[k] * f);
  return out;
}
export function upgradeCost(g, i) {
  const p = g.plots[i]; if (!p) return null;
  const base = BUILDINGS[p.type].cost.blossom || 30;
  return { blossom: Math.ceil(base * Math.pow(BUILDING_UPGRADE.costMult, p.level + 1)) };
}
export function tapUpgradeCost(g, key) {
  const lvl = key === 'tap' ? g.tapLevel : g.autoLevel;
  return { blossom: Math.ceil(TAP_UPGRADES[key].base * Math.pow(TAP_UPGRADES[key].costMult, lvl)) };
}

export const canAfford = (g, cost) => Object.entries(cost).every(([k, v]) => g[k] >= v);
const pay = (g, cost) => { for (const k in cost) g[k] -= cost[k]; };

/* ---- actions (each returns true on success) ---- */
export function tap(g) { g.blossom += tapValue(g); g.totalTaps++; return true; }

export function build(g, i, type) {
  if (g.plots[i] || i >= unlockedPlots(g) || !canAfford(g, buildCost(g, type))) return false;
  pay(g, buildCost(g, type));
  g.plots[i] = { type, level: 0 };
  checkTier(g);
  return true;
}
export function upgradeBuilding(g, i) {
  const cost = upgradeCost(g, i);
  if (!cost || !canAfford(g, cost)) return false;
  pay(g, cost); g.plots[i].level++;
  return true;
}
export function demolish(g, i) {
  for (const v of g.villagers) if (v.plot === i) v.plot = null;
  g.plots[i] = null;
  checkTier(g);
  return true;
}
export function recruit(g) {
  if (population(g) >= housingCap(g) || !canAfford(g, VILLAGER.recruitCost)) return false;
  pay(g, VILLAGER.recruitCost); g.villagers.push({ plot: null });
  return true;
}
/** Move one idle Peasant onto plot i, or one off plot i back to idle. */
export function assignTo(g, i) {
  const idle = g.villagers.find(v => v.plot == null);
  if (!idle) return false;
  idle.plot = i; return true;
}
export function unassignFrom(g, i) {
  const v = g.villagers.find(x => x.plot === i);
  if (!v) return false;
  v.plot = null; return true;
}
export function buyTapUpgrade(g, key) {
  const cost = tapUpgradeCost(g, key);
  if (!canAfford(g, cost)) return false;
  pay(g, cost);
  if (key === 'tap') g.tapLevel++; else g.autoLevel++;
  return true;
}

/** Promote through any tiers whose building threshold is now met. */
export function checkTier(g) {
  let t = g.tier;
  while (t + 1 < TIERS.length && buildingCount(g) >= TIERS[t + 1].needs.buildings) t++;
  const up = t > g.tier;
  g.tier = t;
  return up;
}

/** Production per second for each resource (buildings × levels × peasants,
    auto-tap into Blossoms, minus Peasant Food upkeep). */
export function rates(g) {
  const r = { food: 0, wood: 0, ore: 0, blossom: 0 };
  g.plots.forEach((p, i) => {
    if (!p) return;
    const def = BUILDINGS[p.type];
    if (!def.produces) return;
    r[def.produces] += def.rate * Math.pow(BUILDING_UPGRADE.mult, p.level) * (1 + villagersOn(g, i) * VILLAGER.boost);
  });
  r.blossom += autoTapRate(g) * tapValue(g);
  r.food -= population(g) * VILLAGER.upkeep;
  return r;
}

/** Advance the sim by dt seconds (mutates g). Returns true if a tier-up fired. */
export function tick(g, dt) {
  const r = rates(g);
  for (const k of ['food', 'wood', 'ore', 'blossom']) g[k] = Math.max(0, g[k] + r[k] * dt);
  g.lastTick = Date.now();
  return checkTier(g);
}

/** Apply capped offline production since lastTick. Returns {seconds, gained} or null. */
export function applyOffline(g) {
  const now = Date.now();
  const elapsed = Math.min(OFFLINE_CAP_SECONDS, Math.max(0, (now - (g.lastTick || now)) / 1000));
  g.lastTick = now;
  if (elapsed < 30) return null;
  const before = { blossom: g.blossom, food: g.food, wood: g.wood, ore: g.ore };
  const r = rates(g);
  for (const k of ['food', 'wood', 'ore', 'blossom']) g[k] = Math.max(0, g[k] + r[k] * elapsed);
  checkTier(g);
  const gained = {};
  for (const k of ['blossom', 'food', 'wood', 'ore']) { const d = Math.floor(g[k] - before[k]); if (d > 0) gained[k] = d; }
  return Object.keys(gained).length ? { seconds: Math.floor(elapsed), gained } : null;
}

export const serialize = (g) => g;
export const deserialize = (data) => ({ ...createGame(), ...data, plots: padPlots(data?.plots) });
function padPlots(plots) {
  const out = Array.from({ length: GRID.max }, (_, i) => (plots && plots[i]) || null);
  return out;
}
