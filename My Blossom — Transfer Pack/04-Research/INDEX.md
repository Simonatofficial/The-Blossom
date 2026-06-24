# Research Library — index

External research folded into the repo so Claude Code can consult it every session **before** designing a feature that has a real-world equivalent. This is the field guide; the project docs are the build orders.

> **When to read these:** before designing or overhauling any feature that maps to a known app category (habit/task/wellness, calendar/notes, D&D/tabletop, maps/worldbuilding, music, idle/strategy games). The `learn-from-the-field` skill fires for exactly this and points here. Read the **one relevant section**, not the whole file — these are large.

| File | What's inside | Reach for it when building… |
|---|---|---|
| `market-research.md` | Competitor landscape (Habitica, Streaks, Todoist, Notion, Calm, Headspace, Duolingo, Strava, MyFitnessPal), what works/fails, market gaps, revenue/tier benchmarks, conversion math. | Habits, goals, tasks, journaling, meditation/breathing, onboarding, pricing/tiers, retention features. |
| `technical-teardowns-everyday-and-worldbuilding.md` | How real apps are built: Google Calendar, Apple Notes/Reminders (CloudKit), shopping lists, Strava, MyFitnessPal, Google Classroom; D&D Beyond, Roll20, Inkarnate, World Anvil. | Calendar sync, notes data model, fitness/nutrition, study, D&D character/rules engine, world map renderer, lore wiki. |
| `technical-teardowns-music-and-gaming.md` | Spotify, Audible, HeroForge, idle/clicker games, Civ VI, side-scrolling strategy (Northgard) — save systems, render pipelines, production math, prestige. | Music player, the Blossoms game (idle + grid sim + side-scroller battles), graphs, save/sync patterns. |

## How to use a teardown without copying it

1. **Extract the *pattern*, not the product.** e.g. idle games use a single per-frame production accumulator + offline-progress catch-up on load → that's the pattern Blossoms should reuse, in our own cozy skin.
2. **Translate to our rails.** Everything-is-data, offline-first, 60fps on mid-range Android, calm/cozy. A pattern that needs a always-on server or violates the cozy laws gets adapted or dropped.
3. **Cite the decision back into the build doc** so we don't re-litigate it.

## Headline takeaways (so you don't have to re-read to remember)

- **Consolidation is the wedge.** Users juggle 4–7 apps ($30–80/mo); My Blossom's one customizable surface is the value proposition. (`market-research.md`)
- **Feature bloat + weak onboarding are the top killers** (52% 30-day drop-off industry avg). Launch focused, disclose depth slowly — this *is* the cozy laws, validated by the market.
- **Gamification (+30% engagement), personalization (+50% retention), offline-first, privacy-first** are the proven levers. We already have the first; lean into the rest.
- **Save patterns:** clickers = auto-save JSON every few seconds to local + optional cloud; creators = part-based config <1MB; strategy = incremental cloud+local. Maps cleanly onto our IndexedDB→Supabase sync.
