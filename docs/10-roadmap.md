# 10 — Roadmap (build in this order)

Each phase ends with the docs/09 release checklist. Don't start a phase until the previous one is shippable — the app should be usable from Phase 1 onward.

## Phase 0 — Skeleton (the seed)
PWA shell: index.html, manifest, SW, install on Android/Windows verified. `core/` (store, events, ids, router), `fx/loop`, base CSS variables, app chrome (settings drawer stub, module switcher stub, tab bar). One hardcoded module/page to prove the render path.

## Phase 1 — Core engine (roots)
Module engine (pages, widget grid, drag/reorder/collapse/move), widget registry + base, settings drawer for real. Widgets: **Notes, Time, Counter, Separator**. Theme system with **Flower + Space** presets (colors only). Saves: export/import file + full-state code, daily autosave. Onboarding tour.

## Phase 2 — Growth loop (stem)
Widgets: **Tracker, Quest, Journal, Routine, Calendar**. Value system (`values.js`, link picker). Day rollover. Blossom codes for all node types + Codes library.

## Phase 3 — Gamification (buds)
Widgets: **Skill (with nesting), Health, Goal, Habit (+ COSMOS wizard), Market**. Wallet, payouts, streaks, freeze/restore items. Celebration animations.

## Phase 4 — The bloom
**Graph widget** with line/bar/pie, then the **Flower Graph** (take the time to make it beautiful — docs/05 geometry spec). Complex particles. **The Blossom preset module** assembled and set as default.

## Phase 5 — Atmosphere (the garden around it)
Particle engine + all presets, pointer FX, atmosphere engine + all presets, custom theme/particle editors, remaining preset themes. Performance pass against the 60fps budget.

## Phase 6 — Companion widgets
Canvas (widget version), Calculator, Alarm/Timer, Music Player, Notifications, Image/Gallery, Dice.

## Phase 6.5 — Change requests (docs/11)
Work the active CRs in their stated order (menu-row fix → Flower Graph fixes → panel placement → widget search → preset effect overrides → vibrancy pass) before or interleaved with Phase 7 — CR-1 especially must land before new modules add more panels.

## Phase 7 — Big modules (one per release)
1. ~~**Study Guide**~~ ✅ (closest to existing widgets)
2. ~~**Infinite Canvas**~~ ✅ (sector/quadtree/tile engine — budget real time)
3. ~~**World Builder**~~ ✅ (reuses the canvas engine; biggest module — shipped with CR-14)
4. ~~**D&D Character Manager**~~ ✅
5. ~~**D&D DM Campaign Manager**~~ ✅ (reuses character + world pieces)

## Phase 8 — Polish & small presets
- ~~Reading Nook, Recipe Box, Budget Garden, Music Practice, Fitness Log definitions~~ ✅ (`js/presets/modules/small.js`)
- ~~Trash UI~~ ✅ (Settings drawer: per-item restore / delete-forever **plus multi-select** — checkboxes, select-all, bulk Restore / Delete forever, Empty trash)
- ~~Accessibility pass~~ ✅ — **reduced-motion** (global CSS `prefers-reduced-motion` block + particle/atmosphere/flower-graph gates; RelationshipWeb solves its layout synchronously); **focus & roles** (done once in `components.js`/`shell.js`: dialogs/panels are `role="dialog"`/`"alertdialog"` + `aria-modal`, move focus in on open, **trap Tab**, close on Esc, **restore focus** on close; `seg`→`radiogroup`/`radio`+`aria-checked`, `switchEl`→`role="switch"`, tab bar a labeled `<nav>` with `aria-current="page"`); **labels** (`icon()` stamps `data-i`; a MutationObserver in `components.js` gives every icon-only control without a name one inferred from its glyph — covers dynamic re-renders and future buttons; an explicit `title`/`aria-label` always wins).
- i18n-ready strings file *(only remaining Phase 8 item; architectural string extraction, low priority for a single-language app)*

## Phase 9 — Ship & harden
Release-readiness *without* changing hosting (still local-git by the user's choice). Most of this was already in place; this phase verified it and closed the gaps.
- ~~PWA shell~~ ✅ — `manifest.webmanifest` (name/short_name/description, **id/lang/dir/categories**, maskable + 192/512 icons, portrait, theme/background color); `index.html` (lang, viewport-fit, theme-color, favicon, apple-touch-icon); SW **update-available toast** (never auto-reloads — `app.js · registerSW`), boot `try/catch` fallback screen, per-widget render guards, `navigator.storage.persist()`.
- ~~Data safety~~ ✅ — daily autosaves (keep 30), safety autosave before a Replace import, file + full-state-code export, merge/replace import, 30-day soft-delete trash with multi-select purge.
- ~~Global error safety net~~ ✅ — `window` `error` + `unhandledrejection` → a calm, throttled toast ("Something hiccuped — your work is safe."), still logged to console (`app.js`).
- ~~Accessibility + reduced-motion~~ ✅ (Phase 8).
- ~~IndexedDB quota write-failure surfacing~~ ✅ (2026-06-13) — a failed flush (storage full) re-queues the unsaved write instead of dropping it (`core/store.js`) and emits `storage:full`; `app.js` surfaces a calm, throttled toast + a feed note so the user can free space or export.
- *Optional / environment-bound:* real-device 60fps profiling.

## Phase 10 — Data safety & portability
The roadmap originally ended at Phase 8; 9–10 were added on request. Everything lives on-device, so off-device backups are the real safety net.
- ~~Off-device backup reminder~~ ✅ — Download-file / Copy-save-code record `lastExportAt`; on boot, if there's been no off-device backup in 14 days (and the install isn't nearly empty), a single **calm `backup` notification** lands in the feed (at most once a week — never a nagging toast). Settings → Saves shows "Last off-device backup: N days ago" (`core/saves.js`, `ui/settings.js`, `app.js`).
- ~~Restore preview before applying a backup~~ ✅ (2026-06-13) — the shared import/restore preview (`ui/settings.js · renderImportPreview`) now shows the save's **date**, its **contents** counts, and — for a whole-workspace restore — **"You have now: …"** so Replace can never overwrite your data unseen. The autosave **Restore this backup** action routes through it (`openBackupRestore`) instead of a bare confirm.
- ~~IndexedDB quota handling~~ ✅ (2026-06-13, see Phase 9).
- Candidates still open: a side-by-side restore *diff* (beyond counts), scheduled export reminders, more preset modules/widgets, GitHub Pages publish (see `DEPLOY.md`).

---

**Standing rule:** before any phase or any newly requested feature, run the **grill-me** skill (see CLAUDE.md) against the relevant docs section with the user to resolve open questions — one question at a time, with recommended answers.
