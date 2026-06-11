# 08 — Preset Modules

Preset modules are bundled definition files (`js/presets/modules/`) instantiated with fresh ids. They are made of the same pages/widgets/objects as user creations — presets add **module-specific widget types** where needed (registered like any widget). Heavy modules lazy-load their widget code via dynamic `import()` on first open (still offline-safe — the SW pre-caches everything).

---

## 1. The Blossom (default, pre-installed)

Three pages: **Calendar · Home · Blossom**.

- **Calendar:** the Calendar widget, full-width, aggregating the whole module.
- **Home:** Time widget on top, then Quest/Habit/Routine cluster, Tracker, Journal, Goal, Market, Notifications — the daily driver page. (Users rearrange freely; this is just the starting layout.)
- **Blossom:** the signature page. A large **Flower Graph** (stemless, ×-oriented per docs/05 CR-6) with **four petals** linked to four Skill widgets — **Physical, Mental, Emotional, Social** — each petal's length = that skill's level (normalized), with complex particles around each petal for sub-skills. Below the flower, the four Skill widgets in a 2×2 grid, each containing nested sub-skills:
  - **Physical:** Strength, Conditioning, Mobility & Recovery, Nutrition, Sleep, Health
  - **Mental:** Focus, Learning, Creativity, Discipline, Wisdom
  - **Emotional:** Emotional Awareness, Regulation, Resilience, Expression, Self-Compassion, Positive Emotion
  - **Social:** Communication, Relationships, Social Confidence, Conflict Resolution, Leadership, Community

  Sub-skills start unlinked; onboarding hint cards show how to feed them (link a tracker, nest a quest…). The page is the user's life in bloom — keep it spacious, flower centered, breathing.

---

## 2. Infinite Canvas (art app)

One page (Canvas) + a Gallery page. Built on `canvas-core.js` extended with an **infinite, deep-zoom surface**.

**Architecture — this is the hard part; do it properly:**
- **World model:** strokes/images live in world coordinates as vector data (points + pressure + brush params), stored in a **quadtree** keyed by world-space bounds. The viewport is `{cx, cy, zoom}` with `zoom` stored as a float64 exponent — effectively unbounded zoom in/out (use `scale = 2^zoomLevel`; at extreme depths, re-anchor world origin to the viewport center and offset stored coordinates per *sector* to dodge float precision loss — sectors are 2^20-unit tiles; a stroke's coords are relative to its sector).
- **Rendering:** each frame, query the quadtree for shapes intersecting the viewport at a level-of-detail cutoff (skip strokes smaller than 0.5px on screen). Render visible strokes to a cached offscreen tile pyramid (like a map app): tiles of 512px at each power-of-two zoom band, invalidated when strokes change. Pan/zoom = recompose cached tiles + live-render the active stroke only. 60fps target.
- **Tools:** pen, marker (multiply blend), airbrush, eraser, line/shape tools, lasso-select (move/scale/delete selection), text blocks, image drop-in, eyedropper. Brush size is *world-scaled* by default (zoom in to paint fine detail) with a screen-scaled toggle.
- **Navigation:** pinch/scroll zoom centered on pointer, two-finger/space-drag pan, a minimap toggle, zoom readout ("×0.001 – ×1000+"), bookmarks (save named viewpoints), "fit all" button.
- **Gallery page:** Image widgets of exported snapshots + a bookmarks list.
- **Objects:** the canvas document (chunked into sector objects so saves stay incremental), bookmarks, exports.

---

## 3. D&D Dungeon Master — Campaign Manager

Pages: **Dashboard · Story · World · NPCs · Encounters · Players · Sessions**.

Module-specific widget types: StatBlock, Encounter, InitiativeTracker, LootTable, SessionLog, RelationshipWeb.

- **Dashboard:** Time widget, "Next session" card (date, prep checklist as a Quest widget), recent session recap note, quick Dice widget, campaign-level Notes.
- **Story:** nested Notes for arcs → chapters → scenes; each scene note supports status chips (planned/running/done), links to NPCs/locations/encounters; a **timeline strip** widget (horizontal scroll of dated story beats, in-world calendar supported — custom month/day names).
- **World:** embeds World Builder content (link to a World Builder module, or lightweight local versions of its Map + Lore widgets) — locations, factions, pantheon.
- **NPCs:** a card-grid widget of NPC objects: portrait (image), name, role, location, disposition, voice note ("gravelly, says 'aye'"), secrets (collapsed by default — DM-eyes styling), StatBlock (full 5e-style block: abilities, AC/HP/speeds, traits, actions; system-agnostic freeform mode too), relationship links to other NPCs/PCs. **RelationshipWeb** widget renders linked NPCs as a force-layout node graph on canvas (tap node → NPC card).
- **Encounters:** Encounter objects = name, location, creatures (ref StatBlocks × count), difficulty estimate (computed from party level/size vs CR sum — show as Sprout→Radiant chips, not hard math), treasure (LootTable: weighted random tables, "roll" button), read-aloud text box, tactics notes. **InitiativeTracker** (the live-play widget): add combatants from the encounter + party, auto-roll or manual initiative, big turn order list with HP steppers, conditions chips (poisoned, prone… with round counters), round counter, death-save pips, "next turn" as a giant single tap. Designed for one-handed table use.
- **Players:** PC summary cards (linked to D&D Character module Blossom codes if imported), inspiration tracker, XP/milestone awards log, handouts gallery (Image widget).
- **Sessions:** SessionLog objects — date, attendance checklist, prep notes (pre), recap (post), loot awarded, XP awarded, "what the players don't know yet" section. A "Start session" button pins the Dice + InitiativeTracker into a floating quick-bar for the duration.

---

## 4. D&D Character Manager (player-side)

Pages: **Sheet · Combat · Inventory · Spells · Story**.

Module-specific widgets: CharacterSheet, SpellBook, InventoryLedger, LevelPlanner.

- **Sheet:** the full character: portrait, name/class/level/race/background/alignment; ability scores with auto-derived modifiers, saves, skills (proficiency/expertise toggles compute bonuses); AC/initiative/speed; passive scores. Everything tappable: tap a skill → roll it with the Dice widget (modifier applied), result toast. Edit mode vs play mode toggle (play mode locks structure, exposes only the rollables/steppers).
- **Combat:** HP (current/max/temp steppers), hit dice, death saves, conditions, attacks list (name, to-hit, damage formula — tap to roll), resource pips (rage, ki, sorcery points… user-definable trackers), rest buttons (short/long — auto-restores per rules the user configures).
- **Inventory:** InventoryLedger — items with qty, weight, value, equipped toggle; auto carrying-capacity bar; currency purse (cp/sp/ep/gp/pp — distinct from Blossom coins!); attunement slots (3 pips).
- **Spells:** SpellBook — spell objects (name, level, school, casting time, range, components, duration, full text), filterable by level/prepared; spell-slot pips per level (tap to expend, rest restores); "prepared" count vs limit.
- **Story:** backstory Notes, personality/ideals/bonds/flaws cards, faction reputation trackers, session journal (Journal widget — entries per session), level-up log, **LevelPlanner** (planned choices for future levels).
- A character exports as a single Blossom code → importable by a DM module's Players page.

---

## 5. World Builder (the ultimate one)

Pages: **Atlas · Lore · Civilizations · Characters · Timeline · Pinboard**.

Module-specific widgets: WorldMap, LoreWiki, CivProfile, TimelineWidget, Pinboard.

### Atlas — the interactive map (Inkarnate × Milanote)
- **WorldMap** builds on the Infinite Canvas core (same zoom/sector engine) with map-specific layers:
  1. *Terrain paint* — brush with terrain styles (ocean, coast, plains, forest, mountain, desert, tundra, swamp): each is a textured stamp brush (pre-made seamless pattern fills, theme-tintable).
  2. *Landmass tools* — coastline pen (smoothed closed paths with auto sea-shading), continent/island generator: "stamp a landmass" with size + roughness sliders (procedural blob via midpoint-displaced polygon), then hand-edit vertices.
  3. *Features* — stamp library (mountains, trees, cities, towers, ports… as SVG stamps that scale with zoom band), rivers (tapered stroke tool snapping downhill-ish), region borders (dashed paths with fill tint), labels (curved text along paths, zoom-band visibility: continent names show zoomed out, village names only zoomed in).
  4. *Pins* — the Milanote half: any map point can hold a **pin** linking to a Lore article, Civilization, Character, or free note/image. Pins cluster at low zoom; tap pin → side panel preview → "open" navigates to the linked object.
- Multiple maps per world (overworld, regions, cities, dungeons) with parent/child links ("this city pin opens the city map").

### Lore — LoreWiki
- A wiki of lore articles (rich Notes objects) with **categories** (History, Religion, Magic, Cultures, Creatures, Items, Languages, Cosmology…  user-extendable), tags, and `[[wikilinks]]` — typing `[[` in any notes field across the module opens an article picker and creates a navigable link; backlinks listed on every article. Orphan-article and broken-link lists help gardening.

### Civilizations — CivProfile
- Structured profiles for Kingdom/Empire/City/Village/Tribe: identity (name, banner image, motto), scale & type, government (ruler links → Characters), society (population, classes, culture notes), economy (exports/imports, currency), military, religion (links → Lore), relations matrix (ally/neutral/rival/war chips vs other civs — feeds the RelationshipWeb view), notable locations (links → map pins), history (dated events that auto-feed the Timeline). Sections are collapsible; everything optional — a village can be three fields, an empire can be fifty.

### Characters
- The same card-grid + deep profile as the DM module's NPCs (shared widget code): portrait, essence line, personality (traits/ideals/bonds/flaws), background & history (dated events → Timeline), relationships (→ web view), affiliations (civs, factions), goals/secrets, gallery, freeform notes. Optional StatBlock attachment.

### Timeline
- A horizontal, zoomable timeline (reuse zoom-band thinking) of **eras → events**, auto-collecting dated events from Civilizations, Characters, and Lore plus manual entries. Custom calendars supported (define era names, year lengths, month names). Tap event → source. Filter lanes by category (wars, rulers, discoveries…).

### Pinboard
- A Milanote-style freeform board (infinite canvas, no terrain tools): drag in note cards, images, lore links, character cards; draw connector arrows; group with frames. For brainstorming the world before it's structured.

---

## 6. Study Guide

Pages: **Notes · Flashcards · Quizzes · Library**.

Module-specific widgets: Notebook, FlashcardDeck, Quiz, DocumentShelf.

- **Notes:** Notebook = a two-level organizer (subjects → topics) of rich Notes objects with image/document attachments inline. A "key term" highlight style (toolbar) marks term–definition pairs for the generators below.
- **Library (DocumentShelf):** imported PDFs/images of handouts (Blobs) with a built-in viewer (render PDFs via canvas — embed a minimal, vendored PDF renderer or restrict v1 to images and let PDFs open in a new tab from the Blob URL; decide at build time and note it), tags, and "linked topic" so documents sit beside relevant notes.
- **Flashcards (FlashcardDeck):** decks of card objects (front/back, optional image, optional cloze). **Generate from notes:** scans selected topics for key-term highlights, Q&A patterns, and definition sentences → proposes cards in a review list (user accepts/edits/rejects each — generation is assistive, never silent). Study mode = **spaced repetition** (SM-2 light: again/hard/good/easy buttons, intervals stored per card) with a daily due-count that can link as a value (feeds Skills!). Card flip = soft 3D turn; session ends with a small garden-growth summary.
- **Quizzes (Quiz):** build practice quizzes from decks/topics: multiple choice (distractors drawn from sibling cards' answers), true/false, type-the-answer (fuzzy match), and match-pairs. Configure length, topics, timer (optional, off by default). Results page: score, per-question review, weakest-topics list; results are day-keyed objects → graphable, linkable to Skill widgets (studying literally levels you up).

---

## 7. More preset modules (smaller, included as definitions only)

- **Reading Nook:** book list (cover, status, progress tracker), reading-session timer (Alarm widget pomodoro), quotes notebook, a per-book Flower Graph of genres read.
- **Recipe Box & Meal Planner:** recipe Notes (ingredients checklist + steps), week meal-plan calendar, grocery checklist generated from planned recipes.
- **Budget Garden:** income/expense Counter+Tracker hybrids, category pie graph, savings Goals (the growth-ring seed fits perfectly). *(Display-only math, no financial advice features.)*
- **Music Practice:** instrument Skill tree, metronome (Alarm-core), practice-session quests, recording notes.
- **Fitness Log:** workout Routine widgets, exercise Trackers (weight × reps), body measurements Tracker, progress line graphs, rest-timer.

Each of these is ~1 page of definition JSON — cheap to ship, great for the preset gallery.

## Build decisions - Study Guide (v1)

- DocumentShelf PDFs: no vendored PDF renderer (zero-dependency rule). Images open in the inline lightbox; PDFs open in a new tab from their Blob URL - both fully offline.
- Study widgets load eagerly with the other widget types rather than via dynamic import(): the whole app ships ~70 small SW-cached modules, so lazy-loading bought nothing measurable here. Revisit for the canvas-heavy modules.
- Card generation harvests <mark class="key-term"> "term - definition" pairs and Q:/A: line pairs; free-form definition-sentence mining was deliberately left out (too noisy to be assistive).
