# 02 — Data Model: Objects, Values, Links, Blossom Codes

## The hierarchy

```
Workspace (the app)
└── Module (a self-contained "application", e.g. The Blossom, World Builder)
    └── Page (a tab inside a module, e.g. Home, Calendar, Statistics)
        └── Widget (an interactive card, e.g. Tracker, Flower Graph, Notes)
            └── Object (a piece of user content, e.g. a note, a tracker day,
                        a character sheet, a map, a journal entry, a drawing)
```

**Objects are the user's content.** Widgets are the containers/tools that create, display, and edit objects. Pages arrange widgets. Modules group pages into an app. The Workspace holds modules plus universal features (settings, themes, saves).

## Record schemas

All records share: `{ id, type, createdAt, updatedAt, name }` (ULID ids).

### Module
```js
{
  id, name, icon,            // icon: id from icons.js, or user-chosen emoji
  pages: [pageId...],        // ordered
  themeOverride: themeId|null,
  presetKey: 'blossom'|null  // which preset spawned it, for reference only
}
```

### Page
```js
{
  id, moduleId, name, icon,
  widgets: [widgetId...],    // ordered, top to bottom
  themeOverride: themeId|null
}
```

### Widget
```js
{
  id, type,                  // type: key in widgets/registry.js
  pageId,                    // or parentWidgetId for nested widgets
  parentWidgetId: null,      // set when nested (Notes, Separator, Journal, Skill…)
  name, collapsed: false,
  themeOverride: themeId|null,
  config: { ... },           // type-specific settings (see docs/05)
  links: [Link...]           // value links (below)
}
```

### Object
```js
{
  id, widgetId, kind,        // kind: 'note'|'entry'|'trackerDay'|'drawing'|'map'|
                             //       'character'|'questLog'|'flashcard'|...
  data: { ... },             // kind-specific content
  date: 'YYYY-MM-DD'|null    // set for day-keyed objects (tracker days, entries…)
}
```

## The Value system (`core/values.js`)

This is what makes widgets composable. Every widget type may expose **value outputs** — named, numeric (or numeric-over-time) readings:

| Widget | Outputs (examples) |
|---|---|
| Tracker | each tracker's daily value (`water: 6`), per day |
| Quest | completions today, completion % , streak length |
| Habit | same as quest + COSMOS adherence score |
| Counter | current count |
| Skill | level, current XP, XP gained today |
| Health | current health, % of max |
| Goal | % complete |
| Journal | entries written (count per day) |

A **Link** pulls a value from a source into a consumer:

```js
{ sourceWidgetId, output: 'water', transform: { scale: 1, clamp: [0, null] } }
```

Consumers: **Graph** widgets (plot linked values), **Skill** widgets (linked values become XP), **Health** widgets (linked quests define max health), **Goal** widgets (linked quests/habits define progress).

Resolution rules:
- Values resolve lazily on read and re-resolve when the source emits `object:changed`.
- Day-keyed outputs return series: `getSeries(link, fromDate, toDate)` → `[{date, value}]`.
- Cycles are detected and refused at link-creation time with a friendly message ("These two widgets would feed each other forever.").
- Nested Skill-in-Skill is allowed (it's a chain, not a cycle); depth is unlimited but XP decays per layer (docs/07).

**UI for linking:** every linkable widget's settings has a "Linked values" section → "+ Add link" opens a picker: choose module → page → widget → output, with a live preview of the current value. Links display as small chips (source name + output) that can be tapped to edit transform or remove.

## Blossom Codes (`core/codes.js`)

A Blossom code is a portable, copy-pasteable snapshot of any node: Object, Widget (with its objects), Page (with its widgets+objects), Module (everything inside), or full Workspace (= save code).

**Format:** `BLSM1.<type>.<base64url(deflate(JSON))>` — e.g. `BLSM1.widget.eJyrVk...`
- `BLSM1` = magic + format version. `type` ∈ `obj|wgt|pg|mod|ws`.
- Payload JSON: `{ v: schemaVersion, root: <record>, children: [records...], exportedAt }`.
- Compress with `CompressionStream('deflate-raw')` (native, no deps); decompress likewise.
- On import: all ids are **re-minted** (fresh ULIDs, internal references remapped) so imports never collide with existing data. Cross-references that point outside the snapshot (e.g. a link to a widget that wasn't exported) are dropped gracefully and reported ("2 links pointed outside this code and were removed.").

**Copying:** every Module/Page/Widget/Object context menu has "Copy Blossom code". After copying, the user is prompted to name it; the named code is stored in the **Codes library** (Settings → Blossom Codes): a notes-style list showing name, type chip (Module/Page/Widget/Object), saved date, and a Copy button. Codes can be renamed, updated (re-snapshot the same source), or deleted.

**Importing:** Settings → Blossom Codes → "Paste a code", or contextually ("+ Add widget" → "From Blossom code"). Preview before import shows what's inside.

**Save codes** are just `ws`-type Blossom codes (full workspace) — same machinery, used by docs/01 Saves.

## How everything interacts (canonical flows)

1. **User checks off a Quest** → Quest widget updates its `questLog` object for today → emits `object:changed` → linked Health widget recomputes health; linked Skill widget accrues pending XP; coins are credited per docs/07 → Market widget's wallet display updates via `wallet:changed`.
2. **Day rolls over** → `day:rolled` → Skills finalize yesterday's XP (level-ups fire a soft bloom animation + coin payout), Health pays out by % and resets, streaks update (freeze items consulted), autosave backup written.
3. **User taps a petal on the Flower Graph** → first tap: petal lifts slightly and a tooltip panel shows the value breakdown → second tap: router navigates to the source widget (its module/page), which glows briefly to orient the user → tap elsewhere: tooltip dismisses.
4. **User drags a widget to another page** → module engine updates both pages' `widgets` arrays → links keep working (links are id-based, location-independent).
