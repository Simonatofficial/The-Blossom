# STATUS — session handoff ledger

> The fast resume point. Read this + `CLAUDE.md` to know where we are without re-scanning the tree.
> Keep it current per `docs/00-claude-framework.md` §4. Newest first.

**Last updated:** 2026-06-20 · **Latest pushed version:** v108

---

## Now (in progress)

- *(Nothing actively in progress — **Living Layout overhaul (docs/15) COMPLETE**: all six phases 0–5 shipped v103–v108. Pull the next backlog item below into Now when starting.)*

## Next (queued, in order)

0. **Living Layout follow-ups (optional polish).** The overhaul is shipped & verified; remaining nice-to-haves if revisited: re-author the *non-home* preset pages into archetypes (only home pages got them); extend the earned "tick" with type-specific blooms (Tracker check, Goal settle) beyond the central card pulse; wire the Module/Page/Widget grammar icons into the nav-panel "add" buttons (FAB has them); a per-module identity editor (today only presets/JSON set `module.identity`). None blocking.
1. **E — confirm the literal-page case (if any).** v102 fixed the *scroll-position* "dump" (you now return to where you were on the page). If a separate bug still lands you on the **wrong page** (not just wrong scroll), it was NOT reproducible by reading — get an exact repro (which surface; route before/after; in-app back vs hardware back vs Esc) and fix narrowly. ⚠ Don't blind-touch the router's push-vs-`replace`/`viewPushed`/focus-flag/deep-link logic.
2. **15 — Living Layout overhaul (6 phases, ~5 weeks).** Spec complete + grill-me locked. Adds feel-token cascading layer (identity.css + fx/identity.js) so widgets become characters (Phase 1: materials + signatures), pages become rooms (Phase 2: layout archetypes), modules become worlds (Phase 3: masthead + entrance), controls breathe (Phase 4: FAB/grammar/settings), and micro-life settles (Phase 5: Liveliness dial + polish). Start Phase 0 (token foundation, zero visible change) when E confirmed.
3. Older backlog: i18n strings (Phase 8), open CRs in `docs/11`, Tabletop companion features (`docs/14`), V2 items (`docs/13` — V2-21 Char Sheet multi-system, V2-23 World Map), Blossoms phase 2 (paused).

## Done (recent, newest first)

- **Living Layout overhaul (docs/15) — COMPLETE** (v103–v108): feel-token foundation → widget materials → page archetypes → module worlds → FAB grammar → Liveliness dial. Personality is now structural (material/silhouette/density/texture/motion), inherited as data, opt-in and reversible. Per-version entries below.
- v108 — ui: **Phase 5 — Liveliness dial & earned micro-life (Living Layout)** — one global motion dial in Settings → Appearance (Still / Gentle / Lively), persisted to localStorage + `data-liveliness` on `<body>`. Scales all Phase 1–4 motion: Still ≈ reduced-motion; Gentle adds earned entrances/wisp/tick; Lively adds FAB idle breath. Entrance no longer fires on first load (earned). Earned "tick": a barely-there card pulse on value change (central `refreshCard`, gated). Verified: dial scales all four motions across levels, first load still, tick gated, no new errors.
- v107 — ui: **Phase 4 — control life, FAB grammar & breath (Living Layout)** — one visual grammar for the three levels (Module=globe/accent, Page=leaf/highlight, Widget=sprout/success) on the FAB items; items fan on a subtle arc; press/open halo; scrim glow near the thumb; idle breath gated to `data-liveliness=lively` (off by default, decision #8). Chrome hover-bloom already met spec. Verified live: grammar discs distinct, 360px keeps items on-screen, breath off by default.
- v106 — ui: **Phase 3 — module identity, modules become worlds (Living Layout)** — module identity rides on `<body>` (chrome inherits world feel); page identity layers on `.page-scope`. Tab-bar personality via `data-accent-shape` (underline/rail/bloom/halo); module entrance wisp on genuine switch (non-blocking, reduced-motion off); opt-in masthead (off by default). Six preset worlds baked at instantiation (`PRESET_IDENTITIES`/`PRESET_HOME_LAYOUTS`); landing page opens in its archetype. Existing modules stay neutral (guardrail §9). Verified live: D&D DM bakes roomy/rail/parchment/drifting + split landing + wisp; cleanup left user data intact.
- v105 — ui: **Phase 2 — page layout archetypes & entrance (Living Layout)** — pages pick a structural archetype via `data-layout` on `.page-scope`: masonry (default), stream (reading column), hearth (full-width hero + grid; hero self-heals), gallery (equal tiles), split (2fr/1fr). All collapse to one column <600px. Entrance: widgets stagger-rise on genuine page switches only (reuses v102 samePage signal; reduced-motion at rest). Page identity merges over module identity; grid gap follows `--feel-gap`; opt-in page header band. Layout picker in Pages panel menu. Verified live: 4 archetypes resolve, stagger 0→180ms, same-page no re-stagger, menu chain persists, no errors.
- v104 — ui: **Phase 1 — widget materials & signatures (Living Layout)** — each widget type wears a *material* (paper/glass/slate/card/canvas), applied auto by type + overridable per instance, themed through the cascade. Silhouette (radius/frame per material), signatures (type-chip on every card, paper watermark), header voice (serif paper, upper-case glass micro-label, glass accent-rail). Cards now read structure from `--feel-*` (defaults unchanged) + a texture `::after` layer. Per-widget Material row in settings (decision #10). Verified: glass/card/paper distinct on Blossom home, slate via override applies+reverts, 360px clean, no errors.
- v103 — fx: **Phase 0 — feel-token foundation (Living Layout)** — `css/identity.css` (feel-token `:root` defaults + `--tex-*` gradient library + cozy/roomy/compact `data-feel` bundles) + `js/fx/identity.js` resolver (`applyScopedIdentity`/`clearScopedIdentity`) wired onto both the grid page-scope and the routed widget-page. Zero visible change — tokens resolve to today's values. Texture subtlety is a feel token (`--feel-texture-opacity`); gradients single-sourced in CSS. Substrate for Phase 1–5. **Verified** (Opus rebuild): resolver proven to emit correct tokens for cozy/overrides and fully reset on clear; `:root` defaults == today; no console errors; SW precache updated + cache bumped v102→v103 (offline-safe). ⚠ Phase 1 (widget materials + signatures) is the first consumer of these tokens.
- v102 — nav: **E return-to-origin (scroll)** — `engine.js` remembers the module page's scroll across re-renders, so returning from a widget view *or* a same-page rebuild (e.g. toggling an effect in Settings) lands you where you were, not at the top; genuine page switches still top. Render-layer only — router history/push/replace untouched. Verified: same-page re-render preserves scroll, page switch tops.
- **UI/feel overhaul (F) — COMPLETE** (v97–v101): system pass + four surface redesigns (Settings, menus/popovers, widget cards & page layout, panels & drawers), all *within the current cozy identity* (cozy purple, theming preserved, nothing jarring). See per-version entries below.
- v101 — ui: F **panels & drawers** — side panels round only their inner (app-facing) corners (`overflow:hidden` + radius-lg) so they read as a soft sheet; panel title weight 600 + tighter tracking; scrim 0.32→0.38; sheet grab-handle widens/warms on hover, accent on grab. CSS-only (`components.css`).
- v100 — ui: F **widget cards & page layout** — idle-fade card controls (return on hover/focus), openable affordance (`:has` border warm + press), page max-width 1180 centered.
- v99 — ui: F **menus & popovers** — anchored open motion (origin per placement side), destructive rows → `--danger` + danger hover, comfier item rhythm, popover scale-in on `--shadow-pop`.
- v98 — ui: F **Settings redesign** — collapsible grouped sections (Personalize / Your data / App), per-row icon+title+hint, JS-eased height + `inert`; data-safety flows untouched & verified.
- v97 — ui: F **system pass** (depth/elevation, interaction states, motion, type) — lifts every surface at once, within the current identity.
- v96 — build: guided from-scratch module builder + page builder (instantiatePageInto); completes workstream G.
- v95 — build: Help-me-build wizard engine + Study blueprint; preset tap → tailored wizard with full-preset escape. Spec `docs/13` §3c.
- v94 — nav: Manage Groups panel (rename/icon/delete/reorder groups + member modules); completes workstream D.
- v93 — nav: **module groups + top switcher rail** (groups.js; All + auto Favorites + custom; swipe/arrows/pill; usage tracking; hides in widget views). Spec `docs/13` §3b.
- v92 — study: bookmark (★) cards while studying/quizzing → dynamic "Bookmarked" study set.
- v91 — study: mastery tracking + "what to work on" weak-spot focus (smart "Needs work" + per-area sets) + per-part % breakdown at finish.
- v90 — study: optional **Tip** field on terms/cards/quizzes (notebook "Tip:" line → flashcard model → faces → quiz Q/A).
- v89 — quiz: results/card/history show correct/incorrect **counts** + an all-time tally instead of a lone %.
- v88 — shell: removed Modules from the top menu; chrome button opens Settings directly (modules live on the FAB).
- v87 — picker: +Add widget gallery organized into collapsible categories (Character Sheet → Tabletop).
- v86 — brand: renamed app to **My Blossom** across visible chrome (display-name only).
- **Claude Operating Framework** — added `docs/00-claude-framework.md` (prompt-overhaul, token, cozy, continuity, DoD) + this STATUS ledger; slimmed `CLAUDE.md` to a lean entry point. *(docs)*
- v85 — fx: removed lightning effect; rebuilt aurora as an atmosphere.
- v84 — tabletop: sheet linking — armor→AC auto-calc & weapon→attacks.
- v83 — fx: allow up to 6 stacked particle layers (was 3).
- Phase 8 — trash multi-select UI; accessibility pass (reduced-motion, focus/roles, inferred labels).
- Phase 7 — Study Guide, Infinite Canvas, World Builder, D&D Character, D&D DM modules all shipped.

---

### How to use this file
- **Starting work:** move the task into **Now**, add its one-line frame (Goal · Approach · Files · Done-when).
- **Finishing:** move it to **Done** with its `v##` tag; pull the next item into **Now**; bump *Last updated* + *Latest pushed version*.
- **Stopping mid-task:** leave it in **Now** with a `⏸ next step:` note.
