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
5. **D&D DM Campaign Manager** (reuses character + world pieces)

## Phase 8 — Polish & small presets
Reading Nook, Recipe Box, Budget Garden, Music Practice, Fitness Log definitions. Accessibility pass (focus order, labels, reduced-motion audit), trash UI, i18n-ready strings file.

---

**Standing rule:** before any phase or any newly requested feature, run the **grill-me** skill (see CLAUDE.md) against the relevant docs section with the user to resolve open questions — one question at a time, with recommended answers.
