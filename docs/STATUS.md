# STATUS — session handoff ledger

> The fast resume point. Read this + `CLAUDE.md` to know where we are without re-scanning the tree.
> Keep it current per `docs/00-claude-framework.md` §4. Newest first.

**Last updated:** 2026-06-20 · **Latest pushed version:** v102

---

## Now (in progress)

- *(Nothing actively in progress — F complete; E scroll-restoration shipped v102. Pull the next backlog item below into Now when starting.)*

## Next (queued, in order)

1. **E — confirm the literal-page case (if any).** v102 fixed the *scroll-position* "dump" (you now return to where you were on the page). If a separate bug still lands you on the **wrong page** (not just wrong scroll), it was NOT reproducible by reading — get an exact repro (which surface; route before/after; in-app back vs hardware back vs Esc) and fix narrowly. ⚠ Don't blind-touch the router's push-vs-`replace`/`viewPushed`/focus-flag/deep-link logic.
2. **15 — Living Layout overhaul (6 phases, ~5 weeks).** Spec complete + grill-me locked. Adds feel-token cascading layer (identity.css + fx/identity.js) so widgets become characters (Phase 1: materials + signatures), pages become rooms (Phase 2: layout archetypes), modules become worlds (Phase 3: masthead + entrance), controls breathe (Phase 4: FAB/grammar/settings), and micro-life settles (Phase 5: Liveliness dial + polish). Start Phase 0 (token foundation, zero visible change) when E confirmed.
3. Older backlog: i18n strings (Phase 8), open CRs in `docs/11`, Tabletop companion features (`docs/14`), V2 items (`docs/13` — V2-21 Char Sheet multi-system, V2-23 World Map), Blossoms phase 2 (paused).

## Done (recent, newest first)

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
