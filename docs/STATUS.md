# STATUS — session handoff ledger

> The fast resume point. Read this + `CLAUDE.md` to know where we are without re-scanning the tree.
> Keep it current per `docs/00-claude-framework.md` §4. Newest first.

**Last updated:** 2026-06-20 · **Latest pushed version:** v85

---

## Now (in progress)

- **Tabletop sheet linking polish** — uncommitted WIP in `js/widgets/dndsheet.js`, `dndinventory.js`, `dnd-shared.js`, plus `js/fx/weather.js` and docs (`01-architecture.md`, `07-gamification.md`), `sw-assets.js`.
  ⏸ next step: review these diffs against `docs/14-tabletop-overhaul.md`, run the cozy + Done checks, then commit each as its own feature and push.

## Next (queued, in order)

1. **i18n-ready strings file** — the only remaining Phase 8 item (`docs/10-roadmap.md`). Low priority, single-language app; architectural string extraction.
2. **Open change requests** — sweep `docs/11-change-requests.md` for anything still open and work in stated order.
3. **Tabletop companion features** — party / shop / encounter / dice per `docs/14-tabletop-overhaul.md`.
4. **V2 framework items** — pull next from `docs/13-v2-framework.md` (target the relevant heading, never load the whole file).

## Done (recent, newest first)

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
