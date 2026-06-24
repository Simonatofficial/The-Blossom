# 05 — The Elemental Companion & Element System (draft, evolving)

The heart of My Blossom: a **soul-bonded elemental creature** that lives on your Blossom and visibly grows as you do. This is the emotional core that ties the whole app together — and it connects to Simon's book world. **This doc is intentionally a draft** with open questions throughout; treat the specifics as proposals to refine via `grill-me`, not settled law. The *system shape* is firm; the *exact content* (elements, forms, mappings) is Simon's to author.

> Why it matters: the market research is blunt that personalization + a reason to return drive retention (`docs/research/market-research.md`). A creature that is *uniquely yours*, discovered through a quiz and grown through real life, is that reason — and nothing else on the market does it this way.

---

## 1. The one-paragraph concept

You take a short personality quiz; it reveals your **element** (fixed forever — your elemental nature). You then choose a **physical form** for your companion (swappable any time) which gets "filled in" with your element's theme. The creature lives on **The Blossom** (the home page) beside your four life-aspects. As you live — studying, exercising, breathing, connecting — the matching aspect levels up, and **your creature visibly changes**: bigger, more capable, richer-colored, more beautiful. Every module pours back into the Blossom and into the creature. Later, the world scales up to **Pantheons** (great creatures over cities) drawn from your book.

---

## 2. Element discovery (the quiz)

A gentle, skippable quiz inspired by the 16personalities model (the four axes: Mind I/E, Energy N/S, Nature T/F, Tactics J/P, plus Identity A/T). The quiz does double duty: it **reveals your element** and **seeds your starting aspects/preferences**.

**Draft mapping (NOT official — a starting point):** map the four role-groups to four base elements, then refine to a sub-element from the remaining axes; blended answers yield a blended element.

| 16P role-group | Base element (draft) | Feel |
|---|---|---|
| Analysts (N+T) | **Air** (LOCKED) | clarity, freedom, the mind in motion |
| Diplomats (N+F) | **Water** (LOCKED) | empathy, depth, flow |
| Sentinels (S+J) | **Earth** (LOCKED) | stability, structure, patience |
| Explorers (S+P) | **Fire** (LOCKED) | drive, spontaneity, transformation |

**Sub-elements (draft examples — there can be many more than 16):**
- Water → Ice · Snow · Cloud · Mist
- Fire → Lightning · Lava · Ash · Light
- Earth → Metal · Wood · Crystal · Clay
- Air → Wind · Storm · Sound · Aurora

**Blends:** split answers lean toward a mix (e.g. Fire+Water → Steam; Earth+Fire → Magma; Air+Water → Frost). The quiz can output a primary + secondary lean rather than one rigid label. Element is **identity, never a gate** — no element is "better," and nothing in the app is locked behind one.

> Open questions: exact axis→sub-element rules; how blends resolve; whether the user can re-take the quiz (proposal: element is fixed once chosen to keep it meaningful, but a "re-discover" is allowed with a gentle ceremony). Decide via `grill-me`.

---

## 3. The creature: fixed element, swappable form

- **Elemental form is fixed** — your element never changes (it's who you are).
- **Physical form is chosen and swappable** — hybrid animals authored by Simon, themed by your element. Draft form ideas: flying fox, dragon-cat, dog-narwhal, elephant-wolf, and combinations. New forms can be unlocked/earned over time.
- **Art pipeline:** Simon designs each creature form as layered art with element-driven layers (palette, aura/particles, material) so one form reads correctly in any element. Forms + element themes are bundled assets (offline, no CDN).

---

## 4. Growth: the four aspects shape your creature

The creature is a *living portrait* of your four life-aspects. As each aspect levels (fed by its module — §5), the creature changes:

| Aspect | Fed mainly by | Creature change (draft) |
|---|---|---|
| **Physical** | Exercise module | strength & **size** — bigger, sturdier, more imposing |
| **Mental** | Study module | **abilities** — unlock utilities: streak-savers, +XP-per-task helpers, focus boosts |
| **Emotional** | Breathing module | **element colors** — palette deepens/shifts with emotional balance |
| **Social** | Connection module | **beauty** — adornments, grace, finer detailing |

So a high-Physical low-Social creature is huge but plain; a high-Social high-Emotional one is radiant and ornate. The creature *tells the story of how you've grown* at a glance. (Mental abilities are the one aspect that grants **mechanical** perks, keeping leveling rewarding without being pay-to-win.)

> Open question: how Mental "abilities" interact with the coin Market / streak systems — design so they feel earned, never mandatory.

---

## 5. The Blossom loop (every module connects back)

**The Blossom** is the hub: your companion + the four-aspect flower-graph + your personal habits/goals. **Every other module feeds an aspect**, which feeds the creature:

```
Study   ─▶ Mental ─┐
Exercise─▶ Physical┤
Breathing▶Emotional├─▶  The Blossom (flower-graph + creature)  ─▶ creature grows
Connection▶Social ─┘
```

- A finished study session raises Mental; a workout raises Physical; a breathing session raises Emotional; tending a relationship raises Social.
- The Blossom page shows the live flower-graph (petals = aspects, in element colors) and the creature reacting to today's gains.
- This is the spine of the whole app: do anything anywhere → your Blossom and creature visibly respond.

---

## 6. Tools are self-contained (lesson from the original app)

The original app tried to make widgets depend on each other and it got buggy. **New rule: every Tool is a complete, standalone instrument.** A Tool *may* read from another (a graph *can* show a tracker's data) but **never depends** on another to function, and nothing breaks if a linked Tool is missing. Connections are optional enrichments, not wiring. (See `docs/01` §4 — the tool plugin contract enforces this.) Tools should feel like *fully-built instruments* (a real notebook, a real breathing trainer), not thin boxes.

---

## 7. Pantheons & the book world (future / exploratory — not v1)

Bigger, world-tier ideas pulled from Simon's book. Captured here so we build v1 in a way that leaves room for them:

- **Pantheons** — great, powerful elemental creatures that preside over regions/cities and **draw on the strength of their people**; bigger cities → bigger pantheons. A natural fit for a future **community layer** (a city's collective progress feeds its pantheon).
- **Nations** — the user could choose a nation from the book; it colors their lore, starting pantheon, cosmetics.
- **Lore integration** — element families, creatures, and pantheons can carry the book's canon, making the app a living companion to the story.

These are **ideas, not commitments.** Keep v1's data model general (elements/creatures/aspects as data) so pantheons/nations can layer on later without a rewrite.

---

## 8. Room for improvement (open, by design)

- Exact personality→element & blend rules (§2).
- Whether/how element can be re-discovered (§2).
- Full roster of elements, sub-elements, and creature forms (Simon authors).
- How Mental abilities plug into Market/streaks (§4).
- Pantheon/community mechanics & whether they're social or solo (§7).
- Onboarding ceremony for bonding with your first creature (this is the highest-stakes "soul" moment — design with `breathe-life`).

> Update this doc as decisions land. Anything built against it should cite the section it implements.

---

## 9. LOCKED decisions (from Simon's design doc — these override drafts above)

- **The companion is called "Liri"** (pron. *Lie-ree* / *Ly-rie*; name may still change). Use "Liri" everywhere in UI and code.
- **Element mapping (locked):** Air = Analysts, Water = Diplomats, Earth = Sentinels, Fire = Explorers. **Quiz = 15 questions** (¼ of 16personalities' length).
- **Main element is fixed** for free/most users; **changeable only with the Cosmos tier**. The **sub-element evolves as you level** — it follows whichever **aspect you level most** — and **locks at a set level** (changeable later only with Cosmos).
- **Forms are swappable each level up to a cap, then permanent** (changeable after the cap only with Cosmos). Starting forms: **Flying Fox · Dragon-Cat · Dog-Narwhal · Elephant-Wolf · Porcupine-Squirrel.** New forms unlock via **levels & milestones.**
- **Aspect → Liri growth (locked, 5 aspects):** Physical → **size & strength**; Mental → **abilities** (streak-savers, +XP, focus boosts — the only mechanical perks, earned not bought); Emotional → **unlocks backgrounds**; Social → **unlocks outfits**; Recreation → fun/Liri-Life performance. (Growth model & flower/radar rendering: `docs/06`, `docs/04`.)
- **The Liri page** holds: the Liri vignette, the **five aspect-flowers** + a **radar graph** of aspect levels, **Liri Life** (the duck-life-style game), a **bond level** (rises as you tend streaks/tasks, feed with coin-bought food, play, dress), plus **mood tracker · journal · milestones**, and buy **food / toys / clothes** with coins.
- **Liri is visible (subtly) on other pages too** — tucked behind a button, to a side, or roaming — never taking over the screen; its **dedicated page** is where you fully interact, dress, feed, and change it. (It is **both a page and a dock item**.)
- **Liri Life** (duck-life-style care game) is a **v1 must-have**; aspects power the Liri's in-game performance (`docs/06` §6).

---

### One-line summary
*A 15-question quiz reveals your **Liri's** fixed element (Air/Water/Earth/Fire); you pick a swappable form (locking at a cap) themed by it; living your five aspects grows the Liri — size, abilities, backgrounds, outfits — shown as flowers + a radar on its page, where you also play Liri Life, raise its bond, and tend it. Pantheons & the book world wait in the wings.*
