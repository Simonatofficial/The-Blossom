# SETUP — first run & the daily loop

Plain steps to get My Blossom running on your phone, then keep building. Full publishing path (accounts, sync, money, stores) is in `docs/02-zero-to-release.md`.

## 0. Install the tools (one time)

- **Node.js** (LTS): <https://nodejs.org>
- **Git**: <https://git-scm.com>
- **Expo Go** on your Android phone (Play Store) — to see the app live.
- **VS Code** (optional): <https://code.visualstudio.com>

## 1. Install dependencies

From this folder:

```bash
npm install
```

> **If anything version-mismatches** (this scaffold pins sensible versions for Expo SDK 56, June 2026, but the SDK moves): the most reliable path is to let Expo reconcile versions —
> ```bash
> npx create-expo-app@latest my-blossom-fresh   # in a temp location
> # then copy our app/, src/, docs/, .claude/, *.json, *.md into it
> npx expo install expo-sqlite react-native-mmkv @shopify/react-native-skia \
>   react-native-reanimated react-native-gesture-handler @supabase/supabase-js react-native-purchases
> ```
> `npx expo install` picks versions that match the installed SDK. Re-verify the latest SDK at <https://docs.expo.dev/versions/latest/>.

## 2. Run it

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your phone. You should see the **My Blossom v0.0.1** placeholder home, themed. That's M0 proven. 🎉

> Some features (RevenueCat, native home-screen widgets) don't run in Expo Go — for those you'll make a **development build** later (`eas build --profile development`). Everything in M0–M3 runs in Expo Go.

## 3. Put it on GitHub

```bash
git init
git add -A
git commit -m "chore: my blossom v0.0.1 skeleton + framework"
# create an empty repo at github.com, then:
git remote add origin https://github.com/<you>/my-blossom.git
git push -u origin main
```

The `ship-it` skill will auto-commit + auto-push each finished feature after this.

## 4. Add your secrets (when you reach M4 / payments)

```bash
cp .env.example .env
# paste your Supabase URL + anon key, RevenueCat keys, Stripe publishable key
```

Never commit `.env` (it's in `.gitignore`). For cloud builds, store these as **EAS secrets**.

## The daily build loop

1. Open Claude Code; describe the **next single feature**.
2. It overhauls the ask → tiny frame → builds the cheapest cozy version (`overhaul-the-ask`).
3. Test on your phone (Expo Go / dev build).
4. Tell it what's wrong; iterate.
5. It verifies, updates `docs/STATUS.md`, commits + pushes (`ship-it`).
6. Repeat. One feature per commit.

## Where to go next

- Building features → `docs/01-architecture.md` (§6 has the M0→M7 order).
- Accounts/sync/money/publishing → `docs/02-zero-to-release.md`.
- What to build & why → `docs/03-market-and-suggestions.md` + `docs/research/`.

## Assets note

`assets/` is empty in this scaffold. Before a real build, add `icon.png` (1024×1024), `adaptive-icon.png`, `splash.png`, and `favicon.png` (paths are set in `app.json`). Until then, Expo uses defaults for `expo start`.
