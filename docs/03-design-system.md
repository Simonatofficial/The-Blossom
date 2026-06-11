# 03 — Design System: Themes, Atmospheres, Particles, Icons, UI Feel

## UI philosophy

Cozy, calm, invited-in. The interface should feel like opening a journal by lamplight, not launching a dashboard.

- **Quiet chrome.** One small settings icon (top-right), one module-switcher icon beside it, page tabs along the bottom. Nothing else competes for attention. Chrome elements fade to ~50% opacity when idle and return on interaction.
- **Soft geometry.** 12–16px corner radii, 1px borders in a translucent accent, layered translucent panels (`backdrop-filter: blur(12px)` with solid-color fallback).
- **Gentle motion.** 150–250ms ease-out for everything; widgets settle into place rather than snap. Respect `prefers-reduced-motion`: disable atmosphere drift and reduce particles to zero.
- **No aggression.** No red badges, no exclamation marks, no guilt copy. A missed habit "wilts" (slightly desaturated) instead of turning angry red.
- **User-first space.** Every screen is the user's: widgets, order, names, themes are all theirs to change. Empty states are warm invitations ("This page is quiet. Plant a widget?") with a single soft button.

## Theme system (`fx/themes.js`)

A **theme** = colors + atmosphere + background particles + click/drag particles.

```js
{
  id, name,
  colors: {
    bg, bgGradient: [c1, c2, ..., angle], // 2–4 stop background gradient
    surface, surfaceAlt,               // panels, cards
    border, text, textSoft,
    accent, accentSoft, highlight,
    glow,                              // translucent accent for box-shadows/halos
    success, warn                      // used sparingly (streaks, wilting)
  },
  atmosphere: { preset: 'constellations', options: {...} } | null,
  particles:  [ { preset: 'cherryBlossoms', overrides: {...}, enabled: true },
                { preset: 'windStreaks',    enabled: true } ] | null,
              // up to 3 layers (CR-7); a single object is read as a 1-layer array
  pointerFx:  { preset: 'starSparkle',   overrides: {...} } | null
}
```

Colors are injected as CSS variables (`--bg`, `--accent`, …) on `:root`, or on a wrapper element for per-module/page/widget overrides — **theme scoping is just scoped CSS variables**, so it's free. Every theme must pass a WCAG AA contrast check between `text`/`surface` and `accent`/`bg`; the custom-theme editor warns (never blocks) when contrast is low.

**Per-scope themes:** Module, Page, and Widget settings each have a Theme row: "Inherit (default) / pick a theme / customize". Atmosphere and particles only ever run at the workspace level of the **active scope chain** (the deepest non-inherit atmosphere wins) — never two atmospheres at once.

**Vibrancy rules (CR-4):** presets must feel vivid, not gray-cozy. Gradients are multi-stop (2–4) and hand-tuned to the atmosphere's light source; accent/highlight carry real chroma; `glow` powers halos on active tabs, progress fills, badges, and flower petals; atmosphere `colorShift` defaults ON and visibly breathes through the UI. Vibrancy lives in accents/gradients/glows — text-on-surface contrast stays AA.

**Editing preset effects (CR-5):** any selected theme — preset or custom — exposes an **Effects** section (Atmosphere / Particles / Pointer FX rows: on/off, swap preset, "Adjust…"). Edits to presets are saved as a non-destructive override layer (`meta.settings.themeOverrides[themeId]`) merged at apply time; the preset shows a "customized" chip with a "Reset to preset" action, and "Save as new theme" promotes overrides to a custom theme.

### Preset themes

| Theme | Palette | Atmosphere | Particles | Pointer FX |
|---|---|---|---|---|
| **Flower** (day) | Cherry-blossom pinks, warm cream, soft gold accents | Day/Night cycle | Cherry blossoms drifting down + occasional wind streaks | Blossom petals burst from taps, trail on drag |
| **Space** (night) | Deep indigo/violet, blue-purple gradients, silver text | Constellations | Twinkling stars + rare shooting star | Star sparkle |
| **Forest** | Deep greens, moss, warm bark browns | Clouds (slow, high) | Falling summer leaves, drifting fireflies after "dusk" | Leaf flutter |
| **Ocean** | Teals, deep blue, seafoam | Waves (bottom) | Rising bubbles | Bubble pop |
| **Sunset** | Burnt orange → rose → dusk purple gradient | Sunset sun | Drifting embers/dust motes | Warm glow ring |
| **Sunrise** | Pale gold → blush → sky blue | Sunrise sun | Floating dandelion seeds | Light shimmer |
| **Beach** | Sand, coral, sky | Waves + clouds combo (waves at low density) | Slow heat shimmer specks | Sand flick |
| **Solar System** | Near-black, planet-hued accents | Orbiting planets (constellation variant) | Tiny comets | Orbit ring pulse |
| **Crimson** (deep reds) | Wine reds, charcoal, gold trim | none (calm) | Slow smoke wisps | Ember spark |

### Custom theme editor (Settings → Themes → "New theme")

A single scrollable panel, live-previewing on the real app behind it:

1. **Colors** — tap any swatch → color wheel + hue/sat/light sliders + hex field. "Generate gradient" derives `bgGradient` from `bg` automatically (user can hand-tune both stops + angle).
2. **Atmosphere** — preset picker (cards with mini live previews) + per-preset options + master on/off.
3. **Particles** — pick preset or "Custom…" (opens particle editor below) + on/off.
4. **Pointer FX** — same as particles, for click/drag layer.
5. **Save** — name it; custom themes appear alongside presets everywhere, and can be edited, duplicated, renamed, deleted. Deleting a theme in use falls back affected scopes to Inherit.

## Atmosphere engine (`fx/atmosphere.js`)

Atmospheres are slow, reactive background scenes on `#atmosphere-canvas`. Shared contract:

```js
{ key, init(canvas, options), tick(dt), applyColorShift(themeColors) -> shiftedColors, destroy() }
```

Global options on every atmosphere: `enabled`, `speed` (0.25×–3×), `colorShift: on|off` (whether the atmosphere may tint theme colors), `intensity` (visual density/brightness).

| Preset | Behavior | Color shift |
|---|---|---|
| **Day/Night cycle** | A small sun and moon orbit a fixed point off-screen-center on a slow circle (default: one full cycle per real day, speed-adjustable to minutes). Sun up → background lightens +8% brightness, warm tint; moon up → darkens −10%, cool tint. Smooth dawn/dusk gradients at the crossover. | Brightness/temperature curve |
| **Constellations** | 4–7 procedurally placed constellations (varying star count 3–9, line segments faintly drawn). Stars twinkle on independent sine phases; whole constellations drift ±10px over minutes and occasionally fade out/in to new positions. Hover/tap a star: it glows and its constellation lines brighten briefly (the one interactive atmosphere). | Subtle cool tint at night |
| **Sunset / Sunrise** | A static low sun with long-period (10–30 min) gradient wash across `bgGradient` — sunset runs warm→dark, sunrise dark→light. Direction chosen at setup. | Gradient wash |
| **Waves** | 2–3 layered sine-wave bands flowing along a chosen edge (top/bottom/left/right), gentle parallax, occasional soft "crash" foam shimmer. | Slight saturation pulse with each crest |
| **Clouds** | 3–5 large, very soft cloud sprites (pre-blurred radial-gradient blobs, not per-frame blur) crossing over minutes; their shadows imperceptibly dim panels they pass behind. | −3% brightness under cloud |

**Optimization (required):** atmospheres render at half device resolution and upscale (they're soft by nature); max 1 atmosphere active; tick work capped (~0.5ms/frame budget); everything precomputed at `init` (no per-frame gradient object creation); pause entirely when `document.hidden` or reduced-motion.

## Particle engine (`fx/particles.js`)

One engine, two layers: **background** (`#particle-canvas`, behind UI) and **pointer FX** (`#fx-canvas`, above UI, spawn at click/drag positions). A particle definition:

```js
{
  id, name,
  shape: { kind: 'sprite'|'char'|'string'|'emoji', value: '❀'|'*'|'snow' },
  behavior: 'fallDown'|'floatUp'|'flowLeft'|'flowRight'|'flowDiagonal'|
            'drift'|'random'|'orbit'|'bounce',
  effects: ['twinkle','glow','grow','shrink','pop','merge','explode','geyser'],
  speed: 1, speedVar: 0.3,
  size: 16, sizeVar: 0.4,           // px; ±variation factor
  maxCount: 60,                     // hard cap; pointer layer cap: 120
  spawn: { area: 'random'|'top'|'bottom'|'left'|'right'|'center'|'middle',
           x: 0.5, y: 0.0,          // normalized anchor (sliders)
           radius: 0.3 },           // normalized spawn radius (slider)
  lifetime: 'offscreen'|seconds,    // despawn rule
  rotation: { spin: 0.2, sway: 0.5 } // gentle tumble for leaves/petals
}
```

**Preset particles:** Snow, Rain, Autumn leaves, Summer leaves, Cherry blossoms, Hearts, Stars, Shooting stars, Bubbles, Fireflies, Tech glyphs (0/1, brackets), Wind streaks, Fire embers, Smoke wisps, Dust motes, Dandelion seeds, Comets. Each preset is a full definition the user can duplicate and tweak.

**Pointer FX presets:** Star sparkle, Blossom burst, Bubble pop, Ember spark, Heart pop, Ripple ring, Leaf flutter, Confetti. Drag emits along the path at a distance-throttled rate; click emits a small burst (5–12).

**Custom particle editor:** opened from the theme editor or Settings → Particles. Top half = live preview region running the definition in isolation; bottom half = controls in collapsible groups (Shape, Behavior, Effects, Spawn, Size & Speed, Limits). Emoji/char shapes show a text input; sprite shapes show the preset sprite gallery. Save/name/edit/delete like themes.

**Optimization (required):**
- Object pool, preallocated to `maxCount`; zero allocations per frame.
- Sprite shapes pre-rendered once to offscreen canvases at 3 size steps; `char`/`string`/`emoji` shapes also pre-rasterized (fillText per frame is too slow).
- Hard caps: 150 particles total background, 120 pointer; engine auto-degrades (halves counts) if frame time >20ms for 60 consecutive frames, and remembers the degraded level per device.
- Particles despawn when off-screen or past lifetime; off-screen check is cheap bounds math.
- Single rAF shared with atmosphere (`fx/loop.js`); skip rendering entirely when both layers idle.

## Icons & emoji policy

**Default to inline SVG icons** (`js/ui/icons.js` — a curated ~80-icon set: feather-style, 1.5px stroke, inheriting `currentColor`). Icons everywhere in chrome, widgets, pages, buttons, and empty states. Text labels accompany icons in settings and menus.

**Emoji are an accent, not a language:**
- ✅ Allowed: user-chosen icon for a Module or Page tab (the icon picker offers SVG icons first, then an emoji tab); particle shapes; playful flourishes inside interactive settings (e.g. theme preview cards); user content (notes, journals — anything they type).
- ❌ Not allowed: widget chrome, headers, buttons, stats, labels, system copy. These use SVG icons or plain text — cleaner and more stylistic, per the product vision.
- Tab icons render at 18px with the tab name beneath (or alone when space is tight, with the name as tooltip/long-press label).

## Layout & components

- **Bottom tab bar** = the module's pages (3–5 visible; overflow into a "More" sheet). Active tab: accent underline glow, not a filled pill.
- **Widget card**: header row (drag handle ⋮⋮ on left-hold, name, collapse chevron, overflow menu ···) + body. Collapsed = header only. Overflow menu: Edit, Theme, Move, Link values, Copy Blossom code, Delete.
- **Panel placement is a user setting (CR-1)**: Settings → Appearance → "Open panels as" — Full page / Left panel / Right panel / Bottom sheet (default: right ≥600px, bottom sheet below). Implemented once in `ui/components.js` `openPanel()`; every surface (widget internal views, settings, pickers, editors, galleries) routes through it. Only destructive confirmations use a small centered dialog, regardless of the setting.
- **Views are routes, not stacked overlays (CR-8)**: opening a widget's internal view navigates (router sub-route); the content beneath unmounts — never visible behind the new view, and back/refresh/deep-links work. Only one content surface at a time (a picker opened from a view replaces any prior picker). View containers use the translucent `surface` treatment over a transparent page background so atmosphere + particles stay visible in all four placements; side/bottom placements dim the live page with a ~20% scrim, never show stale surfaces.
- **Theme scoping follows the widget inside (CR-9)**: the scoped CSS-variable wrapper applies to a widget's card *and* its routed internal view; while a view is open, that widget is the deepest active scope, so its theme's colors — and its atmosphere/particles/pointer FX, if defined — take over until back is pressed.
- **Menu rows (CR-3)**: one shared `.menu-row` component for every menu/gallery/picker — leading icon, then a flex-column text block: name (`1rem`, 600 weight) on its own line, description beneath (`0.8125rem`, `textSoft`, max 2 lines, ellipsis). Never let name and description render inline.
- **Widget gallery search (CR-2)**: the "+ Add widget" gallery has a pinned search field filtering by name/description/keywords, with a This module / Everywhere scope that also finds existing widget instances and navigates to them.
- **Typography**: one humanist sans (system stack: `system-ui` first — no webfont download, offline rule) with a serif option in settings for journal/notes bodies. Base 16px, 1.6 line height.
- **Responsive**: single column ≤600px; 2-column masonry for widgets 600–1100px; 3-column above. Widget width settings: full / half / third (where columns allow).

## Build decisions (v1 implementation notes)

- Atmosphere "color shift" is painted as canvas tint overlays rather than mutating theme CSS variables (safer, same visual effect).
- Custom particle definitions are stored in the `themes` store with `type: 'particle'`.
- Forest/beach themes map to single-shape particle presets (summerLeaves, dustMotes) - mixed-shape presets can come later via a `layers` extension.
