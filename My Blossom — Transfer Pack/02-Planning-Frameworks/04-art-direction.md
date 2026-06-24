# 04 — Art Direction (the visual soul)

The single source of truth for how My Blossom *looks and feels*. The `breathe-life` skill enforces this; this doc defines it. Every surface inherits from here so the whole app reads as one warm, living world — not a pile of screens. Keep it current: when you invent a new piece of the visual language, write it down here.

> **North star:** a hand-illustrated cozy world you *tend*. Closer to a storybook garden or a calm life-sim than to a productivity dashboard. If a screen could belong to any other habit app, it's wrong.

---

## 1. The big idea

My Blossom is a **living garden under a changing sky**. You don't "use" it; you visit a place that grows with you. Three things carry that everywhere:

- **A place** — each module is somewhere real (the Garden, the Cosmos, a dusk Forest, a Study nook), rendered as a layered illustrated scene with depth and weather.
- **A presence** — a gentle **companion** (working name: a *Sprout* — a small seedling spirit) and/or the **Blossom** itself live in the scene, breathe, and react to you.
- **A motif** — the **cosmos-flower**: a four/eight-petal bloom that doubles as the logo, the COSMOS method sigil, the Blossom graph, loaders, and earned-delight bursts.

---

## 2. The layer cake (build every screen like this)

From back to front — never collapse this into a flat fill:

1. **Sky / atmosphere** — the theme's time-of-day light (dawn peach, night violet, dusk amber). A soft celestial glow (sun/moon) lives here.
2. **Far scenery** — rolling hills / distant trees / nebula, lower contrast, slightly desaturated (depth-of-field).
3. **Near scenery** — the garden, foreground trees, the ground, a path. Higher contrast, more detail.
4. **The presence** — companion + the Blossom, with a soft contact shadow.
5. **Particles / weather** — pollen, petals, fireflies, snow, drifting between scenery and UI.
6. **UI cards** — float *above* the world on soft shadows; semi-translucent so the place shows through (user-adjustable opacity).
7. **Chrome & FAB** — quiet icons in soft circles; the FAB is a glowing bloom.

Parallax layers 1–3 gently on scroll. Slightly blur far layers for depth.

---

## 3. Palette (per-theme worlds)

Themes are *moods/biomes with their own light*, not just hue swaps. Hardcoded scene colors (they must not invert in dark mode); UI text gets a soft scrim over busy art.

| Theme | Sky light | Scenery | Accent | Particles | Presence mood |
|---|---|---|---|---|---|
| **Flower (day)** | dawn peach → soft blue | cherry-pink + warm green | rose `#e07aa6` | petals, pollen | sunlit, awake |
| **Forest** | hazy gold-green | layered lush greens | leaf `#5fb87f` | green leaves, fireflies | calm, shaded |
| **Cosmos (night)** | deep violet → indigo | nebula + hills silhouette | starlight `#9f86ff` | stars, comets, fireflies | dreamy, glowing |
| **Ocean** | teal dusk | reef blues | aqua `#3fc0d6` | bubbles, fish | floaty, cool |
| **Sunset** | violet → amber | warm hills | ember `#ff9e6d` | fireflies, embers | golden, slow |
| **Autumn** | amber haze | rust + ochre | maple `#ef9f4a` | autumn leaves | crisp, cozy |

Warm whites over pure white; dusk-violet over pure black. Gradients/bloom only to carry **light and focus**, never as flat decoration.

---

## 4. The companion (the elemental creature)

> The companion is the **soul-bonded elemental creature** — full system in `docs/05`. Visually: a hybrid animal (flying fox, dragon-cat, dog-narwhal…) themed by the user's **element** (fire/water/earth/air + sub-elements), with an element aura/particle signature. Element form is fixed; physical form is swappable. The creature **visibly grows** with the four aspects (Physical→size, Mental→abilities, Emotional→element color, Social→beauty). Render it in layers so one form reads in any element. (The earlier "Sprout" is just the simplest starter form.)

Baseline motion/personality (any form):

- **Idle:** slow breath (scale 1.00↔1.03), occasional blink, tiny sway.
- **Reacts:** perks/hops on a completed quest; looks toward what you tap; dozes (half-lidded) at night; wilts a touch if neglected, never guilt-trips.
- **Grows:** visibly matures as the user's Blossom levels — a long-arc reward.
- It is presence and warmth, **never** a nag or a popup.

---

## 5. Materials & components

- **Cards:** a *material* (soft paper / frosted glass / warm slate / soil) with faint grain; 18–22px radius, occasional hand-drawn wobble; soft drop shadow + a hair of inner top-light; translucent over the scene. Never a flat rect with a gray 1px border.
- **Icon chips:** rounded squircles holding a custom line/duotone icon, catching the theme light.
- **Buttons / pills:** pill-shaped, soft press-in give; primary uses the theme accent with gentle light.
- **FAB:** a blooming flower that opens petals into Module / Page / Widget options (the cosmos-flower in motion).
- **Type:** a friendly humanist sans for UI; a soft serif for editorial/journal/quotes. Two weights. Sentence case, warm microcopy ("a calm night to tend your garden").
- **Icons:** one custom hand-built set. No stock emoji as primary UI (emoji only as a user-chosen accent on tabs).

---

## 6. Motion & delight

- **Ambient:** companion breath, drifting particles, swaying scenery, slow celestial drift, parallax. Low amplitude, calm easing, looping. Gated by `prefers-reduced-motion` + the Liveliness dial (Still / Gentle / Lively).
- **Transitions:** originate from the touch point; 200–350ms ease-out; pages cross-fade like changing rooms; module switch plays a short scene "wisp".
- **Earned delight:** completing blooms a petal-burst / firefly / coin-drop + a companion reaction + a soft chime — varied, never repeated back-to-back, never unearned.

---

## 7. Anti-patterns (forbidden)

Flat single-fill cards; UI floating on a solid color with no scene; default Material/iOS components merely tinted; stock emoji as icons; characterless evenly-spaced gray grids; zero ambient life; gradients/glow as random decoration; anything reskinnable into another habit app unnoticed.

---

## 8. Canonical screen layout (LOCKED — v0.0.1, approved by Simon)

The approved home/companion direction. New screens inherit this; deviations need a reason.

**Navigation (firm):**
- **Modules live on a TOP rail.** A fixed 3-module window with the **active module centred and enlarged** (icon + name); chevron arrows (and swipe L/R) page through the set, wrapping. Tapping a side module selects it. This replaces any bottom module dock.
- **Pages live on a BOTTOM tab bar.** The active module's pages (e.g., Blossom → Home · Companion · Calendar) sit along the bottom; the active page is pill-highlighted. Switching modules resets to the module's first page.
- **A small companion avatar** sits in the top chrome (right) as a shortcut straight to the Companion page.
- **Theme toggle** in the top chrome cycles the world (see below).
- **FAB (+)** still adds module/page/tool.
- Returning from a sub-view lands you where you were.

**The Blossom (flower-graph) — "whole bloom" (firm):**
- It is a **full, layered flower**, the **centred centerpiece of the Home page** — not thin spokes. Build it in two layers: an **even 8-petal back layer** (soft theme-tint) that always reads as a complete bloom, plus a **front layer of 4 vivid aspect petals** (teardrop shape) on the diagonals (X), each **scaled by that aspect's level** so the data shows without the flower ever looking broken. Soft glow backdrop + a seeded centre. Big and generous, with a gentle float.

**Companion page (firm):**
- Creature in its own vignette + aura; show **name · form · element · level** only. **Do NOT show an "element fixed" label** under the pet (the fixity is a system fact, not UI chrome). Below: "how you've shaped her" (the four aspects) + Mental-unlocked abilities + swappable forms.

**Themes / background (direction):**
- Cards stay **translucent & crafted** so the world shows through (opacity adjustable).
- Backgrounds are the **original app's themed atmospheres** (Flower, Sunset, Cosmos shown; Forest/Ocean/Autumn/etc. to follow per §3.2), built as a layered scene: a **multi-stop sky gradient**, a **horizon haze band**, **atmospheric-perspective hills** (far layers lighter/softer), a **distant tree-line silhouette** rather than big cartoon trees, and a soft ground haze. **Aim: painterly & atmospheric, not cartoonish** — this is an ongoing refinement (Simon's note); push toward richer, more illustrated scenery as we build in Skia. Particles per theme (petals/pollen · fireflies/embers · stars/comet).

---

## 9. LOCKED visual decisions (from Simon's design doc)

- **Themes:** keep the roster (Flower · Cosmos · Forest · Ocean · Sunset · Autumn · Solar System) and **add "Scarlet"** — a deep, beautiful red (the palette had no red). **Custom theme creator ships at launch**, available to **Designer/Cosmos tiers only**.
- **Atmospheres absorb "Weather" — one merged "Interactive Atmospheres" section.** No separate weather layer. **Remove** the Mountain-range and Forest atmospheres, and **remove** the Fire weather effect.
- **Interactive atmosphere effects** the user can tap, each with a small **minigame/counter**: **Fireflies** (tap to glow/catch → "caught" counter), **Pufferfish** (tap to puff/grow), **Meteors** (tap to explode), plus the existing day/night, constellations, sunrise/sunset, waves, solar-system. Interactive effects must stay cozy and **never interfere with use**.
- **Particles:** pointer/screen particles **follow the finger/mouse** (the old mobile trail bug is fixed); share one picker with background particles; all optional/off by default. More presets later.
- **Cards:** translucent with a **lower (but still readable) opacity** so the world shows through; texture is **optional — try it, drop it if it looks off**; outlines can be **custom designs (Simon will help author)**.
- **Liveliness:** default **Gentle**, but the app should genuinely **feel alive & immersive** — add **interaction motion** (e.g. tools grow slightly on hover/press, gentle responses to touch) on top of ambient motion. Respect reduce-motion + the dial.
- **The growth graph (locked):** an **aspect = a flower**, its **attributes = petals** (petals grow as attributes level), its **skills = stars** that orbit the flower (stars glow brighter as skills level); the **aspect flower grows more colourful** as the aspect levels. The five aspect-flowers sit under the Liri; add a **radar graph** of the Liri's level across the five aspects. (Structure: `docs/06`.)
- **Liri on every page (subtle):** the Liri may appear quietly on non-companion pages — behind a button, to a side, or roaming — never dominating; full interaction stays on its own page.

---

### One-line summary
*A hand-illustrated living garden under a changing sky, with a breathing **Liri** and the cosmos-flower motif — depth in layers, warmth in materials, life in gentle (interactive) motion, joy in earned blooms — rich in the world, quiet in the controls. Modules ride a top rail, pages sit at the bottom, a whole bloom anchors the home, and aspects render as flowers (petals=attributes, stars=skills) plus a radar.*
