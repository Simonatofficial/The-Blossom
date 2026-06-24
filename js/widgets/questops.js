/* Shared quest mechanics (docs/05 Quest + docs/07 economy): schedules, rep
   logs, instant payouts, partial payouts at rollover, streaks + freezes.
   Used by Quest, Habit, Routine, and Health — keeps widgets decoupled while
   the rules live in one place (decision noted in docs/05). */

import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { wallet } from '../core/wallet.js';
import { dayObject, saveObject, todayStr } from './base.js';

export const DIFFICULTY = {
  sprout: { label: 'Sprout', mult: 1 },
  bloom: { label: 'Bloom', mult: 2 },
  flourish: { label: 'Flourish', mult: 4 },
  radiant: { label: 'Radiant', mult: 8 }
};

const STREAK_MILESTONES = { 7: 50, 30: 250, 100: 1000, 365: 5000 };
const BASE_PAYOUT = 10;

/** Is this quest scheduled on a given date? */
export function scheduledOn(widget, dateStr) {
  const cfg = widget.config;
  if (cfg.startDate && dateStr < cfg.startDate) return false;
  if (cfg.endDate && dateStr > cfg.endDate) return false;
  const kind = cfg.schedule?.kind || 'daily';
  if (kind === 'daily') return true;
  if (kind === 'once') return dateStr === (cfg.startDate || todayStr());
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return (cfg.schedule.days || []).includes(day);
}

/** Read a day's log without creating one (safe for value outputs). */
export function readLog(widget, dateStr) {
  return store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'questLog' && o.date === dateStr) || null;
}

export function repsDone(widget, dateStr) { return readLog(widget, dateStr)?.data.done || 0; }

export function completionPct(widget, dateStr) {
  const reps = widget.config.reps || 1;
  return Math.min(1, repsDone(widget, dateStr) / reps) * 100;
}

/**
 * Add (or remove) a rep for today. Pays out instantly on the final rep
 * (docs/07: per-rep payouts would be gameable). Editing past days never pays.
 * @param {{bonusMult?: number, noPayout?: boolean, tier?: string}} [opts]
 *   bonusMult: habits' Stretch +25%; noPayout: Market quest-skips (docs/07).
 * @returns {{done: number, completedNow: boolean, coins: number}}
 */
export function addRep(widget, delta = 1, dateStr = todayStr(), opts = {}) {
  const reps = widget.config.reps || 1;
  const log = dayObject(widget.id, 'questLog', dateStr, { done: 0, paid: false });
  log.data.done = Math.max(0, Math.min(reps, log.data.done + delta));
  if (opts.tier) log.data.tier = opts.tier;
  let completedNow = false;
  let coins = 0;
  if (log.data.done >= reps && !log.data.paid && dateStr === todayStr()) {
    log.data.paid = true;
    completedNow = true;
    if (!opts.noPayout) {
      coins = Math.round(BASE_PAYOUT * (DIFFICULTY[widget.config.difficulty]?.mult || 1) * (opts.bonusMult || 1));
      wallet.add(coins, `quest:${widget.id}`);
    }
  }
  saveObject(log);
  // V3 growth loop (docs/17 §3): a newly-completed day feeds this tool's aspect once.
  if (completedNow) events.emit('growth:emit', { widget, action: { kind: 'complete', date: dateStr, key: `${widget.id}:complete:${dateStr}` } });
  return { done: log.data.done, completedNow, coins };
}

/** Current streak state, stored on the widget. */
export function streakState(widget) {
  widget.config.state = widget.config.state || { streak: 0, best: 0, lastRolled: null };
  return widget.config.state;
}

/** Active streak freeze for a quest (set by the Market, docs/07). */
function freezeActive(widgetId, dateStr) {
  const freezes = store.getMeta('freezes', {});
  const f = freezes[widgetId];
  if (!f) return false;
  if (dateStr > f.until) {
    delete freezes[widgetId];
    store.setMeta('freezes', freezes);
    return false;
  }
  return true;
}

/**
 * Day rollover for one quest-like widget (docs/07): partial payout, streak
 * update (freeze consulted), milestone coins. Idempotent per date.
 */
export function rollQuestDay(widget, fromDate) {
  const state = streakState(widget);
  if (state.lastRolled === fromDate) return;
  state.lastRolled = fromDate;

  if (scheduledOn(widget, fromDate)) {
    const reps = widget.config.reps || 1;
    const log = readLog(widget, fromDate);
    const done = log?.data.done || 0;

    if (done >= reps) {
      state.streak += 1;
      state.best = Math.max(state.best, state.streak);
      const bonus = STREAK_MILESTONES[state.streak];
      if (bonus) {
        wallet.add(bonus, `streak:${widget.id}`);
        events.emit('notify', { category: 'streak', text: `${widget.name}: ${state.streak}-day streak · +${bonus}c` });
      }
    } else {
      if (done > 0 && log && !log.data.paid) {
        const mult = DIFFICULTY[widget.config.difficulty]?.mult || 1;
        wallet.add(Math.floor(BASE_PAYOUT * mult * (done / reps) * 0.5), `quest-partial:${widget.id}`);
        log.data.paid = true;
        saveObject(log);
      }
      if (!freezeActive(widget.id, fromDate) && state.streak > 0) {
        // remember the break so a Streak Restore can repair it within 7 days (docs/07)
        state.prevStreak = state.streak;
        state.brokenOn = fromDate;
        state.streak = 0;
      }
    }
  }
  store.put('widgets', widget);
}

/** Completion rate over the last `days` scheduled days (for stats views). */
export function completionRate(widget, days = 30) {
  let scheduled = 0, completed = 0;
  const reps = widget.config.reps || 1;
  for (let i = 1; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = todayStr(d);
    if (!scheduledOn(widget, ds)) continue;
    scheduled++;
    if (repsDone(widget, ds) >= reps) completed++;
  }
  return scheduled ? Math.round((completed / scheduled) * 100) : null;
}
