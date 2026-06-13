# 04 — Core Concepts: Workspace, Modules, Pages, Widgets, Objects

## Workspace

The Workspace is the whole app: all modules plus universal features (Settings drawer: Themes, Saves, Blossom Codes, About/Tutorial replay). Universal features are reachable from anywhere via the settings icon. All user data persists across app updates (docs/01 persistence rules).

## Modules

Modules are the separate "applications" inside The Blossom — each one a full-screen experience with its own pages, widgets, and optional theme.

**Module switcher:** an icon next to settings opens a drawer of module cards (icon, name, page count, theme swatch). Actions: switch, **+ New module** (→ from Preset / from Blossom code / from Scratch), long-press or ··· for Rename, Change icon, Theme, Reorder, Copy Blossom code, Delete (soft, to trash).

- *From Preset*: gallery of preset modules (docs/08) with descriptions and a preview screenshot region; selecting one instantiates the preset definition (fresh ids).
- *From Scratch*: name + icon → creates a module with one empty Home page.
- The last-used module reopens on launch (`localStorage`).

## Pages (Tabs)

Pages organize a module; they render as the bottom tab bar. A basic module might have Calendar / Home / Statistics.

- Pages hold an ordered list of widgets in a responsive column/masonry layout (docs/03).
- Page management: long-press a tab (or module settings → Pages): Add, Rename, Change icon, **Set as home page**, Reorder (drag), Theme, Copy Blossom code, Delete.
- Page settings can also set a per-page theme override (docs/03 scoping).
- **Home page (optional).** A module may mark one page as its *home* (`module.homePageId`); the home tab shows a small home marker. Opening the module from the switcher, **or launching the app** (the manifest `start_url` is hash-less, so a cold launch carries no page), lands on the home page; if none is set it falls back to the first page. Tapping tabs within a module still navigates normally, and an in-browser reload (hash present) resumes the exact page — only "no page specified" resolves to home (`core/router.js · resolve`). Pointing home at a deleted page self-heals to the first page.

## Widgets

Widgets are the heart of the app — interactive cards that do things. Full per-widget specs: docs/05.

**External vs internal:** every widget has an *external face* (the card on the page — at-a-glance info, quick interactions) and many also have an *internal view* (tap the card body → the widget expands into a full panel for deep interaction). Spec for each widget says which it is.

**Universal widget abilities** (implemented once in `widgets/base.js` + module engine; every widget inherits):
- Add (from the page's "+" button → widget type gallery / Blossom code), remove (soft delete), rename, reorder (drag by handle), move to another page (overflow menu → Move), collapse/expand.
- Per-widget theme override.
- Link values in/out where the type supports it (docs/02 Value system).
- Copy as Blossom code.
- **Nesting:** container-capable widgets (Notes, Separator, Journal entries, Skill, Health, Goal, Routine) can hold child widgets. Nested widgets are full widgets — same abilities, rendered inside the parent's internal view. Nesting depth is unlimited; the breadcrumb in the internal view shows the chain (Home › Fitness › Strength).

### The Widget interface (`widgets/registry.js`)

Every widget type registers:

```js
registry.register({
  type: 'tracker',
  name: 'Tracker', icon: 'pulse',
  container: false,                 // can hold child widgets?
  external: true, internal: true,   // which faces exist
  defaultConfig: () => ({...}),
  outputs: (widget) => [...],       // value outputs it exposes (docs/02)
  renderCard(el, widget, ctx),      // external face
  renderFull(el, widget, ctx),      // internal view (if internal)
  renderSettings(el, widget, ctx),  // type-specific settings section
  onDayRolled(widget, ctx),         // optional day-rollover hook
  onLinkedChange(widget, ctx)       // optional: a linked source changed
});
```

`ctx` provides `store`, `events`, `values`, `navigate`, `toast`, `wallet` — widgets never import each other.

## Objects

Objects are the pieces of user content inside widgets: drawings, notes, character sheets, goals, habits, journal entries, maps, images, tracker days, flashcards, quiz results, lore articles, etc. (schema in docs/02).

- Objects belong to a widget but can be **referenced** elsewhere (links, graph data points, calendar items).
- Objects with a `date` participate in day-based features (history views, calendar, day rollover).
- Object context menus (where surfaced in a widget's UI) offer Copy Blossom code and Delete.

## Interaction summary (who talks to whom)

```
User input → Widget (edits its Objects) → store write → 'object:changed' event
   → values.js invalidates dependent links
   → consumer widgets (Graph/Skill/Health/Goal) re-render their affected parts
   → gamification (docs/07) credits coins/XP → 'wallet:changed' → Market card updates

Router: tab tap → page render; graph/calendar item second-tap → navigate(widgetId)
Day rollover ('day:rolled') → each widget's onDayRolled → autosave backup
```

Modules never contain logic — they are pure data (pages + widget ids) rendered by `modules/engine.js`. All behavior lives in widget types. This is what keeps the app one consistent machine: **presets, user creations, and Blossom-code imports are all just data flowing through the same engines.**
