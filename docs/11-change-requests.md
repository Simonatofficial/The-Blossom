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

## CR-7 — Multiple particle presets at once (particle layers) · `fx/particles.js`, `fx/themes.js`, `ui/settings.js` · ✅ 2026-06-11
*(Build note: layer reorder uses up/down chevrons instead of drag — calmer at a 3-item max; decision recorded in docs/03. Pointer FX stays single-layer — background layers were the priority.)*

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

## CR-11 — Surface taxonomy: Pages vs Panels vs Popovers · `core/router.js`, `ui/components.js`, app-wide audit · ✅ 2026-06-11
*(Build notes: widget views render as `.routed-page` inside the page host — the CR-1 setting no longer touches them; the Canvas focus page is the `/w/<id>/f` route with browser fullscreen as a secondary control inside it; `openPopover(anchor, opts)` landed in ui/components.js and the canvas color panel uses it; panels are one-at-a-time globally — a second open replaces the first, including nested prompt/picker flows.)*

**Problem:** the app blurs panels and pages. Opening a Notes widget overlays a panel instead of taking you to a real page; the Infinite Canvas "fullscreen" fullscreens the whole app instead of opening a bigger-canvas page; small utilities (brush color) open heavyweight overlays. We need one clear rule for how every feature opens.

**The taxonomy — three surface classes, three APIs, no exceptions:**

| Class | What it's for | How it opens | API |
|---|---|---|---|
| **Page** | Content the user works *in*: every widget's internal view (Notes, Journal, Skill, Canvas…), module pages, the Canvas focus view | **Real navigation.** Router pushes a route; previous content fully unmounts; header gets a back arrow; browser/hardware back works; refresh/deep-link lands correctly. Fills the app area. Never an overlay. | `navigate(route)` |
| **Panel** | App/meta surfaces and pickers: settings menu, theme editor, link picker, module switcher, widget gallery, Blossom-code dialogs, layer panel | **Pop-up overlay** sliding from left / right / bottom / full-page — this is where the CR-1 "Open panels as" setting applies (it governs *panels only*, not pages). Scrim behind; scrim-tap/swipe to dismiss; one panel at a time (a second replaces the first). | `openPanel(content, opts)` |
| **Popover** | Quick mid-task utilities: brush color & tool options in Canvas, overflow (···) menus, emoji/icon quick pick, sort/filter controls | **Small anchored menu** popping from the control that opened it. Compact (≤320px), never covers the work area's center, dismisses on tap-outside or selection. No scrim, no route change. | `openPopover(anchor, content)` (new) |

**Decision rule for everything future:** *Do you go somewhere to work in it? → Page. Are you configuring or picking something app-level? → Panel. Are you adjusting something mid-task without leaving? → Popover.* Add this table to docs/03 (done) and follow it for all Phase 7+ modules.

**Required reclassifications (audit and migrate):**
- All widget internal views: panel → **Page** (this supersedes CR-8's "routed view in panel placements" — widget views no longer respect the panel-placement setting; they are always pages. CR-8's replace-not-stack, transparent-background, and CR-9 theming rules still apply to these pages).
- Infinite Canvas fullscreen (docs/12 §1): instead of the Fullscreen API on the app, the button navigates to a **Canvas focus page** — same document, all Blossom chrome hidden, toolbar with its hide/reveal tab, back arrow exits. (Optional browser fullscreen remains as a *secondary* control inside the focus page for users who want it.)
- Canvas color/tool/brush options: panel → **Popover** (anchored flyouts per docs/12 §9).
- Settings, pickers, galleries, editors: stay **Panels** under the CR-1 setting.
- Confirm dialogs: unchanged (small centered dialog).

**Accept when:** opening a Notes widget changes the route and back returns to the page with nothing stacked; the panel-placement setting visibly affects settings/pickers but *not* widget opening; the Canvas focus page gives a bigger canvas without OS fullscreen; picking a brush color never spawns a panel; every surface in the app is traceable to exactly one of the three APIs.

---

## CR-12 — Canvas zoom regression: drawing/erasing must be zoom-independent again · `canvas-core.js`, tile pyramid (BUG — fix before continuing CR-10) · ✅ 2026-06-11
*(Fixed in the raster model — no vector fallback needed. Tests: `tests/infcanvas-zoom.html` (§5 cases, permanent) + `tests/infcanvas-pointer.html` both pass; implementation notes in docs/12 build decisions.)*

**Problem:** the original (vector) canvas was fully zoom-independent — draw at any zoom, it rendered properly, and anything could be erased from anywhere. Since the raster-tile migration (docs/12 §0): strokes render weird while drawing, drawings **disappear when zoomed far out**, and the **eraser only works at the zoom level the stroke was drawn at**. This is a regression in the new architecture, not polish.

**Root cause to verify:** content is being rasterized into tiles *of the zoom band it was painted in*, and (a) the pyramid above/below those bands is missing or stale, so other zooms render nothing or garbage; (b) the eraser writes only to the *current* band's tiles, so it misses content stored in other bands.

**Required behavior (the invariant):** *a layer is one logical image; the zoom level is only a camera.* Every read (render) and every write (paint, erase, fill, gradient, select-transform) must hit the same logical content no matter the current zoom.

**Fix spec:**
1. **Single write path through the pyramid.** An edit at any zoom writes to the content's native-resolution tiles (the band where that region's detail lives), then propagates: downsample up the pyramid (for zoomed-out views) and mark finer/coarser levels dirty for lazy rebuild. The eraser is the same brush pipeline with destination-out compositing — by going through the shared write path it automatically erases content from any band at any zoom.
2. **Cross-band erase/paint:** when the brush footprint at the current zoom covers regions whose native tiles live in *other* bands (drawn while zoomed differently), the operation must resample and apply to those tiles too. Practical approach: per region keep **one** native band (the finest ever painted there); coarser strokes over it resample down into that band rather than creating a parallel band.
3. **Never disappear.** Zoomed far out, content renders from pyramid levels — below 0.5px on screen it may simplify to downsampled pixels/dots, but it must never cull to nothing. Zoomed far in, native tiles upscale (smoothing per brush type; pixel-brush tiles stay crisp/nearest-neighbor).
4. **Live stroke rendering:** the in-progress stroke draws directly to the screen layer (no tile round-trip mid-stroke) and commits to tiles on pointer-up — this should remove the "renders all weird while drawing" artifacts.
5. **Regression tests (required, keep permanently):** draw at zoom ×1 → erase at ×0.1 and ×10 → assert pixels gone; draw at ×1 → zoom to ×0.001 → assert non-empty render; draw at ×100 → zoom to ×1 → assert visible and correctly placed; rapid zoom while drawing → no artifacts.
6. If after honest assessment the raster pyramid can't meet the invariant within the performance budget, **fall back to the original vector model as the source of truth** (it already worked) and treat raster tiles purely as a render/effects cache — fill/blend rasterize *regions*, not the whole document. The user's experience is the requirement; the architecture serves it.

**Accept when:** all §5 tests pass and a user can draw at any zoom, see it from any zoom, and erase it from any zoom — exactly like the original engine — with blend/fill/layers still working.

---

## CR-13 — Canvas: zoomed-out drawing lags then crashes + low-opacity strokes look like circle trails + remove Sketchy brush · `canvas-core.js` (BUG — fix immediately) · ✅ 2026-06-11
*(Build notes: root cause verified — per-dab `applyWrite` iterated the brush rect's tile range at finer-band resolution (billions of loop steps at low zoom) and allocated/decoded a canvas per existing fine tile. Fixed by the whole-stroke buffer commit in `infcanvas-commit.js` — full spec of the shipped pipeline in docs/12 build decisions. The stroke buffer fixes 13b for pen/pixel/blend/eraser in the Infinite Canvas AND the small Canvas widget. Tests: `tests/infcanvas-perf.html` (permanent) — ×0.001 screen-wide stroke commits in ~20ms with 10 tiles; CR-12 zoom + pointer suites still pass.)*

### 13a. Drawing while zoomed out becomes incredibly laggy and crashes the system

**Symptom:** at low zoom, strokes stutter, then the whole app (sometimes the device/browser) locks up and crashes.

**Likely cause (verify first):** a world-scaled brush at low zoom covers an enormous world area; the CR-12 write path then rasterizes/resamples into native-resolution (fine-band) tiles across that whole footprint — unbounded tile allocation, unbounded memory.

**Fix requirements:**
1. **Cost must scale with screen pixels, not world area.** A stroke is rasterized at the band matching the *current* zoom (the resolution at which the user can actually see it). It must never allocate or rewrite tiles at bands finer than the current view — finer bands get the result via the pyramid (mark dirty, regenerate lazily *when zoomed in*, not eagerly).
2. **Hard budgets, graceful degradation, never a crash:** cap tiles touched per stroke commit (e.g. 512) and total resident tile memory (device-scaled, e.g. 256MB); commits are chunked across frames (async, with the live-stroke overlay covering until done); if a single operation would exceed budget, complete it at a coarser band and toast softly ("Big stroke — saved at view resolution"). An allocation failure must abort the operation cleanly with state intact, never take down the app.
3. **Profile then test:** add a perf regression test — full-screen-width stroke at zoom ×0.001 commits in <100ms and bounded memory; pan/zoom immediately after stays at 60fps.

### 13b. Low-opacity strokes render as a trail of overlapping circles

**Symptom:** semi-transparent lines look like strings of stamped circles, not smooth lines.

**Cause:** each brush stamp is composited onto the layer individually, so overlapping stamps multiply opacity. **Fix (the standard Kleki/Procreate approach):** render the entire in-progress stroke into an offscreen **stroke buffer** at full alpha, then composite the buffer onto the layer **once, at the stroke's opacity**, on pointer-up. Stamps overlapping *within* one stroke never darken each other; two separate strokes still build up as expected. Applies to pen, pixel, blend, and eraser (eraser: buffer as a mask, applied destination-out once).

### 13c. Remove the Sketchy brush

Delete the Sketchy brush entirely — tool button, options, renderer, registry entry, and its row in docs/12 §3 (already removed). No data migration needed (existing sketchy marks are already flattened pixels; they stay as-is).

**Accept when:** a huge zoomed-out scribble commits smoothly with stable memory; a 30%-opacity stroke is a uniform smooth line at every zoom; Sketchy is gone from the toolbar; all CR-12 zoom-independence tests still pass.

---

## CR-14 — World Builder Atlas & stamps: custom brushes, text boxes, pointer tool, editable POIs · `WorldMap`, stamp library (FEATURE — fold into the in-progress Atlas build) · ✅ 2026-06-11
*(Build notes: shipped with the Atlas. `wb-stamps.js` = the library (records in the themes store as data-URL PNGs → Blossom codes work via the existing `thm` type), picker popover, manager panel, file import; `worldmap-objects.js` = pointer tool + map text boxes (curve renders plain text along an arc; visibility band in screen px); `worldmap-pins.js` = pin rendering/editor/presets (six varied defaults). "Save as stamp" landed on the Infinite Canvas select tool and the Canvas widget toolbar. Scatter mode rasterizes into the terrain tiles (one undo per drag). Stamps available in Pinboard, CivProfile crests, Character tokens, Timeline event icons, LoreWiki headers. Decisions recorded in docs/08.)*

The Atlas (docs/08 §5) is still being built — make sure it lands **with** these; they are now part of its spec (docs/08 updated to match):

1. **Custom world brushes & structure stamps (imports).** A user stamp library, "My Stamps," fed three ways: **(a)** import an image file (PNG/JPG, transparent PNG respected); **(b)** send a drawing from the small **Canvas widget**; **(c)** send a **selection from the Infinite Canvas** (the CR-10 select tool gets a "Save as stamp" action — also add it to the Canvas widget). Stamps get a name, category (terrain brush / structure / decoration / token), default size, and optional theme-tint toggle. Managed in a Stamps panel: rename, recolor/tint, recategorize, resize default, delete, reorder; exportable/importable as Blossom codes. Custom stamps appear alongside built-ins in the Features stamp tool, and any stamp can also act as a **pattern brush** (scatter mode: density/jitter/rotation sliders) for painting forests, ruins, dune fields, etc.
2. **Text boxes, same as Infinite Canvas.** The Atlas text/label tool uses the identical rich text-box objects from docs/12 §3 (movable, resizable, re-editable forever, Notes-style formatting), *plus* the map-specific options it already has (curve along a path, zoom-band visibility).
3. **Pointer (select) tool — the default tool.** A normal mouse/tap mode for *using* the map rather than painting it: hover/tap highlights interactive things (stamps, structures, labels, pins/POIs); tap selects (selection ring + name chip); selected objects get move/scale/rotate handles, an Edit action (opens the right editor for what it is), duplicate, and delete. The map opens in pointer mode; painting tools are opt-in. Esc/tap-empty deselects.
4. **POIs/pins are fully customizable.** Per-pin: **color** (palette + wheel), **symbol** (the SVG icon set, an emoji, *or any stamp from My Stamps*), **size** (S/M/L or numeric), **name + label visibility** (always / on-hover / zoom-band), link target, and notes. Pin styles can be saved as reusable **pin presets** ("Capital city", "Dungeon", "Quest giver"). Default pin set gets several shapes/colors out of the box so they never feel limiting.
5. **Stamps everywhere in World Builder.** The same My Stamps library is available across the module's widgets: Pinboard cards, CivProfile banners/crests, Character tokens/portrait frames, Timeline event icons, and LoreWiki article headers — one library, one picker component (a Popover, per CR-11).

**Accept when:** an image imported as a stamp can be painted in scatter mode on the map, used as a pin symbol, and placed on a Pinboard card; a Canvas-widget drawing and an Infinite Canvas selection both arrive in My Stamps; the pointer tool selects and edits a stamp, a label, and a pin; a pin's color/symbol/size/name are all editable and savable as a preset; Atlas text is re-editable rich text boxes.

---

## CR-15 — Popovers overflow off-screen (can't change colors in Infinite Canvas) · `ui/components.js` `openPopover()` (BUG)

**Symptom:** in the Infinite Canvas, the color popover opens *downward* from the toolbar and runs off the bottom of the screen — the picker is unreachable, so colors can't be changed.

**Fix — collision-aware placement in `openPopover()`, not a one-off patch.** Popovers are positioned by the shared utility (CR-11), so fix it once there:
1. **Measure, then place.** After rendering (hidden) measure the popover; place on the anchor's preferred side, but **flip to the opposite side** if it would cross any viewport edge (below ↔ above, right ↔ left). The toolbar's color popover, with a bottom-docked toolbar, must therefore open *upward*.
2. **Clamp + arrow.** After flipping, clamp position to an 8px viewport margin on all sides; keep the caret/arrow pointing at the anchor even when clamped.
3. **Constrain height as a last resort.** If neither side fully fits, pick the larger side and give the popover `max-height` with internal scroll — content may scroll, but never off-screen.
4. **Account for real viewport** (`visualViewport`): on-screen keyboard, browser UI, and safe-area insets — recompute on `resize`/`scroll`/orientation change while open.
5. **Audit every popover** (color/tool/brush flyouts, ··· menus, quick pickers, stamp picker) — all must use `openPopover()`; remove any ad-hoc positioning. Add a regression test: anchor at each screen corner + each toolbar dock → popover fully within viewport every time.

**Accept when:** the canvas color popover opens fully on-screen (upward from a bottom toolbar) on a 360×740 viewport with and without keyboard, and every popover in the app stays within the viewport from any anchor position.

---

## Order of work

~~CR-3 → CR-6 → CR-1 → CR-2 → CR-5 → CR-4~~ ✅ all complete 2026-06-10.

**Round 2:** ~~CR-10~~ ✅ 2026-06-11 (canvas overhaul shipped in one release — accuracy fix, raster layers, redo, all Kleki tools; see docs/12 build notes). Remaining: CR-8 first (routing rework — CR-9 depends on its view container, and it touches every surface) → CR-9 (scoped theming into views) → CR-7 (particle layers; independent, do anytime).

**Round 3 (current priority):**
1. ~~CR-12~~ ✅ 2026-06-11 — zoom independence restored via cross-band write path + mip-chain rendering + live-stroke overlay; all §5 tests pass.
2. ~~CR-11~~ ✅ 2026-06-11 — surface taxonomy implemented (widget views are true Pages; focus page route; popovers; one panel at a time).
3. ~~CR-7~~ ✅ 2026-06-11 (particle layers shipped).
4. Then resume Phase 7 (World Builder → D&D Character → D&D DM).

**Round 4:**
1. ~~CR-13~~ ✅ 2026-06-11 — stroke-buffer commit pipeline; budgets + chunking; Sketchy removed; perf tests permanent.
2. ~~CR-14~~ ✅ 2026-06-11 — shipped with the World Builder module (stamps library + pointer tool + editable pins + rich text labels + save-as-stamp hooks).
3. Then continue Phase 7 (D&D Character → D&D DM).

**Round 5 (current priority):**
1. **CR-15** — popover off-screen bug (blocks color changes in the canvas; small, fix first).
2. Then continue Phase 7 (D&D Character → D&D DM).

Mark each CR done here (`✅ + date`) when its acceptance criteria pass on a 360px viewport and desktop.
