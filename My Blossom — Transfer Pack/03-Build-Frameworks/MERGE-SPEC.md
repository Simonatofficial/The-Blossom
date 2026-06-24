# My Blossom v1.0.0 — The Master Merge Spec

> **The "ultimate merge file."** This is the single source of truth for fusing **The Blossom** (the mature, feature-complete app — `../My App`, v119) with **My Blossom v0.0.1** (the clean React Native / Expo / Supabase rebuild — `../My Blossom v0.0.1`).
>
> The goal in one line: **The Blossom's whole body and soul, rebuilt on My Blossom's clean cross-platform spine — without the downgrades.**

---

## 0. What you're merging (and why v0.0.1 hurt)

| | **The Blossom** (`My App`) | **My Blossom v0.0.1** |
|---|---|---|
| Stack | Vanilla HTML/CSS/JS, no build step, PWA | React Native + Expo + TypeScript + Supabase |
| Platforms | Web / installable PWA only | **Android · iOS · Web** from one codebase |
| Maturity | **v119** — ~60 widgets, 6+ preset modules, full D&D 5e SRD, study garden, COSMOS, gamification, theming/particles/atmosphere/weather | **~10–15% of the felt product** — solid engine, 3 widgets (notes/tracker/quest) |
| Sync | IndexedDB local + Blossom save-codes | **Supabase** (Postgres + Auth + RLS + Realtime), offline-first |
| Companion | — | **Liri** (designed, not built) |
| What it has | **Everything you love: the features** | **Everything you want around them: the platform** |

**Why v0.0.1's "upgrades" became downgrades.** It was a *rewrite from a blank page*, so it had the heart and the idea but none of the accumulated body — and it tried to re-invent surfaces (the flower, the FX, the widgets) instead of *porting the proven ones*. The result: a beautiful foundation with almost nothing standing on it, where every screen felt like a worse version of something The Blossom already did well.

**v1.0.0's rule, therefore:** *don't redesign what already works — port it, then improve it in place.* The Blossom is the reference implementation for behaviour and feel; v0.0.1 is the reference implementation for architecture and reach. Where they disagree on **what a feature does**, The Blossom wins. Where they disagree on **how it's built**, v0.0.1 wins.

---

## 1. The five merge principles (these prevent the downgrade)

1. **Port, don't reinvent.** Every widget/module already exists and is tuned in The Blossom. We translate it — logic copied, view rebuilt natively — never re-imagine it from scratch. A ported screen must match or beat its Blossom original before it ships.
2. **Brain / body split is law.** Pure logic (`logic.ts`) has zero RN imports and is node-testable; views (`View.tsx`) only render + dispatch. This is the one thing v0.0.1 got exactly right, and it's what makes The Blossom's JS logic *portable at all* (copy the function bodies, strip `window`/DOM, add types).
3. **Tools are self-contained.** The Blossom's worst bugs came from widgets depending on each other. A Tool is a *complete instrument* that works alone; it may *optionally* read another's outputs but never throws if that other is missing. Connections enrich; they never couple. (Enforced by `WidgetHost` being the only thing that touches storage — see §3.)
4. **Everything is data.** Modules, pages, widgets, themes, particles, SRD content — all JSON definitions rendered by generic engines. Adding content never edits an engine. (Both apps already believe this; we keep it.)
5. **Offline is sacred; sync is a mirror.** The UI always reads/writes local; Supabase mirrors in the background, last-write-wins. No render ever waits on the network.

---

## 2. The unified architecture

```
            ┌─────────────────────────────────────────────┐
            │  app/  (Expo Router)  — module rail · page    │
            │  tabs · FAB · WidgetHost grid · Liri dock     │   ← body (RN, rebuilt)
            ├─────────────────────────────────────────────┤
            │  src/widgets/<type>/  logic.ts (pure brain)   │   ← ported from Blossom JS
            │                       View.tsx (RN face)      │
            ├─────────────────────────────────────────────┤
            │  src/modules/ engine + presets (data)         │   ← ported defs
            │  src/fx/ visual engine (Canvas2D in WebView)  │   ← ported from Blossom
            │  src/theme/ tokens + ThemeProvider            │
            ├─────────────────────────────────────────────┤
            │  src/core/store/  Store interface             │
            │    memory · sqlite (local truth) · index      │   ← kept from v0.0.1
            │  src/core/sync/  SyncEngine → Supabase         │
            └─────────────────────────────────────────────┘
                       offline-first · LWW · RLS on
```

**What's kept verbatim from v0.0.1** (it was correct): the `Store` interface, the sqlite/memory adapters, the offline-first `SyncEngine`, the Supabase schema + RLS, the Expo/EAS config (device-verified on SDK 54), the `ThemeProvider`, the 7-theme roster, the aspect model.

**What's enriched for the merge:** the **widget contract**. v0.0.1's `{ logic, View }` was too thin to hold a real Blossom widget. v1.0.0's `Widget` (see `src/widgets/types.ts`) adds the pieces The Blossom's widgets actually need:

- **Two faces** — `CardView` (the external card) + `FullView` (the internal panel on tap). This is The Blossom's `renderCard`/`renderFull`, typed.
- **`primaryTap`** — card-body tap action (Counter +1, Dice reroll) vs. opening.
- **`outputs`** — values a Tool exposes to the link/graph/Blossom-loop system, day-keyed where relevant.
- **`container`** — can it nest child widgets (Notes, Journal, Routine…).
- **`settings`** — declarative schema driving a generic settings panel.
- **`category` + `keywords`** — for the collapsible Add-widget gallery (The Blossom has ~10 categories).
- **`onDayRolled`** — the day-rollover hook for streaks/resets.

This single contract is the spine of the whole port: **every one of The Blossom's ~60 widgets maps onto it cleanly.**

---

## 3. The Tool contract in practice (the decoupling fix)

`WidgetHost` (`src/widgets/WidgetHost.tsx`) is the **only** component that touches the store for a widget. It:
loads the widget's state object → runs the pure reducer locally on dispatch → persists every change → subscribes for synced updates → renders the right face → hands the widget a `ctx` (`navigate`, `toast`, `readLink`, `grow`).

A widget therefore **never imports the store or another widget.** It reads cross-widget values only through `ctx.readLink(...)`, which returns `null` (never throws) when the source is absent. *This is the structural fix for The Blossom's "too buggy when widgets relied on each other."*

---

## 4. The full port map (every feature → where it lands)

Status legend: ✅ done in v1.0.0 · 🔜 next wave · 📋 mapped/queued · 💤 later.

### 4.1 Core engine
| Piece | Source | Lands at | Status |
|---|---|---|---|
| Store interface | v0.0.1 (kept) | `src/core/store/types.ts` | ✅ |
| sqlite + memory adapters | v0.0.1 | `src/core/store/{sqlite,memory}.ts` | ✅ |
| Offline-first sync (LWW) | v0.0.1 M4 | `src/core/sync/engine.ts` + `supabase/schema.sql` | ✅ engine + schema; 🔜 Supabase transport + SyncProvider |
| Object **links** (cross-reference) | Blossom `core/values.js` | `Store.link/linksFrom/linksTo` | ✅ interface; 🔜 value resolver UI |
| ids / wallet / saves (Blossom codes) | Blossom `core/*` | `src/core/store/ids.ts`, `src/core/logic/*` | ✅ ids; 📋 wallet, save-codes |
| Module→Page→Widget model + instantiator | Blossom `presets/modules` | `src/modules/{types,engine}.ts` | ✅ |
| Theme tokens + 7 themes | v0.0.1 | `src/theme/*`, `src/presets/themes.ts` | ✅ |
| Living-Layout feel tokens | Blossom docs/15 | `FeelTokens` on theme | ✅ types; 📋 cascade |
| Visual engine (themes·atmospheres·weather·particles·flower) | Blossom Canvas2D (approved) | `src/fx/` via transparent WebView (native) + canvas (web) | 📋 port per v0.0.1 `ENGINE-PORT.md` |

### 4.2 Widgets (The Blossom's ~60 → the contract)
Grouped by the Add-gallery category. Reference Tools (✅) prove the pattern; the rest port wave-by-wave by copying each Blossom widget's logic into `logic.ts`, rebuilding its card/full faces in RN, and registering one line.

| Category | Widgets to port | Status |
|---|---|---|
| **Productivity** | tracker ✅ · quest ✅ · habit/COSMOS ✅ · goal ✅ · routine · calendar · alarm/timer · reminder · questboard | tracker/quest/habit/goal ✅, rest 🔜→📋 |
| **Notes & Writing** | notes ✅ · journal · docshelf · library | notes ✅ |
| **Data & Charts** | counter ✅ · graph · flowergraph · overview | counter ✅, graph 🔜 |
| **Growth & Rewards** | skill ✅ · health · market · characteristic | skill ✅, rest 📋 |
| **Study** | flashcards · quiz · notebook · study-notes (elements) · the BLOOM garden loop, mastery, adaptive sessions | 🔜 (priority) |
| **Creative** | canvas · infcanvas (painting) · gallery · music · pinboard · canvaboard | 📋 (canvas needs Skia/dev build) |
| **Tabletop (D&D 5e)** | dndsheet · pcsheet · spellbook · dndinventory · dndcombat · dndstory · compendium · character-creator · homebrew · statblock · loottable · sessionlog/plan · encounter · initiative · levelplanner · dice + **full SRD content** | 🔜 SRD import (never re-key); 📋 sheets/companion |
| **World** | worldmap · worldchars · civprofile · wtimeline · lorewiki · relationshipweb | 💤 |
| **Games** | blossoms · snake · solitaire | 💤 |
| **Utility / Organization** | calculator · time · separator · notifications · hub · pagewidget | 📋 |

### 4.3 Modules (presets)
| Module | Source | Status |
|---|---|---|
| My Blossom (hub) | new starter ✅ + Blossom `blossom.js` | ✅ starter; 🔜 full |
| Productivity (→ Mental) | Blossom + DESIGN-DOC | 🔜 **build first** |
| Activity (→ Physical) | Blossom | 🔜 **build first** |
| Meditation · Connection · Recreation | DESIGN-DOC | 📋 |
| Study Guide | Blossom `study.js` | 🔜 |
| D&D DM · D&D Character | Blossom `dnddm.js` / `dndcharacter.js` | 📋 |
| Infinite Canvas · World Builder | Blossom | 💤 |

### 4.4 The systems that tie it together
| System | Source → v1.0.0 | Status |
|---|---|---|
| **COSMOS** habit method | Blossom docs/06 → habit widget (tiers + streak + adherence) | ✅ widget; 🔜 weekly review UI |
| **Gamification** (XP·levels·coins·streaks) | Blossom docs/07 → `src/core/logic/{xp,wallet}` | ✅ core math; 📋 Health/Market widgets |
| **Aspects → Attributes → Skills** (the flower growth) | v0.0.1 `aspects.ts` + DESIGN-DOC → `core/logic/growth.ts` emits/applies aspect-XP | ✅ engine; 🔜 wire `ctx.grow` + render growth |
| **Liri** (companion: page, dock, Liri Life, element quiz, bond/mood) | DESIGN-DOC docs/05 → `src/widgets/liri` + `app/liri` | 📋 |
| **Save / Blossom codes** (import old PWA gardens) | Blossom `core/saves.js` → importer | 📋 (do before launch — no one loses a garden) |
| **Monetization** (no-paywall, 7-day Cosmos trial, Designer tier) | v0.0.1 docs/02 → RevenueCat/Stripe | 💤 (M7) |
| Home-screen widgets · push · real alarms | v0.0.1 docs/02 → native modules (dev build) | 💤 (M6) |

---

## 5. The porting roadmap (the order to build)

Each wave ends green (typecheck + smoke + device check) and pushed. **The engine waves are mostly done; the value is in the module/widget waves.**

- **W0 — Foundation (this delivery).** ✅ Clean scaffold, Store + sqlite/memory + sync engine, enriched widget contract, registry, theme system + 7 themes, module engine, 3 reference Tools, app shell, starter module, Supabase schema, smoke test. *Standing on a verified spine.*
- **W1 — Shell to parity.** Module rail (3-window, active-centred — Blossom v115) + page tab bar + FAB add-gallery (categories/search) + settings panel (generic from `settings` schema) + open/close transitions. *Make the existing 3 Tools feel like The Blossom.*
- **W2 — Productivity & Activity modules.** Port habit (COSMOS), goal, routine, quest, skill, health → build the two priority modules → wire the **Blossom loop** (modules emit aspect-XP) + the growth engine so the aspect flowers actually grow.
- **W3 — Study garden.** Port flashcards + quiz + notebook + the BLOOM loop, mastery tracking, adaptive/mixed sessions, the study-skills flower (Blossom v111–v119). High user value, all-data, no native deps.
- **W4 — Visual engine + Liri.** Port the Canvas2D engine (atmospheres/weather/particles/flower) into the transparent-WebView wrapper; build Liri (page + dock + element quiz + Liri Life) on top.
- **W5 — Tabletop.** Import the full 5e SRD data files as-is; port character sheet → spellbook → inventory → compendium → companion (party/shop/encounter/initiative) + dice.
- **W6 — Sync transport + accounts UI.** Wire `SupabaseRemote` + `SyncProvider` (foreground/interval/Realtime) + anonymous→email auth + Account panel + the **Blossom-code importer** (migrate old PWA gardens).
- **W7 — Creative, World, Games** (need Skia/dev build) **→ M6 native extras → M7 money + store release.**

**MVP cut line (ship before W5 finishes):** My Blossom hub + Productivity + Activity + Study, core widgets, accounts/sync, tier gate. Launch focused; depth lands in updates.

---

## 6. Locked decisions (from DESIGN-DOC + this merge)

- **5 aspects** — Mental · Physical · Emotional · Social · Recreation — each a flower (attribute petals + skill stars), fed by **6 modules** (hub **My Blossom** + Productivity · Activity · Meditation · Connection · Recreation). **Build Productivity & Activity first.**
- **Companion = Liri** (own page + dock item, subtly present elsewhere; "Liri Life" game; element quiz Air/Water/Earth/Fire).
- **Tools vs Widgets:** Tools = in-app units; Widgets = their Android home-screen surfacing (same Tool, projected).
- **No-paywall model:** locked content simply doesn't appear; subscriptions live only in Settings; 7-day Cosmos trial; custom-theme creator at the Designer tier.
- **Supabase hardened:** RLS on always (`auth.uid() = user_id`); ids are **text**, never Postgres `uuid` (v0.0.1's live 400). Soft-delete window = **1 week**.
- **Stack pinned to Expo SDK 54** (the newest Simon's device's Expo Go runs); move to a **dev build** at the visual-engine/native-module wave and bump SDK then.
- **Feel over flash:** themes/atmospheres are a *foundation to expand heavily*, Blossom-inspired, with far more customizability — not the final look.

---

## 7. How to resume (for the next session)

1. Read `CLAUDE.md` (entry point) + `docs/STATUS.md` (where we are) + this file (the map).
2. Pull the next wave's first item into STATUS → *Now*.
3. To port a widget: open its Blossom source (`../My App/js/widgets/<type>.js`), copy the pure logic into `src/widgets/<type>/logic.ts` (strip DOM/`window`, add types), rebuild the card/full faces in `View.tsx`, fill `index.ts` against the contract, add one line to `registry.ts`. Add a smoke case for the logic. Verify, then ship.
4. Never re-key SRD/preset/theme data — import the files.

*The brain is ported and tested; the body is rebuilt one proven widget at a time. That's the whole plan.*
