# My Blossom — Transfer Pack

*Every in-depth guide, design decision, and framework for turning **The Blossom** into **My Blossom**, gathered in one place. These are the **full documents** — your hours of planning and the deep frameworks — not summaries.*

> **The one rule across all of this:** build on your finished app (**The Blossom**), **add** the features and the publishing layer to it — never rebuild it from scratch.

---

## How to use this pack

If you read three things, read these in order:
1. **`TRANSFER.md`** (in this folder's root) — the master build-pack: the new features, data structures, SQL, code blueprints, commands, and the build order, all in one file written for The Blossom's actual stack.
2. **`01-Design-Decisions/DESIGN-DOC.md`** — your own decision-filled master spec (the staircase you filled in: aspects, modules, Liri, money, every locked choice).
3. **`03-Build-Frameworks/GUIDE.md`** — the readable, complete picture of what the app is and does.

Everything else is the deep reference behind those.

---

## What's in here

### `TRANSFER.md` — the master pack
The single build playbook: the 5 Aspects→Attributes→Skills (full data), the growth loop, Liri, Supabase sync (schema + auth + a vanilla-JS sync blueprint), Capacitor/TWA publishing, RevenueCat subscriptions, and the step-by-step build order.

### `01-Design-Decisions/` — your hours of planning
- **`DESIGN-DOC.md`** — the master design document: the full staircase (Foundation → Floors 1–11) with every decision, the complete Aspect→Attribute→Skill rosters, the companion, navigation, tech, money, and onboarding. **The source of truth.**
- **`MY-BLOSSOM-DESIGN-DOC.md`** — the companion design write-up.

### `02-Planning-Frameworks/` — the deep planning specs
- **`00-operating-framework.md`** — how the build works (prompt-overhaul, token rules, cozy laws, Definition of Done).
- **`01-architecture.md`** — the core model, storage interface, project structure, build order, what to salvage.
- **`02-zero-to-release.md`** — accounts → build → Supabase → RevenueCat/Stripe → legal/privacy → store submission → OTA. **The release bible.**
- **`03-market-and-suggestions.md`** — strategy, competitor lessons, the consolidation wedge, prioritized suggestions.
- **`04-art-direction.md`** — the living-garden visual soul: layer-cake depth, per-theme worlds, materials, motion, earned delight, anti-slop rules.
- **`05-companion-and-elements.md`** — Liri: the soul-bond, the element quiz (Air/Water/Earth/Fire), aspect-driven growth, Liri Life, the Liri page.
- **`06-modules-and-aspects.md`** — the structure map: the 5 aspects, the 6 modules, the Blossom loop, flower + radar rendering, build priority.
- **`07-fx-and-atmospheres.md`** — themes, atmospheres, weather, particles, the visual engine.
- **`BUILD-NOTES.md`**, **`ENGINE-PORT.md`** — implementation notes + the visual-engine port plan.
- **`CLAUDE-operating-framework.md`**, **`SETUP.md`** — the working agreements + project setup.

### `03-Build-Frameworks/` — the frameworks built for the merge
- **`MERGE-SPEC.md`** — the master merge map: every feature → where it lands, the full port map, the wave roadmap.
- **`GUIDE.md`** — the complete readable guide (what it is, all it does, how to use it, what's built vs. to build).
- **`ARCHITECTURE.md`** — the bones in detail (store, sync, the tool contract, the module model).
- **`CONNECT-github-supabase.md`** — connecting to the existing GitHub repo + Supabase (the exact steps).
- **`CLAUDE-v1.0.0.md`**, **`README-v1.0.0.md`** — the v1.0.0 operating entry + setup.

### `04-Research/` — the research library
- **`INDEX.md`** + **`market-research.md`** + the two **`technical-teardowns-…`** files — competitor and feature teardowns to borrow from when designing.

### `05-Status-Notes/` — session ledgers
- **`STATUS-v0.0.1.md`**, **`STATUS-v1.0.0.md`** — where each build left off (handy context, not a plan).

### `06-ACCESS-GitHub-Expo-Supabase.md` — keys & dashboards
All the access info in one place: the **GitHub** repo + how to push, the **Expo.dev / EAS** project (build/OTA), and the **Supabase** project URL + public key + dashboard + how to run the schema and enable auth. Read the security note at the top first (the public key is safe; the secret key is never stored here).

---

## A note on The Blossom's original docs
The Blossom's internal docs (`docs/00`–`16`: full widget specs, COSMOS method, gamification math, the overhauls) **aren't copied here on purpose** — they already live in The Blossom inside your other project, which your other Claude Code can read. This pack holds the *plans, frameworks, and access* you bring *to* that app; the app keeps its own internal docs.

---

## The build path in one line
Rebrand → **Supabase** accounts + offline-first sync → **Capacitor/TWA** wrap for Android → **RevenueCat** no-paywall subscriptions → **publish** → then add the planned features (aspects, growth loop, Liri, custom themes, home-screen widgets) as OTA updates. Full detail in `TRANSFER.md` and `02-Planning-Frameworks/02-zero-to-release.md`.
