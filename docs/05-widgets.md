# 05 — Widgets (full specifications)

Conventions: **External** = card face on the page. **Internal** = full panel on tap. **Outputs** = values exposed to the link system (docs/02). **Container** = can nest child widgets.

## Interaction model (V2 §P-2)

Every card supports a **primary tap**, a **hold-to-drag**, and a **··· menu** for meta-actions only:

- **Tap the card body** → the widget's *primary action*. A widget def may declare `primaryTap(widget, ctx)` (e.g. Counter increments, Dice re-rolls the last formula); otherwise an *internal* widget opens its full view. Interactive controls inside the body (buttons, inputs, anything with class `.no-open`) keep their own taps and are excluded from the primary tap.
- **Hold the drag grip (600ms)** → reorder mode with the glowing border (`js/modules/engine.js`).
- **··· (Widget menu)** → Edit appearance/settings · Copy Widget Code · Delete. Never primary actions.

Per-widget primary taps: Counter → increment · Dice → re-roll last formula · all *internal* widgets → open full view · Habit tier buttons / Routine checkboxes / etc. remain the on-card primary controls they already were.

---

## Notes Widget
*Internal · Container · Outputs: word count (rarely used)*

- **Card:** note name + "last opened" date beneath, with a 2-line content preview in `textSoft`.
- **Internal:** a rich-text editor (contenteditable + a custom toolbar — no libraries). Toolbar (icons only, floats above selection on mobile): Title + 3 heading levels, Bold/Italic/Underline, text size, text color & highlight (theme-palette swatches first, then wheel), bulleted/numbered lists, checkboxes, dropdown/collapsible section, divider, image insert (stored as Blob), and **link** → to another module, page, widget, or object (picker like the value-link picker; rendered as an accent chip that navigates on tap).
- **Infinitely nestable:** an "Insert widget" toolbar action embeds any widget type as a block inside the note. Embedded widgets are real widgets (full abilities) rendered inline.
- Autosaves continuously; revision history not required v1 (trash covers deletion).

## Time Widget
*External only · Outputs: none*

- Displays current day name, time (live, minute tick), and date in large warm type — the cozy heart of a Home page. Beneath: a freeform pinned note (single text block) the user can edit inline; it persists regardless of day.
- Settings: 12/24h, show seconds, show week number.

## Journal Widget
*Internal (card shows status) · Container · Outputs: entriesToday, entryStreak*

- **Card:** "Journal" + today's state: "No entry yet today" or "1 entry ✓" styled softly, plus current streak as a small leaf icon + number.
- **Internal:** a date strip (calendar-style, swipeable weeks) on top; below, the selected day's entries. **An entry is a nested widget** — choose Notes (write), Canvas (draw), Tracker snapshot, or any widget type. Multiple entries per day; past and future dates allowed.
- **Suggestion button** ("Inspire me", always available): pops a gentle card with a random prompt from three pools — *write about…* (40+ prompts), *draw…* (20+), *pause* (breathing exercise / 2-min meditation / stretch). Re-roll freely. Pools live in a JSON file so they're easily extended.

## Tracker Widget
*External + internal · Outputs: one per tracker, day-keyed*

**Revised in V2 §22.** Starts **completely empty** — the user adds tracked items. Values save instantly to today's `trackerDay` object.

- **Card (today):** each item as a row with its own control:
  - **Count** — − / + steppers; shows `value unit` + an optional goal **ring** (today's value ÷ goal).
  - **Measure** — numeric input; the **unit label always shows beside the value** (e.g. `72 kg`).
  - **Scale** — user-defined max **2–100** (default 10); rendered as tappable flower dots up to 10, a slider above that.
  - **Yes/No** — holds **multiple labelled sub-items** (each its own checkbox row); all shown on the card.
  - **Timer** — play/pause stopwatch; shows today's accumulated duration, live-ticking while running.
  - **Text Note** — today's single-line note (truncated on the card; tap the pencil to edit).
- **Internal:** day browser (view/edit any past day) **plus a history graph** — pick an item, toggle **Days / Weeks / Months**, a bar chart of values (Yes/No graphs as daily % completed), a "Tracked N of the last 30 days" stat, and a goal-completion ring.
- **Outputs (links):** one per item — numeric value (count/measure/scale), % completed (Yes/No), minutes (timer), 1/0 tracked (text).
- **Settings:** add/remove items; per item set type, unit, goal, Scale max, and Yes/No sub-items. Legacy `bool` items read as single Yes/No (no data loss).

## Graph Widget
*External + internal · Consumer of links · Multiple graphs per widget*

The visualization engine. A Graph widget holds 1+ **graph definitions**; the card shows them in a user-arranged layout (stacked, side-by-side, or grid for 3+).

```js
graph: {
  kind: 'line'|'bar'|'pie'|'scatter'|'bubble'|'radar'|'flower',
  series: [Link...],                 // what to plot (docs/02)
  range: 'week'|'month'|'quarter'|'year'|'custom',
  aggregate: 'raw'|'sum'|'avg',      // month view compiles weeks via this
  encode: {                          // how value maps to visuals (per series)
    position: true, size: false, brightness: false,
    glow: false, opacity: false
  },
  complex: [ComplexParticle...]      // see below
}
```

- **Rendering:** custom canvas renderer (no chart libs). Theme-colored, animated draw-in (lines grow, petals bloom, bars rise — 400ms ease-out). Axes minimal: hairline gridlines in `border`, labels in `textSoft`.
- **Interactivity:** tap a data point/petal/bar → tooltip panel (value, source name, date breakdown). Tap the same element again → navigate to the source widget. Tap empty space → dismiss. (Same pattern app-wide.)
- **Series picker UI:** "+ Add data" → link picker with live preview; per-series color (defaults to theme accent rotation), label, and encode toggles.

### Flower Graph (the signature graph — get this right)

A radial graph where **each linked series is a petal**; built to actually look like a flower, not a radar chart.

- **Geometry:** petals are closed Bézier teardrop shapes (two mirrored cubic curves from center to tip), not wedges — gently pointed tip, waist narrowing to ~55–60% of max width at the base where it meets the core. Petal length = normalized value (with a 25% minimum so even zero-values look like a bud, never a gap). Petal width ≈ `2π/petalCount` with 8–12% overlap so adjacent petals layer like a real flower. Petals tilt: each rotated to its angle around center with a subtle 3–5° natural variance and drawn back-to-front so overlaps shade correctly.
- **Rotation (CR-6.3):** a global `rotationOffset = π/petalCount` is applied to all petals so no petal points straight up — with 4 petals the flower reads as an **×, never a +**. A manual rotation slider (0–360°) in graph settings adds to the offset. Labels, hit-testing, and complex-particle anchors all share the same offset.
- **Styling (CR-6.2):** layered petals — base radial gradient (rich hue at base → translucent tip) + an inner highlight petal at ~70% scale and lower opacity for depth; 1px lighter rim light on the outer edge; soft per-petal drop shadow under overlaps; slight per-petal hue rotation (±6°) so neighbors aren't identical; theme `glow` halo behind high-value petals. Center: a circular "core" disc (theme `highlight`) with a tiny stamen dot ring. **No stem, no leaves (CR-6.1)** — the flower floats centered on a soft radial glow.
- **Motion:** on render, petals bloom outward sequentially (60ms stagger); on value change, a petal eases to its new length; idle, the flower breathes (±1.5% scale, 6s period; off under reduced-motion).
- **Value encoding options per petal:** length (default), saturation, glow strength, petal width.
- **Labels:** petal names curve along just past each tip in `textSoft` 11px; hidden under 480px width (tooltip covers it).

### Complex particles (data décor)

For series whose source is itself composite (e.g. a Skill containing nested skills), the graph can display **complex particles**: small glyphs (star, dot, petal, spark — user-chosen) positioned `around | inside | scattered-across | along-edge` of the parent graph/petal. Count = number of sub-components; each particle's brightness/size encodes its sub-value. Behaviors (chosen at creation): grow-with-level, glow-with-level, slow-orbit, twinkle. Capped at 40 per graph; reuse the particle engine's pooled sprites. Tapping a complex particle tooltips its sub-source; second tap navigates. **Hit-testing (CR-6.4):** complex particles register in the same pointer pipeline as petals with a minimum 44×44px hit target (hit radius expands beyond the visual glyph), and are tested *before* petals so overlapping petals never swallow their taps — every star must be reliably tappable on a 360px touchscreen.

## Skill Widget
*External + internal · Container (skills + any value source) · Outputs: level, xpToday*

- **Card:** skill name, level badge (soft circular emblem), XP progress bar to next level, and "+N XP today" in `textSoft`.
- **Mechanics:** XP accrues during the day from linked values / nested widgets (1 value point = 1 XP, transform-adjustable), **finalizes at day rollover**. Nested Skill widgets feed their parent on level-up with per-layer decay. Level curve, decay, and coin payout: docs/07.
- **Internal:** XP history sparkline, list of XP sources (links + nested widgets) with today's contribution each, nested widget area, and a level-up log.
- Level-ups trigger a quiet bloom animation on the card + coin toast.

## Health Widget
*External + internal · Container (Quest widgets) · Outputs: health, healthPct*

- **Card:** a horizontal vitality bar styled as a vine that leafs out as it fills (0% = bare stem, 100% = lush), with `current / max` beneath. No red — an empty vine, never an angry bar.
- **Mechanics:** max health = sum of required completions of contained/linked Quests today (10 quests × 5 reps = 50). Each completion = +1 health. Resets to 0 at rollover; pays out coins proportional to final % (docs/07).
- **Internal:** today's quest list with completion ticks, plus a history calendar (heat-tinted days, read-only for past days).

## Quest Widget
*External + internal · Outputs: completionsToday, completionPct, streak*

- **Card:** quest name, "3 / 5 today" counter with − / + stepper (and a long-press to set exact), difficulty chip, current streak (leaf + number). One-tap interaction is the whole point — completing a rep must take exactly one tap.
- **Creation/settings:** name; schedule (one-off / daily / weekly / custom days); reps per occurrence; active window (start date → end date or open-ended); optional time-of-day window (used by Calendar + notifications); difficulty (Sprout/Bloom/Flourish/Radiant → coin multiplier, docs/07).
- **Internal:** stats — streak (current/best), completion rate, calendar heatmap, history list; per docs/07, missed days consume streak-freeze items before breaking.
- Completing reps earns coins on the final rep of the day (not per-rep — prevents gaming).

## Habit Widget
*External + internal · Outputs: same as Quest + adherence score*

A Quest with the COSMOS method built in. Creation runs the **COSMOS wizard** (docs/06) — purpose, anchor/trigger, MVV/Standard/Stretch tiers, frictions/rewards, backup plan, milestones, review cadence.

- **Card:** habit name + the trigger sentence in small italic `textSoft` ("After morning coffee — 10 pushups"), today's tier buttons: **MVV · Standard · Stretch** (tap the tier you did; MVV always counts as a success).
- **Internal:** the full COSMOS sheet (editable), milestone tracker, weekly review card (docs/06 Study step), grade (A/B/C/R rubric) and history.

## Routine Widget
*External (expandable card) · Outputs: routineCompletionPct*

- Bundles selected Quests + Habits into a named, ordered checklist (Morning routine, Sunday reset) on a daily/weekly/monthly cadence at a chosen time of day.
- **Card:** routine name + next occurrence + progress ring; expands inline (not a separate view) to show its items as one-tap rows — ticking a row completes a rep on the underlying Quest/Habit widget (single source of truth; the routine never duplicates state).
- Persists until edited/deleted.

## Goal Widget
*External + internal · Container · Outputs: progressPct*

- **Card:** goal name + % complete as a growth ring around a seed icon that matures (seed → sprout → bud → bloom at 100%) + target date countdown in `textSoft`.
- **Mechanics:** progress = weighted average of linked/nested Quests, Habits, and Milestone checklist items (weights editable). Short- or long-term; completing a goal triggers the full-card bloom + a Radiant coin bonus.
- **Internal:** the why (purpose text), linked items with per-item progress, milestones with dates, and a reflection note area.

## Market Widget
*External + internal · Reads wallet · the reward shop*

- **Card:** coin balance as four small coin icons with counts (Copper/Silver/Gold/Platinum) + owned-rewards count.
- **Internal — Shop:** four tiers of reward cards (docs/07 catalog: quest skips, streak restore, streak freeze, custom rewards). Each card: icon, name, effect text, price. Buying moves it to **Owned**; using an owned item applies its effect via a target picker (e.g. choose which quest to skip). **Custom rewards:** users define their own real-life rewards ("Movie night", price in any tier) — buying one simply logs it; the reward is theirs to enjoy.
- Exchange: 10 copper = 1 silver = … ; an exchange row lets users convert up/down freely.

## Calendar Widget
*External + internal · Aggregator*

- Month grid (external card = current month, compact) with day cells showing soft dots per scheduled item (color = source widget's accent). Internal: month/week/day views, agenda list.
- **Auto-populates** from every dated thing in the same module (configurable: whole workspace): Quest schedules, Routines, Habit windows, Goal milestone dates, Journal entries. Plus manual events (title, date/time, repeat, note, icon).
- Tap day → agenda panel; tap item → navigate to source. This is a from-scratch calendar honoring app theming — **do not** embed Google Calendar (offline rule); a settings option may import a read-only `.ics` file.

## Separator Widget
*External only · Container*

- A labeled divider line (name centered, hairline rules to each side) with a collapse chevron — collapsing hides all widgets grouped inside it. Drag widgets into/out of it directly on the page. Optional icon.

## Counter Widget
*External · Outputs: count, day-keyed optional*

- Big number, big − / + buttons, long-press for set/reset. Settings: step size, daily-reset on/off (when on, history is day-keyed and graphable), target value.

## Canvas Widget
*External (thumbnail) + internal · Objects: drawings*

- **Card:** latest drawing thumbnail + name.
- **Internal:** a drawing surface — pen/marker/eraser, size + opacity sliders, theme-palette + wheel colors, undo/redo (50 steps), pinch zoom/pan, layers (up to 8), PNG export, image import as layer. Pointer-events with pressure where available; strokes stored as vector paths for crisp redraw, flattened thumbnail cached as Blob.
- This is the small sibling of the Infinite Canvas module (docs/08), sharing the same drawing core (`js/widgets/canvas-core.js`).

## Music Player Widget
*External · Plays local files*

- Imports audio files (stored as Blobs); playlist list, shuffle/repeat, soft seek bar, volume. Media Session API so OS controls work. No streaming (offline rule).

## Alarm / Timer Widget
*External + internal*

- Alarms (time + repeat days + label + gentle chime from a small bundled set), countdown timers, and a pomodoro mode (work/break lengths, auto-cycles, session counter that can output a value link!). Uses Notifications API where granted; otherwise in-app chime + flash. Note: PWA alarms only fire while the app/SW is alive — surface this honestly in the widget's settings copy.

## Notifications Widget
*External · The quiet inbox*

- A reverse-chron feed of app events the user opted into: level-ups, streak milestones, day-rollover summaries, "quest window open" reminders. Settings: per-category toggles. Never badges; just a soft dot on the card when unread.

## Calculator Widget
*External (mini) + internal (full)*

- Card: a 4-function inline calculator. Internal: scientific layout (trig, powers, roots, parens, memory, history tape; tap a history line to reuse). Clean grid of soft keys, theme-colored.

## Image / Gallery Widget
*External (cover) + internal (grid)*

- Stores imported images (Blobs) in a soft-cornered masonry grid; lightbox view with zoom; captions. Used heavily by Study Guide and World Builder modules.

## Dice Widget
*External · for the D&D modules but generally fun*

- Tap to roll: d4 d6 d8 d10 d12 d20 d100, custom formula input (`2d6+3`), advantage/disadvantage toggle, roll history. Rolls animate with a tiny tumble + pointer-FX sparkle.

## Build decisions (v1 implementation notes)

- Notes: images embed as downscaled (max 1280px) data URLs so notes survive Blossom-code export/import intact; revision history deferred per spec.
- Separator: collapsing hides the widgets that follow it on the page until the next separator (group = span between separators).
- Quest/Habit/Routine/Health share one mechanics module, `js/widgets/questops.js` (schedules, rep logs, payouts, streaks, freezes) - widgets stay decoupled, rules live in one place.
- Goal progress uses each linked quest/habit's 30-day completion rate (sticky) rather than today's completion (noisy); milestones count done/not-done.
- Journal entries are nested child widgets; the (entry widget, date) pairs live in the journal's config.
- Graph hit-testing: petals by angle+radius, points/bars/slices by region; first tap tooltips, second tap navigates (app-wide pattern).
