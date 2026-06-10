# 07 — Gamification & Economy

Design intent: rewards are a gentle tailwind, never a slot machine. No loss-framing, no FOMO timers, no decay punishments. The economy exists to make effort feel acknowledged and to fund self-chosen rewards.

## Currency

Copper → Silver → Gold → Platinum, exchange 10:1 upward (and breakable back down 1:10). Wallet lives in `meta.wallet = {c, s, g, p}`; all earnings go in as copper-equivalent and auto-promote display (e.g. 1,234 copper displays as 1g 2s 3c 4? — no: store raw copper, display as highest-denomination breakdown `1g 23s 4c` → implement as: keep a single integer `copper`, render via division; the four-field wallet is display-only). Coin icons: four SVG coins with subtle metal tints from the theme.

## Earning

| Source | Payout (copper) |
|---|---|
| Quest completed (all reps done for the day) | base 10 × difficulty multiplier |
| Difficulty multipliers | Sprout ×1 · Bloom ×2 · Flourish ×4 · Radiant ×8 |
| Partial completion | floor(base × completionPct × 0.5) — completing matters more |
| Habit (any tier) | as quest; Stretch tier +25% |
| Streak milestones (7/30/100/365 days) | 50 / 250 / 1,000 / 5,000 |
| Health widget, end of day | maxHealth × healthPct × 2 (100% health = full payout) |
| Skill level-up | 20 × ceil(newLevel × 0.5) — "a percentage of money each level: higher level, more money" |
| Goal completed | 500 × average difficulty of its parts |

Anti-gaming: payouts are computed at **day rollover** for everything except instant quest-completion payouts; editing past days never re-pays; deleting and recreating a quest resets its streak.

## Skill XP & levels

- XP today = sum of linked values (1 point = 1 XP, per-link transform may scale).
- XP **finalizes at rollover** — the bar fills live during the day in a lighter "pending" tint, then commits.
- Level curve: `xpToNext(level) = 50 × level^1.4` (rounded to 10). Infinite levels.
- **Nested skills:** when a child Skill levels up, the parent gains `childLevel × 10 × 0.5^depth` XP (decay halves per layer — infinite nesting allowed, diminishing gain as specced). A skill never gains XP from its own descendants twice (the chain only propagates one step per level-up event).

## Health

- `max = Σ required reps of contained/linked quests (today's schedule)`; `+1` per rep completed; reset to 0 on rollover after payout. Past days are frozen (view-only history).

## Streaks

- A quest's streak increments on any day where all scheduled reps complete (or an MVV tier for habits). Non-scheduled days don't affect streaks.
- On a missed scheduled day, consume (in order): an active **Streak Freeze**, then a **Streak Restore** if the user applies one within 7 days, else the streak ends. The streak UI is a leaf count, never a flame — calm, botanical.

## Market catalog

| Tier | Item | Effect |
|---|---|---|
| Copper (25c) | **Small Quest Skip** | Marks 1 rep of one quest complete today. No coin payout from it. One-time use. |
| Silver (8s) | **Big Quest Skip** | Marks one quest fully complete today. No coin payout. One-time use. |
| Gold (5g) | **Streak Restore** | Repair a streak broken within the last 7 days (marks the missed day complete for streak purposes only). One-time use. |
| Platinum (3p) | **Streak Freeze** | Shields one quest's streak for up to 7 missed days (consumed after the 7-day window or when spent). |
| Any tier | **Custom Reward** | User-defined real-life treats with user-set prices ("Movie night — 2g"). Buying logs the purchase to a Reward Journal; the treat is enjoyed offline. |

Owned items live in the Market's **Owned** shelf; using one opens a target picker. Purchases and uses are recorded (date, item, target) for the user's own history — never surfaced as judgment.

## Celebration language

Level-ups, streak milestones, and goal completions trigger: card bloom animation (petals unfurl over the card, 800ms), a soft chime (optional, off by default), a toast ("Discipline reached level 7 · +70c"), and a pointer-FX burst at the card. Never a full-screen takeover.

## Build decisions (v1 implementation notes)

- Wallet is a single raw copper integer; the four denominations are display-only, so the Market's exchange row is unnecessary (conversion is automatic) and was omitted.
- Streak Restore repairs by re-adding the remembered pre-break streak (the break date and prior streak are stored on the quest when a streak ends).
- Skill parent propagation: a child level-up grants `childLevel x 10 x 0.5` XP one layer up; cascades continue naturally only if the parent itself levels up.
