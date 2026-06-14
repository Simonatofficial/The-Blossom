# 01 — Architecture

## Repo layout

```
/
├── index.html              # App shell: root containers, loads js/app.js as module
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker (root scope)
├── icons/                  # PWA icons (192, 512, maskable) + favicon
├── css/
│   ├── base.css            # Reset, CSS variables, typography, layout primitives
│   ├── components.css      # Buttons, panels, inputs, cards, drawers
│   └── widgets.css         # Widget chrome + per-widget styles
├── js/
│   ├── app.js              # Boot: store init → theme → router → render shell
│   ├── core/
│   │   ├── store.js        # IndexedDB wrapper (get/put/delete/query, debounced flush)
│   │   ├── events.js       # Tiny pub/sub event bus
│   │   ├── router.js       # Module/page navigation (hash-based)
│   │   ├── values.js       # Value system: resolve links between widgets (docs/02)
│   │   ├── codes.js        # Blossom code encode/decode (docs/02)
│   │   ├── saves.js        # Export/import, autosave scheduler
│   │   └── ids.js          # ULID generator
│   ├── ui/
│   │   ├── icons.js        # Inline SVG icon set (single source of icons)
│   │   ├── components.js   # Panel, drawer, toast, confirm, color wheel, sliders
│   │   ├── shell.js        # App chrome: module switcher, page tabs, settings button
│   │   ├── settings.js     # Settings drawer (themes, saves, codes, about)
│   │   └── onboarding.js   # First-launch guided tour
│   ├── fx/
│   │   ├── loop.js         # Single shared requestAnimationFrame loop
│   │   ├── particles.js    # Particle engine (background + click/drag layers)
│   │   ├── atmosphere.js   # Atmosphere engine (day/night, constellations, waves…)
│   │   └── themes.js       # Theme application (CSS variable injection)
│   ├── widgets/
│   │   ├── registry.js     # Widget type registry
│   │   ├── base.js         # Widget base class / interface helpers
│   │   └── <type>.js       # One file per widget type (notes.js, tracker.js, …)
│   ├── modules/
│   │   └── engine.js       # Generic module renderer (pages, widget grid)
│   └── presets/
│       ├── themes.js       # Preset theme definitions
│       ├── particles.js    # Preset particle definitions
│       ├── atmospheres.js  # Preset atmosphere definitions
│       └── modules/        # Preset module definitions (blossom.js, dnd-dm.js, …)
└── docs/                   # This framework
```

## Runtime architecture

Layered, strictly downward dependencies:

```
UI shell & widgets  →  module engine  →  core (store, values, events)  →  IndexedDB
        ↘  fx (themes/particles/atmosphere) — reads theme state, owns its canvases
```

- **Event bus** (`core/events.js`): `emit/on` with namespaced events (`object:changed`, `widget:added`, `day:rolled`, `theme:changed`). Widgets never call each other directly — they react to events and to value links.
- **Day rollover**: `saves.js` runs a check on boot and on `visibilitychange`: if the stored `lastActiveDate` < today, emit `day:rolled` (Health resets, Skill XP finalizes, autosave backup is written). All day-based logic listens for this one event.
- **Render model**: widgets render into their card container and own their DOM. The module engine handles layout, drag-reorder, collapse, and per-widget theme scoping (a wrapper element carrying scoped CSS variables).

## Canvas layers (z-order)

1. `#atmosphere-canvas` — fixed, behind everything
2. `#particle-canvas` — fixed, behind UI, above atmosphere
3. App DOM (UI)
4. `#fx-canvas` — fixed, pointer-events none, above UI: click/drag particles

All three are driven by `fx/loop.js` (one rAF). The loop sleeps when no effect is active and when `document.hidden`.

## Persistence

IndexedDB database `blossom`, stores:

| Store | Key | Contents |
|---|---|---|
| `modules` | id | Module definitions (pages, widget order, theme overrides) |
| `widgets` | id | Widget instances (type, config, parentPage, links) |
| `objects` | id | All user content (notes, entries, tracker days, characters, maps…) |
| `themes` | id | Custom themes/particles/atmospheres |
| `meta` | key | Settings, wallet, lastActiveDate, onboarding state |
| `saves` | id | Autosave backups + named saves + stored Blossom codes |
| `trash` | id | Soft-deleted records with `deletedAt` (purge after 30 days) |

Rules:
- Schema version in `meta`; migrations are additive only — **never drop or rewrite user data destructively**.
- Writes are debounced 500ms per record, force-flushed on `pagehide`/`visibilitychange`.
- Large binaries (images, canvas layers) stored as Blobs in `objects`.

## Saves (user-facing)

Settings → Saves section (bottom of settings drawer):

- **Export**: "Copy save code" (full-state Blossom code, see docs/02) or "Download file" (`.blossom` JSON file). Either action also creates an autosave and prompts the user to name it.
- **Import**: "Paste code" or "Load file", with a confirm screen summarizing what will be imported (counts of modules/widgets/objects) and a choice of **Merge** or **Replace** (Replace makes a safety autosave first).
- **Autosaves**: written automatically at end of each day (on the first launch of a new day) and on every export. They appear in a built-in Notes-style list: each entry shows name (if user-named), date, time, a **Copy code** button, and a dropdown with its update history. Users can delete any backup. Keep the most recent 30 daily backups automatically.
- **Manual autosave**: an "Autosave now" button; prompts for a name.

## index.html skeleton

Minimal shell only — everything else is rendered by JS:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>The Blossom</title>
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#1b1430">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/widgets.css">
</head>
<body>
  <canvas id="atmosphere-canvas"></canvas>
  <canvas id="particle-canvas"></canvas>
  <main id="app" aria-live="polite"></main>
  <canvas id="fx-canvas"></canvas>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

## First launch (Startup / Tutorial)

`ui/onboarding.js` runs when `meta.onboarded` is unset. A soft, skippable 6-step guided tour rendered as gentle spotlight cards (no full-screen takeover):

1. **Welcome** — name yourself (optional), one-line promise: "Build a space that's yours."
2. **Pick a starting theme** — live preview of Flower (day) and Space (night) presets; tapping a card applies it instantly behind the tour.
3. **Meet Modules** — shows the module switcher; The Blossom module is pre-installed.
4. **Meet Widgets** — highlights one widget card, demonstrates collapse/drag.
5. **COSMOS intro** — one sentence + "Plant your first habit?" (optional, launches the COSMOS wizard, docs/06).
6. **Saves reassurance** — "Everything lives on your device. Back up anytime in Settings."

Every step has a quiet "Skip tour" link. Tour can be replayed from Settings → About.

## Build decisions (v1 implementation notes)

- A dedicated `pages` object store was added to IndexedDB (additive; the spec table implied pages lived inside modules, but Page records have their own ids/widgets arrays).
- `tools/serve.ps1` is the local test server on machines without Python (`python -m http.server` equivalent); `tools/gen-sw-assets.ps1` regenerates `sw-assets.js`; `tools/gen-icons.ps1` regenerates the PNG icons.
- Store strategy: full in-memory cache hydrated at boot, synchronous reads, debounced (500ms) write-through to IndexedDB, force-flush on pagehide/visibilitychange.
