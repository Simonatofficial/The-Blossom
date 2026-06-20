# 15 — The Living Layout Overhaul

> **Read this before any module/page/widget *feel* work.** This is the authoritative spec for giving the app life: making every Module feel like its own world, every Page feel like a different room, and every Widget feel like a character instead of a box. It sits on top of `docs/03` (design system) and `docs/04` (core concepts) and changes **nothing** about the tech stack or the everything-is-data rule — it extends them.

---

## 0. The overhaul block (per `docs/00` §1)

**Restate.** The layout feels vibe-coded: clunky, lifeless, samey. Every module looks like the last, every page is a boring grid, every widget is an identical translucent box. Make it feel natural, cozy, alive — a massive, structural overhaul of the Module → Page → Widget experience, plus more life in the Module/Page/Widget/Settings controls.

**The real diagnosis (why it feels samey).** Today, *personality is only color-deep*. The whole app renders from **one** `--surface`, **one** `--radius`, **one** `.widget-card` shape, **one** `.widget-grid` masonry, **one** motion curve. A theme swaps the *colors* of that single skeleton — so Forest and Space are the same room repainted. Nothing varies the **structure, rhythm, texture, silhouette, density, or motion**. That sameness *is* the clunk. You can't fix it by adding more colors; you fix it by letting structure and material vary — as **data**, scoped exactly like colors already are.

**Overhaul (what we add, within the rails).**
- *Cozy:* identity arrives **soft and inherited** — every new lever defaults to today's look, so nothing jars; worlds reveal themselves as you wander, never on a loud first load (cozy laws §1–4).
- *Token-efficient:* one new **scoped-CSS-variable layer** ("feel tokens") that cascades through the existing module/page/widget scope wrappers for **free**, exactly like theme colors (CR-9). No engine rewrite — additive fields on existing definition objects, rendered by generic engine hooks. Everything-is-data (rule 2) is preserved and extended, not bent.
- *Quality:* 60fps budget, offline, 360px, reduced-motion, AA contrast all hold — feel tokens are static gradients + transform/opacity only.
- *Quantity (near-free adjacent wins):* a single **Module/Page/Widget visual grammar** (consistent icon + colour role at every level) that also cleans up the FAB, nav panels, and breadcrumbs in one move.

**Frame.**
- **Goal:** structural + material identity for Modules, Pages, Widgets — alive, cozy, distinct — as inherited data.
- **Approach:** add a *feel-token* CSS-var layer + `identity.css`; teach the engines to read four new optional data fields (`identity`, `layout`, `material`, `signature`); ship in 6 independently-shippable phases.
- **Files:** new `css/identity.css`, new `js/fx/identity.js` (token resolver); edits to `modules/engine.js`, `widgets/base.js`, `widgets/registry.js`, `js/ui/fab.js`, `css/widgets.css`, `css/fab.css`, `css/components.css`; preset `identity` blocks in `js/presets/*`. New doc rows in `CLAUDE.md`.
- **Cozy notes:** default = inherit = today's look. Intensity is opt-in. Worlds are discovered, not delivered.
- **Done-when:** each phase passes the `docs/00` §5 Definition of Done; the six preset modules each *read* as a distinct world; a tired person at 11pm feels calmer, not busier.

---

## 0.1 Locked decisions (grill-me, 2026-06-20)

These were resolved in a grill-me pass and are **binding** — they override any softer phrasing elsewhere in this doc.

| # | Decision | Resolution |
|---|---|---|
| 1 | **Materials apply how?** | **Auto by widget type.** Every widget gets its material the moment Phase 1 ships — including existing and default modules. `inherit` governs *density/texture/motion*, **not** whether a widget has character. (Refines §9: structure/density/texture inherit; materials always apply.) |
| 2 | **Default texture?** | **Faint texture on by default** in the `cozy` feel — a barely-there frosted/grain wash on the card fill. Static gradient, perf- and AA-safe. |
| 3 | **Preset pages?** | **Re-author the six presets' home/key pages** into archetypes (hearth/stream/etc.) as part of this work — not engine-only. Presets are the showcase. |
| 4 | **Module entrance?** | **On but minimal** — brief, faint, dismissible name wisp + atmosphere cross-fade; reduced-motion shows it instantly with no animation. |
| 5 | **Silhouettes?** | **Subtle only** — radius + frame variation per material, plus at most a faint paper deckle/torn bottom edge. No notches/ticket cuts. |
| 6 | **Masthead?** | **Opt-in, off by default** — protects 360px vertical space; worlds still differ via tab personality, texture, density, motion. A module may enable it. |
| 7 | **Tab-bar personality?** | **Varies per world by default** via `--feel-accent-shape` (underline/rail/bloom/halo). Each preset sets its own. |
| 8 | **FAB idle breath?** | **Tied to Liveliness; off at the default 'Gentle'.** The ≤2% idle pulse appears only at `Lively`. Press halo + `+`→`×` morph always on. (No unprompted idle motion by default.) |
| 9 | **Paper title voice?** | **Serif on paper materials by default** (Journal/Notes/Lore/Docs) via `--font-serif`. Reversible per widget. |
| 10 | **Per-widget material picker?** | **Expose it, tucked away** — an Inherit/pick "Material" row in per-widget settings beside the Theme row (progressive disclosure). |
| 11 | **Spec scope?** | **All six phases stay fully specced.** Each is independently shippable + DoD-gated; Claude Code works them in order and stops on command. |

---

## 1. The core idea — three identity scopes

The hierarchy already exists (Module → Page → Widget). We give each scope a **kind of identity it owns**, and let them cascade:

| Scope | Metaphor | Owns | Expressed by |
|---|---|---|---|
| **Module** | a **world** | overall density, corner language, texture, motion personality, masthead, entrance | `module.identity` |
| **Page** | a **room** | structural layout, header/intro treatment, rhythm | `page.layout` + `page.identity` |
| **Widget** | a **character** | material, silhouette, signature, header voice, micro-life | `registry.material` + `widget.signature` |

Cascade rule (mirrors theme scoping, CR-9 / `docs/03`): **the deepest non-inherit value wins.** A widget's material can override the module's surface feel, just like a widget theme overrides module colours. Everything is one scoped-variable chain.

---

## 2. The feel-token layer (the foundation — Phase 0)

Themes already inject **colour** variables onto a scope wrapper. We add a **parallel, optional layer of "feel" variables** with safe defaults in `:root`. They cascade through the *same* wrappers, so they cost nothing extra at runtime and inherit naturally.

```css
:root {
  /* ----- feel tokens (defaults = today's look; never jarring) ----- */
  --feel-radius:       var(--radius);        /* corner language        */
  --feel-density:      1;                     /* spacing scale multiplier */
  --feel-pad:          14px;                   /* derived from density    */
  --feel-gap:          14px;                   /* grid gap, density-scaled */
  --feel-surface:      var(--surface);        /* card fill               */
  --feel-texture:      none;                   /* layered bg image        */
  --feel-border:       1px solid var(--border);
  --feel-elevation:    var(--shadow-soft);    /* flat | lifted | floating */
  --feel-ease:         var(--ease);           /* motion personality      */
  --feel-dur:          var(--t-med);
  --feel-accent-shape: underline;             /* how accent expresses    */
}
```

**Three named "feel presets"** (calm defaults the user dials, never auto-loud) are just bundles of these tokens, set on a scope wrapper via a `data-feel` attribute:

| `data-feel` | Density | Radius | Texture | Motion | Reads as |
|---|---|---|---|---|---|
| `cozy` *(default)* | 1.0 | 14px | faint frosted wash | calm ease, 200ms | the current Blossom |
| `roomy` | 1.25 | 18px | soft paper grain | drifting, 250ms | a quiet journal / lounge |
| `compact` | 0.8 | 10px | crisp, no texture | springy, 150ms | a focused dashboard / cockpit |

**Resolver** (`js/fx/identity.js`, ~tiny): given a definition's `identity`, it sets `data-feel` + writes any explicit overrides as inline scoped vars on that scope's wrapper element — exactly the pattern `fx/themes.js` already uses for colours. No new rendering path.

> **Why this is the cheapest correct path:** structure and material now vary through *data + cascading variables*, the mechanism the app is already built on. We are not adding a second styling system; we are giving the existing one more knobs.

**Textures (offline, performant).** Each texture is a single pre-built CSS gradient/`radial-gradient` stack (a "frosted wash," "paper grain," "linen," "parchment," "starfield haze"), painted on the card's existing `::before` fill layer at low opacity. No images to download (offline rule), no per-frame blur (perf rule) — they're static paint. Texture opacity is itself a feel token so themes keep it subtle.

**Acceptance (Phase 0):** tokens + resolver land with **zero visible change** (everything resolves to today's values). Verified at 360px, offline, reduced-motion, 60fps. This is the safe substrate every later phase builds on.

---

## 3. Widgets become characters (Phase 1 — highest impact)

This is the change the user will *feel* first: "all the widgets are simple boxes." We give each **widget type** a material, a silhouette, a signature, and a voice — declared once in the registry as data, themed by the cascade.

### 3.1 Materials

A **material** is a named bundle of feel tokens that suits a *kind* of widget. Declared in the registry (`material: 'paper'`), resolved to feel tokens by `identity.js`. Five to start:

| Material | For | Surface feel | Radius | Border | Signature touch |
|---|---|---|---|---|---|
| **paper** | Notes, Journal, Docs, Lore | warm matte, faint grain, slight inset | 12px | hairline, warm | soft top-edge "page" highlight; serif title option |
| **glass** | Tracker, Stats, Graph, Health | translucent frosted, cool | 14px | 1px translucent accent | thin accent rail when active |
| **slate** | Dice, Combat, games | deep, low-texture, matte | 10px | inked 1.5px | crisp press feedback, tactile |
| **card** | Counter, Calculator, Skill, Goal | clean solid-ish, lifted | 16px | none, elevation-defined | corner-bloom accent on change |
| **canvas** | Canvas, Canva Board, Map | edge-to-edge, frame not box | 14px | thin frame, content bleeds | content *is* the surface; minimal chrome |

Materials are **themable**: they read theme colour vars, so Forest-paper and Space-paper differ correctly. A widget's `theme` override still wins on colour; its `material` governs *feel*. Either can be overridden per-instance (the existing per-widget settings get a "Material" row beside "Theme": *Inherit / pick*).

### 3.2 Silhouettes (break the rectangle, gently)

Uniform rectangles are half the "box" problem. Materials may carry an **optional, subtle silhouette** via cheap CSS (`clip-path`/pseudo-elements, no layout cost):
- **paper** → a faint torn/deckle bottom edge (2–3px pseudo) — reads handmade.
- **card** → slightly rounded-top "filing card" with a thin header shelf.
- **slate / glass / canvas** → stay rectangular but vary radius + frame.

Silhouettes default **off** unless the material declares one, and never clip content — they're decorative pseudo-layers. Reduced-motion unaffected (static).

### 3.3 Signatures (give each card a face)

A **signature** is a small, quiet identifying flourish so a Counter never looks like a Journal — using the **existing SVG icon set** (no emoji in chrome, rule 7):
- A **type chip**: the widget's icon in a softly tinted accent chip at the header start (replaces the bare grey icon).
- A **corner watermark**: the same glyph at ~6% opacity, large, bottom-right behind content — a faint "maker's mark." Pure CSS, opt-in per material.
- A **signature rule**: a 2px accent micro-line whose *shape* follows `--feel-accent-shape` (underline / side-rail / corner-bloom / halo) — the same token the tab bar and module use, so the whole world rhymes.

Per-widget `signature: { watermark, chip, rule }` lets a definition tune or silence any of these. Defaults are gentle.

### 3.4 Header voice & micro-life

- **Voice:** paper materials may set the title in the existing `--font-serif`; glass uses an uppercase micro-label; card/slate use the humanist sans. One line of CSS per material — gives instant tonal variety.
- **Micro-life (earned, opt-in, transform/opacity only):** a Counter increment *ticks* (tiny scale-settle), a Tracker check *blooms* (reuse `--glow`), a completed Goal *settles* (soft fade to a "done" calm, never red). All respect reduced-motion and the opt-in-intensity law — defaults are barely-there; the user dials up in Settings → Appearance → "Liveliness."

**Acceptance (Phase 1):** open a page with a Note, a Tracker, a Counter, and a Dice widget — all four read as visibly different *objects*, not four recoloured boxes, while still clearly belonging to the same app. Themes still recolour every material correctly. 60fps with particles + atmosphere; 360px intact.

---

## 4. Pages become rooms (Phase 2)

"Each page is boring and lifeless… each page should feel like something different than the last." The lever: **stop rendering every page as the same 6-column masonry.** Add a `page.layout` archetype (data) the engine knows how to render, plus a page **intro treatment**.

### 4.1 Layout archetypes

`page.layout` (default `masonry` = today's behaviour, so nothing breaks):

| Archetype | Structure | Feels like | Good for |
|---|---|---|---|
| **masonry** *(default)* | dense multi-column, `grid-auto-flow: dense` | a board | dashboards, mixed widgets |
| **stream** | single centred column, generous vertical rhythm, wider max | a page you read | journaling, notes, reading, reflection |
| **hearth** | one full-width **hero** widget, supporting widgets in a calmer grid beneath | a home with a focal point | module home pages |
| **gallery** | equal tiles, consistent aspect, gentle | a collection | canvases, maps, character portraits |
| **split** | two named zones (e.g. 2fr / 1fr) each with own rhythm | a desk: work + margin | list + detail, tracker + log |

Archetypes are pure CSS-grid templates in `identity.css`, selected by `data-layout` on `.page-scope`. Each is responsive: all collapse to a single calm column ≤600px (responsive rule). The widget width settings (full/half/third) still apply where the archetype allows.

A page can mark one widget as its **hero** (`page.heroWidgetId`) for `hearth`; self-heals to first widget if missing (mirrors the existing `homePageId` self-heal in `core/router.js`).

### 4.2 Page intro & rhythm

So a page *opens with character* instead of dumping a grid:
- **Page header band** (optional, themable): page name + optional subtitle + a thin signature rule in the accent (shape from `--feel-accent-shape`). Replaces today's flat `.page-title`. Quiet by default; can carry a faint theme-tinted "mood strip" gradient (one static gradient, perf-safe).
- **Entrance choreography:** on page render, widgets **stagger-fade in** (8–14px rise, opacity, 30ms steps, capped total ~250ms) — transform/opacity only, fully skipped under reduced-motion. This single touch removes most of the "lifeless" feeling at near-zero cost. Reuses the scroll-restoration work (v102): genuine page switches animate; same-page re-renders do **not** re-stagger (no flicker).
- **Density per page:** a page may set `identity.feel` (`cozy`/`roomy`/`compact`), so a Journal page breathes and a Stats page tightens — the same module can hold both.

**Acceptance (Phase 2):** a module with a Home (`hearth`), a Journal (`stream`, roomy), and a Stats (`masonry`/`split`, compact) page — the three feel *structurally* different the instant you tab between them, not just differently filled. Tabbing is smooth, no layout thrash, reduced-motion lands instantly with no animation.

---

## 5. Modules become worlds (Phase 3)

"Each Module should feel unique and comfortable." A module sets the **ambient identity** every page and widget inherits, plus a couple of world-level signatures.

### 5.1 `module.identity`

```js
identity: {
  feel: 'cozy' | 'roomy' | 'compact',   // base feel preset
  accentShape: 'underline'|'rail'|'bloom'|'halo', // how accent expresses everywhere
  texture: 'frosted'|'paper'|'linen'|'parchment'|'starfield'|'none',
  motion: 'calm'|'drifting'|'springy',
  masthead: boolean,                     // show the quiet module header zone
}
```

These set feel tokens on the **module scope wrapper**, so pages and widgets inherit unless they override — one place to give a whole world its character. Pairs with the theme the module already carries (colour) and its atmosphere/particles (ambient) — now **structure** joins them.

### 5.2 World-level signatures (cozy, not loud)

- **Masthead (opt-in):** a thin, quiet header zone showing the module name + a single accent flourish line — so you always *know which world you're in* without a heavy header. Fades with the chrome (50% idle, like the rest).
- **Module entrance:** switching modules cross-fades the atmosphere (already swappable) and shows a brief, **dismissible** module title wisp that fades in ~600ms and out — "the world arrives." Honors reduced-motion (instant) and never blocks interaction (cozy law §3/§6).
- **Tab-bar personality:** the bottom tab bar's active indicator follows `--feel-accent-shape` — underline-glow (today), a left side-rail, a soft corner bloom, or a halo. One token, set once per world, and the tabs feel native to it.

**Acceptance (Phase 3):** load the Study module then the Canvas module — beyond colour, the **density, corners, texture, tab indicator, and motion** differ, so each genuinely feels like a different app-within-the-app. Switching is calm and reversible.

### 5.3 Recommended identities for the six presets (so they ship distinct)

| Preset module | feel | material lean | texture | layout home | accentShape | motion |
|---|---|---|---|---|---|---|
| **The Blossom** (life) | cozy | card/glass | frosted | hearth | bloom | calm |
| **Infinite Canvas** | compact | canvas | none | gallery | rail | springy |
| **D&D DM** | roomy | slate/paper | parchment | split | rail | drifting |
| **D&D Character** | cozy | paper | parchment | hearth | bloom | calm |
| **World Builder** | roomy | paper | linen | stream | underline | drifting |
| **Study Guide** | compact | glass | frosted | masonry | underline | springy |

(These are **data** in `js/presets/*` — examples of the system, not hardcoded specials. Users can change any of them, and their own modules pick whatever they like.)

---

## 6. The controls get life (Phase 4 — FAB, grammar, settings)

"The Module/Page/Widget buttons also need a bit more life… settings top right, and the 3 others inside the plus."

### 6.1 One visual grammar for the three levels

Define a **fixed icon + colour role** for each hierarchy level, used *everywhere* (FAB items, nav panels, breadcrumbs, "add" affordances) so the user always knows which level an action operates on:

| Level | Icon (SVG set) | Role colour | Verb |
|---|---|---|---|
| **Module** | a "world"/orbit glyph | accent | *new world* |
| **Page** | a "leaf"/room glyph | highlight | *new room* |
| **Widget** | a "spark"/seed glyph | success-tint | *plant* |

This coherence is the near-free quantity win: it improves the FAB, the nav panels, and orientation all at once.

### 6.2 FAB

- The `+` → `×` morph stays. Add a **very slow idle breath** (≤2% scale, ~6s, opt-in via Liveliness, off under reduced-motion) and a **press halo** that blooms in the accent — alive, not busy.
- The three items fan out on a subtle **arc** (not a straight stack), each with its grammar icon + a one-word label (*World / Page / Widget*) + a faint role tint on the icon disc. Stagger already exists (`fab.css`) — keep it.
- On open, the FAB casts a soft accent glow on the scrim near the thumb — warmth, not a dark slab.

### 6.3 Settings (top-right) & chrome

- Keep it quiet (50% idle). Add a gentle **hover bloom** consistent with `.chrome-btn`, and make sure the module-switcher and settings share the exact same idle/awake rhythm so the top chrome reads as one calm system.
- Nav panels (Modules/Pages/Widgets) adopt the grammar icons + role colours and the `.list-item` row standard (CR-3) so they feel composed, not ad-hoc.

**Acceptance (Phase 4):** the three creation paths are instantly legible and feel inviting; the FAB has a soft pulse of life without demanding attention; reduced-motion users see a still, perfectly usable version.

---

## 7. Living micro-states & final polish (Phase 5)

A pass to put "life in the feel of everything," strictly within the opt-in-intensity law:
- **Liveliness setting** (Settings → Appearance): *Still / Gentle (default) / Lively* — one global dial scaling all micro-life (card entrances, ticks, blooms, FAB breath, masthead wisp). *Still* ≈ reduced-motion. Persisted in `localStorage` (tiny pref, allowed).
- **Earned motion only:** things move when the user *did* something (added, completed, switched) — never idle nagging, never on first load (cozy law §3).
- **Consistent micro-timing:** all signature motions use `--feel-ease`/`--feel-dur` so a world's motion personality is coherent.
- **Empty states** standardized as warm, type-specific invitations (already partly there) using the grammar icons.
- **Polish sweep:** verify every material × every preset theme for AA contrast and texture subtlety; 60fps with 6 particle layers + atmosphere on a mid-range Android; 360px; offline; no console errors.

---

## 8. Build order (each phase = one shippable feature, DoD-gated)

Follow in order; each is independently valuable and safe to ship alone (per `docs/00` §4 — one commit per feature, auto-push when green).

0. **Token foundation** — `identity.css` feel-token defaults + `fx/identity.js` resolver + scope-wrapper wiring. *Zero visible change.* (the safe substrate)
1. **Widget materials + signatures** — the "boxes → characters" win. *(highest impact first)*
2. **Page layout archetypes + intro/entrance.**
3. **Module identity — masthead, entrance, tab personality** + preset `identity` blocks.
4. **Control life — FAB, the Module/Page/Widget grammar, settings/chrome.**
5. **Living micro-states, Liveliness dial, polish sweep.**

> Rationale: foundation is invisible and risk-free; widgets are what the user touches most and notices first; pages and modules then layer ambient identity over already-improved widgets; controls and micro-life are the finishing gloss. Each phase leaves the app fully shippable.

---

## 9. Guardrails (never break these while building)

- **Everything is data** (rule 2). `identity` / `layout` / `material` / `signature` are definition fields rendered by generic engines. No hardcoded preset where a definition object will do. Presets in `js/presets/*` are just example data.
- **Inherit by default — with one deliberate exception.** Absence of an `identity`/`layout`/`signature` field = today's structure, density, texture, and motion (decision 0.1 #1). **Materials are the exception:** they apply automatically by widget *type*, so existing and default modules look less boxy the moment Phase 1 ships — this is intended, not a regression. No migration touches user *data*; only the rendered surface gains character, and any of it is reversible per widget/module.
- **Scoped variables only** (CR-9). Feel tokens cascade through the existing module/page/widget wrappers — no second styling system, no per-component JS theming.
- **Cozy laws hold** (`docs/00` §3): discoverable not delivered, progressive disclosure, no demands for attention, opt-in intensity, calm motion/shape, user sets the pace, icons over emoji.
- **Perf budget:** textures are static gradients; all motion is transform/opacity; reduced-motion fully respected; single shared rAF untouched; 60fps with particles + atmosphere on mid-range Android.
- **Offline + 360px + AA contrast** verified every phase. No runtime CDN, no webfonts.
- **Definition of Done** (`docs/00` §5) gates every commit; `docs/STATUS.md` updated; pushed green.

---

## 10. The cozy gut-check (apply to every phase before pushing)

> *Could a tired person meet this at 11pm and feel calmer, not busier? Does each module now feel like its own quiet world, each page its own room, each widget its own small character — without anything demanding attention or arriving at full volume? Is every bit of the new life opt-in and reversible?* If any answer is wrong, soften it.

---

### One-line summary

*Personality was only colour-deep — so we add a cascading **feel-token** layer (free, like theme colours) that lets **structure, material, silhouette, and motion** vary as inherited data: widgets become characters, pages become rooms, modules become worlds, and the controls breathe — all opt-in, all cozy, shipped in six safe phases.*
