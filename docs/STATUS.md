# STATUS — session handoff ledger

> The fast resume point. Read this + `CLAUDE.md` to know where we are without re-scanning the tree.
> Keep it current per `docs/00-claude-framework.md` §4. Newest first.

**Last updated:** 2026-06-20 · **Latest pushed version:** v100

---

## Now (in progress)

- **UI/feel overhaul (F)** — grilled & bounded (2026-06-20): approach = *system pass first, then surface redesigns*; improve depth + typography/hierarchy + motion/states + spacing/consistency; surfaces to redesign = Settings, menus/popovers, widget cards/page-layout, panels/drawers; boldness = *elevate within current identity* (keep cozy purple, preserve theming, never jarring).
  - ✅ **System pass shipped (v97)** — deeper layered shadow scale (+`--shadow-pop`), hover-lift/press states on rows/buttons/cards, menu-icon accent on hover, input focus ring, heading/overline letter-spacing. Pure CSS in base/components/widgets.
  - ✅ **Settings redesign shipped (v98)** — flat 8-section wall → calm collapsible groups under Personalize / Your data / App category labels (icon + title + one-line hint per row; Account auto-shown open only when sync configured). New `group()`/`category()` helpers in `ui/settings.js`; JS-eased height (measures `scrollHeight`, settles to `auto`) + `inert` on collapsed bodies for clean focus/AT order; `.set-*` CSS in components.css. **All data-safety logic untouched** — reset/backup/import/trash flows verified intact. *(Note: preview runs backgrounded so rAF/transitions are throttled — animation unobservable there, but toggle logic confirmed: open sets height=scrollHeight + aria/inert correct, close → 0.)*
  - ✅ **Menus & popovers shipped (v99)** — anchored open motion (dynamic `transform-origin` per placement side in `placeFloating`, so menus/popovers grow from the corner nearest the tap); destructive menu rows now warm to `--danger` (red, matching `.btn-danger`) with a danger-tinted hover instead of amber `--warn`; comfier item rhythm (10×12 padding, 10px radius, softer inset separators); popover entrance harmonized to a scale and reuses `--shadow-pop` (dropped its redundant local shadow). `components.js` + `components.css`.
  - ✅ **Widget cards & page layout shipped (v100)** — quieter chrome: drag/collapse/overflow controls rest at 0.5 opacity when idle and return on hover/`focus-within` (desktop only via `@media (hover:hover)`; touch keeps them visible); tappable (`.openable`) card warms its border on hover (`:has`) + soft press on `:active`; page content capped at `max-width:1180px` centered so it stops stretching on wide screens; header gap 4→6px. CSS-only (`widgets.css`).
  ⏸ next step: **surface redesigns**, last one — (4) **panels & drawers**. Its own commit; keep within identity.

## Next (queued, in order)

1. **F surface redesigns** (see Now) — ~~Settings~~ ✓ → ~~menus~~ ✓ → ~~widget cards~~ ✓ → panels.
2. **Nav return-to-origin fix (E)** — exiting settings/widget should return where you were, not dump to the module page.
3. Older backlog: i18n strings (Phase 8), open CRs in `docs/11`, Tabletop companion features (`docs/14`), V2 items (`docs/13`).

## Done (recent, newest first)

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
