# My Blossom — Claude Code Framework (v0.0.1)

My Blossom is a cozy, fully customizable, all-in-one life app. The user builds their **own** app out of **Modules → Pages → Widgets → Objects**, themed with atmospheres, particles, and weather, gamified through Skills, Quests, Health, and a coin Market, and grounded in the **COSMOS** habit method.

**This is a fresh build (v0.0.1).** It is a native app from day one — **React Native (Expo)**, **Android-first**, also running on **iOS** and the **web** (Windows/Linux/Mac via the browser build), with **Supabase** for accounts and cross-device sync. GitHub is used for source control + testing builds; distribution is the mobile stores. There is no prior code in this folder to maintain — earlier prototypes live in sibling folders and are a **reference only** (see `docs/01` "What to salvage").

This file is the lean entry point. Read the relevant `/docs` file before working on any area — each is the authoritative spec for its domain.

> **★ Product source of truth: `docs/DESIGN-DOC.md`** — Simon's completed, decision-filled master spec. When any doc disagrees with it, it wins; update the doc to match. Key locked decisions (2026): **5 aspects** (Mental · Physical · Emotional · Social · **Recreation**), each a **flower** of **Attribute petals** + **Skill stars**, fed by **6 modules** (hub **My Blossom** + **Productivity**·**Activity**·**Meditation**·**Connection**·**Recreation**); the companion is **Liri** (own page + dock item, subtly present elsewhere, with a "Liri Life" game); **Tools** = in-app units, **Widgets** = Android home-screen versions of Tools; **no-paywall** model (locked content just doesn't appear; subscriptions only in Settings; 7-day Cosmos trial); **Supabase must be hardened** (`docs/02` security section); **build Productivity & Activity first**. Structure map: `docs/06`.

## Every session — start here

1. **Read `docs/00-operating-framework.md`** (how we work) and **`docs/STATUS.md`** (where we are). Together they let you resume in seconds without re-scanning the tree.
2. Then follow the five always-on jobs from the framework:
   - **Overhaul the ask first.** Treat every prompt as a seed: restate it, improve it (cozy · token-efficient · quality · quantity) without drifting from intent, frame a tiny plan (Goal · Approach · Files · Cozy notes · Done-when), then build. (§1)
   - **Spend tokens like coins.** Read only what the task touches, reuse definitions over new code, smallest correct diff, no narration. When a turn burns unusually high usage, end it with one plain line on what drove it. (§2)
   - **Build cozy.** Calm, discoverable, progressive disclosure, opt-in intensity — the user explores at their own pace; nothing is force-fed. (§3)
   - **Track + persist.** Update `docs/STATUS.md` (Now/Next/Done), then **auto-commit + auto-push to `main`** on every completed feature. (§4)
   - **Finish clean.** Meet the Definition of Done before pushing. (§5)

## Required setup: install the grill-me skill

Before any major design or planning session, the `grill-me` skill should be present in `.claude/skills/grill-me/` (it ships with this project). If missing, restore it:

```bash
mkdir -p .claude/skills/grill-me
curl -fsSL https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grill-me/SKILL.md \
  -o .claude/skills/grill-me/SKILL.md
```

**When to use it:** whenever the user proposes a new module, widget, or large feature, invoke grill-me to interview them one question at a time, recommending an answer for every question, until the design is fully resolved. Explore the codebase to answer a question instead of asking when you can.

## Project skills

The operating framework (`docs/00-operating-framework.md`) is installed as triggerable skills in `.claude/skills/`. The doc stays the single source of truth; the skills make the right rule fire automatically. They self-trigger, but you can invoke any by name.

| Skill | Fires when | Spec |
|---|---|---|
| `overhaul-the-ask` | any build request / messy idea-dump | §1 |
| `cozy-check` | adding/changing anything the user sees or feels — keeps it calm | §3 |
| `breathe-life` | building/redesigning a surface — gives it soul (cozy, lively, immersive); fires on "feels flat / generic / AI-slop" | `docs/04` + §3 |
| `organized-code` | writing/refactoring code; adding/removing a tool/module/theme; keeping the codebase clean, modular & overhaul-ready | `docs/01`, `docs/DESIGN-DOC.md` |
| `ship-it` | a feature is finished and verified — Done, STATUS, commit, push | §4 + §5 |
| `usage-check` | "why is my usage so high"; defines the always-on heavy-turn note | §2 |
| `grill-me` | a new module/widget/large feature needs interviewing out | §1 (deep path) |
| `cloud-sync` | accounts / cross-device sync / Supabase tables / RLS / offline-first | `docs/01`, `docs/02` §C |
| `monetize` | subscriptions / tiers / paywall / donations / RevenueCat / Stripe | `docs/02` §D |
| `release-it` | building & publishing a release, store submission, OTA updates | `docs/02` §F–H |
| `learn-from-the-field` | designing/overhauling a feature with a real-world analogue | `docs/research/`, `docs/03` |

## Documentation index

| File | Domain |
|---|---|
| `docs/00-operating-framework.md` | **How we work** — prompt-overhaul, token efficiency, cozy laws, session continuity, git push, Definition of Done. Read first, every session. |
| `docs/STATUS.md` | **Where we are** — live Now / Next / Done ledger. The fast resume point; update as you work. |
| `docs/01-architecture.md` | **What we build on** — RN/Expo + Supabase architecture, the Module→Page→Widget→Object model, storage interface, offline-first sync, project structure, the M0–M7 build order, and what to salvage from earlier prototypes. **Read before any build work.** |
| `docs/02-zero-to-release.md` | **0 → release → updates** — accounts/tools, Expo build, Supabase sync, RevenueCat+Stripe tiers, legal/privacy, testing, Play/App Store submission, OTA updates. Facts verified June 2026. |
| `docs/03-market-and-suggestions.md` | **Strategy** — competitor lessons, the consolidation wedge, prioritized P0–P2 suggestions, technical patterns to borrow, revenue reality. |
| `docs/04-art-direction.md` | **The visual soul** — the living-garden art direction: the layer-cake, per-theme worlds, the companion, materials, motion, earned delight, anti-patterns. The `breathe-life` skill enforces it. **Read before any visual work.** |
| `docs/05-companion-and-elements.md` | **The heart** — **Liri** (the companion), the 15-q element quiz (Air/Water/Earth/Fire), fixed-element/swappable-form (caps + Cosmos overrides), aspect-driven growth, Liri Life, the Liri page, Pantheon/book-world future. §9 holds the locked decisions. **Read before companion/onboarding/element work.** |
| `docs/06-modules-and-aspects.md` | **Structure map** — the 5 aspects → Attribute → Skill model, the 6 modules, the Blossom loop, flower + radar rendering, Liri Life, build priority. **Read before any module/aspect/growth work.** |
| `docs/DESIGN-DOC.md` | **★ Product source of truth** — Simon's full decision-filled spec (every aspect/attribute/skill, per-module intent, all answers). The authority; other docs defer to it. |
| `docs/research/INDEX.md` | **Research library** — market research + technical teardowns of comparable apps. Read the one relevant section before designing a feature with a real-world analogue (the `learn-from-the-field` skill points here). |

> Detailed per-domain specs (every widget, the COSMOS method in depth, gamification math, each preset module, the theming/particle/atmosphere/weather engines) carry over **conceptually** from the earlier prototypes. Port a spec into a new numbered doc here *when you start building that domain*, so this folder's docs always describe the code that actually exists.

## Tech stack (the new non-negotiables)

- **React Native + Expo (managed), TypeScript.** Android-first; iOS and web from the same codebase. **Currently pinned to Expo SDK 54** (RN 0.81 / React 19.1) — the newest SDK Simon's device's Expo Go supports. Bump to a newer SDK once we move to a development build (planned M3, for Skia/native modules Expo Go can't run). Reconcile any dep with `npx expo install --fix`.
- **Navigation:** Expo Router (file-based) — mirrors Module → Page.
- **Local storage:** `expo-sqlite` (structured data) + `react-native-mmkv` (tiny prefs). **Everything goes through one `store` interface** (`docs/01`) — adapters swap underneath; the interface never changes.
- **Cloud sync:** **Supabase** (Postgres + Auth + Row Level Security + Realtime). **Offline-first:** the UI reads/writes local; sync mirrors to the cloud. Never block a render on the network.
- **Graphics/FX:** `@shopify/react-native-skia` for particles, atmospheres, weather, graphs, drawing, canvas, maps; `react-native-reanimated` + `react-native-gesture-handler` for motion/touch. One shared frame loop; pooled, capped, paused when backgrounded.
- **Payments:** `react-native-purchases` (RevenueCat) on mobile; Stripe on web.
- **Native extras:** home-screen widgets (`react-native-android-widget` / iOS WidgetKit), `expo-notifications` + background tasks for real alarms/reminders.
- **No runtime CDNs.** Everything bundled. Offline is sacred.

## Engineering rules

1. **Spec first.** Read the relevant `/docs` section before implementing. If the spec is silent, choose the simplest cozy default and note the decision in the doc.
2. **Everything is data.** Modules, pages, widgets, themes, particles are JSON definitions rendered by generic engines — never hard-code a preset where a definition object would do. Presets are bundled definition files in `src/presets`.
3. **Widgets are plugins.** A widget is `{ type, logic, View, defaults, settingsSchema }`. New widget = new folder in `src/widgets/<type>/`, registered once, zero edits elsewhere. **Keep `logic.ts` pure (no view code); the `View.tsx` only renders + dispatches.**
4. **Performance budget:** 60fps with particles + atmosphere on a mid-range Android phone. Single Skia frame loop, object pooling, capped counts, pause when backgrounded. Animate via Reanimated on the UI thread; no per-frame React re-renders.
5. **Offline always.** Every feature works with zero network. Local-first; sync is a mirror.
6. **Calm UI.** Soft corners (12–16px), generous whitespace, 150–250ms ease-out, respect `prefers-reduced-motion`. The UI invites; it never demands. See `docs/00` §3.
7. **Icons over emoji.** An inline SVG/vector icon set everywhere in chrome/widgets/pages. Emoji only as optional user-chosen accents on Tabs and in interactive/settings flourishes.
8. **Never lose data.** Writes flush on app background/close; deletions are soft (30-day trash) unless a spec says otherwise; no migration drops user data. Supabase: **Row Level Security on, always.**
9. **Verify.** After any feature: run on a device/emulator (Expo Go or a dev build), check the console, test offline, and test at a 360px-wide layout.

## Working agreements

- Keep modules/components under ~300 lines; split when larger.
- TypeScript types on public functions and the store interface.
- One commit per feature, conventional message + version tag: `feat(widgets): flower graph petal layout (v0.x.y)`. Auto-push to `main` when done — see §4.
- When the user asks for something new and underspecified, use **grill-me** before coding.
- Don't re-key content from the prototypes (SRD data, presets, COSMOS copy) — import the files; see `docs/01` "What to salvage".
- Workflow details (prompt overhaul, token rules, cozy laws, STATUS ledger, Definition of Done) live in `docs/00-operating-framework.md`.
