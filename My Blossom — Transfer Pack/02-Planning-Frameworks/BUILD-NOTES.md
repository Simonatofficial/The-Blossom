# BUILD-NOTES — what works, what doesn't (living log)

Per the `organized-code` skill + Simon's ask ("take notes on what works and doesn't"). Newest first. Keep entries tight: **Decision · Gotcha · Pattern · Dead end**, dated.

---

## 2026-06-23 (later) — Visual engine PORTED + theme-driven (Simon: "port it over")

- **Decision:** Simon approved the prototype → **full port done.** The engine now drives off the app's **existing themes** (`src/presets/themes.ts`) instead of a parallel list (one theme id → UI tokens + scene). Faithful to The Blossom, organised clean & data-driven.
- **New shape:** `scenes.ts` (per-theme `SceneExtra`) + `scene.ts` (`buildScene`) + `engineRuntime.ts` (the canvas engine as an isolated, parse-verified JS string) + `engineHtml.ts` (HTML wrapper) + `VisualEngine.tsx`/`.web.tsx`. Old `engine/themes.ts` → deprecated shim (delete it).
- **Covered:** all 7 themes (incl. Scarlet); atmospheres dayNight · constellations · sunset/sunrise · waves · solarSystem · none (mountain/forest dropped per DESIGN-DOC); particles petal · pollen · leaf · autumnLeaf · heart · star · shootingStar · comet · bubble · firefly · snow · rain; optional whole-bloom flower (`withFlower`).
- **Pattern:** adding a theme/particle/atmosphere = ONE entry/branch. Engine is a clean seam — swappable without touching features. `engineRuntime` verified to parse via `new Function(js)`.
- **Handoff:** `docs/ENGINE-PORT.md` = exact wire-in steps for Claude Code (install react-native-webview, swap `<Sky/>`+`<AtmosphereCanvas/>` → `<VisualEngine/>`, retire Skia, verify web+phone).
- **Gotcha to watch:** shell can't delete files in the mount — `engine/themes.ts` left as a `export {}` shim; Claude Code should delete it. WebView transparency white-flash on some Android devices → body bg already transparent; ramp opacity on first paint if seen.

## 2026-06-23 — Visual engine: cross-platform (the big course-correct)

- **Gotcha (root cause of the "awful/blob" visuals):** the M3 build rendered FX with **Skia** (`@shopify/react-native-skia`). Two problems: (1) Skia is **skipped on web** (`app/index.tsx` guards `Platform.OS !== 'web'`), so PC had no atmosphere; (2) the Skia flowers read as **blobs**, not blooms. Net: worse visuals *and* no web — the opposite of the old app, which used HTML/Canvas2D and ran everywhere.
- **Decision (Simon approved "prototype first"):** adopt a **single cross-platform visual engine** = the **ported Canvas2D engine** (same tech as the old app + the approved mockups). Render it **behind** the native UI:
  - web → `<iframe srcDoc=html>` (`VisualEngine.web.tsx`)
  - native → transparent `<WebView source={{html}}>` (`VisualEngine.tsx`)
  - one HTML string from `src/fx/engine/engineHtml.ts`; themes in `src/fx/engine/themes.ts`.
- **Pattern that works:** keep the visual engine a **self-contained HTML/Canvas2D string** (no app imports), theme inlined as JSON, re-mount on theme change (`key={themeId}`). UI/cards/tools stay **native RN** floating over it. This is the seam: the engine can be swapped/upgraded without touching any feature code (`organized-code` §4).
- **Prototype shipped (pending Simon's run):** `app/engine.tsx` (`/engine`) shows the engine + translucent native cards + a theme switch, to prove web == phone before we commit.
- **To run native:** `npx expo install react-native-webview` (Expo-supported; works in Expo Go). Web needs nothing extra.
- **If we commit:** replace the Skia atmosphere/flower on the real screens with `VisualEngine`; port the full theme/atmosphere/particle roster from the old app's `js/fx/*`; then retire the Skia FX files. Engine themes will merge into `src/presets/themes.ts` (add Scarlet + the custom creator, docs/04 §9).
- **Open / watch:** WebView transparency on some Android devices can flash a white frame — test; if it shows, set the body bg transparent (done) and consider `opacity` ramp on first paint. Performance of a full-screen WebView backdrop is fine for a calm scene; revisit only if a heavy device stutters.

## 2026-06-23 — Roadmap honesty

- **Decision:** the M0–M7 phases are **not equal**; "5/8" overstated progress. M0–M4 = invisible engine (~done); **M5 = ~80% of the felt product, barely begun.** STATUS now tracks **engine % vs felt-product %** separately so a checkmark never implies the cozy app exists. (`docs/STATUS.md`, `docs/01` §6.)
