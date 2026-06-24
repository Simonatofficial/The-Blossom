# 17 — My Blossom V3: the all-in-one overhaul

> **Authoritative spec** for turning *The Blossom* into *My Blossom*. This doc folds the
> entire **Transfer Pack** (`/My Blossom — Transfer Pack/`) into the project's framework and
> adds the two decisions the pack left open: the **Hub** layer and the **Tools** vocabulary.
> Read this before any V3 work. It supersedes the V2 aspect/module plans in `docs/13` where
> they conflict; everything else in `docs/01`–`16` still stands.

## The one rule

**Add, don't replace.** The last attempt failed because it rebuilt from scratch in a new stack
(React Native / Expo) and nothing worked. We do the opposite: the finished app's skeleton —
IndexedDB store, the generic Module/Page/Widget engines, the value system, gamification, themes,
particles — **stays exactly as it is.** V3 is new files, new registry entries, new preset
definitions, and a thin layer around the existing engine. **No migration ever drops user data.**
Every step ships independently; the app keeps working throughout.

The Transfer Pack itself is the long-form reference (full SQL, code blueprints, art direction,
release bible, research). This doc is the in-framework map: what changes, where it lands, in what
order, and how nothing breaks.

---

## 1. What V3 changes (the headline list)

1. **5 Aspects, not 4** — Mental · Physical · Emotional · Social · Recreation. The growth spine.
2. **Widgets → Tools** (user-facing). Each tool is fully self-contained: it works alone and never
   *depends* on another, but can read another's data as a bonus.
3. **Aspect Tools with a built-in Flower Graph** — the flower-graph view becomes an internal
   feature of an Aspect tool, and the aspect itself is an XP track that levels from its attributes
   and skills.
4. **Liri** — a new soul-bonded elemental companion that grows from your aspects.
5. **Hub layer** — a real new container above Module: Workspace → **Hub** → Module → Page → Tool →
   Object. Built by evolving the existing module-groups/bookmark feature.
6. **New 6-module structure**, each connecting back to the My Blossom hub.
7. **Drastic UI refresh** layered on the existing Living-Layout feel system (`docs/15`).
8. **Cloud sync** (Supabase), **publish to mobile** (Capacitor/TWA), **subscriptions**
   (RevenueCat, no-paywall).

All of it is additive. Existing saves load into the new layout unchanged (§9).

---

## 2. The 5 Aspects → Attributes → Skills

Five **aspects**, each rendered as a flower: its **attributes** are petals (sized by level), its
**skills** are stars orbiting it. Pure data in `js/presets/aspects.js`, rendered by the *existing*
Flower Graph — no new renderer.

| Aspect | Module it lives in | Attributes (petals) |
|---|---|---|
| **Mental** | Productivity | Focus · Memory · Problem Solving · Learning · Emotional Intelligence |
| **Physical** | Activity | Strength · Endurance · Mobility · Nutrition · Recovery |
| **Emotional** | Meditation | Self-Awareness · Self-Regulation · Resilience · Self-Compassion · Motivation |
| **Social** | Connection | Communication · Empathy · Relationships · Collaboration · Leadership |
| **Recreation** | Entertainment | Creativity · Mastery · Presence · Adventure · Joy |

Each attribute carries four named skills (full roster in `TRANSFER.md` §2.1 — port verbatim into
`js/presets/aspects.js`). Levels start at 1.

**Rules.** A single action can feed more than one aspect/attribute (a team sport → Physical *and*
Social), so contributions are modelled as a list: `{ aspect, attribute, amount, skill? }`. Untouched
attributes stay at level 1.

---

## 3. The Blossom growth loop (Tools feed Aspects)

The spine that makes the app feel like *one thing*: real activity grows the right petal → the
aspect → Liri.

**The contract (additive to the registry).** A tool may expose an optional, **idempotent**
`grows(before, after, action)` that returns the contributions newly earned by an action — `[]` when
nothing new happened (re-tapping the same habit day earns nothing).

```js
// In a tool definition (js/widgets/<tool>.js):
grows(before, after, action) {
  return [{ attribute: 'discipline', amount: 10 }]; // [] if nothing new
}
```

Port these mappings: Habit (newly-logged day → `+10` to its `growthAttribute`, default
`discipline`), Quest (step completed → `+10 focus`), Goal (milestone → `+20 wisdom`), Skill
(granted XP → `learning` 1:1, tagged with the skill name). A tool's `config.growthAttribute` lets
the *same* tool feed a different aspect per module (an Activity habit → `strength`).

**Built (v120).** `js/presets/aspects.js` (the full 5×5×4 roster), `js/core/growth.js` (ledger
+ curve + the `runGrows`/`initGrowth` bridge), the `grows()` registry contract on Habit · Quest ·
Goal · Skill, and the self-contained **Aspect tool** (`js/widgets/aspect.js`, reuses `drawFlower`).
The two new aspect modules **Productivity** (Mental) and **Activity** (Physical) and the default
Hub map (`js/presets/hubs.js`) ship as data. **Routing decision (since the old `discipline`/`wisdom`
defaults aren't in the new roster):** a contribution with *no* attribute routes to the emitting
module's aspect's **first petal** (Productivity→Focus, Activity→Strength); `config.growthAttribute`
overrides it; amounts are Habit/Quest **+10**, Goal milestone **+20**, Skill XP **1:1 → Learning**
tagged with the skill name. Idempotency is enforced by the action key (`<id>:complete:<date>` etc.).

**The growth engine (`js/core/growth.js`).** A ledger `aspectId → attributeId → { level, xp }`.
`applyGrowth(ledger, {aspect, attribute, amount})` adds XP and rolls levels with the existing curve
`xpToNext(level) = max(10, round(50·level^1.4/10)·10)`. `aspectLevel` = rounded mean of its
attribute levels. The module a tool lives in decides which aspect its contributions route to
(`module.feedsAspect`), unless the tool overrides via `config.growthAttribute`.

**Module → aspect map:** `productivity→mental · activity→physical · meditation→emotional ·
connection→social · entertainment→recreation`. The **My Blossom hub** shows all five flowers + Liri.

### 3.1 Aspect Tool (the flower, self-contained)

The flower-graph view becomes a built-in feature of a self-contained **Aspect tool**:

- **External face:** the aspect's flower at a glance (petals sized by attribute level), current
  aspect level, recent growth.
- **Internal view:** the full Flower Graph (petals = attributes, stars = skills), per-attribute XP
  bars, and the skills that feed it.
- It is **its own XP track** — the aspect levels from its attributes and skills, exactly like a
  Skill widget levels from its XP. It reads the growth ledger; pure data in, visuals out. It works
  standalone (drop one on any page) and needs no other tool present.

---

## 4. Liri — the companion

A soul-bonded elemental companion who grows with your aspects. Built as a **new module + a few
tools** (additive); see `TRANSFER.md` §4 and `02-Planning-Frameworks/05-companion-and-elements.md`
for the full design.

- **Soul-bonded & personal** — feels connected to *you*, not generic.
- **Element** chosen by a **15-question quiz** → Air / Water / Earth / Fire. Element is *fixed*; the
  **form** can change over time (with caps; Cosmos tier can override).
- **Growth from aspects:** Physical → size · Mental → abilities · Emotional → colours · Social →
  beauty.
- **Liri's own page** to feed, dress, change, play; **also ambiently present** on other pages —
  tucked by a button / on a screen edge / wandering (configurable), never covering the screen. A
  **dock/top-bar avatar** jumps to Liri's page.
- **Liri Life** — a gentle duck-life-style mini-game: bond, mood, journal, milestones; spend the
  existing **coin wallet** on food, toys, clothes.

**Build pieces:** `js/presets/modules/liri.js` (Home / Companion / Liri-Life pages); tools
`companion`, `elementquiz`, `lirilife`, each registering like any tool. Liri reads the growth
ledger to render size/abilities/colours/beauty.

---

## 5. The Hub layer (new — evolved from module groups)

**Decision:** Hub is a *real* layer, not just a prettier group. The model becomes:

```
Workspace → Hub → Module → Page → Tool → Object
```

A **Hub** is a package of related modules that connect to each other, and Hubs can connect to other
Hubs. Example: a **Physical** hub holds exercising, nutrition, and cooking-book modules, all linked,
and connects to the **My Blossom** hub at the centre.

### 5.1 How it's built (no data loss)

It grows out of the existing **module-groups** feature (`js/core/groups.js`, shipped v93–v94),
where groups are already ordered sets of modules stored in the synced `settings` meta blob. V3
**promotes groups into first-class Hub objects** while keeping the computed built-ins (All,
Favorites) as views.

- **New store kind `hubs`** — a Hub object: `{ id, name, icon, theme?, moduleIds:[], links:[{toHubId, rel}], identity? }`.
  `links` enables hub-to-hub connections; `identity` plugs into the Living-Layout feel cascade
  (`docs/15`) so a Hub is a *world of worlds*.
- **Migration (one-time, on first V3 load):** every existing `settings.moduleGroups` entry becomes a
  Hub object with the same id/name/icon/members. `All` and `Favorites` stay computed. Nothing is
  deleted; if migration is skipped or fails, the old groups still render (read-through fallback).
- **Top rail** already pages through groups with swipe/arrows (v115); it now pages through Hubs. The
  "Manage Groups" panel (v94) becomes "Manage Hubs" with the added hub-to-hub link editor.
- A Hub may carry its own theme/atmosphere so entering a hub feels like entering a place.

### 5.2 The default hub map

The **My Blossom** hub is the centre; each aspect module is reachable from it and links back.

```
            ┌──────────── My Blossom (hub / centre) ────────────┐
            │   shows all 5 aspect flowers + Liri + the map      │
            └───────────────────────────────────────────────────┘
   Productivity   Activity   Meditation   Connection   Entertainment
    (Mental)     (Physical)  (Emotional)   (Social)    (Recreation)
```

Hubs can also be deeper than one module (the Physical hub example): the user composes their own.

---

## 6. New module structure

Six preset modules, each wired to its aspect and connecting back to the My Blossom hub:

| Module | Aspect | Theme of contents |
|---|---|---|
| **My Blossom** | — (hub) | The centre: all five flowers, Liri, the hub map, the COSMOS overview. |
| **Productivity** | Mental | Tasks, focus, study, habits, goals. |
| **Activity** | Physical | Exercise, nutrition, recovery, tracking. |
| **Meditation** | Emotional | Breathwork, journaling, mood, self-compassion. |
| **Connection** | Social | Relationships, communication, people. |
| **Entertainment** | Recreation | Creativity, play, adventure, joy. |

**Build Productivity & Activity first** (highest daily use); the others follow. These are preset
definition files in `js/presets/modules/` — the same data-driven engine renders them, so adding a
module needs zero engine changes.

---

## 7. Tools vocabulary (the rename)

**Decision: user-facing labels first.** Rename **"widget" → "tool"** everywhere the user sees it —
chrome, menus, the add gallery, docs prose — while keeping internal code identifiers
(`widgets/registry.js`, file names, the `Widget` interface) **unchanged for now** to avoid a risky
refactor. The word **"Widget"** is reserved for the *Android home-screen widgets* (a later
Capacitor feature), per the Transfer Pack glossary: a **Tool** is the in-app thing; a **Widget** is
the same tool surfaced on the phone home screen.

**Self-containment is the contract.** Every tool must function on its own — drop it on a blank page
and it works. It may *read* another tool's data (links, growth, graph points) as a bonus, but never
*depend* on it; a missing linked tool degrades gracefully and breaks nothing. This is already the
engine's design (`ctx` only; tools never import each other) — V3 just makes it a stated law.

---

## 8. Base tools: sync, publish, subscriptions

These are "base tools" — platform capabilities, not page tools. Full blueprints in `TRANSFER.md`
§6–8 and the release bible `02-Planning-Frameworks/02-zero-to-release.md`.

**Cloud sync — Supabase (`TRANSFER.md` §6).** Accounts + cross-device sync without changing how the
app works: it keeps reading/writing IndexedDB (instant, offline) and mirrors to Supabase in the
background. New `js/core/sync.js`, offline-first, **last-write-wins by `updatedAt`**, soft deletes.
Non-negotiables: **Row Level Security always on** (`auth.uid() = user_id`), **anon key only** on the
client, **text ids** (our friendly ids), never re-stamp the clock on a pulled row. Auth: anonymous
by default (instant, no signup wall), "Save your account" upgrades to email/password (+ Google
optional) so the same garden syncs across devices.

**Publish to mobile — Capacitor / TWA (`TRANSFER.md` §7).** The app is a web PWA, so it's
**wrapped, not rebuilt.** Fastest path: PWABuilder → Android TWA (auto-updates on redeploy).
Recommended: **Capacitor** (`com.simon.myblossom`, `--web-dir=.`) for native purchases, push,
alarms, and later home-screen Widgets, with Live Updates for OTA. **Note:** Expo/EAS is
React-Native-only and does *not* apply to a web app — that's exactly why the earlier rebuild felt
like starting over. iOS later from the same Capacitor project.

**Subscriptions — RevenueCat, no-paywall (`TRANSFER.md` §8).** One SDK across Play Billing,
App Store, and Stripe. **Locked content simply doesn't appear** — no nag walls, no blocked buttons;
the free app is whole. Subscriptions live **only in Settings**. Tiers: **Free** · **Cosmos** (full
features + 7-day trial) · **Designer** (creation tools — custom-theme creator, advanced building).
One gate helper: `has(tier)` → absent entitlement hides the feature, never blocks it.

---

## 9. No data loss — how the new layout keeps every save

The user's worry — *"will I lose progress?"* — is answered structurally:

- The **store, schemas, and ids are unchanged.** Modules, pages, widgets/tools, objects, themes,
  the wallet, and gamification state all load exactly as today.
- V3 changes are **new definitions + new layers**, not rewrites. Adding a module re-renders it with
  the updated preset *information* (the new look, the aspect wiring) over the **same skeleton** —
  the engine that draws it is the same one, so existing instances keep their data.
- The **Hub layer is additive** (§5.1): groups migrate into hubs with a read-through fallback;
  nothing is deleted.
- The **growth ledger** is new state that *accumulates* from activity; it never overwrites existing
  widget data.
- Every deletion stays **soft** (30-day trash, `docs/01`), and writes still flush on
  `visibilitychange`/`pagehide`.

If any V3 feature would require dropping or rewriting user data, **don't ship it** — find an
additive path or note the decision in this doc first.

---

## 10. Phased build order (each phase ships on its own)

Mirrors the Transfer Pack's transfer sequence, reordered so the lowest-risk, no-data-touch work
comes first and the app is always usable.

**Phase 0 — Foundation & rename (no data touched).**
Rebrand chrome to *My Blossom* (manifest already done at v86); adopt the **Tools** vocabulary in all
user-facing strings (§7); land the 6 preset module definitions + the default Hub map as data;
write `js/presets/aspects.js` (data only, nothing rendered yet).

**Phase 1 — Hub layer.**
Add the `hubs` store kind, the one-time groups→hubs migration with fallback, the hub-to-hub link
editor, and re-point the top rail / Manage panel at hubs (§5).

**Phase 2 — Aspects + growth loop.**
`js/core/growth.js` ledger + curve; the `grows()` registry contract; port the Habit/Quest/Goal/Skill
mappings; the self-contained **Aspect tool** with its built-in flower graph and own XP (§3).

**Phase 3 — Liri.**
The Liri module + `companion`/`elementquiz`/`lirilife` tools; ambient presence + dock avatar;
Liri reads the growth ledger (§4).

**Phase 4 — Cloud sync.**
Supabase schema + RLS + auth + `js/core/sync.js`; verify on two devices (§8).

**Phase 5 — Publish to mobile.**
Capacitor wrap (or TWA first) → internal testing track on a real phone (§8).

**Phase 6 — Subscriptions.**
RevenueCat no-paywall tiers + 7-day Cosmos trial, Settings-only (§8).

**Phase 7 — Look & feel + extras.**
Drastic UI refresh on top of Living Layout (`docs/15`); custom theme creator (Designer tier);
interactive atmosphere effects; Android home-screen Widgets.

Use **grill-me** (per `CLAUDE.md`) to interview out each new module/tool before building it, and
**ship-it** (Definition of Done → STATUS → commit → push) at the end of each phase.

---

## 11. Locked decisions + glossary

**Locked.** 5 aspects (Mental · Physical · Emotional · Social · Recreation), each Aspect →
Attribute → Skill, drawn as flowers. 6 modules (My Blossom hub · Productivity · Activity ·
Meditation · Connection · Entertainment), Productivity & Activity first. **Hub** is a real layer
above Module, evolved from groups, hubs link to hubs. **Tools** = in-app (user-facing rename of
widgets); **Widgets** reserved for Android home-screen. Companion = **Liri** (soul-bonded, fixed
element via 15-q quiz, swappable form, own page + ambient + dock, Liri Life game). **No-paywall**
subscriptions, Settings-only, 7-day Cosmos trial, **Designer** creation tier. **Supabase** sync,
RLS always on, anon key only, text ids, soft delete. Wrapped with **Capacitor/TWA** (not Expo).
Android-first, web at launch, iOS later. Offline always. **Add, never rebuild.**

**Glossary.** *Aspect* — one of five sides of life, a flower. *Attribute* — a petal. *Skill* — a
star orbiting it. *Blossom loop* — tools emit growth → attributes → aspects → Liri. *Tool* — an
in-app widget; *Widget* — the same tool on the phone home screen; *Object* — a tool's data. *Hub* —
a package of connected modules, itself connectable to other hubs. *Liri* — your soul-bonded
elemental companion. *Entitlement* — an active tier (Cosmos/Designer) that *reveals* content.

**Source materials:** the full long-form references live in `/My Blossom — Transfer Pack/`
(`TRANSFER.md`, `01-Design-Decisions/DESIGN-DOC.md`, `02-Planning-Frameworks/`, `03-Build-Frameworks/`,
`04-Research/`, `06-ACCESS-…`). This doc is the in-framework authority; the pack is the depth behind it.
