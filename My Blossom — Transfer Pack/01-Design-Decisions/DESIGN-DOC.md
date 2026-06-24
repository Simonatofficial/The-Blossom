# **My Blossom — Master Design Document (v0.0.1 worksheet)**

**What this is.** Every decision, system, and detail of My Blossom, gathered into one place and arranged like a **staircase**. Start at the **Foundation** and climb one step at a time. At each step you'll see *what it is*, *how it works*, the *current proposal*, and *your call*. Read it, edit it, fill in the blanks, tick the boxes. When you've walked the whole staircase, send it back and I'll turn your answers into the finished, built framework.

**How to use it.** Don't try to do it all at once. Take a floor per sitting. Change anything — nothing here is sacred except the few items marked ✅. Where you see a blank `✎ ______`, write your answer right in the line. Where you see ❓, that's a real fork I need you to choose. Leave a note anywhere with `>> your note`.

### **Legend**

* ✅ **Firm** — core to the app; change only if you really mean to.  
* ✦ **Proposed** — my best draft; edit freely.  
* ❓ **Open** — a real decision only you can make.  
* ✎ `______` — a blank for you to fill.  
* ☐ / \* — tick when you've reviewed/approved a step.

### **Map of the staircase**

* **Foundation** — vision, who it's for, platforms, principles  
* **Floor 1 — Structure** — how the app is organized  
* **Floor 2 — Tech & Data** — the wiring underneath  
* **Floor 3 — Look & Feel** — themes, atmosphere, particles, weather, UI  
* **Floor 4 — The Heart** — the elemental companion, elements, aspects, growth  
* **Floor 5 — Method & Game** — COSMOS, XP, coins, quests/habits  
* **Floor 6 — The Modules** — Blossom, Study, Exercise, Breathing, Connection (+ future)  
* **Floor 7 — Tools Library** — every tool type, catalogued  
* **Floor 8 — Onboarding** — first-bonding & build wizards  
* **Floor 9 — Money & Release** — tiers, donations, publishing  
* **Floor 10 — The Future** — pantheons, your book-world, community  
* **Floor 11 — How We Build** — the operating framework & skills  
* **Appendix** — master list of open decisions \+ glossary

---

# **FOUNDATION — the ground you stand on**

*The few things everything else rests on. Get these right and the rest follows.*

### **F.1 — The promise (one sentence)**

**What it is:** the single line that says what My Blossom *is*. **Proposal:** ✦ *"A cozy, fully customizable, all-in-one life app where you grow a soul-bonded elemental companion by tending the real parts of your life."* **Your call:** ✎ Rewrite in your words: \_\_\_\_\_\_ \* Reviewed

### **F.2 — Who it's for**

**What it is:** the person you're building for first. **Proposal:** ✅ You, Simon, first — built to fit your life perfectly; anyone who vibes with it is welcome. (Market note: the wedge is *consolidation* — replacing the 4–7 \>\> (All the) apps people juggle — plus deep personalization and privacy.) **Your call:** ✎ Anyone else you specifically want it to serve? \_\_\_\_\_\_ \* Reviewed

### **F.3 — The problem it solves**

**What it is:** why it deserves to exist. **Proposal:** ✦ Life-tools are scattered, cold, and samey. My Blossom unifies them into one warm, personal place where progress is *felt* (your creature visibly grows), not just logged. **Your call:** ❓ Is "consolidation \+ a living companion" the core hook, or is something else more central? ✎ The central problem my app solves is helping me, Simon, visualize my life in a way that makes sense, is comforting, cozy, and productive. \* Reviewed

### **F.4 — Platforms & reach**

**What it is:** where it runs. **Proposal:** ✅ **Android-first**, also **iOS** and **web** (so Windows/Linux/Mac via browser). One codebase. GitHub for source \+ test builds; mobile stores for release. Locked to portrait. Works fully offline. **Your call:**  Confirm Android-first · ☐ iOS at launch or later? ✎ IOS Later ·  Web at launch or later? ✎ At Launch \* Reviewed

### **F.5 — The four guiding principles**

**What it is:** the values every decision is checked against. **Proposal:** ✅

1. **Cozy** — calm, discoverable, opt-in, never force-fed (the *controls* whisper).  
2. **Alive** — layered, warm, illustrated, gently in motion, full of *place* (the *world* breathes).  
3. **Yours** — deeply customizable & personal; you design your Blossom.  
4. **Solid** — offline-first, never loses data, 60fps, private. **Your call:** ✎ Add a 5th principle if you have one: \_\_\_\_\_\_ \* Reviewed

---

# **FLOOR 1 — STRUCTURE (how the app is organized)**

### **1.1 — The core model**

**What it is:** the nested skeleton of the whole app. **How it works:** five nesting levels.

* **Workspace** ✅ — the entire app; one per person.  
* **Module** ✅ — an "app inside the app" (The Blossom, Study, Exercise…). You switch between them.  
* **Page** ✅ — a screen inside a module (Home, Companion, Calendar…). Organizes tools.  
* **Tool** ✅ — the interactive unit on a page (Notes, Tracker, Quest, Graph…). *Formerly called "widget."* Opens into its own full view.  
* **Object** ✅ — the data inside tools (a note, a drawing, a goal, a journal entry). Objects can be *referenced* from anywhere.

**Everything is data:** modules/pages/tools/themes are JSON definitions rendered by generic engines. Presets are bundled definition files. **Your call:** ❓ Keep the word **"Tool"** (clear) or stick with **"Widget"** (familiar)? ✎ Tools are in app, Widgets are out of app but act the same. App tools vs Android Widget (Android devices will be able to pull all tools from the app and use them as widgets on their home screens). · Confirm the 5-level model \* Reviewed

### **1.2 — Tools are self-contained (the big lesson)**

**What it is:** the rule that fixes the original app's worst bug. **How it works:** ✅ every Tool is a *complete instrument on its own*. It **may optionally** read another tool's data, but **never depends** on one — if a linked tool is missing/empty, this tool still works and nothing breaks. Connections are bonuses, not wiring. **Your call:** Confirm · ✎ Any tools you *do* want tightly linked (accept the risk)? \_\_\_\_\_\_ \* Reviewed

### **1.3 — The Blossom loop (everything connects back)**

**What it is:** the spine that makes the app one thing, not many. **How it works:** ✅ every module feeds an **aspect** of your Blossom, which grows your **creature**:

* Study → **Mental \>\> Productivity \-\> Mental**  
* Exercise → **Physical \>\> Activity \-\> Physical**  
* Breathing → **Emotional \>\> Meditation \-\> Emotional**  
* Connection → **Social \>\> Connection \-\> Social**  
* **\>\>** Entertainment \-\> **Recreation** (The Recreation aspect of life is meant to be the fun aspect, the aspect where the user can make things fun, plan activities, and grow in a positive way).  
* The Blossom → the hub that shows it all

Should be broken down further:  
Aspect \- Attribute \- Skill

Here’s some Examples I had Claude generate:

## **Exercise**

Physical Development  
Build muscular power and functional capability for daily activities and long-term resilience.  
Compound Lifting

Master fundamental movements like squats, deadlifts, and presses  
Core Stability

Build abdominal and deep core muscle endurance  
Functional Movement

Apply strength to real-world activities like lifting and carrying  
Progressive Overload

Systematically increase resistance and difficulty  
Sustain physical activity over extended periods and build cardiovascular health.  
Aerobic Conditioning

Improve heart and lung efficiency through sustained activity  
Distance Building

Gradually increase duration of cardio activities  
Pace Management

Maintain consistent effort levels during long activities  
Recovery Optimization

Develop proper rest and nutrition strategies  
Increase range of motion and prevent injuries for better athletic performance.  
Static Stretching

Hold stretches to increase muscle length  
Dynamic Movement

Practice active flexibility during exercise  
Joint Mobility

Restore and maintain optimal joint function  
Breathing Techniques

Use breath work to deepen stretches safely  
Fuel your body properly for energy, recovery, and long-term vitality.  
Meal Planning

Design balanced, sustainable eating patterns  
Nutrient Knowledge

Understand macros and micronutrients  
Hydration Mastery

Maintain optimal fluid intake  
Supplement Understanding

Make informed choices about supplements  
Allow your body to repair and regenerate for optimal performance.  
Sleep Hygiene

Establish consistent routines and environment  
Rest Cycles

Understand and implement recovery days  
Stress Reduction

Use relaxation techniques before bed  
Sleep Quality Tracking

Monitor and improve sleep patterns

## **Productivity**

Mental Development  
Direct and maintain your attention on tasks for deep, meaningful work.  
Deep Work Sessions

Engage in uninterrupted, focused work periods  
Distraction Elimination

Identify and remove focus blockers  
Attention Span Extension

Gradually increase focus duration  
Task Prioritization

Identify and focus on high-impact activities  
Enhance your capacity to encode, store, and retrieve information.  
Information Retention

Improve ability to remember learned material  
Active Recall

Practice retrieving information without cues  
Spaced Repetition

Use proven techniques to strengthen memory  
Memory Palace Technique

Apply visualization strategies for complex information  
Analyze situations and find effective solutions to complex challenges.  
Analytical Breakdown

Deconstruct complex problems into components  
Creative Solution Generation

Brainstorm multiple approaches  
Logical Reasoning

Apply structured thinking to problems  
Systems Thinking

Understand how different elements interact  
Continuously acquire knowledge and expand your capabilities.  
Active Learning

Engage deeply with new material  
Skill Acquisition

Master new abilities systematically  
Knowledge Integration

Connect new information to existing knowledge  
Curiosity Development

Cultivate intrigue and exploration mindset  
Understand emotions logically for better decision-making and awareness.  
Emotion Recognition

Identify emotional states in yourself and others  
Pattern Recognition

Connect emotions to triggers and outcomes  
Perspective Taking

Consider situations from multiple viewpoints  
Decision Analysis

Evaluate choices with emotional awareness

## **Meditation**

Emotional Development  
Understand your emotions, triggers, patterns, and values deeply.  
Emotion Identification

Name and understand your feelings  
Trigger Mapping

Identify what causes your emotional reactions  
Values Clarification

Understand what truly matters to you  
Shadow Work

Acknowledge and integrate difficult aspects of yourself  
Manage emotions and respond thoughtfully to situations.  
Grounding Techniques

Use methods to calm yourself in stress  
Breathing Mastery

Use breath work for emotional control  
Pause & Respond

Create space between stimulus and response  
Emotional Reframing

Change perspective to shift emotional state  
Recover from difficulties and grow stronger through challenges.  
Failure Integration

Learn and grow from setbacks  
Perspective Maintenance

Keep challenges in healthy perspective  
Resource Activation

Draw on inner and outer resources during difficulty  
Growth Mindset

View obstacles as opportunities to develop  
Treat yourself with kindness and understanding.  
Negative Self-Talk Reduction

Challenge harsh inner critic  
Forgiveness of Self

Release guilt and shame constructively  
Worthiness Recognition

Accept your inherent value  
Boundaries Setting

Protect your emotional energy  
Find direction and drive that fuels your actions meaningfully.  
Goal Alignment

Ensure goals match your values  
Intrinsic Motivation

Develop internal drive (not external pressure)  
Purpose Connection

Link daily actions to larger meaning  
Energy Management

Maintain motivation through ups and downs

## **Connection**

Social Development  
Express yourself clearly and listen actively to others.  
Active Listening

Fully engage and understand others  
Clear Expression

Articulate ideas with clarity and precision  
Non-Verbal Communication

Master body language and tone  
Question Asking

Ask thoughtful, open-ended questions  
Understand and share the feelings of others genuinely.  
Perspective Understanding

Genuinely see from others' viewpoints  
Emotional Resonance

Feel with others, not just for them  
Validation Skills

Acknowledge others' feelings and experiences  
Compassionate Response

Respond with genuine care and support  
Form meaningful connections and nurture them over time.  
Networking

Build professional and personal connections  
Vulnerability

Share authentically and allow others to know you  
Conflict Resolution

Navigate disagreements constructively  
Trust Development

Build and maintain trusted relationships  
Work effectively with others toward shared goals.  
Cooperative Problem-Solving

Work together toward solutions  
Role Recognition

Understand and embrace your role in teams  
Feedback Integration

Receive and apply input from others  
Group Dynamics

Navigate team interactions effectively  
Inspire and guide others to achieve shared goals.  
Vision Communication

Articulate compelling direction  
Decision Making

Make sound choices for group benefit  
Delegation

Empower others to take on responsibilities  
Inspiration

Motivate and uplift those around you

## **Entertainment**

Recreation & Enjoyment  
Create something new and express yourself authentically through various mediums.  
Artistic Skill Development

Master your chosen creative medium  
Creative Problem-Solving

Apply creativity to overcome challenges  
Ideation

Generate abundant ideas and possibilities  
Execution

Bring creative visions to reality  
Develop competence and expertise in activities you enjoy.  
Deliberate Practice

Focus on improving specific aspects  
Technique Refinement

Perfect the fundamentals  
Advanced Technique

Move beyond basics into complexity  
Teaching Others

Share your skill with community  
Be fully engaged in the moment without judgment.  
Present Moment Awareness

Focus on what's happening now  
Sensory Appreciation

Engage all senses fully  
Flow State Achievement

Reach deep engagement and enjoyment  
Meditation Practice

Develop sustained mindfulness  
Seek new experiences and step outside comfort zones.  
New Experience Seeking

Try activities outside your normal routine  
Comfort Zone Expansion

Gradually increase challenge level  
Travel & Exploration

Discover new places and perspectives  
Risk Assessment

Balance adventure with safety  
Cultivate happiness and appreciation in daily life.  
Gratitude Practice

Regularly acknowledge what's good  
Simple Pleasure Recognition

Find joy in everyday moments  
Celebration

Mark achievements and positive moments  
Humor Cultivation

Develop and share laughter

Doing anything anywhere → your Blossom and creature visibly respond. **Your call: \>\>** I’d like it to feel as if your Companion is soul bonded and connected to the user. It should feel personal. ❓ Are these the right 4 aspects, and the right module→aspect mapping? ✎5 Modules & Aspects: add Entertainment \-\> Recreation ❓ Should some modules feed *two* aspects (e.g., a team sport → Physical \+ Social)? ✎ Yes, \- kind of: Skills can feed into multiple attributes / attributes can feed into multiple aspects (if it makes sense to) \* Reviewed

### **1.4 — Navigation model**

**What it is:** how you move around. **Proposal:** ✦

* **Bottom dock** — switch modules (Blossom, Productivity, Activity, Meditation, Connection, Entertainment).  
* **Page tabs** — within a module, switch pages (e.g., Blossom → Home · Companion · Calendar).  
* **Companion** lives on its *own page* (not repeated on every screen); a small creature avatar in the top bar jumps to it.**\>\>** Doesn’t necessarily live exclusively on its own page, but It has its own page that the user can interact with the Companion. I’d like it if the Companion was visible on the other pages, but not in your face or taking up the whole screen, it could be placed behind a button like the settings, it could be on the side of the screen on the bottom or top, it could even change places, etc.  
* **FAB (+)** — a blooming flower button to manage a module / page / tool.  
* Returning from a sub-view lands you **where you were**, not at the top. **Your call:** ❓ Dock at the bottom, or a swipe-able top rail like the original? ✎ The swipe didn’t function in the original, but I’d like it if you could swipe to change modules. · ❓ Should the Companion be a page inside The Blossom, or its own dock item? ✎ I’d like it if the Companion had a dedicated page but could be added as its own item/item, just his own page is where you can interact with him, dress him, change him, etc. \* Reviewed

---

# **FLOOR 2 — TECH & DATA (the wiring under the floor)**

*You don't have to love this floor — just confirm the choices. They're mostly settled.*

### **2.1 — Tech stack**

**What it is:** what it's built with. **Proposal:** ✅ Expo \+ React Native \+ TypeScript · Expo Router (navigation) · Skia (visuals/particles/graphs/drawing) · Reanimated \+ Gesture Handler (motion/touch) · expo-sqlite \+ MMKV (local storage) · **Supabase** (accounts/sync) · RevenueCat \+ Stripe (payments) · expo-notifications \+ background tasks (alarms/reminders). No runtime CDNs; everything bundled. **Your call:**  Approve stack · ❓ Supabase confirmed for sync (vs Firebase)?  yes / ✎ Use Supabase but you must configure it securely and safely. \* Reviewed

Supabase Security Requirements for Blossom  
Goal

This application stores private user information including tasks, goals, habits, notes, journals, drawings, and account data.

Security is a top priority.

Implement the backend using Supabase with the following requirements.

---

Authentication

Required

* Use Supabase Auth.  
* Support email/password authentication.  
* Require email verification before account activation.  
* Password reset must use Supabase's built-in secure reset flow.  
* Never store passwords manually.  
* Never create custom password storage systems.  
* Support MFA (multi-factor authentication).  
* Support OAuth providers later if needed.

---

Database Security

Row Level Security

Enable RLS on EVERY user-data table.

No table containing user information may be accessible without RLS.

Example tables:

* profiles  
* goals  
* habits  
* tasks  
* journals  
* notes  
* drawings  
* achievements  
* reminders  
* settings

---

Ownership Model

Every user-owned record must contain:

user\_id UUID NOT NULL REFERENCES auth.users(id)

The authenticated user must only access rows where:

auth.uid() \= user\_id

Required policies:

SELECT

Users can only read their own rows.

INSERT

Users can only create rows for themselves.

UPDATE

Users can only update their own rows.

DELETE

Users can only delete their own rows.

No exceptions.

---

Service Role Security

Never expose:

* service\_role keys  
* admin keys  
* database passwords

to the client application.

Service-role keys must only exist in:

* Edge Functions  
* Secure backend environments  
* Server-side API routes

The mobile/web app must only receive the public anon key.

---

Secrets Management

Store all secrets in environment variables.

Never hardcode:

* API keys  
* Stripe secrets  
* RevenueCat secrets  
* Supabase service keys  
* JWT secrets

Never commit secrets to Git.

---

File Storage Security

If user uploads are supported:

* Use Supabase Storage.  
* Private files must be stored in private buckets.  
* Access must be authenticated.  
* Generate signed URLs when temporary access is needed.  
* Do not expose direct public URLs for private content.

---

API Security

Validate all input.

Requirements:

* Length limits  
* Type validation  
* Allowed value validation  
* Sanitization where appropriate

Reject malformed requests.

---

Logging

Do not log:

* passwords  
* tokens  
* access tokens  
* refresh tokens  
* payment details

Safe logs only.

---

Payments

Use Stripe Checkout or Stripe Payment Elements.

Requirements:

* Card data must never pass through our servers.  
* Card data must never be stored in Supabase.  
* Payment verification must occur through Stripe webhooks.

---

Backups

Enable automated database backups.

Test restore procedures before production launch.

---

Rate Limiting

Protect against abuse.

Implement:

* login rate limits  
* signup rate limits  
* password reset rate limits

Prevent brute-force attacks.

---

Admin Access

Admin accounts must:

* use MFA  
* use strong passwords  
* never share credentials

---

Security Audit Checklist

Before production release:

* Verify RLS is enabled on every user table.  
* Verify users cannot access other users' records.  
* Verify service keys are not exposed.  
* Verify file storage permissions.  
* Verify payment flow.  
* Verify backups.  
* Verify environment variables.

Run security testing before launch.

Any security issue takes priority over feature development.

### 

### 

### 

### 

### **2.2 — Storage & offline-first**

**What it is:** how your data is stored and stays instant. **How it works:** ✅ the app always reads/writes a **local** database first (instant, works with no signal); a background sync mirrors to the cloud. One `Store` interface; storage adapters swap underneath without touching tools. **Your call:**  Confirm offline-first as non-negotiable \* Reviewed

### **2.3 — Accounts & sync**

**What it is:** logging in and syncing across your devices. **Proposal:** ✦ Start every new user with **anonymous sign-in** (instant sync, no signup wall); offer "save your account" (email/password or Google) later, keeping all data. Row-Level-Security so only you can see your data. Last-write-wins per object for v1. **Your call:** ❓ OK to start anonymous and upgrade later? yes / ✎ \_\_\_\_\_\_ · ❓ Sign-in options to offer:  email/password & Google \* Reviewed

### **2.4 — Saves, Blossom codes & data safety**

**What it is:** backups and sharing. **Proposal:** ✦ Keep the original's **Blossom codes** — copy/paste a code (or file) to save or share any object/tool/page/module. Auto-save daily; autosaves on export. Soft-delete (30-day trash); a full "reset all data" with a strong double-confirm (type DELETE). **Your call:** ☐ Keep Blossom codes · ❓ Keep daily auto-backup codes in a notes tool like before? ✎ Yes, but soft delete within a week instead of 30 days, if objects are included in a code user must verify there is no sensitive information (I don’t want users accidentally sharing a notebook with sensitive information). \* Reviewed

### **2.5 — Project structure**

**What it is:** how the code is laid out (FYI). **Proposal:** ✅ `app/` routes · `src/core` (store, logic) · `src/fx` (Skia effects) · `src/widgets/<type>` (each tool \= logic.ts \+ View.tsx) · `src/presets` (definitions \+ content) · `src/theme` · `src/ui` (chrome). **Your call:**  Noted (no action needed)  \* Reviewed

# **FLOOR 3 — LOOK & FEEL (what you see and feel)**

*This is the floor you cared most about. Lots to tune here.*

### **3.1 — Art direction (the soul)**

**What it is:** the one coherent visual identity. **Proposal:** ✦ **A hand-illustrated living garden under a changing sky.** Closer to a storybook/life-sim than a dashboard. Built in **layers** every screen: sky/atmosphere → scenery → (companion only on its page) → particles/weather → translucent crafted cards float above. Warm light, organic rounded shapes, gentle motion, the **cosmos-flower** motif throughout. No flat squares, no stock-emoji UI, nothing reskinnable into another app. **Your call:**  Approve the living-garden direction · ✎ Any reference apps/art you want me to lean toward I want it to be unique and special \- it should be personalized and customizable \* Reviewed

### **3.2 — Themes (the worlds)**

**What it is:** the preset moods you can dress the app in; each is a *biome with its own light*, not just a hue swap. Per-module/page/tool theming is allowed. **Proposal (edit the roster — keep ✓ / cut ✗ / rename):**

| Theme | Mood | Particles (default) | Keep? |
| ----- | ----- | ----- | ----- |
| Flower (day) | dawn cherry-garden, pinks gradients | petals, pollen | ✎ |
| Cosmos (night) | galaxy violet/indigo gradients | stars, comets, fireflies | ✎ |
| Forest | lush hazy/deep green gradients | leaves, fireflies | ✎ |
| Ocean | reef blues/teal gradients | bubbles, fish | ✎ |
| Sunset | Violet→amber gradient | fireflies, embers | ✎ |
| Autumn | rust & ochre gradients | autumn leaves | ✎ |
| Solar System | deep space \+ planets | stars, comets | ✎ |

**Your call:** ✎ Themes to add: Scarlet theme \- We have a lot of colors but no red. This should be a deep and beautiful red color · ❓ Custom-theme creator (color wheel, save/name/edit/delete) at launch or later? ✎ At launch \* Reviewed

### **3.3 — Atmospheres**

**What it is:** the big reactive background effect that brings a theme alive (behind everything). One slider controls each. **Proposal (keep/cut/edit):** ✦

* Day/Night cycle — sun & moon revolve a pivot; sky brightens/darkens. Slider \= speed (timelapse). ✎  
* Constellations — real-looking twinkling stars that connect & slowly drift; rotating set. Slider \= drift speed. ✎  
* Sunset / Sunrise — a large sun; slider \= position top↔bottom with realistic color shift. ✎  
* Waves — natural ocean waves filling the screen; slider \= size/strength. ✎  
* X \- Remove Mountain range — layered peaks/waterfalls/trees; slider \= variation. ✎  
* X \- Remove Forest — depth of trees; slider \= density/types. ✎  
* Solar System — sun & orbiting planets; slider \= orbit speed. ✎

**Your call:** ✎ Add/cut atmospheres:Remove Mountain range and Forest. · Each atmosphere off by default (opt-in)? \* Reviewed

### **3.4 — Particles**

**What it is:** the small drifting effects (background \+ pointer/screen). Pick from presets or build custom; each fully adjustable. **Proposal — properties per particle:** ✦ shape (emoji / character(s)  / image / preset), **angle** (consistent tilt), behavior, speed, count, size \+ size-variation, spawn box (how high/low, how left/right, how wide). With **numbers shown**, not just sliders. **Behaviors:** ✦ Fall · Float · Move Left · Move Right · **Swim** (fish-like wander) · Diagonal (adjustable angle) · Drift · Twinkle (fast, sparkly) · Glow · Grow/Shrink (gentle) · Pop · Bounce. **Preset particles (keep/cut/edit):** ✦ Petals (cherry/leaf, gradient) · Autumn leaves · Green leaves · Hearts (bigger, fewer, upright, rising) · Stars (subtle move, strong twinkle) · Shooting stars (small, fast, steep angle) · Comets (bigger, long trail) · Bubbles (bigger, fewer, pop randomly) · **Fireflies** (strong glow, gradient colors) · Tech (1s/0s or green streaks) · Smoke wisps · Custom. *(Snow/Rain/Wind/Fire moved to Weather. Dust motes & dandelion cut.)* **Your call:** ✎ Particles to add: Add more later· Pointer & screen particles share the same picker (Pointer should follow the mouse/finger \- I know the particle trail didn’t work on mobile). ·  All particles optional/off-by-default \* Reviewed

### **3.5 — Weather / screen effects  \>\> NO longer weather / screen effects, under Atmosphere as interactive atmospheres.**

**What it is:** effects that touch the *screen and tools* (in front), not just the background. Immersive, never in the way; can be disabled. **Proposal (keep/cut/edit):** ✦

* Snow — falls \+ frost on screen edges \+ icicles grow on top; tap an icicle to drop it. Slider \= icicle speed.  
* Rain — falls \+ droplets accumulate on screen; tap to run them down. Slider \= saturation speed.  
* Clouds — drift across top of screen; tap to pop into smaller clouds. Slider \= cloud type (soft↔stormy).  
* Wind — streaks across screen \+ a gentle cozy wobble on tools. Slider \= speed/wobble.  
* X \- Remove Fire — cozy fire at the bottom with sparks; s'mores cook around it; tap to eat (a new one appears). Slider \= size/cook speed.  
* Fireflies \- Interactive fireflies that glow when you tap them.  
* Pufferfish \- Interactive pufferfish that grow when you tap them  
* Meteors \- Interactive Meteors that explode when you tap them

**Your call:** ✎ Add/cut weather:Remove Fire. also Merge weather with Atmosphere, it should all be under the same section.  Confirm "weather must never interfere with use" Also add back Fireflies, they were really fun \* Pufferfish, Meteors, etc. Also for interactive effects it’d be cool to have “minigames” involved, like a counter for tapped fireflies being a counter on how many you’ve captured, etc.. \* Reviewed 

### **3.6 — UI components & materials (the not-a-box rule)**

**What it is:** how tools/cards/buttons actually look. **Proposal:** ✦ Cards are **tactile objects**: a *material* (soft paper / frosted glass / warm slate / soil) with faint grain, 18–22px rounded (sometimes one different corner), soft shadow \+ a hair of top-light, **translucent so the world shows through (opacity adjustable)**. Icon chips \= rounded squircles with custom icons. Pills for buttons with a soft press. FAB \= a blooming flower. Type \= friendly humanist sans \+ a soft serif for journal/quotes; two weights; sentence case; warm microcopy. **Custom icon set; emoji only as your chosen accent.** **Your call:** ☐ Approve translucent crafted cards · ❓ Default card opacity (so background shows but text stays readable): ✎ \_\_\_% · ✎ Icon style preference (line / duotone / filled): \_\_\_\_\_\_  \>\> The texture Idea sounds nice but at the same time I’d worry it’d make things look weird, we can try but remove if needed. We can also try custom designs for the outlines, I will help design. \* Reviewed

### **3.7 — Motion & the Liveliness dial**

**What it is:** how much the world moves. **Proposal:** ✦ Always something *gently* moving (companion breath, drifting particles, swaying scenery, parallax). One **Liveliness dial**: Still / Gentle / Lively, plus full respect for the OS "reduce motion" setting. **Your call:** ❓ Default level — Still / **Gentle** / Lively? ✎ Gentle, Also I love the idea of movement, It’d be cool for things to have animations / movement when interacted with, maybe tools could grow slightly bigger when hovered over, etc I love the idea that the app and environment feel alive and cozy all at the same time.. \* Reviewed

### **3.8 — Earned delight**

**What it is:** the little payoffs for doing things. **Proposal:** ✦ Completing something blooms a small *earned* moment — a petal-burst, a firefly, a coin drop, the creature reacts, a soft chime — varied, never repeated back-to-back, never unearned, never confetti-spam. **Your call:**  Approve · ✎ A signature "completion" moment you'd love: I really like this, I think this would bring a lot of life to completing things.  \* Reviewed

### **3.9 — The two feel-rules (guardrails)**

**What it is:** the checks that keep it cozy *and* alive. **How it works:** ✅ **Cozy** keeps the controls calm/quiet; **Breathe-life** keeps the world rich/alive. Rule of thumb: *lavish with the world, frugal with the controls.* Anti-slop list: no flat fills, no placeless UI, no tinted default components, no characterless gray grids, no lifeless screens. **Your call:** Noted \* Reviewed

---

# **FLOOR 4 — THE HEART (your elemental companion)**

*The most important and most open floor — this is the part that's uniquely yours and ties to your book. Everything here is draft; shape it freely.*

### **4.1 — The companion concept**

**What it is:** the creature that makes the app *yours*. **Proposal:** ✦ A **soul-bonded elemental creature** living on its own page. A quiz reveals your **element** (fixed forever \- Subscriptions can edit theirs.); you choose a **physical form** each level, up until a certain level then remains permanent.(swappable at each level, capped and permanent at certain level \- after can be changed with Subscription) themed by that element. It **visibly grows** as you live. Later scales to **Pantheons** (Floor 10). **Your call:** Approve the concept · ✎ Name for the creature category in-app (e.g., "companion", "spirit", "kin"): Call them Liri (Lie \- ree or Ly rie) \- This name can change and probably will \* Reviewed

### **4.2 — The element quiz**

**What it is:** how a person discovers their element. **Proposal:** ✦ A gentle, skippable quiz inspired by 16personalities' four axes (Mind I/E · Energy N/S · Nature T/F · Tactics J/P). Draft base mapping:

| Personality group | Base element (draft) |
| ----- | ----- |
| Analysts (N+T) | Air |
| Diplomats (N+F) | Water |
| Sentinels (S+J) | Earth |
| Explorers (S+P) | Fire |

Remaining axes refine to a **sub-element**; split answers → a **blend**. Element is identity, never a gate. **Your call:** ❓ Keep the 4 base elements as Fire/Water/Earth/Air? ✎ \_\_\_\_\_\_ · ❓ Is the role-group→element mapping right? ✎ Swap Fire & Air (I swapped already) Air should be Analysts, Fire should be Explorers.· ❓ Can element be re-discovered later, or fixed for good? ✎ The main Element will be fixed Unless user has subscription, though the Sub elements change as the user levels. What sub element is chosen depends on what aspect gets leveled the most \- at a certain level the sub element locks \- can be changed with subscription. · ❓ Quiz length (5? 12? 16 questions)? ✎ 15 questions \- 1/4th of what 16personalities does. ☐ Reviewed

### **4.3 — Elements & sub-elements roster**

**What it is:** the full menu of elements (you author this). **Proposal (draft — edit/expand heavily):** ✦

* Water → Ice · Snow · Cloud · Mist  
* Fire → Lightning · Lava · Ash · Light  
* Earth → Metal · Wood · Crystal · Clay  
* Air → Wind · Storm · Sound · Aurora  
* Blends (examples) → Steam (Fire+Water) · Magma (Earth+Fire) · Frost (Air+Water)

**Your call:** ✎ Your real element list (this is yours to define — add as many as you like): \_\_\_\_\_\_ \* Reviewed

### **4.4 — Creature forms**

**What it is:** the physical shapes a companion can take (element fills them). **Proposal:** ✦ Hybrid animals you design; element is fixed, **form is swappable**; new forms unlock over time. Draft ideas: flying fox · dragon-cat · dog-narwhal · elephant-wolf · combos. **Your call:** ✎ Forms you want to start with: Flying Fox, Dragon Cat, Dog Narwhal, Elephant wolf, Porcupine Squirrel· ❓ How are new forms unlocked (level? coins? milestones?): ✎ New forms are unlocked through levels and milestones. \* Reviewed

### **4.5 — Aspect-driven growth**

**What it is:** how living your life changes the creature. **Proposal (draft):** ✦

| Aspect (fed by) | Changes the creature's… |
| ----- | ----- |
| Physical (Exercise) | **size & strength** |
| Mental (Study) | **abilities** — streak-savers, \+XP helpers, focus boosts |
| Emotional (Breathing) | **element colors \>\> Unlocks backgrounds** |
| Social (Connection) | **beauty / adornment \>\> Unlocks outfits** |

Only **Mental** grants mechanical perks (kept earned, never pay-to-win). **Your call:** ❓ Approve these four mappings? ✎ \_\_\_\_\_\_ · ✎ Example abilities you'd want from Mental: \_\_\_\_\_\_ \* Reviewed

I want there to be a Duck life style game with the users Liri, The Aspects affect how well the Liri performs with those stats. Ex: Your liri would go faster in a race or swimming competition with higher strength. Your Liri can have more friends with Social, Emotional allows your Liri to focus more, Mental allows your liri to know more, etc. This Duck life style game is a rough draft and will need a bigger and better framework with more details.

### **4.6 — The Companion page**

**What it is:** the creature's dedicated screen. **Proposal:** ✦ A vignette of your creature (its own little scene \+ element aura), name/element/form/level, "how you've shaped them" (the 4 aspects), unlocked abilities, change-form, pet/feed. *Not* shown on other pages. **Your call:** ✎ What else belongs on this page (mood? a journal of milestones? a "bond level"?): definitely have a tracker for mood, a journal & milestones. Bond level would be perfect \- can be affected by how well you care for your Liri as well as how you upgrade. The more you tend your liri (stick to streaks / tasks / habits), the more you care for your Liri (feed using food bought with coins earned from quests & milestones), played with, etc. \* Reviewed

### **4.7 — The four aspects (and their sub-skills)**

**What it is:** the dimensions of growth the flower-graph shows. **Proposal (from the original Blossom):** ✦

\>\> I sent a large list earlier that displays the Aspect, Attribute, & Skills that they will be broken into.

* **Physical** → Strength · Conditioning · Mobility · Nutrition · Sleep · Health  
* **Mental** → Focus · Learning · Creativity · Discipline · Wisdom  
* **Emotional** → Awareness · Regulation · Resilience · Expression · Self-Compassion · Positive Emotion  
* **Social** → Communication · Relationships · Social Confidence · Conflict Resolution · Leadership · Community

**Your call:** ✎ Edit the sub-skills per aspect: Edit the four aspects and sub-skills to match the 5 aspects, attributes, and skills mentioned earlier. (Physical, Mental, Emotional, Social, Recreation). · ❓ Show sub-skills as buds on the flower-graph? ✎ Show the aspect as a flower, the attribute as a petal, and the skills as stars. (similar to the first blossom app I made \- should be “The Blossom” File. As aspect levels the flower becomes more colorful, as attributes level their petal grows, as skill levels their star glows more. \* Reviewed

---

# **FLOOR 5 — METHOD & GAME (how growth actually works)**

### **5.1 — The COSMOS method**

**What it is:** the habit/goal system at the app's core (built on Atomic Habits \+ more). **How it works:** ✦ **C**larify (purpose \+ measurable goal) · **O**rient (time, place, emotion) · **S**tack (anchor onto an existing habit) · **M**otivate (add reward, remove friction) · **O**bserve (MVV → standard → stretch; milestones) · **S**tudy (reflect & renew). Trigger formula: *"After I \[anchor\] at \[time/place\], I'll \[tiny→standard action\]. Then I'll \[reward\]."* Plus the "3-2-1 Bloom Start" and a gentle scoring rubric. **Your call:** ☐ Keep COSMOS as the method · ✎ Anything to add/simplify: I want a method for creating good habits and breaking bad habits \- also add options to break it down or break the habit into easy to follow steps to make them less overwhelming \- also make sure when creating the habit with the Cosmos method in the first place it isn’t overwhelming. \* Reviewed

### **5.2 — XP, levels & streaks**

**What it is:** the progress mechanics. **Proposal:** ✦ Tools/aspects gain XP from real actions; levels rise with growing caps (level infinitely). Streaks for repeated quests/habits, softened by Market items (below). **Your call:** ❓ Should levels be uncapped (original) or have soft tiers? ✎ Should be uncapped and level infinite, but there can be tiers as you level up to a certain point. 1000 being the max tier with large increments only getting bigger the higher you go \* Reviewed

### **5.3 — Coins & the Market (rewards)**

**What it is:** the in-app reward economy. **Proposal (from the original):** ✦ Earn coins by completing things; 4 tiers — Copper · Silver · Gold · Platinum (10:1 each). Spend at the Market on rewards: small quest-skip (copper), full quest-skip (silver), streak-restore (gold), streak-freeze up to 7 days (platinum). **Your call:** ✎ Edit the rewards / add your own: Liri food, Liri toys, Liri clothes, etc.· ❓ Keep the 4-coin system or simplify to one currency? ✎ Keep currency \* Reviewed

### **5.4 — Quests, Habits, Goals, Routines**

**What it is:** the task family that drives everything. **Proposal:** ✦

* **Quest** — a task (one-off or repeating daily/weekly/custom), with counts, times, streak, difficulty→coins.  
* **Habit** — a COSMOS-built quest; can nest tasks/reminders/to-dos inside.  
* **Goal** — long/short-term; made of quests \+ habits; shows % to completion.  
* **Routine** — a repeating set of habits/quests at chosen times.  
* All editable **directly from the tool** (no digging into settings). **Your call:**  Approve the family · ✎ Anything missing (e.g., a simple to-do)?  \* Reviewed

# **FLOOR 6 — THE MODULES (each room)**

*For each module: its purpose, its pages, its signature tools, and which aspect it feeds. The first five are the launch set.*

### 

### **Help me remake all the modules from scratch to better fit their needs and intended purposes, including a module for My Blossom, Productivity, Activity, Meditation, Connection, & Recreation. Each module should be clean, organized, detailed, useful, and cozy.**

**My Blossom: My Blossom should be the main hub that connects the Productivity, Activity, Meditation, Connection, & Recreation modules together. It should have the main home, overview, & habit/quest/tasks \- it’ll all connect with all the aspects. My Blossom module should also have the Liri companion and all it has to offer, etc.**

**Productivity: Productivity module should include any resources, tools, or important things to help the user be productive, it should Target the Mental aspect, its Attributes, and its Skills. Should be the perfect and ultimate tool for learning. (We had a lot of previous widgets that could work, but also a lot that won’t do anything \- Tools should and will be created to be implemented better. Productivity tab should act as a hub for all things Mental \- maybe it’s studying some class material (Material can be provided with max plan aka the guides/databasses \- perfect for learning, maybe tutorials for math like algebra or calculus, guides can be added later) It could be used to learn a new skill, improve off of Mental habits, etc. Please overhaul this and improve the Productivity Module and all of it’s pages and tools. )**

### **Activity: Activity module should include any resources, tools, or important things to help the user be active. It should target the Physical aspect, its Attributes, and its Skills. Should be the perfect and ultimate tool for physical activities, tracking exercises, etc. (Previous tools can be used, more will be needed.) I would like it to have a visual and interactive display of the human body and its muscle groups. One the user can tap into and track their exercises, measurements, etc. I also want lots of guides and databases that can be used to help the user (with max plan) track exercises, guide them through exercises, etc. It should have a meal planner, etc.**

**Similar to Productivity & Activity \-  Meditation, Connection, & Recreation will also need to be perfect for their corresponding aspect Emotion, Social, & Entertainment. They should be perfect for all the needs the user may have for that Aspect with their Attributes, & skills within.**

### **6.1 — The Blossom (the hub) ✅**

**Feeds:** the overview of all four aspects. **Pages:** ✦ **Home** (greeting, flower-graph, aspect levels, today's quests/habits, trackers) · **Companion** (the creature page, Floor 4.6) · **Calendar** (month/week/day; quests, habits, routines). **Signature tools:** Flower-graph, Skill/aspect tools, Quest/Habit/Goal, Journal, Tracker, Market. **Your call:** ✎ Pages to add/cut: \_\_\_\_\_\_ · ❓ Is the flower-graph the centerpiece of Home or of Companion? ✎ \_\_\_\_\_\_ ☐ Reviewed

### **6.2 — Study → Mental ✦**

**Purpose:** notes, flashcards, quizzes, study tracking. **Pages:** ✦ Notes · Overview · Study. **Signature tools:** **Notebook** (Class › Unit › Topic; key-term / theme / concept / idea / comment highlights with term·definition·details·examples) · **Flashcards** (decks generated from notebooks; custom front/back; smart order; study sets) · **Quiz** (multiple-choice / true-false / fill-blank / dropdown / ordering; saved by date; struggle tracking) · **Study Notes** (auto-collected terms) · **Library** (grouped docs) · **Graph** · **Overview** dashboard · **Study Guide** (struggle-based). **Your call:** ✎ Trim/confirm the study toolset: \_\_\_\_\_\_ ☐ Reviewed

### **6.3 — Exercise → Physical ✦ (new module)**

**Purpose:** movement, training, the body. **Pages (proposed):** ✦ Today · Workouts · Stats. **Signature tools:** ✦ Activity rings (move/stretch/strength) · Session builder/logger · Step & sleep trackers · a strength log · graph. **Your call:** ❓ What matters most to you here — guided workouts, simple logging, or health-data import (Apple Health / Google Fit)? ✎ \_\_\_\_\_\_ · ✎ Tools you want: \_\_\_\_\_\_ ☐ Reviewed

### **6.4 — Breathing → Emotional ✦ (new module)**

**Purpose:** breath, calm, emotional balance. **Pages (proposed):** ✦ Breathe · Reflect · Mood. **Signature tools:** ✦ Breathing trainer (box, 4-7-8, custom; animated orb \+ haptics) · Mood tracker · a short guided-calm/meditation timer · gratitude/journal prompt. **Your call:** ✎ Breathing patterns to include: \_\_\_\_\_\_ · ❓ Add ambient sounds? ✎ \_\_\_\_\_\_ ☐ Reviewed

### **6.5 — Connection → Social ✦ (new module)**

**Purpose:** tending the people who matter. **Pages (proposed):** ✦ People · Reach out · Together. **Signature tools:** ✦ People/bonds list (last-contact, reminders to reach out) · message/letter nudges · shared-moment log · a relationship "web." **Your call:** ❓ Solo (private, just helps *you* connect) or eventually social/shared? ✎ \_\_\_\_\_\_ · ✎ Tools you want: \_\_\_\_\_\_ ☐ Reviewed

### **6.6 — Future / library modules (not launch, kept on the shelf)**

**What it is:** the rich modules from the original, available later as presets. **Proposal:** ✦ D\&D / Tabletop (Campaign, Character sheet, Compendium, Dice, Initiative — 5e/Pathfinder/Starfinder) · World Builder (interactive map, lore, civilizations, characters) · Infinite Canvas (infinite-zoom drawing) · Canva-style board · **Blossoms** (the cozy idle/strategy planet game) · Music player (YouTube/Spotify/Apple links) · standalone Calendar · Alarm/Timer/Stopwatch · Calculator/graphing · small games (Snake, Solitaire). **Your call:** ✎ Which of these do you want *soon* vs *someday*? \_\_\_\_\_\_ · ❓ Anything here that should actually be a *launch* module? ✎ \_\_\_\_\_\_ ☐ Reviewed

---

# **FLOOR 7 — TOOLS LIBRARY (every instrument, catalogued)**

*The full menu of tool types. Each is self-contained (Floor 1.2). Mark keep ✓ / cut ✗ / "v1" / "later". Note the original ones too so nothing is lost.*

### **7.1 — Everyday tools**

✦ **Notes** (rich text, nestable) · **Journal** (dated entries, prompts) · **Tracker** (custom items over days/weeks/months; count / measure+units / scale / yes-no; shows % & days) · **Counter** · **Time** · **Calendar** · **Reminder** · **Alarm/Timer/Stopwatch** (profiles, pre/post-alarm) · **Calculator/graphing** · **Music** · **Separator** (group/collapse tools) · **Page tool** (a page inside every tool) · **Hub** (a clean container showing tools inside, with their EXP) · **Overview** (links to a tool's data/page). **Your call:** ✎ keep/cut notes:keep for now

### **7.2 — Growth & gamification tools**

✦ **Skill** (levels from referenced data) · **Characteristic** (a layer above Skills) · **Health** (based on how often nested quests are used) · **Quest** · **Habit** · **Goal** · **Routine** · **Quest Board** (shows today's tasks from nested tools) · **Market** · **Flower-graph** (X-shaped, petals \= aspects in element colors, sub-skills as buds) · **Graph** (line/bar/pie/scatter/radar/area/etc. \+ flower \+ solar-system styles; saves history; pick X/Y dimensions). **Your call:** ✎ keep/cut notes: Cut kinda, It’ll be separated into Aspect \- Attribute \- Skill. Under each Aspect will be a flower graph \- the Attributes will be the Petals and the Skills will be little stars that rotate around the flower. As Attributes level the Petals grow, as Skills level the Stars Glow. The 5 Aspects will be displayed underneath the Liri companion in the Liri page.

### **7.3 — Study tools**

✦ Notebook · Flashcards · Quiz · Study Notes · Library · Study Guide. *(See 6.2.)*

### **7.4 — Creative & tabletop tools (later)**

✦ Infinite Canvas · Canva board · Character Sheet · Compendium · Dice · Initiative · World Map · Lore wiki · Civilization · Characters.

### **7.5 — Game tools (later)**

✦ Blossoms (clicker/idle/strategy side scroller planet/infinite/etc.) · Snake · Solitaire Liri duck life mix.. **Your call (whole floor):** ❓ Which tools are **v1 must-haves**? ✎ Blososm & Liri Life · ✎ Any tool not listed that you want: Liri life: Liri duck life mix \* Reviewed

---

# **FLOOR 8 — ONBOARDING (the first five minutes)**

### **8.1 — First-bonding flow ✦ (highest-stakes moment)**

**What it is:** the very first experience — discovering your element and meeting your creature. **Proposal:** ✦ A short, beautiful sequence: a calm welcome → the element quiz → an element "reveal" → choose your creature's form → it bonds to you (a small ceremony) → it suggests your *first tiny habit* so you finish the first session having *started something real* (not just a tour). **Your call:** ❓ Quiz first then creature, or pick a creature then discover its element? ✎ Quiz first then creature · ✎ The feeling you want this moment to leave: Motivated & Bonded \* Reviewed

### **8.2 — "Help me build" wizards**

**What it is:** gentle guided setup for modules & pages so nobody faces a blank slate. **Proposal:** ✦ When adding a module/page, default to "Help me build": a few cozy, preset-specific questions assemble a tailored, working setup (with a full-preset and a from-scratch option too). **Your call:**  Kinda Approve · ✎ Modules that most need a guided build: So the “help me build” feature won’t be an official feature in the way its been implemented. I wanted it changed and adjusted severely. I want it to be part of the setup guide at the start when a user first downloads the app, It shouldn’t be 1 question / next question / next question. It should be based on categories, 1 page has many questions on the same category \- Could be things the user is looking to do like what areas do you most want to work on (Exercising, Eating habits, Sleeping, maybe for Productivity it’d be learning, studying, etc.. & as the user chooses those custom modules and pages fitting their needs will be set up. \* Reviewed

### **8.3 — Tutorial philosophy**

**What it is:** how much hand-holding. **Proposal:** ✅ Suggest, never force. No mandatory tour. Features are *discovered* where a curious person would look; gentle dismissible hints at most. **Your call:**  Starting tutorial to guide user through picking out what first modules & pages they want as well as getting their first Element & Liri. Guide should show the user everything they can do \- things like settings \- modules \- pages \- tools \- swiping from sides to change module / tapping up top, etc. \* Reviewed

---

# **FLOOR 9 — MONEY & RELEASE**

### **9.1 — Subscription tiers**

**What it is:** how the app earns, "pay only for what you use." **Proposal (your design):** ✦

| Tier | Price | Unlocks |
| ----- | ----- | ----- |
| Free | $0 | Core app \+ default modules & their tools, \+ default themes/atmosphere\&weather combined/particles. |
| Daisy / Designer | $3/mo | All visuals (themes/atmospheres/particles/weather) \+ custom visual creators |
| Lotus / Manager | $7/mo | Create/edit custom modules; access to all modules and module presets, not just the default modules. |
| Cosmos / Max | $15/mo | Daisy \+ Lotus \+ all guides (learning content, rulebooks) \- Learning content / rulebooks / guides are deep information that the user can use for anything (Cooking tutorials with recipes, Every exercise to exercise every muscle, Every subject with their specific details \- Math/Algebra/Calculus would be taught and could be learned from) |

Monthly / quarterly / yearly per paid tier. Store billing on mobile (RevenueCat), Stripe on web. Paywall is calm and appears where a locked feature naturally is — never a launch nag. **Your call:** ✎ Adjust prices/names/contents:No paywall, the additional things just wont appear in the first palace. Daisy Tier / Lotus Tier / Cosmos Tier. Also Subscription will only appear in the settings tab near the bottom. Users can select to have a free 7 day trial of the Cosmos tier. If free plan only show free uses. After Free trial ends it’ll save what the user did, but it’ll add them to a separate subscription section they have to pay to get back. If made themes they go back to default themes. If adjusted current module or created new custom module, creates copy of all data but reverts back to previous layout, if user used guides/data, they go back to being behind paywall.· ❓ Is the companion/element system Free (recommended, it's the hook) or gated? ✎ Companion is absolutely free, although being able to change element & then companion after level cap will require cosmos tier. \* Reviewed

### **9.2 — Donations**

**What it is:** optional support. **Proposal:** ✦ A one-time "tip jar" (e.g., "Water the garden — $2") via RevenueCat (mobile) / Stripe or Ko-fi (web). **Your call:**  Include a tip jar · ✎ Wording/amounts: No tip jar, if they want to support they’d pay for subscription even if its the lowest $3 tier \* Reviewed

### **9.3 — Release path (summary)**

**What it is:** the road from your machine to the stores (full detail in `docs/02`). **Proposal:** ✅ Build with Expo/EAS → test on your phone & internal tracks → Google Play ($25 once) first → App Store ($99/yr) when ready → web on Vercel/Netlify. Updates via store releases \+ instant JS-only OTA updates. *(Current 2026 facts verified.)* **Your call:** Android-first launch confirmed · ❓ iOS \+ web at launch or later? ✎ IOS later, web now for testing, Web official later \* Reviewed

### **9.4 — Legal & privacy**

**What it is:** the must-dos before publishing. **Proposal:** ✅ Privacy Policy \+ Terms (generated, hosted, linked) · in-app account/data deletion · honest store data-safety forms · Supabase RLS on · no keys in the repo. Market position: **privacy-first — your garden is yours.** **Your call:** Approve privacy-first positioning \* Reviewed

---

# **FLOOR 10 — THE FUTURE (the rooftop — room to grow)**

*Not v1. Captured so we build in a way that leaves the door open. All exploratory.*

### **10.1 — Pantheons**

**Proposal:** ✦ Great, powerful elemental creatures that preside over regions/cities and **draw on their people's strength**; bigger cities → bigger pantheons. A natural future community layer. **Your call:** ✎ How you imagine pantheons working in-app: Only an idea, don’t add yet

### **10.2 — Your book-world & nations**

**Proposal:** ✦ Pull your book's canon in: choose a **nation**, a starting pantheon, lore, cosmetics — making the app a living companion to the story. **Your call:** ✎ What from your book you'd most want first: only an idea, don't add yet.

### **10.3 — Community (optional, private-by-default)**

**Proposal:** ✦ Optional accountability/sharing (show a friend your garden), opt-in, never required. **Your call:** ❓ Do you want any social features at all, or keep it personal? ✎ Maybe a friends list so users can add and invite friends (inviting people can count towards time with designer subscription perks?) Having a friend allows you to show them your Liri & play Liri games with them? Nothing that could expose or show private/personal information. Users will probably have journals / diaries with things they don’t want seen. Nothing that can be harmful will be shared. Only basic information like Liri, aspect levels, etc.

### **10.4 — Research-backed ideas (from the market study)**

**Proposal:** ✦ Cross-domain insights (habit→task→mood→sleep correlations — the gap no competitor fills) · a gentle AI "gardener" companion · wearable/health import · natural-language quick-add · template/Blossom-code sharing. **Your call:** ✎ Which of these excite you (rank or note): All of those interest me, anything that’s been researched from the market I’d love to implement, especially if it’ll help the user. I especially like the wearable/health import. I’d like as many connections as I can get \- Connecting google calendar to calendar \- Connecting the health to a health app on phone, etc. \* Reviewed (whole floor)

---

# **FLOOR 11 — HOW WE BUILD (the crew & the rules)**

*This is for me, but you should know it exists — it's why building stays cheap, cozy, and consistent.*

### **11.1 — The five always-on jobs**

**Proposal:** ✅ (1) Overhaul each request into a tiny plan \>\> Each request should be turned into a tiny plan, but also be improved upon in anyway that’d make the app better · (2) Spend tokens like coins · (3) Build cozy · (4) Track progress \+ auto-push to GitHub · (5) Finish to a Definition of Done. **Your call:**  Noted

### **11.2 — The skills (auto-firing helpers)**

**Proposal:** ✅ `overhaul-the-ask` · `cozy-check` · `breathe-life` · `grill-me` · `usage-check` · `ship-it` · `cloud-sync` · `monetize` · `release-it` · `learn-from-the-field`. **Your call:**  Noted · ✎ A rule you want me to *always* follow: Clean files, Take notes on what works and doesn’t, organize things in a way that are easy to build off, \- if I want to adjust something, edit something, remove/add it’ll be extremely easy to integrate it into the system.

### **11.3 — Build order (M0 → M7)**

**Proposal:** ✅ M0 skeleton → M1 local storage → M2 first tools → M3 theming+FX → M4 accounts+sync → M5 more tools → M6 native (widgets/alarms) → M7 money+release. Ship a focused MVP before M5 finishes. **Your call:** ❓ Your dream **MVP** (the smallest version you'd actually use daily): ✎ Definitely build bottom up, It should be functional and useful \- although The Productivity / Activity modules to be prioritized over Connection, Entertainment, and Meditation. \* Reviewed

### **11.4 — Definition of Done**

**Proposal:** ✅ A feature ships only when it's spec-honored, cozy, safe (no data loss), offline, 60fps, responsive at 360px, clean, verified on a device, and logged+pushed. **Your call:** Noted

---

# **APPENDIX A — Master list of open decisions (❓)**

*Every fork in one place. Answer here or in-line above — your call.*

1. ❓ Call them "Tools" or "Widgets"? (1.1) \>\> Tools \- Widgets are home screen tools  
2. ❓ Are the 4 aspects \+ module→aspect mapping right? Any dual-aspect modules? (1.3, 6.x) \>\> 5 aspects with Attributes & Skills within.  
3. ❓ Dock vs top rail; Companion as a page vs its own dock item? (1.4) \>\>Companion as both a page & dock item (I think I understood this right).  
4. ❓ Supabase confirmed; sign-in options (email/Google/Apple)? (2.1, 2.3) \>\> Supabase with Email & Google  
5. ❓ Start anonymous then upgrade? (2.3) \>\> Yes, start anonymous but be prompted to sign in through google.  
6. ❓ Custom theme creator at launch or later? (3.2) \>\> At launch \- but only access to Designer / max plans.  
7. ❓ Default card opacity %, icon style? (3.6) \>\> Card opacity lower % but not too low, Icon style whatever works and is cozy/comfortable.  
8. ❓ Default Liveliness level? (3.7) \>\> Feel alive and immersive.  
9. ❓ Base elements Fire/Water/Earth/Air? Role→element mapping? Re-discoverable? Quiz length? (4.2)   
10. ❓ Your real element & sub-element roster. (4.3)  
11. ❓ How new creature forms unlock. (4.4) \>\> can swap between creatures up to a certain level & then stays that same creature. Can be changed with subscription.  
12. ❓ Approve the four aspect→creature-growth mappings; example Mental abilities. (4.5) \>\> 5 aspects, mapping, & abilities to be worked on \- implement duck life style game for Liri. “Liri Life” cozy care for your Liri.  
13. ❓ What else lives on the Companion page. (4.6) \>\> Liri life, options to buy Liri food, clothes, play games, etc.  
14. ❓ Sub-skills per aspect; show as flower buds? (4.7) \>\> Aspect shows as flower under aspect page, Attribute shows as petals for that aspect, & Skills show as stars.  
15. ❓ Uncapped levels vs soft tiers. (5.2) \>\> Uncapped & Tiers. Tiers up to 1000, (Small gaps on low tiers but gets very high between higher tiers)  
16. ❓ Keep 4-coin economy or simplify. (5.3) \>\> 4 coin but maybe change later? Certain things should offer better rewards for sure.  
17. ❓ Flower-graph centerpiece of Home or Companion? (6.1) \>\> Home Companion, Flower graph will be displayed under the Aspect page (Also create a radar graph for the Companion to display the Companions level in each Aspect.)  
18. ❓ Exercise focus (workouts / logging / health import)? (6.3) \>\> yes & more  
19. ❓ Breathing: ambient sounds? patterns? (6.4) \>\> yes & more  
20. ❓ Connection: solo vs social? (6.5) \>\> Yes & more  
21. ❓ Which future modules are "soon" vs "someday"; any that should be launch? (6.6)  
22. ❓ Which tools are v1 must-haves? (7)  
23. ❓ First-bonding order: quiz→creature or creature→element; the feeling to leave. (8.1) \>\> Quiz then creature  
24. ❓ Tier prices/names/contents; is the companion Free? (9.1) \>\> Companion free  
25. ❓ iOS \+ web at launch or later? (9.3) \>\> Web for testing, IOS & Web later.  
26. ❓ Any social features, ever? (10.3) \>\> Yes, friends list, limited sharing must keep privacy and security priority.  
27. ❓ Which research-backed ideas excite you. (10.4)  
28. ❓ Your dream MVP. (11.3)

# **APPENDIX B — Glossary**

* **Workspace / Module / Page / Tool / Object** — the five nesting levels (1.1).  
* **Aspect** — Physical / Mental / Emotional / Social; what modules feed and the flower-graph shows.  
* **The Blossom loop** — every module feeds an aspect → grows your creature.  
* **Companion / creature** — your soul-bonded elemental being.  
* **Element / sub-element** — your fixed elemental nature (e.g., Water → Mist).  
* **Form** — the creature's swappable physical shape.  
* **COSMOS** — the habit/goal method (Clarify·Orient·Stack·Motivate·Observe·Study).  
* **Blossom code** — a copy/paste code to save or share any object/tool/page/module.  
* **Atmosphere / Particles / Weather** — background effect / drifting bits / screen-touching effects.  
* **Liveliness dial** — global motion setting (Still/Gentle/Lively).  
* **Pantheon** — a great regional creature (future).

---

*End of staircase. When you've climbed it — edits made, blanks filled, ❓ answered, boxes ticked — send it back and I'll turn it into the finished, built framework.*

