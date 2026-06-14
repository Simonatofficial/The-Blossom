/* Blossoms game — static definitions (docs/13 §21, MVP slice). Pure data, no DOM.
   The MVP covers: tap the Blossom, a plot grid of buildings, assignable Peasants,
   real-time + offline production, and settlement tiers. Battles, villager tiers,
   and the Kingdom/Empire layers are deferred (see docs/13 §21). */

/** Resource keys used throughout the engine + UI. */
export const RESOURCES = {
  blossom: { name: 'Blossoms', emoji: '🌸' },
  food: { name: 'Food', emoji: '🍎' },
  wood: { name: 'Wood', emoji: '🪵' },
  ore: { name: 'Ore', emoji: '⛏️' }
};

/** Placeable buildings. `rate` is base production/sec; `cost` is the first one
    (later copies cost more — see engine.buildCost). Home adds Housing instead. */
export const BUILDINGS = {
  farm: { name: 'Farm', emoji: '🌾', produces: 'food', rate: 0.6, cost: { blossom: 25, wood: 8 } },
  logging: { name: 'Logging Camp', emoji: '🪵', produces: 'wood', rate: 0.4, cost: { blossom: 30 } },
  quarry: { name: 'Quarry', emoji: '⛏️', produces: 'ore', rate: 0.3, cost: { blossom: 45, wood: 15 } },
  home: { name: 'Home', emoji: '🏠', housing: 3, cost: { blossom: 35, wood: 18 } }
};

/** Each placed copy of a building type costs this much more than the last. */
export const BUILD_COST_GROWTH = 1.6;

/** Per-building yield upgrade: each level multiplies output; cost grows steeply. */
export const BUILDING_UPGRADE = { mult: 1.5, costMult: 1.9 };

/** Peasants: boost the building they're assigned to, cost Food upkeep/sec each,
    and take a Housing slot. */
export const VILLAGER = { boost: 0.6, upkeep: 0.04, recruitCost: { food: 18, blossom: 10 } };

/** Tap + auto-tap upgrades (spent in Blossoms). */
export const TAP_UPGRADES = {
  tap: { name: 'Bigger blooms', emoji: '🌷', base: 50, costMult: 2.2, hint: '+1 Blossom per tap' },
  auto: { name: 'Garden helper', emoji: '🐝', base: 120, costMult: 2.6, hint: '+0.5 auto-taps / sec' }
};

/** Settlement tiers — unlock more plots as you build. `needs.buildings` = how
    many buildings placed to reach this tier. */
export const TIERS = [
  { name: 'Camp', emoji: '⛺', plots: 4, needs: { buildings: 0 } },
  { name: 'Hamlet', emoji: '🏕️', plots: 6, needs: { buildings: 3 } },
  { name: 'Village', emoji: '🏘️', plots: 9, needs: { buildings: 6 } },
  { name: 'Town', emoji: '🏰', plots: 12, needs: { buildings: 10 } }
];

/** Plot grid — 12 max slots; tiers unlock up to TIERS[t].plots of them. */
export const GRID = { cols: 4, rows: 3, max: 12 };

/** Offline production is granted for at most this long. */
export const OFFLINE_CAP_SECONDS = 8 * 3600;
