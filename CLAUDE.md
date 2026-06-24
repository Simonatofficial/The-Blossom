# The Blossom — Claude Code Framework

The Blossom (shipping as **My Blossom**) is a cozy, fully customizable, all-in-one life PWA. The user builds their own app out of **Hubs → Modules → Pages → Widgets → Objects**, themed with atmospheres and particles, gamified through the **5 Aspects** (Mental · Physical · Emotional · Social · Recreation) and their growth loop, Skills, Quests, Health, a soul-bonded companion (**Liri**), and a coin Market, grounded in the COSMOS habit method.

> **Vocabulary: keep "Widgets."** The "Tools" rename (docs/17 §7) was **cancelled** — it belonged to an earlier app version that didn't work out; the user wants the proven "Widgets" name kept everywhere. A **Hub** is a real layer above Module that packages connected modules and links to other hubs (shipped v121).

This file is the lean entry point. Read the relevant `/docs` file before working on any area — each one is the authoritative spec for its domain. **For the My Blossom V3 overhaul (5 aspects, Liri, Hubs, sync, publish, subscriptions), `docs/17` is the authority — read it before any V3 work.**

## Every session — start here

1. **Read `docs/00-claude-framework.md`** (how we work) and **`docs/STATUS.md`** (where we are). Together they let you resume in seconds without re-scanning the tree.
2. Then follow the five always-on jobs from the framework:
   - **Overhaul the ask first.** Treat every prompt as a seed: restate it, improve it (cozy · token-efficient · quality · quantity) without drifting from intent, frame a tiny plan (Goal · Approach · Files · Cozy notes · Done-when), then build. (framework §1)
   - **Spend tokens like coins.** Read only what the task touches, reuse definitions over new code, smallest correct diff, no narration. When a turn burns unusually high usage, end it with one plain line on what drove it. (§2)
   - **Build cozy.** Calm, discoverable, progressive disclosure, opt-in intensity — the user explores at their own pace; nothing is force-fed. (§3)
   - **Track + persist.** Update `docs/STATUS.md` (Now/Next/Done), then **auto-commit + auto-push to `main`** on every completed feature. (§4)
   - **Finish clean.** Meet the Definition of Done before pushing. (§5)

## Required setup: install the grill-me skill

Before any major design or planning session on this project, install and use the `grill-me` skill:

```bash
mkdir -p .claude/skills/grill-me
curl -fsSL https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grill-me/SKILL.md \
  -o .claude/skills/grill-me/SKILL.md
```

Source: https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md

**When to use it:** whenever the user proposes a new module, widget, or large feature, invoke grill-me to interview them one question at a time, walking each branch of the design tree and offering a recommended answer for every question, until the design is fully resolved. If a question can be answered by exploring this codebase, explore instead of asking.

## Project skills

The operating framework (`docs/00-claude-framework.md`) is installed as triggerable skills in `.claude/skills/` — the doc stays the single source of truth; the skills just make the right rule fire automatically. They trigger themselves, but you can invoke any by name.

| Skill | Fires when | Framework |
|---|---|---|
| `overhaul-the-ask` | any build request / messy idea-dump (merges the old `braindump-to-spec`) | §1 |
| `cozy-check` | adding or changing anything the user sees or feels | §3 |
| `ship-it` | a feature is finished and verified — runs Done, updates STATUS, commits, pushes | §4 + §5 |
| `usage-check` | "why is my usage so high"; also defines the always-on heavy-turn note | §2 |
| `grill-me` | a new module/widget/large feature needs interviewing out | §1 (deep path) |

## Documentation index

| File | Domain |
|---|---|
| `docs/00-claude-framework.md` | **How we work** — prompt-overhaul protocol, token efficiency, cozy laws, session continuity, git push, Definition of Done. Read first, every session. |
| `docs/STATUS.md` | **Where we are** — live Now / Next / Done ledger. The fast resume point; update it as you work. |
| `docs/01-architecture.md` | PWA shell, file layout, runtime architecture, persistence, save codes |
| `docs/02-data-model.md` | Objects, schemas, the value system, linking, Blossom codes |
| `docs/03-design-system.md` | Themes, colors, atmospheres, particle engine, icons/emoji policy, UI feel |
| `docs/04-core-concepts.md` | Workspace, Modules, Pages, Widgets, Objects — how everything interacts |
| `docs/05-widgets.md` | Full spec for every widget |
| `docs/06-cosmos-method.md` | The COSMOS habit/goal system and its in-app flow |
| `docs/07-gamification.md` | XP, levels, health, streaks, coins, Market rewards |
| `docs/08-modules.md` | Preset modules: The Blossom, Infinite Canvas, D&D DM, D&D Character, World Builder, Study Guide |
| `docs/09-deployment.md` | GitHub Pages publishing, manifest, service worker, Android/Windows install |
| `docs/10-roadmap.md` | Phased build order — follow this sequence |
| `docs/11-change-requests.md` | Active change requests from user testing — work these alongside Phase 7+ |
| `docs/12-canvas-overhaul.md` | CR-10: full spec for the Infinite Canvas painting overhaul (Kleki parity) |
| `docs/13-v2-framework.md` | **V2 spec** — Supabase sync, FAB nav, particles/atmosphere/weather overhaul, themes, new widgets (Blossoms game, Canva Board, Tabletop, etc.), and all V2 change requests. Read this before any V2 work. |
| `docs/14-tabletop-overhaul.md` | **Tabletop (D&D 5e) overhaul** — SRD content counts (have vs. addable), homebrew + custom-book system, character-sheet D&D-Beyond-parity checklist, companion-app features (party/shop/encounter), dice. Read before any Tabletop work. |
| `docs/15-living-layout.md` | **Living Layout overhaul** — the *feel* framework: a cascading feel-token layer that gives Modules (worlds), Pages (rooms via layout archetypes), and Widgets (characters via materials/silhouettes/signatures) distinct identity as inherited data, plus FAB/control life. Read before any module/page/widget *feel* work. |
| `docs/16-study-overhaul.md` | **Study overhaul** — the immersive, anti-burnout study *feel + method*: the garden metaphor (topics Seed→Bloom), five anti-burnout laws, earned delight, the BLOOM study loop, and specs for the new builds (adaptive/mixed sessions, Study Skills flower, time-of-day quiz graph, deck-breakdown dropdowns, struggle-based Study Guide). Read before any Study/Flashcard/Quiz work. |
| `docs/17-my-blossom-v3.md` | **My Blossom V3 spec** — the all-in-one overhaul folded in from the Transfer Pack: the 5 Aspects→Attributes→Skills growth loop, self-contained Aspect Tools (built-in flower graph + own XP), the **Liri** companion, the new **Hub** layer (above Module, evolved from groups), the 6-module structure, Supabase sync, Capacitor/TWA publish, RevenueCat subscriptions, the no-data-loss guarantees, and the phased build order. **Read before any V3 work.** Long-form depth lives in `/My Blossom — Transfer Pack/`. |

## Tech stack (non-negotiable)

- **Vanilla HTML/CSS/JS with native ES modules. No build step, no framework, no npm dependencies at runtime.** The repo is served directly by GitHub Pages.
- Entry point is `index.html`; all code lives in `/js` and `/css` as modules (see `docs/01-architecture.md` for the exact tree).
- Persistence: **IndexedDB** (via a thin wrapper in `js/core/store.js`), `localStorage` only for tiny prefs (last module, theme id). All user data survives app updates — never write a migration that drops data.
- Rendering: DOM + CSS for UI; `<canvas>` for particles, atmospheres, graphs, and the drawing/canvas/map surfaces. One shared `requestAnimationFrame` loop for all canvas effects.
- PWA: `manifest.webmanifest` + `sw.js` (cache-first app shell, versioned cache name). Installable on Android (Chrome) and Windows (Edge/Chrome).

## Engineering rules

1. **Spec first.** Before implementing a feature, read its `/docs` section. If the spec is silent, prefer the simplest cozy default and note the decision in the doc.
2. **Everything is data.** Modules, pages, widgets, themes, and particles are JSON definitions rendered by generic engines — never hard-code a preset where a definition object would do. Presets are just bundled definition files in `/js/presets`.
3. **Widgets are plugins.** Every widget implements the `Widget` interface (`docs/04-core-concepts.md`). New widgets register in `js/widgets/registry.js` and require zero changes elsewhere.
4. **Performance budget:** 60fps with particles + atmosphere on a mid-range Android phone. Particle engine uses a single canvas, object pooling, capped counts, and pauses when `document.hidden`. No layout thrash; animate only `transform`/`opacity` in DOM.
5. **Offline always.** Every feature must work with zero network. No external CDNs at runtime.
6. **Calm UI.** No modals where a panel will do, no badges screaming for attention, generous whitespace, soft corners (12–16px radius), gentle 150–250ms ease-out transitions. The UI invites; it never demands. See `docs/03-design-system.md`.
7. **Icons over emoji.** Inline SVG icon set (`js/ui/icons.js`) everywhere in chrome/widgets/pages. Emoji are allowed only as optional user-chosen accents on Tabs and in interactive/settings flourishes. See the icon policy in `docs/03-design-system.md`.
8. **Never lose data.** Writes are debounced-but-guaranteed (flush on `visibilitychange`/`pagehide`). Deletions are soft (30-day trash) except where the spec says otherwise.
9. **Verify.** After any feature: run a local server (`python -m http.server`), test in browser, check console for errors, test offline, and test on a 360px-wide viewport.

## Working agreements

- Keep modules under ~300 lines; split when larger.
- JSDoc types on all public functions; no TypeScript (no build step).
- One commit per feature, conventional message + version tag: `feat(widgets): flower graph petal layout (v##)`. Auto-push to `main` when done — see framework §4.
- When the user asks for something new and underspecified, use the grill-me skill before coding.
- Workflow details (prompt overhaul, token rules, cozy laws, STATUS ledger, Definition of Done) live in `docs/00-claude-framework.md` — this file just points there.
