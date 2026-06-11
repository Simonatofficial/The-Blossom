# 11 — Active Change Requests (implement alongside Phase 7+)

User-reported issues and feature requests from live testing. **Work these in priority order before/alongside continuing the Phase 7 modules (docs/10).** Each CR lists scope, exact behavior, and acceptance criteria. When a CR changes a spec, the spec docs (03, 05) have already been updated to match — the spec remains the source of truth; this file is the work order.

---

## CR-1 — Panel placement setting (how things open) · `ui/components.js`, `ui/settings.js` · ✅ 2026-06-10

**Problem:** internal views, settings, pickers, and editors always open the same way. The user wants to choose.

**Behavior:**
- New setting: **Settings → Appearance → "Open panels as"** with four options: **Full page · Left panel · Right panel · Bottom sheet**. Stored in `meta.settings.panelPlacement`; default: Right panel on ≥600px viewports, Bottom sheet below.
- This is a single global preference consumed by the shared panel component — implement it **once** in `ui/components.js` (`openPanel(content, opts)`), not per-feature. Everything that opens a surface (widget internal views, settings drawer, link picker, theme editor, icon picker, Blossom-code dialogs, widget gallery) must route through `openPanel` and therefore obey the setting automatically.
- Placement specifics:
  - *Full page:* covers the app area below the chrome, slides up 200ms ease-out, back arrow in its header.
  - *Left / Right panel:* 380–480px wide (min(85vw)), slides in from its edge, scrim over the rest, swipe-toward-edge or scrim-tap to close.
  - *Bottom sheet:* 70vh default with drag handle; drag up to expand to full, drag down to dismiss.
- Per-call override allowed (`opts.placement`) for the rare surface where one mode is wrong (e.g. destructive confirms stay as small centered dialogs — unchanged).
- Nested opens (a picker opened from a panel) stack in the same placement with a breadcrumb/back affordance.

**Accept when:** changing the setting visibly changes how a widget's internal view, the settings drawer, and the link picker open; choice persists across restarts; no surface in the app ignores it.

---

## CR-2 — Widget search · `ui/components.js` (gallery), `ui/shell.js` · ✅ 2026-06-10

**Problem:** no way to search for widgets.

**Behavior:**
1. **In the "+ Add widget" gallery:** a search field pinned at the top (autofocused on desktop, not on mobile). Filters live, case-insensitive, matching widget **name, description, and keywords** (add an optional `keywords: []` field to registry entries, e.g. tracker: `['habit','log','water','sleep','mood']`). Empty result state: "Nothing matches — try 'notes' or 'graph'."
2. **Global widget search:** the same field (or a search icon in the module switcher drawer) with a scope toggle **This module / Everywhere** that also searches *existing widget instances* by name across modules/pages. Results grouped: "Add new" (types) above "Your widgets" (instances, shown as `Module › Page › Name`); tapping an instance navigates to it.

**Accept when:** typing "ski" surfaces the Skill type and any user widget named "Skiing"; navigation from a result lands on the right page with the widget briefly highlighted (reuse the existing navigate-glow).

---

## CR-3 — Menu row formatting bug (name and description run together) · `css/components.css` · ✅ 2026-06-10

**Problem:** in menus/galleries the big name and the small description render inline — "Skill Level up from your linked efforts" — everywhere.

**Fix:** define one shared `.menu-row` (or `.list-row`) component and use it in every menu, gallery, and picker:
- Structure: optional leading icon · a **text column** (`display:flex; flex-direction:column; gap:2px; min-width:0`) · optional trailing affordance.
- Name: `font-size:1rem; font-weight:600; color:var(--text)` — **on its own line** (`display:block`).
- Description: `font-size:0.8125rem; color:var(--textSoft); line-height:1.4` — beneath the name, 1–2 lines with ellipsis overflow.
- Audit **every** list-style surface for the regression: widget gallery, module preset gallery, settings rows, theme/atmosphere/particle preset cards, link picker, icon picker, Market items, Codes library, reward shop. Replace any ad-hoc markup with the shared component — this bug existing "with everything" means the markup was duplicated; consolidate so it can't drift again.

**Accept when:** every two-line row in the app shows name above description with clear hierarchy and spacing at 360px and desktop widths.

---

## CR-4 — Vibrant themes with richer gradients + atmosphere-matched effects · `js/presets/themes.js`, `fx/themes.js` · ✅ 2026-06-10
*(Note: before/after screenshots couldn't be captured — the preview tooling's screenshot API is broken in this environment. Review live: Settings → Themes flips presets instantly, and AA contrast was verified programmatically at 10.2:1–15.0:1 across all nine.)*

**Problem:** preset themes read flat/muted; gradients and atmosphere effects don't sing together.

**Direction (applies to all presets; see updated docs/03 palette notes):**
- **Multi-stop gradients:** `bgGradient` upgraded from 2 stops to 2–4 stops (schema stays backward compatible — accept arrays of 2+ stops). Each preset gets a hand-tuned gradient that matches its atmosphere's light source (e.g. Sunset: deep plum → rose → ember orange at 170°; Ocean: abyss navy → teal → seafoam glow rising from the bottom where the waves live).
- **Saturation pass:** raise accent/highlight chroma noticeably (cozy ≠ gray). Keep text/surface contrast AA — vibrancy goes into accents, gradients, glows, and atmosphere tinting, not into body text backgrounds.
- **Glow tokens:** add `colors.glow` (a translucent accent used for box-shadows on active tabs, progress fills, level badges, flower petals). Themed glow is what makes vibrancy feel intentional.
- **Atmosphere coupling:** each preset's atmosphere `colorShift` should be ON by default and tuned so the atmosphere visibly breathes through the UI (sun warming the gradient, wave crests pulsing saturation, constellation glow cooling panels) — within the existing tint-overlay implementation and performance budget.
- Re-tune all nine presets side by side; screenshot each before/after for the user to review.

**Accept when:** every preset shows a distinct multi-stop gradient, visible (but calm) atmosphere-driven color movement, and accent glows; AA contrast still passes.

---

## CR-5 — Edit a preset theme's active effects (particles, pointer FX, atmosphere) · `ui/settings.js`, `fx/themes.js` · ✅ 2026-06-10

**Problem:** preset themes are take-it-or-leave-it; users want to tweak the active particles/touch effects/atmosphere without building a custom theme from scratch.

**Behavior:**
- Selecting any theme (preset or custom) in Settings → Themes shows an **"Effects" section directly on the active theme**: Atmosphere, Particles, Pointer FX rows — each with on/off, preset swap, and "Adjust…" (opens the relevant editor pre-loaded with current values).
- Edits to a **preset** theme are stored as a non-destructive **override layer** (`meta.settings.themeOverrides[themeId] = {atmosphere?, particles?, pointerFx?, colors?}`) merged over the preset at apply time. The preset itself is never mutated.
- An overridden preset shows a small "customized" chip and a **"Reset to preset"** action (clears the override layer, with confirm).
- "Save as new theme" remains available to promote overrides into a full custom theme.

**Accept when:** the user can switch Flower's petals to fireflies and slow the Day/Night cycle without leaving the preset, see a "customized" chip, and reset cleanly.

---

## CR-6 — Flower Graph fixes · `js/widgets/graph.js` (flower renderer) · ✅ 2026-06-10

Four issues, all in the signature graph (spec updated in docs/05):

1. **Remove the stem.** No stem or leaves poking out of the bottom. Delete the botanical stem/leaf decoration entirely (remove the `style: 'botanical'` decoration and any related SVG). The flower floats centered on a soft radial glow instead.
2. **Prettier petals.** Current petals are too plain. Upgrade the rendering: refine the Bézier teardrop so the tip is gently pointed and the base narrows into the core (waist ≈ 55–60% of max width); 2-layer fill — base radial gradient (rich at base → translucent tip) **plus** an inner highlight petal at ~70% scale and lower opacity for depth; rim light on the outer edge (1px, lighter accent); per-petal soft drop shadow so overlaps read; slight per-petal hue rotation (±6°) so adjacent petals aren't identical. Use the new `colors.glow` (CR-4) for a halo behind high-value petals.
3. **Rotate to an X, not a +.** With 4 petals the flower currently points up/right/down/left (+). Add a global rotation offset of **45° (π/4)** so petals sit diagonal (×). General rule: `rotationOffset = π/petalCount` applied to all petal counts (it also un-sticks the "one petal straight up" look for other counts), plus an optional manual rotation slider (0–360°) in the graph's settings. Labels, tap hit-testing, and complex-particle anchors must all respect the same offset.
4. **Stars (complex particles) aren't tappable.** Hit-testing currently misses them. Fix: complex particles must register hit regions in the same pointer pipeline as petals, with a **minimum 44×44px hit target** (expand small glyphs' hit radius even though the visual stays small). Tap → tooltip with sub-source name/value; second tap → navigate; petals must not swallow taps on particles that overlap them (test particles first — they're visually on top, so they win the hit test).

**Accept when:** a 4-petal Blossom-page flower renders as a stemless ×-oriented bloom with layered, glowing petals, and every star around it can be tapped (tooltip) and double-tapped (navigate) reliably on a 360px touchscreen.

---

## CR-7 — Multiple particle presets at once (particle layers) · `fx/particles.js`, `fx/themes.js`, `ui/settings.js`

**Problem:** a theme can only run one background particle preset at a time. The user wants to combine them (e.g. cherry blossoms + wind streaks, stars + comets).

**Behavior:**
- A theme's `particles` field becomes an **array of layers**: `particles: [{preset, overrides?, enabled}, ...]` (max 3 layers). Backward compatible: a single object is read as a one-layer array; no migration that touches user data.
- The theme Effects section (CR-5) gains a layer list under Particles: each layer = a `.menu-row` with preset name, on/off toggle, "Adjust…", and remove; "+ Add particle layer" button (hidden at 3). Drag to reorder layers (draw order: first = back).
- Same for **Pointer FX** if cheap to do (one extra layer max); background layers are the priority.
- **Performance:** the existing global caps stay authoritative — 150 background particles *total across all layers*, shared object pool, per-layer `maxCount` proportionally scaled down when the combined total exceeds the cap (e.g. two 100-count layers each run at 75). Auto-degrade behavior unchanged. One engine, one canvas, one rAF — layers are just multiple emitters into the same pool.
- Preset themes may now ship multi-layer particles (Flower: blossoms + wind streaks; Space: twinkling stars + rare comets) — update `js/presets/themes.js`, removing the earlier single-shape compromise noted in docs/03 build decisions.

**Accept when:** Flower runs blossoms and wind streaks together at 60fps on a mid-range phone; a user can add fireflies as a third layer, reorder, disable one layer, and reset to preset (CR-5 override layer covers persistence).

---

## CR-8 — Internal views open as real pages, not stacked overlays · `ui/components.js`, `core/router.js` · ✅ 2026-06-11

**Problem:** opening a widget's internal view overlays it on top of whatever was open before — previously opened panels remain visible behind it, and the atmosphere/particle background is hard to see through the pile of surfaces.

**Behavior — navigation, not stacking:**
- A widget's internal view becomes a **routed page**: opening it *navigates* (router pushes a sub-route like `#/module/page/widget/<id>`); the page content beneath unmounts/hides completely — **never** rendered behind the new view. Back (header arrow, hardware/browser back, swipe-back) pops the route and re-renders the page. Deep links and refresh land correctly because it's a real route.
- Only **one** content surface exists at a time. Lightweight pickers opened *from* a view (link picker, icon picker) may still overlay that one view, but must never accumulate: opening a second picker replaces the first.
- **See the background:** the routed view's container uses the same translucent surface treatment as widget cards (`surface` with its existing alpha/backdrop-blur) over a **transparent page background** — the atmosphere and particle canvases stay fully visible around and through it. No opaque full-bleed backdrops anywhere in the view chrome.
- **Relation to CR-1:** the "Open panels as" setting now controls the *visual arrangement* of the routed view (full page / left / right / bottom sheet) but all four placements are routes with the same replace-not-stack and transparent-background rules. In side/bottom placements, the area outside the panel shows the live page dimmed by a light scrim (~20%), not the stale previous overlay.

**Accept when:** opening Skill → its settings → a link picker then pressing back twice returns cleanly to the page; at no point is an older surface visible behind the current one; the atmosphere is clearly visible behind every open view in all four placement modes.

---

## CR-9 — Per-widget theme must apply to the widget's internal view · `fx/themes.js`, `ui/components.js` · ✅ 2026-06-11

**Problem:** setting a theme on a widget only restyles its card ("the button") on the page — its internal view/pages still render in the inherited theme. The custom theme should follow the widget inside.

**Behavior:**
- Theme scoping (docs/03: scoped CSS variables on a wrapper) must wrap **both** render targets: the card on the page *and* the routed internal view from CR-8 (the view container gets the same scoped-variable wrapper, since it no longer inherits the page's DOM position).
- While a widget's internal view is open, that widget is the **deepest active scope**: its theme's colors apply to the whole view, and per docs/03 scope-chain rules its atmosphere/particles/pointer FX (if its theme defines any) take over the global canvases for as long as the view is open, reverting on back. (This is the existing "deepest non-inherit wins" rule — it now must actually engage on view open/close.)
- Same fix for Page-level themes: entering a page with a theme override swaps scope correctly (verify, since the same root cause likely affects it).
- Nested widgets inside an internal view inherit the widget's theme unless they carry their own override (normal chain).

**Accept when:** giving a Skill widget the Space theme makes its card *and* its opened internal view fully Space-themed (colors + constellations atmosphere + star particles), reverting to the page's theme on back; works in all CR-1 placements.

---

## CR-10 — Infinite Canvas overhaul (Kleki-parity painting) · spec: **docs/12-canvas-overhaul.md** · ✅ 2026-06-11

**Problem:** the infinite world works amazingly, but the drawing tools are too limited — "so much space and nothing to do with it." Plus two bugs: marks land above-left of the touch point (all draw tools), and taps don't paint (only drags).

**Scope (full detail + acceptance criteria in docs/12):** pointer-accuracy fix + tap-to-paint; true fullscreen with hideable toolbar; redo alongside undo (50 steps); obvious selected-tool/brush state; manual pixel-size input with no upper limit; rich-text *box* tool (movable, re-editable, Notes-style formatting); palette selector with custom palettes; brush opacity + stabilizer; blend brush, pixel brush, sketchy brush; select/move/copy/paste/transform; viewport-scoped fill + gradient tool; full layer system (add/delete/reorder/opacity/visibility/blend modes); Kleki-inspired toolbar UI. Underneath: layers move to sparse raster tiles over the existing sector/zoom engine (vector originals preserved).

**Accept when:** all ten acceptance criteria in docs/12 §10 pass.

---

## Order of work

~~CR-3 → CR-6 → CR-1 → CR-2 → CR-5 → CR-4~~ ✅ all complete 2026-06-10.

**Round 2:** ~~CR-10~~ ✅ 2026-06-11 (canvas overhaul shipped in one release — accuracy fix, raster layers, redo, all Kleki tools; see docs/12 build notes). Remaining: CR-8 first (routing rework — CR-9 depends on its view container, and it touches every surface) → CR-9 (scoped theming into views) → CR-7 (particle layers; independent, do anytime). Then resume the Phase 7 sequence in docs/10 (next up: World Builder — its WorldMap builds on the canvas engine, whose CR-10 architecture is now in place → D&D Character → D&D DM). Mark each CR done here (`✅ + date`) when its acceptance criteria pass on a 360px viewport and desktop.
