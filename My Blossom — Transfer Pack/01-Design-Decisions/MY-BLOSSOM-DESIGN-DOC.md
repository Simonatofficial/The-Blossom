# My Blossom — Master Design Document (v0.0.1 worksheet)

> **What this is.** Every decision, system, and detail of My Blossom, gathered into one place and arranged like a **staircase**. Start at the **Foundation** and climb one step at a time. At each step you'll see *what it is*, *how it works*, the *current proposal*, and *your call*. Read it, edit it, fill in the blanks, tick the boxes. When you've walked the whole staircase, send it back and I'll turn your answers into the finished, built framework.

> **How to use it.** Don't try to do it all at once. Take a floor per sitting. Change anything — nothing here is sacred except the few items marked ✅. Where you see a blank `✎ ______`, write your answer right in the line. Where you see ❓, that's a real fork I need you to choose. Leave a note anywhere with `>> your note`.

### Legend
- ✅ **Firm** — core to the app; change only if you really mean to.
- ✦ **Proposed** — my best draft; edit freely.
- ❓ **Open** — a real decision only you can make.
- ✎ `______` — a blank for you to fill.
- ☐ / ☑ — tick when you've reviewed/approved a step.

### Map of the staircase
- **Foundation** — vision, who it's for, platforms, principles
- **Floor 1 — Structure** — how the app is organized
- **Floor 2 — Tech & Data** — the wiring underneath
- **Floor 3 — Look & Feel** — themes, atmosphere, particles, weather, UI
- **Floor 4 — The Heart** — the elemental companion, elements, aspects, growth
- **Floor 5 — Method & Game** — COSMOS, XP, coins, quests/habits
- **Floor 6 — The Modules** — Blossom, Study, Exercise, Breathing, Connection (+ future)
- **Floor 7 — Tools Library** — every tool type, catalogued
- **Floor 8 — Onboarding** — first-bonding & build wizards
- **Floor 9 — Money & Release** — tiers, donations, publishing
- **Floor 10 — The Future** — pantheons, your book-world, community
- **Floor 11 — How We Build** — the operating framework & skills
- **Appendix** — master list of open decisions + glossary

---

# FOUNDATION — the ground you stand on

*The few things everything else rests on. Get these right and the rest follows.*

### F.1 — The promise (one sentence)
**What it is:** the single line that says what My Blossom *is*.
**Proposal:** ✦ *"A cozy, fully customizable, all-in-one life app where you grow a soul-bonded elemental companion by tending the real parts of your life."*
**Your call:** ✎ Rewrite in your words: ______
☐ Reviewed

### F.2 — Who it's for
**What it is:** the person you're building for first.
**Proposal:** ✅ You, Simon, first — built to fit your life perfectly; anyone who vibes with it is welcome. (Market note: the wedge is *consolidation* — replacing the 4–7 apps people juggle — plus deep personalization and privacy.)
**Your call:** ✎ Anyone else you specifically want it to serve? ______
☐ Reviewed

### F.3 — The problem it solves
**What it is:** why it deserves to exist.
**Proposal:** ✦ Life-tools are scattered, cold, and samey. My Blossom unifies them into one warm, personal place where progress is *felt* (your creature visibly grows), not just logged.
**Your call:** ❓ Is "consolidation + a living companion" the core hook, or is something else more central? ✎ ______
☐ Reviewed

### F.4 — Platforms & reach
**What it is:** where it runs.
**Proposal:** ✅ **Android-first**, also **iOS** and **web** (so Windows/Linux/Mac via browser). One codebase. GitHub for source + test builds; mobile stores for release. Locked to portrait. Works fully offline.
**Your call:** ☐ Confirm Android-first · ☐ iOS at launch or later? ✎ ______ · ☐ Web at launch or later? ✎ ______
☐ Reviewed

### F.5 — The four guiding principles
**What it is:** the values every decision is checked against.
**Proposal:** ✅
1. **Cozy** — calm, discoverable, opt-in, never force-fed (the *controls* whisper).
2. **Alive** — layered, warm, illustrated, gently in motion, full of *place* (the *world* breathes).
3. **Yours** — deeply customizable & personal; you design your Blossom.
4. **Solid** — offline-first, never loses data, 60fps, private.
**Your call:** ✎ Add a 5th principle if you have one: ______
☐ Reviewed

---

# FLOOR 1 — STRUCTURE (how the app is organized)

### 1.1 — The core model
**What it is:** the nested skeleton of the whole app.
**How it works:** five nesting levels.

- **Workspace** ✅ — the entire app; one per person.
- **Module** ✅ — an "app inside the app" (The Blossom, Study, Exercise…). You switch between them.
- **Page** ✅ — a screen inside a module (Home, Companion, Calendar…). Organizes tools.
- **Tool** ✅ — the interactive unit on a page (Notes, Tracker, Quest, Graph…). *Formerly called "widget."* Opens into its own full view.
- **Object** ✅ — the data inside tools (a note, a drawing, a goal, a journal entry). Objects can be *referenced* from anywhere.

**Everything is data:** modules/pages/tools/themes are JSON definitions rendered by generic engines. Presets are bundled definition files.
**Your call:** ❓ Keep the word **"Tool"** (clear) or stick with **"Widget"** (familiar)? ✎ ______ · ☐ Confirm the 5-level model
☐ Reviewed

### 1.2 — Tools are self-contained (the big lesson)
**What it is:** the rule that fixes the original app's worst bug.
**How it works:** ✅ every Tool is a *complete instrument on its own*. It **may optionally** read another tool's data, but **never depends** on one — if a linked tool is missing/empty, this tool still works and nothing breaks. Connections are bonuses, not wiring.
**Your call:** ☐ Confirm · ✎ Any tools you *do* want tightly linked (accept the risk)? ______
☐ Reviewed

### 1.3 — The Blossom loop (everything connects back)
**What it is:** the spine that makes the app one thing, not many.
**How it works:** ✅ every module feeds an **aspect** of your Blossom, which grows your **creature**:

- Study → **Mental**
- Exercise → **Physical**
- Breathing → **Emotional**
- Connection → **Social**
- The Blossom → the hub that shows it all

Doing anything anywhere → your Blossom and creature visibly respond.
**Your call:** ❓ Are these the right 4 aspects, and the right module→aspect mapping? ✎ ______ · ❓ Should some modules feed *two* aspects (e.g., a team sport → Physical + Social)? ✎ ______
☐ Reviewed

### 1.4 — Navigation model
**What it is:** how you move around.
**Proposal:** ✦
- **Bottom dock** — switch modules (Blossom, Study, Exercise, Breathing, Connection).
- **Page tabs** — within a module, switch pages (e.g., Blossom → Home · Companion · Calendar).
- **Companion** lives on its *own page* (not repeated on every screen); a small creature avatar in the top bar jumps to it.
- **FAB (+)** — a blooming flower button to add a module / page / tool.
- Returning from a sub-view lands you **where you were**, not at the top.
**Your call:** ❓ Dock at the bottom, or a swipe-able top rail like the original? ✎ ______ · ❓ Should the Companion be a page inside The Blossom, or its own dock item? ✎ ______
☐ Reviewed

---

# FLOOR 2 — TECH & DATA (the wiring under the floor)

*You don't have to love this floor — just confirm the choices. They're mostly settled.*

### 2.1 — Tech stack
**What it is:** what it's built with.
**Proposal:** ✅ Expo + React Native + TypeScript · Expo Router (navigation) · Skia (visuals/particles/graphs/drawing) · Reanimated + Gesture Handler (motion/touch) · expo-sqlite + MMKV (local storage) · **Supabase** (accounts/sync) · RevenueCat + Stripe (payments) · expo-notifications + background tasks (alarms/reminders). No runtime CDNs; everything bundled.
**Your call:** ☐ Approve stack · ❓ Supabase confirmed for sync (vs Firebase)? ☐ yes / ✎ ______
☐ Reviewed

### 2.2 — Storage & offline-first
**What it is:** how your data is stored and stays instant.
**How it works:** ✅ the app always reads/writes a **local** database first (instant, works with no signal); a background sync mirrors to the cloud. One `Store` interface; storage adapters swap underneath without touching tools.
**Your call:** ☐ Confirm offline-first as non-negotiable
☐ Reviewed

### 2.3 — Accounts & sync
**What it is:** logging in and syncing across your devices.
**Proposal:** ✦ Start every new user with **anonymous sign-in** (instant sync, no signup wall); offer "save your account" (email/password or Google) later, keeping all data. Row-Level-Security so only you can see your data. Last-write-wins per object for v1.
**Your call:** ❓ OK to start anonymous and upgrade later? ☐ yes / ✎ ______ · ❓ Sign-in options to offer: ☐ email/password ☐ Google ☐ Apple
☐ Reviewed

### 2.4 — Saves, Blossom codes & data safety
**What it is:** backups and sharing.
**Proposal:** ✦ Keep the original's **Blossom codes** — copy/paste a code (or file) to save or share any object/tool/page/module. Auto-save daily; autosaves on export. Soft-delete (30-day trash); a full "reset all data" with a strong double-confirm (type DELETE).
**Your call:** ☐ Keep Blossom codes · ❓ Keep daily auto-backup codes in a notes tool like before? ✎ ______
☐ Reviewed

### 2.5 — Project structure
**What it is:** how the code is laid out (FYI).
**Proposal:** ✅ `app/` routes · `src/core` (store, logic) · `src/fx` (Skia effects) · `src/widgets/<type>` (each tool = logic.ts + View.tsx) · `src/presets` (definitions + content) · `src/theme` · `src/ui` (chrome).
**Your call:** ☐ Noted (no action needed)
☐ Reviewed

# FLOOR 3 — LOOK & FEEL (what you see and feel)

*This is the floor you cared most about. Lots to tune here.*

### 3.1 — Art direction (the soul)
**What it is:** the one coherent visual identity.
**Proposal:** ✦ **A hand-illustrated living garden under a changing sky.** Closer to a storybook/life-sim than a dashboard. Built in **layers** every screen: sky/atmosphere → scenery → (companion only on its page) → particles/weather → translucent crafted cards float above. Warm light, organic rounded shapes, gentle motion, the **cosmos-flower** motif throughout. No flat squares, no stock-emoji UI, nothing reskinnable into another app.
**Your call:** ☐ Approve the living-garden direction · ✎ Any reference apps/art you want me to lean toward: ______
☐ Reviewed

### 3.2 — Themes (the worlds)
**What it is:** the preset moods you can dress the app in; each is a *biome with its own light*, not just a hue swap. Per-module/page/tool theming is allowed.
**Proposal (edit the roster — keep ✓ / cut ✗ / rename):**

| Theme | Mood | Particles (default) | Keep? |
|---|---|---|---|
| Flower (day) | dawn cherry-garden, pinks | petals, pollen | ✎ |
| Cosmos (night) | galaxy violet/indigo | stars, comets, fireflies | ✎ |
| Forest | lush hazy greens | leaves, fireflies | ✎ |
| Ocean | reef blues/teal | bubbles, fish | ✎ |
| Sunset | violet→amber | fireflies, embers | ✎ |
| Autumn | rust & ochre | autumn leaves | ✎ |
| Solar System | deep space + planets | stars, comets | ✎ |

**Your call:** ✎ Themes to add: ______ · ❓ Custom-theme creator (color wheel, save/name/edit/delete) at launch or later? ✎ ______
☐ Reviewed

### 3.3 — Atmospheres
**What it is:** the big reactive background effect that brings a theme alive (behind everything). One slider controls each.
**Proposal (keep/cut/edit):** ✦

- Day/Night cycle — sun & moon revolve a pivot; sky brightens/darkens. Slider = speed (timelapse). ✎
- Constellations — real-looking twinkling stars that connect & slowly drift; rotating set. Slider = drift speed. ✎
- Sunset / Sunrise — a large sun; slider = position top↔bottom with realistic color shift. ✎
- Waves — natural ocean waves filling the screen; slider = size/strength. ✎
- Mountain range — layered peaks/waterfalls/trees; slider = variation. ✎
- Forest — depth of trees; slider = density/types. ✎
- Solar System — sun & orbiting planets; slider = orbit speed. ✎

**Your call:** ✎ Add/cut atmospheres: ______ · ☐ Each atmosphere off by default (opt-in)?
☐ Reviewed

### 3.4 — Particles
**What it is:** the small drifting effects (background + pointer/screen). Pick from presets or build custom; each fully adjustable.
**Proposal — properties per particle:** ✦ shape (emoji / character / image / preset), **angle** (consistent tilt), behavior, speed, count, size + size-variation, spawn box (how high/low, how left/right, how wide). With **numbers shown**, not just sliders.
**Behaviors:** ✦ Fall · Float · Move Left · Move Right · **Swim** (fish-like wander) · Diagonal (adjustable angle) · Drift · Twinkle (fast, sparkly) · Glow · Grow/Shrink (gentle) · Pop · Bounce.
**Preset particles (keep/cut/edit):** ✦ Petals (cherry/leaf, gradient) · Autumn leaves · Green leaves · Hearts (bigger, fewer, upright, rising) · Stars (subtle move, strong twinkle) · Shooting stars (small, fast, steep angle) · Comets (bigger, long trail) · Bubbles (bigger, fewer, pop randomly) · **Fireflies** (strong glow, gradient colors) · Tech (1s/0s or green streaks) · Smoke wisps · Custom. *(Snow/Rain/Wind/Fire moved to Weather. Dust motes & dandelion cut.)*
**Your call:** ✎ Particles to add: ______ · ☐ Pointer & screen particles share the same picker · ☐ All particles optional/off-by-default
☐ Reviewed

### 3.5 — Weather / screen effects
**What it is:** effects that touch the *screen and tools* (in front), not just the background. Immersive, never in the way; can be disabled.
**Proposal (keep/cut/edit):** ✦

- Snow — falls + frost on screen edges + icicles grow on top; tap an icicle to drop it. Slider = icicle speed.
- Rain — falls + droplets accumulate on screen; tap to run them down. Slider = saturation speed.
- Clouds — drift across top of screen; tap to pop into smaller clouds. Slider = cloud type (soft↔stormy).
- Wind — streaks across screen + a gentle cozy wobble on tools. Slider = speed/wobble.
- Fire — cozy fire at the bottom with sparks; s'mores cook around it; tap to eat (a new one appears). Slider = size/cook speed.

**Your call:** ✎ Add/cut weather: ______ · ☐ Confirm "weather must never interfere with use"
☐ Reviewed

### 3.6 — UI components & materials (the not-a-box rule)
**What it is:** how tools/cards/buttons actually look.
**Proposal:** ✦ Cards are **tactile objects**: a *material* (soft paper / frosted glass / warm slate / soil) with faint grain, 18–22px rounded (sometimes one different corner), soft shadow + a hair of top-light, **translucent so the world shows through (opacity adjustable)**. Icon chips = rounded squircles with custom icons. Pills for buttons with a soft press. FAB = a blooming flower. Type = friendly humanist sans + a soft serif for journal/quotes; two weights; sentence case; warm microcopy. **Custom icon set; emoji only as your chosen accent.**
**Your call:** ☐ Approve translucent crafted cards · ❓ Default card opacity (so background shows but text stays readable): ✎ ___% · ✎ Icon style preference (line / duotone / filled): ______
☐ Reviewed

### 3.7 — Motion & the Liveliness dial
**What it is:** how much the world moves.
**Proposal:** ✦ Always something *gently* moving (companion breath, drifting particles, swaying scenery, parallax). One **Liveliness dial**: Still / Gentle / Lively, plus full respect for the OS "reduce motion" setting.
**Your call:** ❓ Default level — Still / **Gentle** / Lively? ✎ ______
☐ Reviewed

### 3.8 — Earned delight
**What it is:** the little payoffs for doing things.
**Proposal:** ✦ Completing something blooms a small *earned* moment — a petal-burst, a firefly, a coin drop, the creature reacts, a soft chime — varied, never repeated back-to-back, never unearned, never confetti-spam.
**Your call:** ☐ Approve · ✎ A signature "completion" moment you'd love: ______
☐ Reviewed

### 3.9 — The two feel-rules (guardrails)
**What it is:** the checks that keep it cozy *and* alive.
**How it works:** ✅ **Cozy** keeps the controls calm/quiet; **Breathe-life** keeps the world rich/alive. Rule of thumb: *lavish with the world, frugal with the controls.* Anti-slop list: no flat fills, no placeless UI, no tinted default components, no characterless gray grids, no lifeless screens.
**Your call:** ☐ Noted
☐ Reviewed

---

# FLOOR 4 — THE HEART (your elemental companion)

*The most important and most open floor — this is the part that's uniquely yours and ties to your book. Everything here is draft; shape it freely.*

### 4.1 — The companion concept
**What it is:** the creature that makes the app *yours*.
**Proposal:** ✦ A **soul-bonded elemental creature** living on its own page. A quiz reveals your **element** (fixed forever); you choose a **physical form** (swappable) themed by that element. It **visibly grows** as you live. Later scales to **Pantheons** (Floor 10).
**Your call:** ☐ Approve the concept · ✎ Name for the creature category in-app (e.g., "companion", "spirit", "kin"): ______
☐ Reviewed

### 4.2 — The element quiz
**What it is:** how a person discovers their element.
**Proposal:** ✦ A gentle, skippable quiz inspired by 16personalities' four axes (Mind I/E · Energy N/S · Nature T/F · Tactics J/P). Draft base mapping:

| Personality group | Base element (draft) |
|---|---|
| Analysts (N+T) | Fire |
| Diplomats (N+F) | Water |
| Sentinels (S+J) | Earth |
| Explorers (S+P) | Air |

Remaining axes refine to a **sub-element**; split answers → a **blend**. Element is identity, never a gate.
**Your call:** ❓ Keep the 4 base elements as Fire/Water/Earth/Air? ✎ ______ · ❓ Is the role-group→element mapping right? ✎ ______ · ❓ Can element be re-discovered later, or fixed for good? ✎ ______ · ❓ Quiz length (5? 12? 16 questions)? ✎ ______
☐ Reviewed

### 4.3 — Elements & sub-elements roster
**What it is:** the full menu of elements (you author this).
**Proposal (draft — edit/expand heavily):** ✦

- Water → Ice · Snow · Cloud · Mist
- Fire → Lightning · Lava · Ash · Light
- Earth → Metal · Wood · Crystal · Clay
- Air → Wind · Storm · Sound · Aurora
- Blends (examples) → Steam (Fire+Water) · Magma (Earth+Fire) · Frost (Air+Water)

**Your call:** ✎ Your real element list (this is yours to define — add as many as you like): ______
☐ Reviewed

### 4.4 — Creature forms
**What it is:** the physical shapes a companion can take (element fills them).
**Proposal:** ✦ Hybrid animals you design; element is fixed, **form is swappable**; new forms unlock over time. Draft ideas: flying fox · dragon-cat · dog-narwhal · elephant-wolf · combos.
**Your call:** ✎ Forms you want to start with: ______ · ❓ How are new forms unlocked (level? coins? milestones?): ✎ ______
☐ Reviewed

### 4.5 — Aspect-driven growth
**What it is:** how living your life changes the creature.
**Proposal (draft):** ✦

| Aspect (fed by) | Changes the creature's… |
|---|---|
| Physical (Exercise) | **size & strength** |
| Mental (Study) | **abilities** — streak-savers, +XP helpers, focus boosts |
| Emotional (Breathing) | **element colors** |
| Social (Connection) | **beauty / adornment** |

Only **Mental** grants mechanical perks (kept earned, never pay-to-win).
**Your call:** ❓ Approve these four mappings? ✎ ______ · ✎ Example abilities you'd want from Mental: ______
☐ Reviewed

### 4.6 — The Companion page
**What it is:** the creature's dedicated screen.
**Proposal:** ✦ A vignette of your creature (its own little scene + element aura), name/element/form/level, "how you've shaped them" (the 4 aspects), unlocked abilities, change-form, pet/feed. *Not* shown on other pages.
**Your call:** ✎ What else belongs on this page (mood? a journal of milestones? a "bond level"?): ______
☐ Reviewed

### 4.7 — The four aspects (and their sub-skills)
**What it is:** the dimensions of growth the flower-graph shows.
**Proposal (from the original Blossom):** ✦

- **Physical** → Strength · Conditioning · Mobility · Nutrition · Sleep · Health
- **Mental** → Focus · Learning · Creativity · Discipline · Wisdom
- **Emotional** → Awareness · Regulation · Resilience · Expression · Self-Compassion · Positive Emotion
- **Social** → Communication · Relationships · Social Confidence · Conflict Resolution · Leadership · Community

**Your call:** ✎ Edit the sub-skills per aspect: ______ · ❓ Show sub-skills as buds on the flower-graph? ✎ ______
☐ Reviewed

---

# FLOOR 5 — METHOD & GAME (how growth actually works)

### 5.1 — The COSMOS method
**What it is:** the habit/goal system at the app's core (built on Atomic Habits + more).
**How it works:** ✦ **C**larify (purpose + measurable goal) · **O**rient (time, place, emotion) · **S**tack (anchor onto an existing habit) · **M**otivate (add reward, remove friction) · **O**bserve (MVV → standard → stretch; milestones) · **S**tudy (reflect & renew). Trigger formula: *"After I [anchor] at [time/place], I'll [tiny→standard action]. Then I'll [reward]."* Plus the "3-2-1 Bloom Start" and a gentle scoring rubric.
**Your call:** ☐ Keep COSMOS as the method · ✎ Anything to add/simplify: ______
☐ Reviewed

### 5.2 — XP, levels & streaks
**What it is:** the progress mechanics.
**Proposal:** ✦ Tools/aspects gain XP from real actions; levels rise with growing caps (level infinitely). Streaks for repeated quests/habits, softened by Market items (below).
**Your call:** ❓ Should levels be uncapped (original) or have soft tiers? ✎ ______
☐ Reviewed

### 5.3 — Coins & the Market (rewards)
**What it is:** the in-app reward economy.
**Proposal (from the original):** ✦ Earn coins by completing things; 4 tiers — Copper · Silver · Gold · Platinum (10:1 each). Spend at the Market on rewards: small quest-skip (copper), full quest-skip (silver), streak-restore (gold), streak-freeze up to 7 days (platinum).
**Your call:** ✎ Edit the rewards / add your own: ______ · ❓ Keep the 4-coin system or simplify to one currency? ✎ ______
☐ Reviewed

### 5.4 — Quests, Habits, Goals, Routines
**What it is:** the task family that drives everything.
**Proposal:** ✦
- **Quest** — a task (one-off or repeating daily/weekly/custom), with counts, times, streak, difficulty→coins.
- **Habit** — a COSMOS-built quest; can nest tasks/reminders/to-dos inside.
- **Goal** — long/short-term; made of quests + habits; shows % to completion.
- **Routine** — a repeating set of habits/quests at chosen times.
- All editable **directly from the tool** (no digging into settings).
**Your call:** ☐ Approve the family · ✎ Anything missing (e.g., a simple to-do)? ______
☐ Reviewed

# FLOOR 6 — THE MODULES (each room)

*For each module: its purpose, its pages, its signature tools, and which aspect it feeds. The first five are the launch set.*

### 6.1 — The Blossom (the hub) ✅
**Feeds:** the overview of all four aspects.
**Pages:** ✦ **Home** (greeting, flower-graph, aspect levels, today's quests/habits, trackers) · **Companion** (the creature page, Floor 4.6) · **Calendar** (month/week/day; quests, habits, routines).
**Signature tools:** Flower-graph, Skill/aspect tools, Quest/Habit/Goal, Journal, Tracker, Market.
**Your call:** ✎ Pages to add/cut: ______ · ❓ Is the flower-graph the centerpiece of Home or of Companion? ✎ ______
☐ Reviewed

### 6.2 — Study → Mental ✦
**Purpose:** notes, flashcards, quizzes, study tracking.
**Pages:** ✦ Notes · Overview · Study.
**Signature tools:** **Notebook** (Class › Unit › Topic; key-term / theme / concept / idea / comment highlights with term·definition·details·examples) · **Flashcards** (decks generated from notebooks; custom front/back; smart order; study sets) · **Quiz** (multiple-choice / true-false / fill-blank / dropdown / ordering; saved by date; struggle tracking) · **Study Notes** (auto-collected terms) · **Library** (grouped docs) · **Graph** · **Overview** dashboard · **Study Guide** (struggle-based).
**Your call:** ✎ Trim/confirm the study toolset: ______
☐ Reviewed

### 6.3 — Exercise → Physical ✦ (new module)
**Purpose:** movement, training, the body.
**Pages (proposed):** ✦ Today · Workouts · Stats.
**Signature tools:** ✦ Activity rings (move/stretch/strength) · Session builder/logger · Step & sleep trackers · a strength log · graph.
**Your call:** ❓ What matters most to you here — guided workouts, simple logging, or health-data import (Apple Health / Google Fit)? ✎ ______ · ✎ Tools you want: ______
☐ Reviewed

### 6.4 — Breathing → Emotional ✦ (new module)
**Purpose:** breath, calm, emotional balance.
**Pages (proposed):** ✦ Breathe · Reflect · Mood.
**Signature tools:** ✦ Breathing trainer (box, 4-7-8, custom; animated orb + haptics) · Mood tracker · a short guided-calm/meditation timer · gratitude/journal prompt.
**Your call:** ✎ Breathing patterns to include: ______ · ❓ Add ambient sounds? ✎ ______
☐ Reviewed

### 6.5 — Connection → Social ✦ (new module)
**Purpose:** tending the people who matter.
**Pages (proposed):** ✦ People · Reach out · Together.
**Signature tools:** ✦ People/bonds list (last-contact, reminders to reach out) · message/letter nudges · shared-moment log · a relationship "web."
**Your call:** ❓ Solo (private, just helps *you* connect) or eventually social/shared? ✎ ______ · ✎ Tools you want: ______
☐ Reviewed

### 6.6 — Future / library modules (not launch, kept on the shelf)
**What it is:** the rich modules from the original, available later as presets.
**Proposal:** ✦ D&D / Tabletop (Campaign, Character sheet, Compendium, Dice, Initiative — 5e/Pathfinder/Starfinder) · World Builder (interactive map, lore, civilizations, characters) · Infinite Canvas (infinite-zoom drawing) · Canva-style board · **Blossoms** (the cozy idle/strategy planet game) · Music player (YouTube/Spotify/Apple links) · standalone Calendar · Alarm/Timer/Stopwatch · Calculator/graphing · small games (Snake, Solitaire).
**Your call:** ✎ Which of these do you want *soon* vs *someday*? ______ · ❓ Anything here that should actually be a *launch* module? ✎ ______
☐ Reviewed

---

# FLOOR 7 — TOOLS LIBRARY (every instrument, catalogued)

*The full menu of tool types. Each is self-contained (Floor 1.2). Mark keep ✓ / cut ✗ / "v1" / "later". Note the original ones too so nothing is lost.*

### 7.1 — Everyday tools
✦ **Notes** (rich text, nestable) · **Journal** (dated entries, prompts) · **Tracker** (custom items over days/weeks/months; count / measure+units / scale / yes-no; shows % & days) · **Counter** · **Time** · **Calendar** · **Reminder** · **Alarm/Timer/Stopwatch** (profiles, pre/post-alarm) · **Calculator/graphing** · **Music** · **Separator** (group/collapse tools) · **Page tool** (a page inside a tool) · **Hub** (a clean container showing tools inside, with their EXP) · **Overview** (links to a tool's data/page).
**Your call:** ✎ keep/cut notes: ______

### 7.2 — Growth & gamification tools
✦ **Skill** (levels from referenced data) · **Characteristic** (a layer above Skills) · **Health** (based on how often nested quests are used) · **Quest** · **Habit** · **Goal** · **Routine** · **Quest Board** (shows today's tasks from nested tools) · **Market** · **Flower-graph** (X-shaped, petals = aspects in element colors, sub-skills as buds) · **Graph** (line/bar/pie/scatter/radar/area/etc. + flower + solar-system styles; saves history; pick X/Y dimensions).
**Your call:** ✎ keep/cut notes: ______

### 7.3 — Study tools
✦ Notebook · Flashcards · Quiz · Study Notes · Library · Study Guide. *(See 6.2.)*

### 7.4 — Creative & tabletop tools (later)
✦ Infinite Canvas · Canva board · Character Sheet · Compendium · Dice · Initiative · World Map · Lore wiki · Civilization · Characters.

### 7.5 — Game tools (later)
✦ Blossoms (idle/strategy planet) · Snake · Solitaire.
**Your call (whole floor):** ❓ Which tools are **v1 must-haves**? ✎ ______ · ✎ Any tool not listed that you want: ______
☐ Reviewed

---

# FLOOR 8 — ONBOARDING (the first five minutes)

### 8.1 — First-bonding flow ✦ (highest-stakes moment)
**What it is:** the very first experience — discovering your element and meeting your creature.
**Proposal:** ✦ A short, beautiful sequence: a calm welcome → the element quiz → an element "reveal" → choose your creature's form → it bonds to you (a small ceremony) → it suggests your *first tiny habit* so you finish the first session having *started something real* (not just a tour).
**Your call:** ❓ Quiz first then creature, or pick a creature then discover its element? ✎ ______ · ✎ The feeling you want this moment to leave: ______
☐ Reviewed

### 8.2 — "Help me build" wizards
**What it is:** gentle guided setup for modules & pages so nobody faces a blank slate.
**Proposal:** ✦ When adding a module/page, default to "Help me build": a few cozy, preset-specific questions assemble a tailored, working setup (with a full-preset and a from-scratch option too).
**Your call:** ☐ Approve · ✎ Modules that most need a guided build: ______
☐ Reviewed

### 8.3 — Tutorial philosophy
**What it is:** how much hand-holding.
**Proposal:** ✅ Suggest, never force. No mandatory tour. Features are *discovered* where a curious person would look; gentle dismissible hints at most.
**Your call:** ☐ Approve
☐ Reviewed

---

# FLOOR 9 — MONEY & RELEASE

### 9.1 — Subscription tiers
**What it is:** how the app earns, "pay only for what you use."
**Proposal (your design):** ✦

| Tier | Price | Unlocks |
|---|---|---|
| Free | $0 | Core app + default modules & their tools |
| Daisy / Designer | $3/mo | All visuals (themes/atmospheres/particles/weather) + custom visual creators |
| Lotus / Manager | $7/mo | Create/edit custom modules; all modules |
| Cosmos / Max | $15/mo | Daisy + Lotus + all guides (learning content, rulebooks) |

Monthly / quarterly / yearly per paid tier. Store billing on mobile (RevenueCat), Stripe on web. Paywall is calm and appears where a locked feature naturally is — never a launch nag.
**Your call:** ✎ Adjust prices/names/contents: ______ · ❓ Is the companion/element system Free (recommended, it's the hook) or gated? ✎ ______
☐ Reviewed

### 9.2 — Donations
**What it is:** optional support.
**Proposal:** ✦ A one-time "tip jar" (e.g., "Water the garden — $2") via RevenueCat (mobile) / Stripe or Ko-fi (web).
**Your call:** ☐ Include a tip jar · ✎ Wording/amounts: ______
☐ Reviewed

### 9.3 — Release path (summary)
**What it is:** the road from your machine to the stores (full detail in `docs/02`).
**Proposal:** ✅ Build with Expo/EAS → test on your phone & internal tracks → Google Play ($25 once) first → App Store ($99/yr) when ready → web on Vercel/Netlify. Updates via store releases + instant JS-only OTA updates. *(Current 2026 facts verified.)*
**Your call:** ☐ Android-first launch confirmed · ❓ iOS + web at launch or later? ✎ ______
☐ Reviewed

### 9.4 — Legal & privacy
**What it is:** the must-dos before publishing.
**Proposal:** ✅ Privacy Policy + Terms (generated, hosted, linked) · in-app account/data deletion · honest store data-safety forms · Supabase RLS on · no keys in the repo. Market position: **privacy-first — your garden is yours.**
**Your call:** ☐ Approve privacy-first positioning
☐ Reviewed

---

# FLOOR 10 — THE FUTURE (the rooftop — room to grow)

*Not v1. Captured so we build in a way that leaves the door open. All exploratory.*

### 10.1 — Pantheons
**Proposal:** ✦ Great, powerful elemental creatures that preside over regions/cities and **draw on their people's strength**; bigger cities → bigger pantheons. A natural future community layer.
**Your call:** ✎ How you imagine pantheons working in-app: ______

### 10.2 — Your book-world & nations
**Proposal:** ✦ Pull your book's canon in: choose a **nation**, a starting pantheon, lore, cosmetics — making the app a living companion to the story.
**Your call:** ✎ What from your book you'd most want first: ______

### 10.3 — Community (optional, private-by-default)
**Proposal:** ✦ Optional accountability/sharing (show a friend your garden), opt-in, never required.
**Your call:** ❓ Do you want any social features at all, or keep it personal? ✎ ______

### 10.4 — Research-backed ideas (from the market study)
**Proposal:** ✦ Cross-domain insights (habit→task→mood→sleep correlations — the gap no competitor fills) · a gentle AI "gardener" companion · wearable/health import · natural-language quick-add · template/Blossom-code sharing.
**Your call:** ✎ Which of these excite you (rank or note): ______
☐ Reviewed (whole floor)

---

# FLOOR 11 — HOW WE BUILD (the crew & the rules)

*This is for me, but you should know it exists — it's why building stays cheap, cozy, and consistent.*

### 11.1 — The five always-on jobs
**Proposal:** ✅ (1) Overhaul each request into a tiny plan · (2) Spend tokens like coins · (3) Build cozy · (4) Track progress + auto-push to GitHub · (5) Finish to a Definition of Done.
**Your call:** ☐ Noted

### 11.2 — The skills (auto-firing helpers)
**Proposal:** ✅ `overhaul-the-ask` · `cozy-check` · `breathe-life` · `grill-me` · `usage-check` · `ship-it` · `cloud-sync` · `monetize` · `release-it` · `learn-from-the-field`.
**Your call:** ☐ Noted · ✎ A rule you want me to *always* follow: ______

### 11.3 — Build order (M0 → M7)
**Proposal:** ✅ M0 skeleton → M1 local storage → M2 first tools → M3 theming+FX → M4 accounts+sync → M5 more tools → M6 native (widgets/alarms) → M7 money+release. Ship a focused MVP before M5 finishes.
**Your call:** ❓ Your dream **MVP** (the smallest version you'd actually use daily): ✎ ______
☐ Reviewed

### 11.4 — Definition of Done
**Proposal:** ✅ A feature ships only when it's spec-honored, cozy, safe (no data loss), offline, 60fps, responsive at 360px, clean, verified on a device, and logged+pushed.
**Your call:** ☐ Noted

---

# APPENDIX A — Master list of open decisions (❓)

*Every fork in one place. Answer here or in-line above — your call.*

1. ❓ Call them "Tools" or "Widgets"? (1.1)
2. ❓ Are the 4 aspects + module→aspect mapping right? Any dual-aspect modules? (1.3, 6.x)
3. ❓ Dock vs top rail; Companion as a page vs its own dock item? (1.4)
4. ❓ Supabase confirmed; sign-in options (email/Google/Apple)? (2.1, 2.3)
5. ❓ Start anonymous then upgrade? (2.3)
6. ❓ Custom theme creator at launch or later? (3.2)
7. ❓ Default card opacity %, icon style? (3.6)
8. ❓ Default Liveliness level? (3.7)
9. ❓ Base elements Fire/Water/Earth/Air? Role→element mapping? Re-discoverable? Quiz length? (4.2)
10. ❓ Your real element & sub-element roster. (4.3)
11. ❓ How new creature forms unlock. (4.4)
12. ❓ Approve the four aspect→creature-growth mappings; example Mental abilities. (4.5)
13. ❓ What else lives on the Companion page. (4.6)
14. ❓ Sub-skills per aspect; show as flower buds? (4.7)
15. ❓ Uncapped levels vs soft tiers. (5.2)
16. ❓ Keep 4-coin economy or simplify. (5.3)
17. ❓ Flower-graph centerpiece of Home or Companion? (6.1)
18. ❓ Exercise focus (workouts / logging / health import)? (6.3)
19. ❓ Breathing: ambient sounds? patterns? (6.4)
20. ❓ Connection: solo vs social? (6.5)
21. ❓ Which future modules are "soon" vs "someday"; any that should be launch? (6.6)
22. ❓ Which tools are v1 must-haves? (7)
23. ❓ First-bonding order: quiz→creature or creature→element; the feeling to leave. (8.1)
24. ❓ Tier prices/names/contents; is the companion Free? (9.1)
25. ❓ iOS + web at launch or later? (9.3)
26. ❓ Any social features, ever? (10.3)
27. ❓ Which research-backed ideas excite you. (10.4)
28. ❓ Your dream MVP. (11.3)

# APPENDIX B — Glossary

- **Workspace / Module / Page / Tool / Object** — the five nesting levels (1.1).
- **Aspect** — Physical / Mental / Emotional / Social; what modules feed and the flower-graph shows.
- **The Blossom loop** — every module feeds an aspect → grows your creature.
- **Companion / creature** — your soul-bonded elemental being.
- **Element / sub-element** — your fixed elemental nature (e.g., Water → Mist).
- **Form** — the creature's swappable physical shape.
- **COSMOS** — the habit/goal method (Clarify·Orient·Stack·Motivate·Observe·Study).
- **Blossom code** — a copy/paste code to save or share any object/tool/page/module.
- **Atmosphere / Particles / Weather** — background effect / drifting bits / screen-touching effects.
- **Liveliness dial** — global motion setting (Still/Gentle/Lively).
- **Pantheon** — a great regional creature (future).

---

*End of staircase. When you've climbed it — edits made, blanks filled, ❓ answered, boxes ticked — send it back and I'll turn it into the finished, built framework.*



