# The Blossom — Claude Code Framework

The Blossom is a cozy, fully customizable, all-in-one life PWA. The user builds their own app out of **Modules → Pages → Widgets → Objects**, themed with atmospheres and particles, gamified through Skills, Quests, Health, and a coin Market, and grounded in the COSMOS habit method.

This file is the entry point. Read the relevant `/docs` file before working on any area — each one is the authoritative spec for its domain.

## Required setup: install the grill-me skill

Before any major design or planning session on this project, install and use the `grill-me` skill:

```bash
mkdir -p .claude/skills/grill-me
curl -fsSL https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grill-me/SKILL.md \
  -o .claude/skills/grill-me/SKILL.md
```

Source: https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md

**When to use it:** whenever the user proposes a new module, widget, or large feature, invoke grill-me to interview them one question at a time, walking each branch of the design tree and offering a recommended answer for every question, until the design is fully resolved. If a question can be answered by exploring this codebase, explore instead of asking.

## Documentation index

| File | Domain |
|---|---|
| `docs/01-architecture.md` | PWA shell, file layout, runtime architecture, persistence, save codes |
| `docs/02-data-model.md` | Objects, schemas, the value system, linking, Blossom codes |
| `docs/03-design-system.md` | Themes, colors, atmospheres, particle engine, icons/emoji policy, UI feel |
| `docs/04-core-concepts.md` | Workspace, Modules, Pages, Widgets, Objects — how everything interacts |
| `docs/05-widgets.md` | Full spec for every widget |
| `docs/06-cosmos-method.md` | The COSMOS habit/goal system and its in-app flow |
| `docs/07-gamification.md` | XP, levels, health, streaks, coins, Market rewards |
| `docs/08-modules.md` | Preset modules: The Blossom, Infinite Canvas, D&D DM, D&D Character, World Builder, Study Guide |
| `docs/09-deployment.md` | GitHub Pages publishing, manifest, service worker, Android/Windows install |
| `docs/10-roadmap.md` | Phased build order — follow this sequence |

## Tech stack (non-negotiable)

- **Vanilla HTML/CSS/JS with native ES modules. No build step, no framework, no npm dependencies at runtime.** The repo is served directly by GitHub Pages.
- Entry point is `index.html`; all code lives in `/js` and `/css` as modules (see `docs/01-architecture.md` for the exact tree).
- Persistence: **IndexedDB** (via a thin wrapper in `js/core/store.js`), `localStorage` only for tiny prefs (last module, theme id). All user data survives app updates — never write a migration that drops data.
- Rendering: DOM + CSS for UI; `<canvas>` for particles, atmospheres, graphs, and the drawing/canvas/map surfaces. One shared `requestAnimationFrame` loop for all canvas effects.
- PWA: `manifest.webmanifest` + `sw.js` (cache-first app shell, versioned cache name). Installable on Android (Chrome) and Windows (Edge/Chrome).

## Engineering rules

1. **Spec first.** Before implementing a feature, read its `/docs` section. If the spec is silent, prefer the simplest cozy default and note the decision in the doc.
2. **Everything is data.** Modules, pages, widgets, themes, and particles are JSON definitions rendered by generic engines — never hard-code a preset where a definition object would do. Presets are just bundled definition files in `/js/presets`.
3. **Widgets are plugins.** Every widget implements the `Widget` interface (`docs/04-core-concepts.md`). New widgets register in `js/widgets/registry.js` and require zero changes elsewhere.
4. **Performance budget:** 60fps with particles + atmosphere on a mid-range Android phone. Particle engine uses a single canvas, object pooling, capped counts, and pauses when `document.hidden`. No layout thrash; animate only `transform`/`opacity` in DOM.
5. **Offline always.** Every feature must work with zero network. No external CDNs at runtime.
6. **Calm UI.** No modals where a panel will do, no badges screaming for attention, generous whitespace, soft corners (12–16px radius), gentle 150–250ms ease-out transitions. The UI invites; it never demands. See `docs/03-design-system.md`.
7. **Icons over emoji.** Inline SVG icon set (`js/ui/icons.js`) everywhere in chrome/widgets/pages. Emoji are allowed only as optional user-chosen accents on Tabs and in interactive/settings flourishes. See the icon policy in `docs/03-design-system.md`.
8. **Never lose data.** Writes are debounced-but-guaranteed (flush on `visibilitychange`/`pagehide`). Deletions are soft (30-day trash) except where the spec says otherwise.
9. **Verify.** After any feature: run a local server (`python -m http.server`), test in browser, check console for errors, test offline, and test on a 360px-wide viewport.

## Working agreements

- Keep modules under ~300 lines; split when larger.
- JSDoc types on all public functions; no TypeScript (no build step).
- Commit per feature with messages like `feat(widgets): flower graph petal layout`.
- When the user asks for something new and underspecified, use the grill-me skill before coding.
