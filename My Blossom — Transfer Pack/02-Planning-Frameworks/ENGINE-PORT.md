# ENGINE-PORT — wiring the cross-platform visual engine (handoff for Claude Code)

**Status:** the engine is **ported and ready**. This is the step-by-step to wire it into the real screens and **retire Skia**. Goal (Simon): *"almost exactly the same as The Blossom, just more organized and clean."* Do this early in M5, before more FX work. Follow `organized-code` + `breathe-life`.

## What the engine is

A clean, isolated **Canvas2D engine** that renders the themed background world (sky → atmosphere → hills → particle layers → optional flower) and runs **identically on web, Android, and Apple** (it's what The Blossom used + what the approved mockups used). It is driven by the app's **existing themes** — one theme id → UI tokens *and* scene.

```
src/fx/engine/
  scenes.ts        per-theme SceneExtra (atmosphere, celestial, hills, particles…), keyed by theme id
  scene.ts         Scene type + buildScene(theme, opts) — merges UI theme + SceneExtra
  engineRuntime.ts ENGINE_RUNTIME — the canvas drawing engine (plain JS string; parses clean)
  engineHtml.ts    engineHtml(scene) — self-contained HTML doc (injects __SCENE__ + runtime)
  VisualEngine.tsx native: transparent <WebView> behind the UI
  VisualEngine.web.tsx  web: <iframe srcDoc> behind the UI
  themes.ts        DEPRECATED shim — delete it
```

Use it anywhere as the background:
```tsx
import { VisualEngine } from '@/fx/engine/VisualEngine';
// plain background:
<VisualEngine themeId={theme.id} />
// Blossom / aspect screens (adds the whole-bloom flower):
<VisualEngine themeId={theme.id} withFlower aspectLevels={[m,p,e,s,r]} />
```
It fills its parent (`absoluteFill`), is `pointerEvents="none"`, and paints its own sky — put it as the **first child** of the screen root, UI after it.

## Steps

1. **Install the native dep:** `npx expo install react-native-webview` (Expo-supported; runs in Expo Go). Web needs nothing.
2. **Delete** `src/fx/engine/themes.ts` (deprecated shim).
3. **Swap the background on each screen:** replace `<Sky/>` + `<AtmosphereCanvas/>` (the Skia path, currently skipped on web) with a single `<VisualEngine themeId={t.id} />` as the first child. Do this in `app/index.tsx`, `app/blossom.tsx`, and any new module/page roots. On the Blossom/aspect surfaces pass `withFlower` (+ real `aspectLevels` once the growth engine exists).
4. **Retire Skia FX once nothing imports them:** `src/fx/AtmosphereCanvas.tsx`, `src/fx/Flower.tsx`, `src/fx/AspectFlower.tsx` (Skia parts), `src/fx/atmospheres.ts`, `src/fx/particles.ts`, `src/fx/flowerLayout.ts`, `src/ui/Sky.tsx`, and the `@shopify/react-native-skia` dependency. Keep `LivelinessProvider` (it's not Skia). Verify nothing else imports Skia first (`grep -rn "react-native-skia\|AtmosphereCanvas\|ui/Sky" src app`).
5. **Verify cross-platform:** `npm run web` → `/engine` and the home both show the living sky on PC; then the dev build on the phone shows the same. `tsc --noEmit` green.
6. **Keep the look faithful + expand:** the engine already covers the theme roster + atmospheres (dayNight · constellations · sunset/sunrise · waves · solarSystem) + particles (petal · pollen · leaf · autumnLeaf · heart · star · shootingStar · comet · bubble · firefly · snow · rain). To match The Blossom fully, tune palettes/behaviours in `scenes.ts`/`engineRuntime.ts` against the mockups + `docs/04`. Adding a theme = an entry in `presets/themes.ts` + `scenes.ts`. Adding a particle/atmosphere = one branch in `engineRuntime.ts`.

## Known follow-ups (not blockers)

- **Interactive atmosphere effects** (tap a firefly to catch it / pufferfish / meteors, with counters — `docs/04` §9): the WebView is `pointerEvents="none"`, so taps pass to native. Implement interactivity as a thin native overlay (Reanimated/Gesture) that knows particle positions, OR enable pointer events on the WebView and post tap coords in. Design later with `breathe-life`; keep it from blocking scroll.
- **Custom-theme creator** (Daisy tier): writes a `Theme` + `SceneExtra` at runtime — the data-driven shape already supports it.
- **Performance:** a full-screen WebView backdrop is fine for a calm scene. If a low-end device stutters, lower particle counts (one number in `initParticles`) or pause when a heavy modal is open. Revisit only if measured.

## Why this way (for the record)

Skia gave blobs + no web. This engine is the proven Canvas2D look, cross-platform, and **theme-data-driven** so it's easy to edit/extend (Simon's core ask). It's a clean **seam**: the whole visual engine can be swapped or upgraded without touching any feature code.
