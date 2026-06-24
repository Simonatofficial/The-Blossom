# ARCHITECTURE — the bones

Detail behind `MERGE-SPEC §2–3`. The bones are inherited from v0.0.1 (they were correct); only the widget contract was enriched for the merge.

## The core model
Four nested concepts, all **data**: **Workspace** (the app) → **Module** (an app-inside-the-app) → **Page** (a screen / tab) → **Widget/Tool** (the interactive unit) → **Object** (the content, referenceable from anywhere via links). Generic engines render the data; presets are bundled definition files.

## Storage — one interface, swappable adapters (`src/core/store/`)
Every widget reads/writes through `Store` (`types.ts`). Implementations sit behind it and never change the interface:
- `memory.ts` — pure JS; the test/web adapter and the reference behaviour.
- `sqlite.ts` — `expo-sqlite`; the on-device source of truth. Mirrors memory exactly.
- `index.ts` — picks the adapter per platform (native → sqlite, web → memory), opened once.

Rules: ids are **text** (never Postgres uuid); deletes are **soft** (`deletedAt`, 1-week sweep); writes set `updatedAt` (drives LWW). The interface adds **links** (`link`/`linksFrom`/`linksTo`) — the cross-object reference backbone that powers the value/graph/Blossom-loop system.

## Sync — offline-first mirror (`src/core/sync/engine.ts`)
`SyncEngine` is transport-agnostic: push local changes since a cursor, then pull remote changes, **last-write-wins by `updatedAt`**. The UI never waits on it. `SupabaseRemote` implements the `SyncSource` (next wave); a Fake one is used in tests. `supabase/schema.sql` is hardened — RLS on, owner-only policies.

## The widget contract (`src/widgets/types.ts`) — the merge's key upgrade
A `Widget` is a pure brain + up to two faces + metadata:
- `logic` — `defaults()` + `reduce()` (+ optional `onDayRolled`). **No RN imports** → node-testable.
- `CardView` (external card) + `FullView` (internal panel) + `primaryTap` (card-body action vs open).
- `outputs` (values for the link system, day-keyed where relevant) · `container` (nests children) · `settings` (declarative schema) · `category` + `keywords` (Add gallery).

`WidgetHost.tsx` is the **only** storage-touching component: it loads state, runs the reducer, persists, subscribes for synced updates, and hands the widget a `ctx` (`navigate`/`toast`/`readLink`/`grow`). A widget never imports the store or another widget — the structural fix for The Blossom's cross-widget bugs.

## Modules (`src/modules/`)
`types.ts` defines the stored `ModuleDoc`/`PageDoc`/`WidgetDoc` and the preset `ModuleDef`/`PageDef`/`WidgetDef`. `engine.ts` instantiates a preset into the store with fresh ids, recursing into nested widgets and creating each widget's backing content object from its `logic.defaults()`.

## Theme + FX (`src/theme/`, `src/presets/themes.ts`, `src/fx/`)
A theme is a biome with its own light: sky gradient + haze + surface/text/accent tokens + a signature particle + optional Living-Layout `feel` tokens. `ThemeProvider` restores/persists the choice; `Sky` paints the always-on gradient floor; the ported Canvas2D **visual engine** layers atmospheres/weather/particles/the flower over it (transparent WebView on native, canvas on web).
