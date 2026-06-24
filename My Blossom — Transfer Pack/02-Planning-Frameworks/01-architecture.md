# 01 — Architecture (fresh build)

How My Blossom v0.0.1 is put together: the core model, the tech stack, the storage interface that makes sync and offline cheap, the project structure, the build order, and what to salvage from the earlier prototypes. **Read this before any build work.** Publishing mechanics are in `docs/02`; strategy in `docs/03`.

> **Guiding principle:** keep **logic** (pure data + math) ruthlessly separate from **rendering** (the views). The logic is the app's brain and is platform-independent; the views are the body and are RN-specific. This separation is what lets one widget = one plugin, what makes Supabase "just another storage adapter," and what kept the earlier prototypes' logic reusable. Protect it everywhere.

---

## 1. The core model (unchanged from the vision)

Four nested concepts. This is the whole mental model of the app.

- **Workspace** — the entire app. One per user.
- **Module** — an "app inside the app" (The Blossom, D&D DM, World Builder, Study, Infinite Canvas…). The user switches between them.
- **Page** — a screen inside a module (Home, Calendar, Statistics, Characters, Maps…). Organizes widgets.
- **Widget** — the interactive unit on a page (Notes, Tracker, Quest, Skill, Graph, Calendar, Canvas…). Openable into its own full view.
- **Object** — the data inside widgets (a note, a drawing, a character sheet, a goal, a journal entry). **Objects are referenceable from anywhere** — a drawing can attach to a D&D character; a habit can feed a goal; a tracker can feed a graph. This cross-linking is the soul of the app.

Everything above is **data**: modules/pages/widgets/themes/particles are JSON definitions rendered by generic engines (engineering rule 2). Presets are just bundled definition files in `src/presets`.

---

## 2. Tech stack

Restated from `CLAUDE.md` so this doc stands alone.

- **Expo (managed) + React Native + TypeScript.** Android-first; iOS + web from one codebase. Verify the current stable line at build time (Expo SDK 56 / RN 0.85 / React 19.2 as of June 2026).
- **Navigation:** Expo Router (file-based) — `app/` routes mirror Module → Page.
- **Local storage:** `expo-sqlite` for structured data; `react-native-mmkv` for tiny prefs (last module, theme id).
- **Cloud sync:** **Supabase** (Postgres + Auth + RLS + Realtime). Offline-first.
- **Graphics/FX:** ⚠ **MUST be cross-platform — one visual engine that renders on web (PC), Android, and Apple.** Skia alone failed this (skipped on web; flowers came out as blobs). **Decision (see `docs/STATUS.md`):** the themed background visual engine (themes · atmospheres+weather/interactive · particles · the flower) is **ported from the previous app's HTML/Canvas2D engine** (the same one the approved mockups used, which Simon loved), rendered via a **transparent WebView on native + a native `<canvas>` on web**. UI/cards/nav/tools stay native RN over it. Re-confirm this before resuming any FX work.
- **Payments:** `react-native-purchases` (RevenueCat) on mobile; Stripe on web.
- **Native extras:** `react-native-android-widget` / iOS WidgetKit; `expo-notifications` + `expo-background-task`.
- **No runtime CDNs.** Everything bundled.

---

## 3. The storage interface (the most important decision)

**Every widget reads/writes through one small `store` interface.** Storage *implementations* (adapters) sit behind it; the interface never changes. This is what makes offline-first and cloud sync cheap and keeps widgets portable.

```ts
// src/core/store/types.ts  (shape, not final)
export interface Store {
  get(kind: string, id: string): Promise<Obj | null>;
  put(obj: Obj): Promise<void>;                 // upsert; sets updated_at
  query(kind: string, where?: Query): Promise<Obj[]>;
  remove(id: string): Promise<void>;            // SOFT delete (sets deleted_at)
  link(fromId: string, toId: string, rel?: string): Promise<void>;
  subscribe(kind: string, cb: (objs: Obj[]) => void): () => void;
}

export interface Obj {
  id: string; kind: string; moduleId?: string;
  data: unknown;                                 // the widget's payload
  updatedAt: number; deletedAt?: number | null;
}
```

**Adapters (added in order, never changing the interface):**
1. `sqlite` — local, the source of truth the UI reads. (Phase M1.)
2. `supabase` — cloud mirror for sync. (Phase M4.)

**Offline-first sync rules:**
- The UI always reads/writes the **local** adapter. Never block a render on the network.
- A background process mirrors local changes up to Supabase and pulls remote changes down.
- **Last-write-wins per object** via `updatedAt` for v1 (simple, good enough; revisit if real conflicts appear).
- Deletions are soft (`deletedAt`); a sweep clears them after 30 days.
- Flush pending writes on app background/close; resume on foreground/online.
- **Supabase Row Level Security on, always** (`auth.uid() = user_id`). See `docs/02` §C for the table + policy SQL.

---

## 4. The widget plugin contract

A widget is a folder, registered once:

```
src/widgets/<type>/
  logic.ts        # PURE: state shape, defaults, reducers, math. No view, no RN imports.
  View.tsx        # RN component: renders state + dispatches actions. No business logic.
  settings.ts     # settingsSchema (declarative) — drives the settings panel generically
  index.ts        # registers { type, logic, View, defaults, settingsSchema }
```

New widget = new folder, registered in the widget registry, **zero edits elsewhere** (rule 3). Keep `logic.ts` pure so it ports, tests, and reuses freely; the `View.tsx` only renders and dispatches.

**Tools are self-contained (hard rule, from the original app's mistakes).** Widgets are also called **Tools** — and each must be a *complete, standalone instrument* (a real notebook, a real breathing trainer), not a thin box that only works wired to others. A Tool **may optionally** read another's data (a graph *can* surface a tracker), but **never depends** on one: if a linked Tool is absent or empty, this Tool still works and nothing throws. Connections are enrichments, not couplings. This is the fix for the "too buggy when widgets relied on each other" problem. See `docs/05` §6.

**The Blossom loop.** Modules aren't islands — **each feeds an aspect**, via the **Aspect → Attribute → Skill** hierarchy (full model in `docs/06`): Productivity→Mental, Activity→Physical, Meditation→Emotional, Connection→Social, Recreation→Recreation. Those five aspects drive the aspect-flowers + the **Liri's** growth (`docs/05`, `docs/06`). Implement as data/events: a module emits aspect-XP (tagged by attribute/skill) the Blossom consumes; modules never reach into each other directly (keeps tools independent).

**Tools vs Widgets.** Inside the app the interactive units are **Tools**. On Android, the same Tools can also be placed on the phone's **home screen as Widgets** — a Widget is a home-screen surfacing of a Tool, not a separate thing. Build Tools so their render/data can be projected into a home-screen widget later (keep logic pure + data in the store).

---

## 5. Project structure (target)

```
my-blossom/
  app/                       # Expo Router routes — the shell + module/page screens
    _layout.tsx              # root: providers (Theme, Store), nav frame
    index.tsx                # entry → current module
  src/
    core/
      store/                 # store interface + sqlite adapter + supabase adapter + sync
      values.ts codes.ts ids.ts wallet.ts saves.ts   # ported pure logic
    fx/                      # Skia particles / atmosphere / weather + one shared frame loop
    widgets/<type>/          # plugin folders (logic.ts + View.tsx + settings.ts + index.ts)
    presets/                 # module/page/widget/theme/particle definitions + SRD content (data)
    theme/                   # JS theme object + ThemeProvider (feel-tokens)
    ui/                      # shell, FAB, panels, nav (the chrome)
  assets/                    # icons, fonts, images
  docs/ .claude/             # this framework
  app.json eas.json .env.example tsconfig.json
```

---

## 6. Build order (M0 → M7) — shippable at each step

Each phase ends green and pushed (run `ship-it`). Don't start the next until the current is verified on a real Android phone.

> **⚖ The phases are NOT equal — don't let "5/8" mislead.** M0–M4 are the *invisible engine* (storage, sync, theme tokens, FX plumbing): hard, correct, but ~0% of what the user sees/feels. **M5 is the actual app** — modules, pages, real tools, the Liri, the canonical cozy look — i.e. ~80% of the felt product. Track **felt-product %** separately from **engine %** in `docs/STATUS.md`. A green M4 does not mean the cozy app exists.

- **M0 — Skeleton.** `create-expo-app` (TS), Expo Router, `ThemeProvider`, one empty Module screen + tab bar. Prove the shell renders and themes apply. *(Repo/EAS/GitHub setup: `docs/02` Phase A–B.)*
- **M1 — Storage interface + local.** Build the `store` interface + `sqlite`/`mmkv` adapters. Blossom code import/export. Prove data persists across restarts. **No cloud yet.**
- **M2 — First three widgets, end to end.** Notes, Tracker, Quest (logic pure, Views new). Prove the Module→Page→Widget→Object loop + settings work. This validates the plugin pattern before scaling.
- **M3 — Theming + FX.** Particles/atmospheres/weather in Skia (opt-in/soft per cozy law); the Flower graph. Prove 60fps on a mid-range phone.
- **M4 — Accounts + sync.** Add the `supabase` adapter behind the same interface (anonymous auth first, email upgrade later). Prove two devices sync. (`docs/02` §C, `cloud-sync` skill.)
- **M5 — Scale the widgets.** Remaining widgets in priority order (Study → Tabletop → Canvas/World → games). Each: pure logic, new View, registered, verified.
- **M6 — Native extras.** Home-screen widgets, push notifications, real background alarms/reminders.
- **M7 — Money + release.** RevenueCat tiers, Stripe web, calm paywall (`monetize`), then store submission (`release-it`, `docs/02` §F–H).

**MVP cut line (ship to stores before M5 finishes):** the Blossom module (Home/Calendar/Blossom pages) with Notes, Tracker, Quest, Habit, Goal, Skill, Journal, Flower graph + accounts/sync + the Free/paid tier gate. **Launch focused, not with all modules** (`docs/03`). Depth lands in updates — which is also the cozy law (discoverable, not delivered).

---

## 7. What to salvage from the earlier prototypes

Sibling folders contain earlier builds (a mature vanilla-JS PWA and an early Expo attempt). **They are reference only — don't depend on them, don't maintain them.** But don't re-key what's already correct, either. Salvage by *porting files*, not retyping:

| Salvage | What it is | How to bring it in |
|---|---|---|
| **Conceptual specs** | The full designs for widgets, COSMOS method, gamification math, preset modules, theming/particle/atmosphere/weather behavior | Port the relevant spec into a **new numbered doc here** when you start building that domain, so this folder's docs always match the code that exists. |
| **Pure logic** | Game engine, graph math, flashcard model, notebook parser, COSMOS rules, value/wallet math | Copy the function bodies into `src/core` / `src/widgets/<type>/logic.ts`, strip any DOM/`window` touch, add TS types. |
| **Tabletop SRD content** | Hundreds of hours of D&D 5e data | Import the data files directly. **Never re-key.** |
| **Preset & theme definitions** | Modules/pages/widgets/themes/particles as JSON | Import as-is into `src/presets`; they're already data. |
| **Design tokens / feel system** | The cozy feel values and rules | Re-express as a JS theme object consumed by `ThemeProvider`. Values carry; delivery changes (CSS vars → JS theme). |

**Do not salvage** the DOM/CSS view layer, the hash router, or the Canvas2D draw calls — those are rebuilt natively (RN components, Expo Router, Skia).

**User data migration:** earlier PWA users export a Blossom save code (or full backup) and import it here. The code format is portable by design — confirm the importer round-trips before launch so no one loses a garden.

---

### One-line summary
*Pure logic behind a stable `store` interface, widgets as plugins, presets as data, views in RN + Skia, Supabase as just another adapter — built M0→M7, salvaging the brain of the old prototypes and rebuilding only the body.*
