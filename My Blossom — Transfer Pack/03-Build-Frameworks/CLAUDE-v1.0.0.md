# My Blossom v1.0.0 — Claude Framework

My Blossom is a cozy, fully customizable, all-in-one life app. The user builds their **own** app out of **Modules → Pages → Widgets → Objects**, themed with atmospheres/particles/weather, gamified through Skills · Quests · Health · a coin Market, grounded in the **COSMOS** habit method, and accompanied by **Liri**.

**v1.0.0 is the merge.** It fuses **The Blossom** (`../My App`, v119 — the full, beloved feature set) with **My Blossom v0.0.1** (`../My Blossom v0.0.1` — the clean React Native / Expo / Supabase, Android·iOS·Web build). Read **`docs/MERGE-SPEC.md` first** — it is the master plan for the whole fusion and the source of truth when any doc disagrees.

> **The merge rule in one line:** *The Blossom's whole body and soul, rebuilt on My Blossom's clean cross-platform spine — port what works, don't reinvent it.* When two builds disagree on **what a feature does**, The Blossom wins; on **how it's built**, v0.0.1 wins.

## Every session — start here
1. Read **`docs/MERGE-SPEC.md`** (the map), then **`docs/STATUS.md`** (where we are).
2. Then the five always-on jobs: **overhaul the ask** (restate → improve cozy/lean → tiny plan → build) · **spend tokens like coins** · **build cozy** (calm, discoverable, opt-in intensity) · **track + persist** (update STATUS, commit, push) · **finish clean** (Definition of Done before pushing).

## The five merge principles (from MERGE-SPEC §1)
1. **Port, don't reinvent** — every widget/module already exists in The Blossom; translate it (logic copied, view rebuilt), never re-imagine from scratch. This is the fix for "the upgrades became downgrades."
2. **Brain/body split is law** — `logic.ts` is pure + node-testable (no RN); `View.tsx` only renders + dispatches.
3. **Tools are self-contained** — a Tool works alone; it may optionally read another's outputs but never depends on one. `WidgetHost` is the only thing that touches storage.
4. **Everything is data** — modules/pages/widgets/themes/particles/SRD are JSON rendered by generic engines.
5. **Offline is sacred; sync is a mirror** — UI reads/writes local; Supabase mirrors in the background (LWW); no render waits on the network.

## Tech stack (non-negotiable)
- **Expo (managed) + React Native + TypeScript.** Android-first; iOS + web from one codebase. **Pinned to Expo SDK 54** (Simon's Expo Go cap); bump on a dev build at the visual-engine wave. Reconcile deps with `npx expo install --fix`.
- **Navigation:** Expo Router (file-based) — `app/` mirrors Module → Page.
- **Local storage:** `expo-sqlite` (structured) + tiny prefs. Everything goes through one `Store` interface (`src/core/store/types.ts`); adapters swap underneath, the interface never changes.
- **Cloud sync:** **Supabase** (Postgres + Auth + RLS + Realtime), offline-first, last-write-wins.
- **Graphics/FX:** the **ported Canvas2D visual engine** in a transparent WebView (native) + canvas (web) — cross-platform, unlike raw Skia. UI/cards/nav stay native RN over it.
- **No runtime CDNs.** Everything bundled. Offline always.

## Engineering rules
1. **Spec first** — read the relevant `docs/` section (and the Blossom source) before building.
2. **Everything is data** — never hard-code a preset where a definition object will do.
3. **Widgets are plugins** — new Tool = new `src/widgets/<type>/` folder (`logic.ts` pure + `View.tsx` + `index.ts`) + one line in `registry.ts`. Zero edits elsewhere.
4. **Performance budget** — 60fps with particles on a mid-range Android; single frame loop, pooled, paused when backgrounded.
5. **Offline always** · **Calm UI** (soft corners, generous space, 150–250ms ease) · **Icons over emoji** · **Never lose data** (soft delete, 1-week trash; RLS on always).
6. **Verify** — typecheck + `npm run smoke` (logic is node-testable) + run on device + test offline + 360px width.

## Working agreements
- Keep modules/components under ~300 lines; split when larger. TS types on public functions + the Store interface.
- One commit per feature: `feat(widgets): habit COSMOS tiers (v1.0.x)`; push to `main` when Done.
- **Never re-key** SRD/preset/theme data — import the files from The Blossom.
- When a new feature is underspecified, interview it out before coding.

## Doc index
| File | Domain |
|---|---|
| `docs/MERGE-SPEC.md` | **★ The master merge plan** — read first. Diagnosis, principles, unified architecture, the full port map, the roadmap, locked decisions. |
| `docs/STATUS.md` | Live Now / Next / Done ledger — the fast resume point. |
| `docs/ARCHITECTURE.md` | The bones in detail — Store, sync, the widget contract, the module model. |
| `README.md` | Setup + run. |
| `../My App/docs/` | The Blossom's authoritative per-domain specs (widgets, COSMOS, gamification, modules) — port a spec in when you build that domain. |
| `../My Blossom v0.0.1/docs/DESIGN-DOC.md` | Simon's decision-filled product source of truth (aspects, modules, Liri, monetization). |
