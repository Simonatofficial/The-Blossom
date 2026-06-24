# 07 — FX & Atmospheres (M3b spec)

How the living world is rendered: the Skia FX engine, the interactive atmospheres, particles, and the Flower-graph. Ported from `docs/04` (the visual soul) into an implementable spec as we start the domain (per `docs/01` §7). **Needs a development build** — `@shopify/react-native-skia` does not run in Expo Go.

> Split: the **definitions + motion math are pure** (`src/fx/*.ts`, node-tested) and ship now; the **Skia renderer** (`src/fx/*.tsx`) consumes them and is verified on the dev build. Logic stays separate from rendering (`docs/01` guiding principle).

---

## 1. The engine (one loop, pooled, capped)

- **One shared Skia `<Canvas>` per scene**, driven by a single Reanimated/Skia clock (`useClock`). Never one canvas per particle, never per-frame React re-renders (`docs/00` §5 perf rule).
- Particles are **pooled and capped**; counts scale by the **Liveliness** dial. Positions come from the pure `particleAt(p, def, t, bounds)` worklet — computed on the UI thread, not in React state.
- **Pause when backgrounded**; honor `prefers-reduced-motion` and Liveliness `still` (→ 0 particles, static scene).
- Budget: **60fps on a mid-range Android phone**. Blur/bloom sparingly; prefer transform/opacity.

## 2. The layer cake (render order, back→front)

Sky gradient + haze (shipped, `src/ui/Sky.tsx`) → far scenery → near scenery → **particles/atmosphere (Skia)** → translucent UI cards (shipped) → chrome. M3b adds the Skia scenery + particle layers between the sky and the cards.

## 3. Atmospheres (definitions in `src/fx/atmospheres.ts`)

Each atmosphere is **data** (`AtmosphereDef`): a particle kind with a motion, count, speed, sway, size/opacity ranges, and a colour (`'accent'` resolves to the theme accent). Roster (from `docs/04` §9, weather merged in):

| id | motion | interactive (counter) |
|---|---|---|
| stars | twinkle | — |
| petals · leaves | fall (+sway) | — |
| pollen | drift | — |
| bubbles | rise | — |
| embers | rise | — |
| **fireflies** | drift + glow | tap → **catch** ("caught") |
| **meteors** | streak | tap → **explode** ("struck") |
| **pufferfish** | drift | tap → **puff** ("puffed") |

Each theme names a default particle (`Theme.particles`). All atmospheres are **opt-in / off by default**, dialed up not down (cozy law 4). Pointer particles follow the finger (later).

## 4. Interactive effects (cozy minigames)

The three interactive atmospheres carry a tiny counter persisted via the Store (`kind: 'fx-counter'`). Tapping a firefly catches it (+1 "caught"), a meteor explodes, a pufferfish puffs. **Must never interfere with use** — purely optional delight (`docs/04` §9).

## 5. Liveliness

`still | gentle | lively` (default **gentle**). Scales particle counts/speed (`still` = 0). Plus interaction motion: tools give slightly on press, gentle touch responses (`docs/04` §9). Always reduce-motion safe.

## 6. The Flower-graph (Home centerpiece — `docs/04` §8)

A whole bloom: an **even 8-petal back layer** (soft theme tint, always a complete flower) + a **front layer of 4 vivid teardrop aspect-petals** on the diagonals, each **scaled by that aspect's level**; soft glow backdrop + seeded centre; gentle float. Petal path geometry is pure (`src/fx/flower.ts`, computed from level → testable); Skia draws it. Full aspect model (5 aspects → attributes=petals, skills=stars + radar) is `docs/06` and lands with the aspect engine.

## 7. Files

```
src/fx/
  types.ts          # AtmosphereDef, Particle, Liveliness (pure)  ✅ M3b-1
  atmospheres.ts    # the atmosphere roster (data)               ✅ M3b-1
  particles.ts      # seeded RNG + makeParticles + particleAt     ✅ M3b-1 (worklet-safe, node-tested)
  AtmosphereCanvas.tsx  # the Skia renderer (consumes the above)  ⏳ needs dev build
  flower.ts / Flower.tsx # graph geometry (pure) + Skia render    ⏳ needs dev build + docs/06
```
