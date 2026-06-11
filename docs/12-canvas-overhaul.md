# 12 — Infinite Canvas Overhaul (CR-10)

The Infinite Canvas's pan/zoom engine works beautifully — but as a *drawing tool* it's too limited. This doc is the authoritative spec for overhauling it into a full painting app, with heavy inspiration from **Kleki** (kleki.com): study its toolset, defaults, and one-hand-friendly UI; when this spec is silent on a behavior detail, do what Kleki does. The infinite world model (sectors, zoom, bookmarks — docs/08 §2) is kept; everything above it is rebuilt.

This applies to the **Infinite Canvas module** first; port shared wins (accuracy fix, redo, layers, palettes) into the small **Canvas widget** via the shared `canvas-core.js` where they fit.

---

## 0. Architecture change: hybrid raster layers

Blend/smudge brushes, flood fill, and gradients are raster operations — pure vector strokes can't support them.

- **Layers are sparse raster tile grids.** Each layer = a map of 512px tiles (allocated only where painted), stored per sector band so the infinite world model still holds. Painting rasterizes the live stroke into the active layer's tiles at the current zoom band's native resolution; the existing tile-pyramid cache handles display at other zooms.
- **Undo/redo** (see §4) snapshots only the tiles a stroke touched (bounded memory), not whole layers.
- The Gallery, bookmarks, exports, and document chunking (docs/08) are unchanged. Migration: existing vector strokes are rendered once into raster tiles on first open of an old document (keep the vector data in the object as a dormant backup field — never destroy user data).
- **Zoom-independence invariant (CR-12 — currently violated, fix first):** *a layer is one logical image; zoom is only a camera.* Every render and every edit (paint, erase, fill, transform) must hit the same logical content at any zoom: one shared write path through the tile pyramid (downsample-up, dirty-mark, lazy rebuild), cross-band resampling so erasing works on content drawn at a different zoom, never culling content to invisibility when zoomed far out, and live strokes drawn to screen then committed on pointer-up. Full fix spec + required regression tests: docs/11 CR-12. If the raster pyramid can't honestly meet this within the performance budget, revert to vector-as-source-of-truth with raster as a region cache — the original engine's behavior is the bar.

## 1. Canvas focus page + hideable toolbar *(revised by CR-11)*

- The toolbar's **focus button** does **not** fullscreen the app via the Fullscreen API. It **navigates to a Canvas focus page** (a real route, per the CR-11 surface taxonomy): same document, all Blossom chrome hidden (tab bar, header), only canvas + toolbar remain. Back arrow / hardware back exits to the normal canvas page.
- An optional **browser fullscreen** control lives *inside* the focus page (secondary, for users who want edge-to-edge); Esc exits it without leaving the focus page.
- In the focus page, a **hide-toolbar toggle** (small tab at the toolbar's edge, and a two-finger double-tap shortcut): collapses the toolbar to a single translucent reveal-tab while drawing. State remembered per session.

## 2. Pointer accuracy + tap-to-paint (BUG — fix first)

- **Marks land above-left of the touch point.** Root cause will be in screen→world transform: audit `getBoundingClientRect` offsets, `devicePixelRatio` scaling, CSS vs canvas pixel size, and visual-viewport offsets (keyboard/scroll). Marks must land **exactly** under the pointer/finger at every zoom level, DPR, and window size — write a regression test that simulates pointer events at known coordinates and asserts painted pixels. The same transform must be used by **all** tools: brush, eraser, line, circle, rectangle, fill, gradient, select, text.
- **A tap must paint** a single dab (pointerdown+pointerup with no move), not require a drag. Shape tools: tap = place with default minimum size; drag = size it.

## 3. Tools (Kleki-parity toolset)

All tools share: color from the active palette, **opacity slider (0–100%)**, size control (§5), and the stabilizer where relevant (§3a).

| Tool | Spec |
|---|---|
| **Pen brush** | Current brush, upgraded: pressure-sensitive size/opacity (PointerEvent pressure), hardness option, spacing-based stamping so fast strokes don't gap. |
| **Blend brush** | Smudge/mix: picks up color under the stamp and mixes it forward along the stroke (Kleki's blend). Strength slider. |
| **Pixel brush** | Hard 1px–N square stamps, no anti-aliasing, snaps to the pixel grid of the current zoom band — for pixel art. Eraser gets a matching pixel mode. |
| **Sketchy brush** | (Kleki signature) strokes connect to nearby existing stroke points with faint web lines. |
| **Eraser** | Opacity + hardness; erases on the active layer only. |
| **Line / Circle / Rectangle** | Live preview while dragging; Shift/second-finger = constrain (perfect circle/square, 45° lines); filled or outline toggle; obey accuracy fix + tap-to-place. |
| **Fill** | Flood fill, scoped for an infinite canvas (§6). Tolerance slider + "grow" (expand fill N px under edges, Kleki-style). |
| **Gradient** | Drag to set start→end: linear and radial, current color→transparent or color→color, opacity-aware. Applies to the active layer, clipped to viewport unless a selection is active (then clipped to selection). |
| **Select** | Rectangle + freehand lasso. Selected region gets marching-ants outline + a transform frame: **move, scale, rotate, copy, paste, duplicate, delete, flip**; cut/paste respects layers (paste lands as a floating selection on the active layer until committed). Tools paint only inside an active selection (it doubles as a mask). |
| **Text** | Replaces the old text tool: places a **text box object** on the layer — repositionable, resizable, re-editable on double-tap *forever* (kept as an object, rasterized only on export/merge). Editing uses the Notes-widget formatting toolbar: bold, italic, underline, size, color, alignment. |
| **Eyedropper** | Unchanged, plus long-press shortcut inside any brush tool. |

### 3a. Stabilizer

Kleki-style smoothing: a 0–5 strength setting in the toolbar (0 = raw). Implementation: pull-string / moving-average — the drawn point chases the pointer with configurable lag; higher = smoother, slower curves. Applies to pen, blend, pixel (optional), and eraser.

## 4. Undo **and redo**

- History stack of **50 steps** (tile-snapshot based, §0): every stroke, fill, gradient, layer op, selection transform, and text edit is one step.
- Toolbar: undo + **redo** buttons (greyed when empty) with step-count tooltip; keyboard Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z; two-finger tap = undo, three-finger tap = redo (Kleki gestures).
- New action after undo clears the redo branch (standard).

## 5. Brush size: manual pixel input, infinite scale

- The size control is a slider **plus a numeric field** — type any value ≥0.1, **no upper limit** (the brush scales infinitely, just like the canvas). Slider covers 1–200; the field goes beyond.
- Size is **world-scaled by default** (zoom in → same world-size brush paints finer screen detail) with the existing screen-scaled toggle; the readout shows both ("250 px · ≈40 on screen").

## 6. Fill on an infinite canvas (decided approach)

Flood fill cannot fill unbounded space. Behavior:

1. Fill region is computed on the **current viewport raster** (what you see) at screen resolution, from the tapped point, honoring tolerance.
2. If the region is **enclosed by drawn lines within the viewport**, it fills exactly to those lines — the normal case, works like any paint app.
3. If the region **touches the viewport edge** (would leak into infinity), it clamps at the visible edge and fills only what's on screen — with a subtle one-time hint toast: "Filled to the edge of your view."
4. A **max-area safety** (~viewport × 1) keeps it predictable; an optional "expand" setting (off / 0.5× / 1× viewport beyond the edges) is the user-adjustable "flood size" — list it in tool settings as *Fill reach*.
5. Result is rasterized into the active layer's tiles at the current zoom band.

## 7. Layers (full Kleki parity)

- **Layer panel**: right-edge drawer (obeys CR-1 placement; collapsible in fullscreen). Each row: thumbnail (live, ~64px), name (tap to rename), visibility eye, opacity slider (0–100%), drag handle to reorder.
- Operations: **add** (cap 16), **delete** (confirm), **duplicate**, **merge down**, **clear**, enable/disable, reorder.
- **Blend modes** per layer (Kleki set): normal, multiply, screen, overlay, darken, lighten, hue, saturation, color, luminosity.
- Active layer is clearly marked; all paint/fill/select operations hit the active layer only. Eraser on a layer erases to transparent.
- Layer data = the sparse tile grids from §0; thumbnails update debounced (200ms) after edits.

## 8. Color palettes

- The color panel keeps the current defaults as the **"Blossom" palette**, and adds a **palette selector**: swatch-row dropdown listing Blossom, a few curated presets (Warm, Cool, Earth, Neon, Pastel, Grayscale), and **custom palettes** — "Custom 1, Custom 2…" auto-named, renameable.
- Custom palette editor: up to 30 swatches; add current color, pick via wheel/sliders/hex, drag to reorder, long-press to delete; duplicate any palette as a starting point. Stored in the `themes` store (`type:'palette'`); exportable as Blossom codes.
- Recent-colors row (last 10) always visible above the palette.

## 9. Toolbar / UI (Kleki-inspired)

- **Selected state must be obvious (BUG):** the active tool gets a filled accent background + glow (`colors.glow`), not just a tint; the active brush type shows name + a live stroke preview chip. One glance = you know your tool, brush, size, opacity, color.
- Layout: compact icon toolbar docked left (landscape/desktop) or bottom (portrait) — Kleki-style: tool icons in a single strip; tapping the active tool again opens its options flyout (size, opacity, stabilizer, tool-specific settings). Color dot + active palette at the strip's end opens the color panel.
- Everything reachable one-handed on a phone; flyouts never cover the center of the canvas.
- Keyboard shortcuts (desktop): B pen, E eraser, G fill, L line, T text, S select, V transform, X swap color, [ ] size, Ctrl+Z/Y.

## 10. Acceptance criteria

1. Marks land exactly under the pointer for every tool at zooms from ×0.01 to ×100, on touch and mouse, at DPR 1–3; single taps paint dabs.
2. Fullscreen hides all chrome; toolbar can be hidden/revealed while drawing.
3. Redo works (buttons, keys, gestures) through 50 steps including layer ops.
4. Active tool/brush is identifiable at a glance in a screenshot.
5. Brush size accepts typed values (0.1 → 10,000+) and paints correctly at both extremes.
6. Text boxes are movable and re-editable with rich formatting after deselection.
7. Fill behaves per §6 in an enclosed shape, an open region, and a zoomed-in detail.
8. Gradient, blend brush, pixel brush, select/transform/copy/paste all function on the correct layer.
9. 16 layers with mixed blend modes + opacity render correctly and pan/zoom at 60fps on a mid-range phone (tile cache absorbs the compositing cost).
10. Custom palettes persist, and existing canvas documents open with their content intact (vector→raster migration, original data retained).

## Build order

§2 accuracy bug → §0 raster-layer architecture + §4 undo/redo → §7 layers → §3 core brushes (pen upgrade, blend, pixel, eraser) + §3a stabilizer → §5 size input → §1 fullscreen + toolbar → §9 UI overhaul → §8 palettes → shapes/§6 fill/gradient → select → text. Ship in 2–3 releases; the accuracy fix and redo may ship immediately ahead of the rest.

## Build decisions (✅ shipped 2026-06-11, blossom-v5)

Implemented across `infcanvas-engine/raster/tools/select/text/palette/ui/infcanvas.js`. Where the spec was silent, these cozy defaults were chosen:

- **Pointer regression test** lives at `tests/infcanvas-pointer.html` (standalone page, no framework — open it under `tools/serve.ps1`). Asserts the painted centroid is ≤1px from the tap at zooms 2^-7…2^6.64 and at a 2× CSS/backing-store ratio. The `tests/` folder is excluded from the SW cache.
- **Zoom independence (CR-12, fixed 2026-06-11):** every edit flows through `RasterDoc.applyWrite()` — content in coarser bands under the edit is *promoted* (moved, pixel-aligned, nearest-neighbour) into the write band, content in finer bands is written directly via a world-space transform, and band-w tiles cover fresh areas with an even-odd clip so nothing double-draws. Regions thereby converge to one native band (the finest ever painted). Rendering far out goes through a lazily built, write-invalidated **mip chain** (`mipTile` + per-band occupancy index) instead of the old skip-the-band guard; each mip level draws its sources twice so the 2× minification fade cancels and distant work simplifies to firm specks instead of vanishing. Live strokes draw to a screen-space overlay and replay through the write path on pointer-up (the blend brush stays direct — it samples committed pixels as it goes; its mid-stroke tile writes are inherent). Permanent tests: `tests/infcanvas-zoom.html`.
- **Layer delete is undoable** by being meta-only: tiles stay put and are vacuumed on the *next* document open, when no history step can resurrect them. Same vacuum removes orphaned text boxes.
- **Merge down** composites the upper layer's tiles per zoom band into the lower layer (opacity + blend applied per-tile against that band's content — an approximation of full-stack compositing that keeps the infinite model). Text boxes on the merged layer are *not* rasterized; they move to the surviving layer as part of the same undo step (merging never bakes text).
- **Selection** lift → transform → drop batches into **one** history step; undoing while a selection floats commits then undoes, which reads as "cancel the move". After a transform, the mask polygon is the transformed outline (exact for lassos too).
- **Fill** composites all visible layers (what you see) but ignores DOM text boxes; its result lands on the active layer. Tolerance 0–128, grow 0–8 px, *Fill reach* off/½/1× viewport.
- **Eyedropper** picks from the rendered display canvas — exactly what the eye sees (including layer blending); picking pure transparent leaves the color unchanged.
- **Second finger constrains shapes** (square/circle/45°) instead of cancelling the stroke — for brushes a second finger still cancels into a pinch (Kleki behavior).
- **Two-finger-double-tap toolbar toggle** only arms in fullscreen, where the undo gesture waits 320ms for a possible second tap; outside fullscreen undo fires instantly.
- **Text boxes** are DOM elements over the canvas (crisp at any zoom, free rich text) and rasterize via SVG `foreignObject` only into PNG exports. Box font sizes/widths are world units. Empty boxes evaporate on blur.
- **Panel swipe-close** now ignores gestures that start on a `canvas` or `.range` — drawing a left-to-right stroke must never close the drawer (bug found by the pointer tests).
- Blossom codes gained a `thm` node type (themes-store records) so palettes — `type:'palette'` records — are exportable; `allThemes()` filters them out of theme pickers.
