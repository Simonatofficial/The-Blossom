# STATUS — session handoff ledger

> The fast resume point. Read this + `CLAUDE.md` to know where we are without re-scanning the tree.
> Keep it current per `docs/00-claude-framework.md` §4. Newest first.

**Last updated:** 2026-06-20 · **Latest pushed version:** v92

---

## Now (in progress)

- **Big "Study + UX" brief** (2026-06-20 user request) — study workstream complete (v86–v92). Next per user order: **grill-me the big design pieces** (D → G → F).
  ⏸ next step: run `grill-me` on **Module-nav overhaul (D)** — module groups + Favorites + top arrow/swipe switcher — to resolve the data model + interaction tree before any code.

## Next (queued, in order)

1. **Module-nav overhaul (D)** — module **groups** the user swaps between + a **Favorites** group; top-of-screen left/right arrows + swipe; active-group concept. New data model → `grill-me` first.
2. **"Help me build" (G)** — guided module + page builders; default path from presets; per-preset question sets; functional linked pages/widgets. `grill-me` first.
3. **UI/feel overhaul (F)** — modules/pages/widgets/popups/menus/settings; fold its design language into D & G rather than a separate sweep.
4. **Nav return-to-origin fix (E)** — exiting settings/widget should return where you were, not dump to the module page.
5. Older backlog: i18n strings (Phase 8), open CRs in `docs/11`, Tabletop companion features (`docs/14`), V2 items (`docs/13`).

## Done (recent, newest first)

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
