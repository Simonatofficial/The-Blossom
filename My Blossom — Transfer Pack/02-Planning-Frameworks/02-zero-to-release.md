# 02 — Zero → Release → Updates (the cozy beginner's path)

Everything needed to take My Blossom from an idea on your machine to a published app, and keep it healthy after. Written for someone with **no prior app-shipping experience**, in plain words. Pair with `docs/01` (the RN architecture) — this doc is the *mechanics*: accounts, tools, sync, money, hosting, store submission, updates.

> Read it like a trail map, not a wall. You do these **in order**, one calm step at a time. Nothing here must be done all at once. The whole point of the cozy laws applies to *you* too: explore at your own pace.

> **Currency of facts:** prices, SDK versions, and store rules below were checked **June 2026** (sources at the bottom). They drift — re-verify the API level and SDK before each release. Claude can web-check these on request.

---

## The big picture in one breath

You'll build the app with Expo (Phase B), give people accounts and cross-device sync with Supabase (Phase C), earn money with tiered subscriptions via RevenueCat + Stripe (Phase D), satisfy the legal must-haves (Phase E), test it (Phase F), publish to Google Play and the App Store (Phase G), then update it forever (Phase H). Phase A is just signing up for things.

---

## Phase A — Accounts & tools (do this first, ~1 evening)

**Accounts to create** (most free; two cost money):

| Service | Cost | Why |
|---|---|---|
| Google account | Free | Gate to everything Google |
| **Google Play Console** | **$25 once** | Publish on Android |
| **Apple Developer Program** | **$99 / year** | Publish on iOS/App Store (skip until you want iOS) |
| Supabase | Free tier, $25/mo Pro later | Accounts + cloud sync |
| RevenueCat | Free under $2,500/mo revenue, then 1% | Subscriptions/purchases |
| Stripe | No monthly fee; ~2.9%+30¢ per charge | Payments for the **web** version |
| Expo (EAS) | Free tier; paid plans for more builds | Builds your app in the cloud |
| GitHub | Free | Stores & backs up your code |

**Tools to install on your computer:**

- **Node.js** (the "LTS" version) — runs the tooling. <https://nodejs.org>
- **Git** — version control. <https://git-scm.com>
- **VS Code** — code editor (optional but nice). <https://code.visualstudio.com>
- **Claude Code** — your build partner, already set up for this repo.
- **Expo Go** on your Android phone (Play Store) — see your app live as you build. For features Expo Go can't run (native widgets, RevenueCat), you'll later make a **development build** instead.

> You do **not** need a Mac to build iOS — EAS builds it in the cloud. You *do* need the $99 Apple account to *publish* to the App Store, and Apple's review is stricter than Google's. It's fine to launch Android-only first.

---

## Phase B — Build the app (Expo)

Full architecture and the phased port live in `docs/01`. The mechanics:

```bash
npx create-expo-app@latest my-blossom        # TypeScript template
cd my-blossom
npx expo start                                # opens in Expo Go on your phone
```

Then work **one widget / one screen at a time** with Claude Code (the daily loop is at the bottom of this doc). Target the current stable Expo line — **SDK 56 (React Native 0.85, React 19.2)** as of June 2026; confirm latest with `npx create-expo-app@latest` and the Expo changelog.

**Keep your code on GitHub from day one:**
```bash
git init && git add -A && git commit -m "chore: expo skeleton"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/my-blossom.git
git push -u origin main
```
(The `ship-it` skill already auto-commits + auto-pushes per finished feature.)

---

## Phase C — Accounts & cross-device sync (Supabase)

**The model that keeps the app cozy and offline-first:** the app always reads/writes a **local** database (SQLite) so it's instant and works with no signal. A background sync mirrors changes to **Supabase** when online. Open the app on another device → it pulls your data down. This is exactly the "clicker = local + optional cloud" / "strategy = incremental cloud+local" pattern from the teardowns (`docs/research/technical-teardowns-music-and-gaming.md`).

**Set up Supabase:**
1. Create a project at supabase.com. Note the **Project URL** and **anon key** (Settings → API).
2. Put them in an `.env` (and `app.config.js` `extra`) — see the `.env.example` in the repo. **Never commit real keys**; commit only `.env.example`.
3. Create your tables. Start with one generic table that mirrors our object model so you don't redesign per widget:

```sql
-- one row per saved object (note, tracker, quest, drawing, character…)
create table objects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  kind        text not null,          -- 'note' | 'tracker' | 'quest' | ...
  module_id   text,
  data        jsonb not null,         -- the object's payload (our existing shape)
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz             -- soft delete (30-day trash, never hard-drop)
);
```

4. **Turn on Row Level Security so each person only sees their own data** (non-negotiable — the default leaves it open):

```sql
alter table objects enable row level security;
create policy "own rows" on objects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

5. **Auth:** start with **anonymous sign-in** so a brand-new user gets syncing instantly with zero friction (cozy: no signup wall). Offer "save your account" (email/password or Google) later, which *upgrades* the anonymous user and keeps their data. Ask Claude Code: *"Add Supabase anonymous auth with an optional email/password upgrade, keeping the local-first store as the source of truth."*

**Sync rules to hand Claude Code:**
- Local DB is the source of truth the UI reads; sync is a mirror.
- Last-write-wins per object via `updated_at` for v1 (simple, good enough). Note conflicts for later if needed.
- Deletions are soft (`deleted_at`); a sweep clears them after 30 days. Never lose a garden.
- Flush pending writes on app background/close; resume sync on foreground/online.

**Free tier reality (June 2026):** 500 MB Postgres, 50,000 monthly active users, 1 GB file storage, 2 active projects, and **free projects pause after ~1 week of inactivity** (fine while building; upgrade to Pro $25/mo before real users rely on it). Plenty to launch on.

---

## Phase D — Money (tiers, subscriptions, donations)

**Your tier design (from your brief) — "pay only for what you use":**

| Tier | Price | Unlocks |
|---|---|---|
| **Free** | $0 | Core app + default modules (Physical, Mental, Emotional, Social, Entertainment) with their built-in pages/widgets |
| **Daisy / Designer** | $3/mo | All visuals — every theme/atmosphere/particle/weather + custom visual creators |
| **Lotus / Manager** | $7/mo | Create/edit/add **custom modules**; access all modules |
| **Cosmos / Max** | $15/mo | Everything in Daisy + Lotus + all guides (e.g. class learning content, D&D rulebook fill-ins) |

Offer **monthly / quarterly / yearly** for each paid tier (yearly = your best retention + cash-flow lever; market data shows annual plans materially lift LTV — `docs/research/market-research.md`).

**How billing works (so Google/Apple don't reject you):**
- **In the mobile apps, purchases MUST go through the store's billing** (Play Billing / StoreKit). You don't call those directly — **RevenueCat** wraps them. You define products + "entitlements" (e.g. `designer`, `manager`, `max`) in RevenueCat, and your code asks RevenueCat "does this user have `manager`?" to unlock features.
- **On the web build, stores aren't involved** — use **Stripe Checkout** for the same tiers.
- **Donations / tip jar:** a one-time purchase product (e.g. "Water the garden — $2") in RevenueCat for mobile, or a Stripe one-time charge / Ko-fi embed on web.

**Setup order:**
1. In Play Console (and App Store Connect) create the subscription products + a one-time tip product.
2. Mirror them in RevenueCat; group into entitlements `designer` / `manager` / `max`.
3. `npx expo install react-native-purchases`; gate features by entitlement.
4. Add a calm **paywall** that follows the cozy laws — it *invites* an upgrade where the locked feature naturally appears (a soft "✦ Daisy" hint on a premium theme), never a nag screen on launch. Ask Claude Code to build it via `monetize` + `cozy-check`.
5. Web: add Stripe Checkout for the same tiers.

**Fees to expect:** Apple/Google take **15%** of subscriptions under ~$1M/yr (Small Business / reduced subscription rates), 30% above. RevenueCat is free under $2,500/mo tracked revenue, then 1%. Stripe ~2.9% + 30¢ per web charge.

---

## Phase E — Legal & safety (don't skip — Google/Apple will reject you without it)

1. **Privacy Policy (required by law if you collect *anything*, even an email).** Must state: what you collect, why, where it's stored, who it's shared with (Supabase, RevenueCat, Stripe are "third parties"), how users delete their data, and a contact. Generate one with Termly or PrivacyPolicies.com; host it free (e.g. GitHub Pages or your site); link it in-app and in both stores.
2. **Terms of Service** — recommended; protects you (acceptable use, "as is", account suspension, disputes). Same generators.
3. **Account & data deletion** — both stores now require an in-app way (or clear path) to delete the account and its data. Your soft-delete + a "delete everything" flow (with the strong double-confirm you specified) covers this.
4. **Data Safety / Privacy forms** — Play Console "Data safety" and App Store "App Privacy" questionnaires must honestly declare what you collect. Fill them to match your Privacy Policy.
5. **Supabase RLS on** (Phase C) — the technical half of "we protect your data."
6. **Keys out of the repo** — only `.env.example` is committed; real keys live in EAS secrets / env. Ask Claude Code to confirm no key is hard-coded before any release.
7. **Children:** if under-13s might use it, COPPA adds obligations — simplest is to state 13+ in your terms and store age rating.

---

## Phase F — Testing (before anyone sees it)

- **Daily dev:** Expo Go (or a dev build for native features) — changes appear on your phone in seconds.
- **Pre-release build:** `eas build --platform android --profile preview` → install the real artifact → it behaves like the shipped app.
- **Internal testing track:** upload to Play Console → Internal testing → invite yourself + friends; same for TestFlight on iOS.
- **The test checklist that matters:** sign up new → log out → log back in (data returns); **sign in on a second device → data syncs**; subscribe → premium unlocks; cancel → it re-locks gracefully; go offline → app still works → reconnect → syncs; place a home-screen widget → it updates; open the web build → core flows work; run at **360px width** and on a mid-range phone for 60fps.

---

## Phase G — Publish

**Android (Google Play):**
1. `eas build --platform android --profile production` → produces an **`.aab`**.
2. Play Console → create the app → fill the **store listing**: name (≤30 chars), short desc (≤80), full desc (≤4000), icon **512×512**, feature graphic **1024×500**, ≥2 phone screenshots, Privacy Policy URL, content rating questionnaire, Data Safety.
3. **Target API level:** must be **Android 15 (API 35)** today; **Android 16 (API 36) becomes required for new apps/updates on 2026-08-31** — target 36 now if you're building mid-2026. Expo/EAS sets this; verify in `app.json`.
4. Upload the `.aab`, set pricing (free app + in-app subscriptions), submit. New-developer review is typically **1–3 days**. Rejections are normal — read the note, fix, resubmit.

**iOS (App Store), when ready:**
1. `eas build --platform ios --profile production` (EAS handles signing in the cloud).
2. `eas submit` or App Store Connect → fill the listing + **App Privacy** → submit to **App Review** (often stricter; expect a back-and-forth on subscriptions and account deletion).

**Web build:** `npx expo export --platform web` → deploy the static output to **Vercel** or **Netlify** (free) or GitHub Pages. This is your browser version with Stripe billing.

---

## Phase H — After launch (updating forever)

- **Shipping an update:** bump `version` (what users see, e.g. 1.0.1) and the build number/`versionCode` (always increases) in `app.json`, `eas build`, upload to the **Production** track. Update review is faster than the first one.
- **Over-the-air (OTA) updates:** `expo-updates` lets you push **JS-only** fixes instantly without a store review (great for copy/logic tweaks). Native changes (new permissions, SDK bumps) still need a full store build.
- **Watch your dashboards:** Supabase (usage, errors), Play Console + App Store Connect (installs, ratings, revenue), RevenueCat (subscriptions, churn, MRR). Add crash reporting (e.g. Sentry) early so you hear about problems before reviews do.
- **Respond to reviews** — even short replies lift ratings and retention.
- **Keep deps current:** every few months `npx expo install --fix` and bump the Expo SDK; stale SDKs eventually block store submission (see the API-level deadline).
- **Cozy release cadence:** ship small and often; let features arrive where users *discover* them, not via a "what's new!" takeover (cozy law 1 + 6). The market data agrees — slow, focused rollout beats feature dumps (`docs/research/market-research.md`).

---

## LOCKED decisions (from Simon's design doc — these override the drafts above)

**Monetization model — NO paywall.** Locked content simply **doesn't appear** for users who don't have the tier (no nag screens, no upgrade interrupts). The **only** place subscriptions are shown is **near the bottom of the Settings tab**.
- **Tiers:** **Daisy** ($3) all visuals + custom theme creator · **Lotus** ($7) all modules + custom modules · **Cosmos** ($15) Daisy + Lotus + all **guides/databases** (deep learning content: cooking+recipes, every exercise per muscle, full subjects like algebra→calculus). Monthly / quarterly / yearly.
- **Free 7-day Cosmos trial.** When it ends, the user's work is **saved but moved to a locked "subscription section"** they must pay to restore: custom **themes revert to defaults** (creations kept), custom/edited **modules copy their data but revert layout to default**, **guides/databases go back behind the tier**. Nothing is deleted — it's parked until they subscribe.
- **No tip jar.** Support = subscribing (even the $3 Daisy tier).
- **Companion (Liri) is always free.** Only **changing your element, or changing your form after the cap**, requires Cosmos.

**Saves & sharing (overrides §2.4):** Blossom-code **soft-delete window is 1 week** (not 30 days). When a code includes **objects**, the user must **confirm there's no sensitive info** before sharing (guard against accidentally sharing a private notebook/journal).

**Launch order:** **Android first.** **Web now, for testing only** (official web later). **iOS later.**

## Supabase security hardening (MANDATORY — from Simon's spec; see also the `cloud-sync` skill)

Security outranks features. Before production, every item must hold:

- **Auth:** Supabase Auth; **email/password + email verification**; built-in secure password reset; **support MFA**; **Google OAuth**; never store/handle passwords ourselves.
- **RLS on EVERY user-data table** (`profiles, goals, habits, tasks, journals, notes, drawings, achievements, reminders, settings`, …). Every row carries `user_id uuid not null references auth.users(id)`; policies for SELECT/INSERT/UPDATE/DELETE all require `auth.uid() = user_id`. **No exceptions.**
- **Service-role / admin keys never reach the client** — only the public **anon** key does. Service keys live only in Edge Functions / server env.
- **Secrets in env vars only**; never hardcode or commit API/Stripe/RevenueCat/JWT/Supabase keys.
- **File storage:** private buckets, authenticated access, **signed URLs** for temporary access; no public URLs for private content.
- **Validate all input** (length, type, allowed values, sanitize); reject malformed requests.
- **Safe logging only** — never log passwords, tokens, refresh tokens, or payment details.
- **Payments:** Stripe Checkout/Elements; card data never touches our servers or Supabase; verify via **Stripe webhooks**.
- **Backups** automated + **restore tested** before launch. **Rate-limit** login/signup/password-reset (anti-brute-force). **Admin accounts** use MFA + strong unique passwords.
- **Pre-launch security audit checklist:** RLS on every table · users can't read others' rows · no exposed service keys · storage perms correct · payment flow verified · backups verified · env vars verified. **Any security issue takes priority over feature work.**

## The daily build loop (pin this)

1. Open Claude Code; describe the next single feature.
2. It overhauls the ask → tiny frame → builds the cheapest cozy version (`overhaul-the-ask`).
3. Test on your phone (Expo Go / dev build).
4. Tell it what's wrong; iterate.
5. It verifies, updates `docs/STATUS.md`, commits + pushes (`ship-it`).
6. Repeat. One feature per commit.

---

### Sources (verified June 2026)
- Google Play target API level (API 35 now; API 36 required 2026-08-31): <https://support.google.com/googleplay/android-developer/answer/11926878> · <https://developer.android.com/google/play/requirements/target-sdk>
- Expo SDK 56 / RN 0.85 / React 19.2: <https://expo.dev/changelog/sdk-56> · <https://docs.expo.dev/versions/latest/>
- RevenueCat pricing (free <$2,500 MTR, then 1%): <https://www.revenuecat.com/pricing>
- Supabase free tier & Pro: <https://supabase.com/pricing>
- Apple Developer Program ($99/yr; 15% Small Business rate): <https://developer.apple.com/support/compare-memberships/> · <https://www.revenuecat.com/blog/engineering/small-business-program/>
