# My Blossom — The Complete Guide

*A readable, full picture of what My Blossom is, everything it can do, how you use it, and what's built vs. still to build. This is the human guide; `MERGE-SPEC.md` is the engineering map and `DESIGN-DOC.md` is the locked product spec.*

---

## 1. The one-paragraph picture

My Blossom is a cozy, all-in-one life app that **you build yourself** out of simple pieces. Instead of being one fixed app, it's a kit: you assemble little **Tools** (a habit tracker, a notebook, a dice roller, a flashcard deck, a character sheet…) onto **Pages**, group those pages into **Modules** (your own mini-apps — "Productivity," "My D&D Campaign," "Study," "Garden of Calm"), and the whole thing is themed into a living world with weather and particles. As you actually *use* it — keep a habit, finish a study session, take a walk — five sides of your life (your **aspects**) grow as flowers, and a companion named **Liri** grows alongside you. It runs on Android, iPhone, and the web from one codebase, syncs across your devices, and works fully offline.

---

## 2. The core idea: you build your own app

Everything is made of four nested pieces. This is the whole mental model:

- **Workspace** — your entire app. Everything lives here.
- **Module** — an "app inside the app." You might have a *Productivity* module, a *Study* module, a *D&D DM* module, a *World Builder* module. You switch between them like switching apps.
- **Page** — a screen/tab inside a module (Home · Calendar · Stats · Characters · Maps). Pages hold your Tools.
- **Tool (Widget)** — the actual interactive card that does something (a tracker, a note, a timer, a dice roller). Tap a Tool to open its full view.
- **Object** — the content inside a Tool (a single note, a drawing, a character, a goal). The magic: objects can **reference each other** — a drawing can attach to a character, a habit can feed a goal, a tracker can feed a graph.

> **"Tools" vs "Widgets":** inside the app they're called Tools. On your Android home screen, the same Tool can appear as a phone **Widget** — same thing, projected onto your home screen.

The deep rule that keeps it stable: **every Tool is complete and standalone.** A graph *can* read a tracker, but if there's no tracker, the graph still works and nothing breaks. (This is the #1 fix over the old app, where Tools depending on each other caused bugs.)

---

## 3. The heart: aspects, the flower, and Liri

### The five aspects
Your life is modelled as five **aspects**, each shown as a flower:

| Aspect | Fed by the module | Example attributes (the petals) |
|---|---|---|
| **Mental** | Productivity | Focus · Learning · Creativity · Discipline · Wisdom |
| **Physical** | Activity | Strength · Conditioning · Mobility · Nutrition · Sleep · Health |
| **Emotional** | Meditation | Calm · Resilience · Gratitude · Self-awareness |
| **Social** | Connection | Connection · Communication · Empathy · Community |
| **Recreation** | Recreation | Play · Creativity · Curiosity · Rest |

Each aspect is a **flower**: its **attributes are the petals**, its **skills are stars** that orbit it. The flower grows and gets more colourful as you level the aspect.

### The Blossom loop (how growth happens)
You don't "grind XP." You just live: completing a habit, finishing a study session, going for a walk, journaling. Each action quietly sends **aspect-XP** to the right attribute. Attributes level → the aspect levels → the flower blooms. The modules feed the aspects; you watch your garden grow as a mirror of your real life.

### Liri, the companion
**Liri** is your soul-bonded companion who grows with you. Liri has:
- **Its own page** and a **dock shortcut**, and is subtly present on other screens.
- An **element** (Air / Water / Earth / Fire) chosen by a 15-question quiz — fixed element, but the *form* can change over time (with caps).
- **Growth driven by your aspects** — your real progress shapes Liri's size, abilities, colours, and beauty.
- **"Liri Life"** — a gentle duck-life-style mini-game: bond, mood, journal, milestones; spend coins on food, toys, and clothes.

---

## 4. The six modules (what each is for)

You start with a couple and add the rest from the preset gallery (or build your own from scratch).

1. **My Blossom (the hub)** — your home base; shows your aspects/flowers and Liri, and links everything together.
2. **Productivity → Mental** — habits (COSMOS method), quests, goals, trackers, skills, calendar. *Build priority #1.*
3. **Activity → Physical** — movement, workouts, sleep, nutrition tracking. *Build priority #2.*
4. **Meditation → Emotional** — breathing, calm, gratitude, reflection.
5. **Connection → Social** — people, check-ins, relationships.
6. **Recreation → Recreation** — play, hobbies, creativity, rest.

You can also build **non-aspect modules** for anything: a D&D campaign, a novel's world, a sketchbook, a recipe box, a budget.

---

## 5. Everything it can do — the full Tool catalog

This is the complete roster the finished app offers (ported from the old app). ✅ = working in v1.0.0 now; the rest are mapped and queued (see §9).

**Productivity**
- **Tracker ✅** — track anything daily (count, measure, yes/no, scale, timer, note) with goals + history graphs.
- **Quest ✅** — step-by-step missions with progress, difficulty, due dates, XP.
- **Habit ✅** — habits built with the **COSMOS** method: a trigger sentence + three effort tiers (tiny/normal/stretch), streaks, weekly adherence.
- **Goal ✅** — a seed that matures from weighted milestones (and, optionally, linked habits/quests).
- **Routine** — a checklist bundle (morning/evening rituals).
- **Calendar** — month view, events, agenda.
- **Alarm / Timer** — pomodoro, countdowns, focus timers.
- **Reminder · Quest Board** — nudges and a mission hub.

**Notes & Writing**
- **Notes ✅** — rich notebook; can embed other Tools inside a note (infinitely nestable).
- **Journal** — dated entries (write or draw), streaks, "inspire me" prompts.
- **Doc Shelf · Library** — documents and reading.

**Growth & Rewards**
- **Skill ✅** — an RPG track that levels from XP.
- **Health** — a vitality "vine" / HP bar tied to your consistency.
- **Market** — spend earned coins on rewards you define.
- **Characteristic** — custom stats.

**Data & Charts**
- **Counter ✅** — a simple tally.
- **Graph** — the visualization engine (line/bar/pie/scatter/gauge), fed by any Tool's outputs.
- **Flower Graph** — your data as a living bloom.
- **Overview** — at-a-glance dashboards.

**Study**
- **Flashcards** — spaced study with mastery tracking, adaptive + mixed sessions.
- **Quiz** — multiple types, weak-term focus, time-of-day score graphs, drill-down results.
- **Notebook → cards** — turn notes into decks.
- The **Study Garden** — topics grow Seed → Bloom; the anti-burnout **BLOOM** study loop; a Study-Skills flower.

**Creative**
- **Canvas** — drawing/sketching with layers.
- **Infinite Canvas** — a full painting surface (Kleki-parity).
- **Gallery · Music · Pinboard · Canva Board** — images, audio, mood boards.

**Tabletop (D&D 5e)**
- **Character Sheet · PC Sheet · Spellbook · Inventory · Combat · Story** — full D&D Beyond-style play.
- **Compendium** — the complete **SRD 5e** content (classes, races, spells, monsters, items, rules).
- **Character Creator · Homebrew · Custom Books** — make your own content.
- **DM tools** — Stat Block, Loot Table, Session Log/Plan, Encounter builder, Initiative tracker, Level Planner, **Dice**.

**World Building**
- **World Map · World Characters · Civilization Profiles · Timeline · Lore Wiki · Relationship Web.**

**Games**
- **Blossoms** (the signature match game), **Snake**, **Solitaire**.

**Utility & Organization**
- **Calculator · Time · Separator · Notifications · Hub · Page-widget.**

---

## 6. The systems that tie it together

- **COSMOS habit method** — the app's signature way of building habits: Clarify your purpose, Outline the goal, Set a trigger ("after I ___, I'll ___"), Map three effort tiers, Observe with the streak log, Sustain with a weekly review.
- **Gamification ✅ (core math built)** — earn **coins** (a copper→silver→gold→platinum chain) and **XP/levels** from real activity; **Health** reflects consistency; the **Market** turns coins into rewards you choose. *(Currency + level curves are ported and tested; the Health/Market Tools are queued.)*
- **The living world** — every **theme** is a biome with its own light (Cosmos, Flower, Forest, Ocean, Sunset, Autumn, Scarlet ✅), with **atmospheres** (day/night, constellations, sunset, waves…), **weather** folded into atmospheres, and **particles** (stars, petals, leaves, embers, bubbles). Plus interactive effects with little mini-game counters (catch fireflies, etc.). A **custom theme creator** lets you design your own (Designer tier).
- **Living Layout** — Tools, pages, and modules can carry their own "feel" (material, density, texture) so each module reads like its own little world.
- **Save / Blossom codes** — export any Tool, page, or module as a shareable code; import to copy it. (Also how old-app gardens migrate in.)
- **Cloud sync ✅ (engine built)** — your data lives locally first (instant, offline), and mirrors to the cloud (Supabase) so it's the same on every device. Sign in is optional; with no account it's just a great offline app.

---

## 7. How to use it — tutorials

These are the core walkthroughs (the in-app tutorial will mirror them; ✅ steps work today).

**A. First run ✅**
Open the app → you land on **My Blossom** and **Productivity**, pre-seeded so it's alive immediately. Tap the module name (top-left) to switch modules. The bottom tabs are that module's pages. The **＋** button adds a Tool.

**B. Build your first Tool ✅**
On any page, tap **＋ → pick a category → choose a Tool** (e.g. *Habit*). It appears as a card. Tap the card to open its full view; edit its settings from there. That's the whole loop — repeat to compose your page.

**C. Plant a habit with COSMOS ✅**
Add a **Habit** Tool. Set the trigger ("After I pour my coffee, I'll read one page"). Each day, tap a tier — **MVV** (tiny, saves the streak), **Standard**, or **Stretch**. Watch the streak and weekly adherence climb. (Soon: this feeds your **Discipline** petal automatically.)

**D. Track and visualize**
Add a **Tracker**, add items (Water = count, Mood = scale, Slept = yes/no). Log daily. Later, add a **Graph** and point it at the tracker to see trends. (Tracker ✅; Graph queued.)

**E. Study a deck** *(queued — W3)*
Add a **Notebook**, write terms, turn it into **Flashcards**, run an adaptive session, then a **Quiz** on your weak terms. Your **Study-Skills flower** grows by subject.

**F. Run a tabletop game** *(queued — W5)*
Make a **D&D Character** module → Character Sheet + Spellbook + Inventory + Dice. DMs make a **D&D DM** module with Encounters, Initiative, Loot, and the SRD Compendium.

**G. Theme your world ✅ (themes) / queued (creator)**
Open settings → pick a theme (each changes the whole world's light + particles). The custom-theme creator and weather toggles come with the FX wave.

**H. Meet Liri** *(queued — W4)*
Take the 15-question element quiz → Liri bonds to you with an element. Visit Liri's page to play **Liri Life**, and watch Liri grow as your aspects do.

---

## 8. Platforms & the "no-terminal" question

- **Android, iPhone, and Web** all run from **one codebase**.
- **npm / the terminal is a build-time tool only** — used while *writing* the app, never by you. When we make a real build, it becomes a normal installed app you tap to open. No terminal, ever, for using it.
- **The path there:** dev build (a real installable APK for testing — happens at the visual-engine wave) → store submission (Google Play, then App Store) → you (and anyone) install it like any app. Web is available throughout for quick checks.
- **Offline is sacred** — everything works with no signal; sync catches up when you're back online.

---

## 9. What's built now vs. what's still to build

**Built and verified today (the spine + first vertical):**
- The full **engine**: local storage, offline-first **sync** (last-write-wins), the **Tool plugin system**, the **Module→Page→Widget** model, **7 themes**, the **aspect/growth** engine, the **gamification core** (coins + XP/level curves).
- **7 working Tools**: Tracker, Quest, Habit (COSMOS), Goal, Skill, Notes, Counter.
- A working **shell**: module switching, page tabs, and the **＋ Add-Tool gallery**.
- Two seeded modules: **My Blossom** + **Productivity**.

**Still to build (mapped in MERGE-SPEC §5, in order):**
- **W1** — finish the shell (3-window module rail, per-Tool settings panel, drag-reorder, soft delete).
- **W2** — the **Activity** module + wire the growth loop so completions visibly grow your flowers; Health + Market Tools.
- **W3** — the **Study garden** (flashcards, quiz, the BLOOM loop).
- **W4** — the **living visual engine** (atmospheres, weather, particles, the flower bloom) + **Liri** (page, element quiz, Liri Life).
- **W5** — **Tabletop** (import the full SRD, then sheets + DM tools + dice).
- **W6** — accounts UI + turning on cloud sync + the **old-app importer** (bring your existing gardens in).
- **W7** — Creative / World / Games Tools → home-screen widgets, notifications, real alarms → the no-paywall tiers → **store release**.

**Rough honesty:** ~15% of the *felt* app exists, on a 100%-real foundation. Each remaining Tool is a "clone the template" job, which is why progress accelerates from here.

---

## 10. For whoever builds it next (Claude Code)

The pattern is deliberately repeatable so building is fast and safe:
- A Tool = a folder `src/widgets/<type>/` with a **pure brain** (`logic.ts`, no UI, node-testable), a **view** (`View.tsx`), and a one-line registration (`index.ts` + `registry.ts`). Nothing else changes.
- **Port, don't reinvent:** copy the old app's logic from `../My App/js/widgets/<type>.js`, strip the web/DOM bits, add types, rebuild the card natively. Never re-type SRD/preset data — import it.
- Read `MERGE-SPEC.md` (the map) + `STATUS.md` (where we are) at the start of every session; verify with `npm run smoke` (the logic is testable without a phone) + a device run; then ship.

*That's My Blossom: a kit for building the cozy life-app that's exactly yours — growing a garden, and a companion, out of the things you actually do.*
