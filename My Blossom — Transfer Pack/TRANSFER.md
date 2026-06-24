# MY BLOSSOM — TRANSFER PACK

*Everything to add to **The Blossom** (your finished app, in `My App/`) to make it **My Blossom**: the new features, data structures, specs, SQL, code blueprints, commands, and guides — in one file. Nothing here replaces the app; it all **adds** to it.*

**How to use this:** work top-to-bottom, or jump to a part. Each part is self-contained. Code blueprints are written for The Blossom's actual stack (vanilla JS + IndexedDB + the widget registry), not a rebuild.

**Contents**
1. The architecture you keep (quick reference)
2. New feature: the 5 Aspects → Attributes → Skills (full data)
3. New feature: the Blossom growth loop (tools feed aspects)
4. New feature: Liri, the companion
5. Navigation additions
6. Base tool: Cloud sync with Supabase (schema + auth + sync blueprint)
7. Base tool: Publish to Android (Capacitor / TWA)
8. Base tool: Subscriptions (RevenueCat, no-paywall)
9. Look & feel additions
10. Build order (the transfer sequence)
11. Locked decisions + glossary

---

## 1. The architecture you keep (quick reference)

The Blossom's model is the foundation — unchanged. Everything new plugs into it.

- **Workspace → Module → Page → Tool → Object.** (Tool = the in-app widget; Object = its data, referenceable anywhere.)
- **Everything is data.** Modules/pages/tools/themes are JSON definitions rendered by generic engines; presets live in `js/presets/`.
- **Tools are self-contained.** A tool may *read* another's data but never *depends* on it — if a linked tool is missing, nothing breaks. Connections are bonuses, not wiring.
- **Add a tool** = register once in `js/widgets/registry.js` (`type, name, icon, renderCard, renderFull, outputs, settings`). Zero edits elsewhere.
- **Storage:** IndexedDB on-device (source of truth) + `localStorage` for tiny prefs. User data survives every update.

> Rule for everything below: **add, don't replace.** New aspects/Liri/sync/subscriptions are new files + new registry entries + a thin layer around the existing engine.

---

## 2. NEW FEATURE — The 5 Aspects → Attributes → Skills

The growth spine. Five **aspects**, each a flower; its **attributes** are petals; its **skills** are orbiting stars. (Full roster from your Design Doc, Floor 1/4.)

### 2.1 The model (data to add — `js/presets/aspects.js`)
```js
// Aspect → Attribute → Skill. Pure data, rendered by the existing Flower Graph.
// Levels start at 1; the growth loop (Part 3) raises them from real activity.
export const ASPECTS = [
  { id:'mental', name:'Mental', module:'productivity', petal:'#7db4f0', seed:'#f0c860',
    attributes:[
      { id:'focus', name:'Focus', skills:['Deep Work Sessions','Distraction Elimination','Attention Span Extension','Task Prioritization'] },
      { id:'memory', name:'Memory', skills:['Information Retention','Active Recall','Spaced Repetition','Memory Palace Technique'] },
      { id:'problem-solving', name:'Problem Solving', skills:['Analytical Breakdown','Creative Solution Generation','Logical Reasoning','Systems Thinking'] },
      { id:'learning', name:'Learning', skills:['Active Learning','Skill Acquisition','Knowledge Integration','Curiosity Development'] },
      { id:'emotional-intelligence', name:'Emotional Intelligence', skills:['Emotion Recognition','Pattern Recognition','Perspective Taking','Decision Analysis'] },
    ] },
  { id:'physical', name:'Physical', module:'activity', petal:'#6cc6a0', seed:'#e8943a',
    attributes:[
      { id:'strength', name:'Strength', skills:['Compound Lifting','Core Stability','Functional Movement','Progressive Overload'] },
      { id:'endurance', name:'Endurance', skills:['Aerobic Conditioning','Distance Building','Pace Management','Recovery Optimization'] },
      { id:'mobility', name:'Mobility', skills:['Static Stretching','Dynamic Movement','Joint Mobility','Breathing Techniques'] },
      { id:'nutrition', name:'Nutrition', skills:['Meal Planning','Nutrient Knowledge','Hydration Mastery','Supplement Understanding'] },
      { id:'recovery', name:'Recovery', skills:['Sleep Hygiene','Rest Cycles','Stress Reduction','Sleep Quality Tracking'] },
    ] },
  { id:'emotional', name:'Emotional', module:'meditation', petal:'#c79af0', seed:'#f0c860',
    attributes:[
      { id:'self-awareness', name:'Self-Awareness', skills:['Emotion Identification','Trigger Mapping','Values Clarification','Shadow Work'] },
      { id:'self-regulation', name:'Self-Regulation', skills:['Grounding Techniques','Breathing Mastery','Pause & Respond','Emotional Reframing'] },
      { id:'resilience', name:'Resilience', skills:['Failure Integration','Perspective Maintenance','Resource Activation','Growth Mindset'] },
      { id:'self-compassion', name:'Self-Compassion', skills:['Negative Self-Talk Reduction','Forgiveness of Self','Worthiness Recognition','Boundaries Setting'] },
      { id:'motivation', name:'Motivation', skills:['Goal Alignment','Intrinsic Motivation','Purpose Connection','Energy Management'] },
    ] },
  { id:'social', name:'Social', module:'connection', petal:'#f0908f', seed:'#f0c860',
    attributes:[
      { id:'communication', name:'Communication', skills:['Active Listening','Clear Expression','Non-Verbal Communication','Question Asking'] },
      { id:'empathy', name:'Empathy', skills:['Perspective Understanding','Emotional Resonance','Validation Skills','Compassionate Response'] },
      { id:'relationships', name:'Relationships', skills:['Networking','Vulnerability','Conflict Resolution','Trust Development'] },
      { id:'collaboration', name:'Collaboration', skills:['Cooperative Problem-Solving','Role Recognition','Feedback Integration','Group Dynamics'] },
      { id:'leadership', name:'Leadership', skills:['Vision Communication','Decision Making','Delegation','Inspiration'] },
    ] },
  { id:'recreation', name:'Recreation', module:'recreation', petal:'#f0c860', seed:'#e8943a',
    attributes:[
      { id:'creativity', name:'Creativity', skills:['Artistic Skill Development','Creative Problem-Solving','Ideation','Execution'] },
      { id:'mastery', name:'Mastery', skills:['Deliberate Practice','Technique Refinement','Advanced Technique','Teaching Others'] },
      { id:'presence', name:'Presence', skills:['Present Moment Awareness','Sensory Appreciation','Flow State Achievement','Meditation Practice'] },
      { id:'adventure', name:'Adventure', skills:['New Experience Seeking','Comfort Zone Expansion','Travel & Exploration','Risk Assessment'] },
      { id:'joy', name:'Joy', skills:['Gratitude Practice','Simple Pleasure Recognition','Celebration','Humor Cultivation'] },
    ] },
];
```

### 2.2 Rules
- **A skill/attribute may feed more than one aspect** when it makes sense (e.g. a team sport → Physical *and* Social). Model contributions as `{aspect, attribute, amount, skill?}`, so one action can emit several.
- Render with the **existing Flower Graph** — one flower per aspect, petals = attributes (sized by level), stars = skills.

---

## 3. NEW FEATURE — The Blossom growth loop (tools feed aspects)

The spine that makes the app *one thing*. Completing real activity grows the right petal → the aspect → Liri.

### 3.1 The contract (add to the widget registry)
Give a tool an optional `grows(before, after, action)` that returns contributions earned by that action (idempotent — re-doing the same thing earns nothing):
```js
// In a tool definition (js/widgets/<tool>.js):
grows(before, after, action) {
  // return [] when nothing was newly earned
  // e.g. habit logged a NEW day → discipline; re-tap → []
  return [{ attribute: 'discipline', amount: 10 }];
}
```
Examples (port these mappings):
- **Habit** — a newly-logged day → `+10` to its `growthAttribute` (default `discipline`). Re-tapping the same day → nothing.
- **Quest** — a step newly completed → `+10 focus`. Un/re-checking → nothing.
- **Goal** — a milestone reached → `+20 wisdom`.
- **Skill** — granted XP → `learning` 1:1, tagged with the skill name.
- A tool's `config.growthAttribute` lets the *same* tool feed a different aspect per module (an Activity habit → `strength`).

### 3.2 The growth engine (add — `js/core/growth.js`)
- A ledger: `aspectId → attributeId → { level, xp }`.
- `applyGrowth(ledger, {aspect, attribute, amount})` → adds XP, rolls over levels with your XP curve (`xpToNext(level)=max(10, round(50·level^1.4/10)·10)`).
- `aspectLevel(ledger, aspect, attributeIds)` = rounded mean of its attribute levels (untouched attributes = 1).
- The module a tool lives in decides which aspect its contributions go to (`module.feedsAspect`), unless the tool overrides via `config.growthAttribute`.

### 3.3 Module → aspect map
`productivity→mental · activity→physical · meditation→emotional · connection→social · recreation→recreation`. The **My Blossom hub** module shows all five flowers + Liri.

---

## 4. NEW FEATURE — Liri, the companion (the heart)

A soul-bonded elemental companion who grows with your aspects. Build as a **new module + a few tools** (additive).

### 4.1 Decisions (locked from your Design Doc)
- **Soul-bonded & personal.** Liri should feel connected to *you*, not generic.
- **Element** via a **15-question quiz** → **Air / Water / Earth / Fire**. Element is *fixed*; the **form** can change over time (with caps; Cosmos tier can override).
- **Growth from aspects:** Physical → size · Mental → abilities · Emotional → colours · Social → beauty.
- **Liri's own page** to interact: feed, dress, change, play. Liri is **also ambiently present** on other pages — not in-your-face: tucked by a button, on a screen edge, or moving around (configurable), never covering the screen.
- **A dock/top-bar avatar** jumps to Liri's page.
- **Liri Life** — a gentle duck-life-style mini-game: bond, mood, journal, milestones; spend **coins** (your existing wallet) on food, toys, clothes.

### 4.2 Build pieces
- `js/presets/modules/liri.js` — the Liri module (Home/Companion/Liri-Life pages).
- Tools: `companion` (the creature view + dress/interact), `elementquiz` (15-q onboarding), `lirilife` (the mini-game). Each registers like any tool.
- Liri reads the **growth ledger** (Part 3) to render size/abilities/colours/beauty. Pure data in → visuals out.

---

## 5. Navigation additions

Mostly already in The Blossom; add these:
- **Module switching:** keep the top rail **and make swipe work** (the original swipe didn't function) — swipe left/right across the top band to change modules; arrows + tap still work.
- **Page tabs:** bottom tabs within a module (exists).
- **Companion shortcut:** a small creature avatar in the top bar → Liri's page; plus the ambient presence (Part 4.1).
- **FAB (+):** the blooming-flower button manages module/page/tool (exists).
- **Return-to-position:** coming back from a sub-view lands where you were, not at the top (exists — keep it).

---

## 6. BASE TOOL — Cloud sync with Supabase

Adds accounts + cross-device sync **without changing the app**: it keeps reading/writing IndexedDB (instant, offline) and mirrors to Supabase in the background. Reuse the Supabase project you already got working.

### 6.1 The schema (run once in Supabase SQL editor — verbatim, hardened)
```sql
create table if not exists public.objects (
  id          text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,
  module_id   text,
  data        jsonb not null,
  updated_at  bigint not null,
  deleted_at  bigint,
  primary key (user_id, id)
);
create index if not exists objects_user_updated on public.objects (user_id, updated_at);

alter table public.objects enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='objects_owner') then
    create policy objects_owner on public.objects
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
```
(Optional `links` table for cross-object references — same shape with `from_id,to_id,rel`. Add later.)

### 6.2 Security requirements (from your Design Doc — non-negotiable)
- **Row Level Security ON, always** (`auth.uid() = user_id`). A user can only ever see/write their own rows.
- **Only the public anon key** reaches the client; the service-role key stays server-side.
- **IDs are `text`** (your friendly ids), never Postgres `uuid`.
- Private data (tasks, goals, habits, notes, journals, drawings) is protected by RLS; nothing is world-readable.

### 6.3 Auth (the cozy path)
- **Anonymous sign-in by default** — instant sync, no signup wall.
- **"Save your account"** upgrades the anonymous user to email + password, so the same garden syncs across devices. Google optional.
- Enable Anonymous + Email (+ Google) providers in the Supabase dashboard. Set a real Site URL so confirmation emails don't point at `localhost`.

### 6.4 The sync blueprint (add — `js/core/sync.js`, vanilla JS)
Offline-first mirror, last-write-wins. The UI never waits on it.
```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js'; // or bundle it (offline rule)
import { store } from './store.js';        // your IndexedDB wrapper
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// every saved object carries: { id, kind, moduleId, data, updatedAt, deletedAt }
async function pushSince(cursor) {                       // local → cloud
  const changed = await store.changedSince(cursor);      // all objects updatedAt > cursor (incl. deletions)
  if (changed.length) await sb.from('objects').upsert(
    changed.map(o => ({ id:o.id, user_id:uid, kind:o.kind, module_id:o.moduleId??null,
                        data:o.data, updated_at:o.updatedAt, deleted_at:o.deletedAt??null })),
    { onConflict:'id' });
  return Math.max(cursor, ...changed.map(o=>o.updatedAt), cursor);
}
async function pullSince(cursor) {                        // cloud → local (LWW)
  const { data } = await sb.from('objects').select('*').gt('updated_at', cursor).order('updated_at');
  for (const r of (data||[])) {
    const local = await store.getRaw(r.id);               // include deleted
    if (!local || r.updated_at > local.updatedAt)         // strictly-newer wins; PRESERVE the clock
      await store.applyRemote({ id:r.id, kind:r.kind, moduleId:r.module_id, data:r.data,
                                updatedAt:r.updated_at, deletedAt:r.deleted_at });
  }
  return Math.max(cursor, ...(data||[]).map(r=>r.updated_at), cursor);
}
// run a pass on launch, on focus, on a 20s timer, and on Supabase Realtime 'objects' changes.
// persist the two cursors (pushedAt/pulledAt) in localStorage, namespaced per user.
```
Rules: local is the source of truth; **last-write-wins by `updatedAt`**; deletes are **soft** (`deletedAt`); never re-stamp the clock on a pulled row (it desyncs LWW); flush before the page hides.

---

## 7. BASE TOOL — Publish to Android (Capacitor / TWA)

The Blossom is a web app, so it's **wrapped**, not rebuilt.

> **Note on Expo.dev:** Expo/EAS is React-Native-only and does **not** apply to a web app — that's why the earlier RN rebuild felt like starting over. The equivalents for a web app are below.

### 7.1 Fastest Android (a day): PWABuilder → TWA
- Host the PWA (GitHub Pages, already set up). Go to **pwabuilder.com**, enter the URL, download the **Android (TWA)** package, sign it, upload to Play. The app *is* your PWA; it auto-updates when you redeploy. In-app purchases use the Play Billing / Digital Goods API.

### 7.2 Recommended (app-like, iOS-ready, native plugins): Capacitor
```bash
cd "My App"                 # the app root (no build step)
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "My Blossom" com.simon.myblossom --web-dir=.
npx cap add android
npx cap copy
npx cap open android        # Android Studio → run on device / build a signed AAB
```
Capacitor unlocks native plugins for **purchases, push notifications, real alarms, and (later) Android home-screen Widgets** — the things the web layer can't do alone. iOS later: `npx cap add ios` (needs a Mac + Apple Developer account).

### 7.3 Updates with no reinstall (your "OTA")
- **PWA/TWA:** redeploy → installs update automatically.
- **Capacitor:** **Live Updates** (Capacitor's OTA) push web changes to installed apps instantly; only new native plugins need a store update.

### 7.4 Publish checklist
Play Console account (~$25 one-time) · signed AAB · listing (icon, screenshots, privacy policy) · start on the **internal testing track** (installs on your phone instantly) · then production. Verify current fees/steps at build time.

---

## 8. BASE TOOL — Subscriptions (RevenueCat, no-paywall)

### 8.1 Engine
**RevenueCat** — one SDK across Google Play Billing (Android), App Store (iOS later), and **Stripe** (web). Has a Capacitor plugin. The app just asks "is this entitlement active?" to show/hide locked content.

### 8.2 The model (locked — no paywalls)
- **Locked content simply doesn't appear** — no nag walls, no blocked buttons. The free app is whole and genuinely useful.
- Subscriptions live **only in Settings**.
- **7-day Cosmos trial.**
- **Tiers:** **Free** · **Cosmos** (full features + the trial) · **Designer** (creation tools — custom-theme creator, advanced building).
- Donations optional ("support the garden").

### 8.3 Gating pattern
```js
// one helper; everything checks it. Absent entitlement = feature is hidden, never blocked.
function has(tier) { return entitlements.includes(tier); }     // 'cosmos' | 'designer'
if (has('designer')) showThemeCreator();                       // else: it just isn't there
```

---

## 9. Look & feel additions

You already have themes, atmospheres, particles, weather. Add:
- **Custom theme creator** (design your own world) — a Designer-tier tool that writes a theme in your existing theme shape.
- **Atmospheres absorb weather**; **interactive effects** with little mini-game counters (catch fireflies, meteors, pufferfish…).
- Keep the full theme roster (incl. Scarlet). Themes change the *whole world's* light + particles — make sure the **theme picker is reachable** in Settings.

---

## 10. Build order (the transfer sequence)

Each step ships independently — the app keeps working throughout.

0. **Already shippable** — install The Blossom as a PWA today (Chrome → Install app).
1. **Rebrand** to My Blossom (manifest name/short_name, chrome strings, icons).
2. **Supabase sync** (Part 6) — schema + auth + `js/core/sync.js`. Test two devices.
3. **Capacitor wrap** (Part 7) — real Android app on your phone (internal testing).
4. **RevenueCat** (Part 8) — no-paywall tiers + 7-day trial.
5. **Publish** to Google Play.
6. **Then add the features as normal updates:** Aspects (Part 2) → growth loop (Part 3) → Liri (Part 4) → custom theme creator (Part 9) → Android home-screen Widgets. Each ships OTA, no reinstall.
7. **iOS** when ready (same Capacitor project).

---

## 11. Locked decisions + glossary

**Locked**
- 5 aspects: **Mental · Physical · Emotional · Social · Recreation**, each Aspect → Attribute → Skill, rendered as flowers.
- 6 modules: **My Blossom (hub) · Productivity · Activity · Meditation · Connection · Recreation**. Build Productivity & Activity first.
- Companion = **Liri**: soul-bonded, fixed element (Air/Water/Earth/Fire) via a 15-q quiz, swappable form, own page + ambient presence + dock avatar, **Liri Life** game.
- **No-paywall** model; Settings-only subscriptions; 7-day Cosmos trial; **Designer** tier for creation tools.
- **Supabase** for sync, **RLS always on**, anon key only, text ids, soft-delete (1-week sweep).
- **Tools** (in-app) vs **Widgets** (the same tools on the Android home screen).
- Platforms: **Android-first**, **web at launch**, **iOS later**. Portrait-locked. Offline always.
- The app is **a web PWA** → wrapped with **Capacitor/TWA** (NOT Expo, which is RN-only).

**Glossary**
- **Aspect** — one of five sides of life, drawn as a flower.
- **Attribute** — a petal of an aspect; **Skill** — a star orbiting it.
- **Blossom loop** — tools emit growth → attributes → aspects → Liri.
- **Tool** — an in-app widget; **Object** — its data; **Module/Page** — containers.
- **Liri** — your soul-bonded elemental companion.
- **Entitlement** — an active subscription tier (Cosmos/Designer) that *reveals* (never unlocks-with-a-wall) content.

---
*This file is the complete transfer pack. Add it to `My App/` (The Blossom). Build on the finished app — add, never rebuild.*
