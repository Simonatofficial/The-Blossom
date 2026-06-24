# Connecting v1.0.0 to your existing GitHub + Supabase

You do **not** need a new GitHub or a new Supabase project. v1.0.0 reuses both. Everything is already wired except one git command that has to run on your machine (this environment can't touch `.git` or the network).

## What's already done for you
- **Supabase keys** — your real `.env` (the working `SUPABASE_URL` + anon key) is copied into this folder. The app reads it via `app.config.js → expo.extra`, exactly like v0.0.1 did.
- **Same Supabase project + `objects` table** — the ported sync writes to the same `objects` table you already got working. No schema change needed to start. *(The extra `links` table in `supabase/schema.sql` is optional/for later — sync uses `objects` only for now.)*
- **Same EAS build project** — `app.json` already carries your EAS `projectId` (`b300747b-…`), so cloud builds + EAS secrets carry over.
- **The proven sync layer** is ported in: `src/core/sync/` (client · auth · remote · engine · cursors · SyncProvider), mounted in `app/_layout.tsx`.

## The one thing to run (connects this folder to your GitHub)
This folder already has its own git history but **no remote**. Point it at your existing repo:

```bash
cd "My Blossom v1.0.0"

# 1. (one-time cleanup of a nested copy made during setup — safe to ignore if absent)
rm -rf ".git/.git"

# 2. add your existing GitHub as the remote
git remote add origin https://github.com/Simonatofficial/My-Blossom.git

# 3. stage + commit the v1.0.0 app
git add -A
git commit -m "feat: My Blossom v1.0.0 — fresh app on the existing repo + Supabase"

# 4. push v1.0.0 as the new main (replaces the old v0.0.1 content on GitHub;
#    your v0.0.1 folder stays as a local backup)
git push -u origin main --force
```

> Step 4 force-pushes because v1.0.0's history is independent of the old one. This is intentional — it makes the existing repo hold the fresh app while keeping the repo, its settings, and your Supabase link. If you'd rather preserve the old commit history too, tell Claude Code "merge histories instead of force-push" and it'll do `--allow-unrelated-histories`.

## Turning sync on (already configured — just verify on device)
1. `npm install`
2. `npx expo start` → open in Expo Go (SDK 54) on your phone.
3. On launch the app signs in anonymously and starts mirroring to your Supabase `objects` table. Add a Tool, then check the table in the Supabase dashboard — your rows should appear.
4. To use it on a second device, add the Account panel's "save your account" (email + password) — that upgrades the anonymous user so the same garden syncs everywhere. *(The Account UI is a small W6 piece still to add; the auth functions it calls — `saveAccount` / `signIn` — are already ported in `src/core/sync/auth.ts`.)*

Offline always works with no account; sync is purely additive.
