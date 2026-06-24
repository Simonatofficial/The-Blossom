# My Blossom v1.0.0

A cozy, fully customizable, all-in-one life app — **Android · iOS · Web** from one codebase. v1.0.0 is the merge of **The Blossom** (the full feature set) onto a clean **React Native / Expo / Supabase** spine. See `docs/MERGE-SPEC.md` for the whole plan.

## Quick start
```bash
npm install                 # uses .npmrc (legacy-peer-deps) — required
npm run typecheck           # tsc --noEmit
npm run smoke               # headless logic + store + sync checks (no device)
npx expo start              # scan with Expo Go (SDK 54) on Android, or press w for web
```
First run seeds a starter **My Blossom** module (Tracker · Notes · Counter) so there's something alive immediately.

## Cloud sync (optional, off by default)
The app runs fully offline with no setup. To turn on Supabase sync:
1. Create a Supabase project; run `supabase/schema.sql` in its SQL editor.
2. Enable the Anonymous, Email, and Google auth providers.
3. Copy `.env.example` → `.env` and paste `SUPABASE_URL` + `SUPABASE_ANON_KEY` (the anon key is the public client key — safe in the app).

## Layout
```
app/            Expo Router screens (the shell)
src/core/       store (interface + sqlite/memory) · sync engine · pure logic
src/widgets/    Tool plugins — <type>/{logic.ts, View.tsx, index.ts}
src/modules/    Module→Page→Widget model + preset instantiator
src/theme/      tokens + ThemeProvider · src/presets/ data (themes, aspects, modules)
src/fx/  src/ui/   visual engine (ported) · shell chrome
docs/           MERGE-SPEC (read first) · STATUS · ARCHITECTURE
supabase/       hardened schema + RLS
scripts/        smoke.ts (node-testable brain)
```

## How to add a Tool (the whole pattern)
New folder `src/widgets/<type>/`: a pure `logic.ts` (state + reducer, no RN), a `View.tsx` (card + optional full view), an `index.ts` registering it against the contract in `src/widgets/types.ts` — then one import line in `registry.ts`. Add a smoke case for the logic. That's it; nothing else changes.

> Porting from The Blossom? Copy the widget's logic from `../My App/js/widgets/<type>.js`, strip `window`/DOM, add types, rebuild the faces in RN. Never re-key SRD/preset data — import the files.
