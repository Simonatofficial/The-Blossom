# 16 — Study Overhaul (the immersive, anti-burnout study framework)

> Read this before any Study, Flashcard, or Quiz work. It is the *feel + method*
> spec for studying in The Blossom — the study counterpart to docs/15 (Living
> Layout). The mechanical widget specs stay in docs/05; this doc says how study
> should **feel** (cozy, fun, never a slog) and the **method** that makes it
> easier. Builds here reuse existing engines wherever possible (mastery,
> flower graph, skills, coins) — almost nothing here is new engine code.

## Why this exists

User feedback, verbatim: *"using the Quiz, sometimes I get burnt out or don't
want to continue. It's very repetitive and basic and makes me want to stop
early."* The study system is mechanically complete (decks, 4 quiz types,
mastery, weak-spots, bookmarks, per-part %) but **emotionally flat**. This doc
fixes the feel, not the plumbing.

---

## 1. The metaphor: studying is tending a garden

Reframe the whole loop. You are not "taking tests" — you are **tending a study
garden**. Every subject is a plant; every topic mastered makes it grow and
bloom. This is not decoration: it reuses the app's existing bloom/seed/coin
language so study finally feels like the rest of The Blossom.

**Topic growth stages** map 1:1 onto the mastery buckets we already compute
(`study-mastery.js#level`) — zero new state:

| Mastery bucket | Garden stage | Meaning |
|---|---|---|
| `unseen` | 🌱 **Seed** | not studied yet |
| `weak` | 🌿 **Sprout** | missed recently, needs water |
| `shaky` | 🌷 **Bud** | getting there |
| `solid` | 🌸 **Bloom** | mastered |

Reuse the seed→sprout→bud→bloom art the Goal widget already ships. A Class is a
plant; its Units/Topics are buds on it; mastering them blooms the plant.

---

## 2. The five anti-burnout laws (study-specific Cozy Laws)

These extend framework §3 for the study loop specifically.

1. **Short by default, visible end.** A session has a *finish line you can see* —
   a progress ring, "4 cards left," "1 topic from a Bloom." Burnout comes from an
   open-ended grind. Default session length is small (10–15 items); "Quick 5" is
   a first-class entry for low-energy days.
2. **End on a win.** Order the session so the last 1–2 items are ones you know —
   you leave on success, not on a miss. Never end a session on the hardest card.
3. **Confidence first, weakness woven, never front-loaded.** Warm up with cards
   you know, weave weak cards into the middle, close strong. (See §4 the BLOOM
   method.) Front-loading the hardest cards is what makes people quit.
4. **Variety kills monotony.** A session rotates *presentation* automatically —
   MC, type-in, true/false, reverse (definition→term), tip-reveal, "tap the
   term." The same deck never feels like the same drill twice. This is the single
   biggest fix for "repetitive and basic."
5. **Rest is part of the method, and it whispers.** If accuracy is sliding or a
   session runs long, offer — never force — a break: *"Nice work. Rest your
   petals?"* Stopping early is reframed as a healthy choice, not a failure.

**Gut-check:** *Could a tired person at 11pm start a "Quick 5," feel a small win,
and stop whenever they like without guilt?* If not, soften it.

---

## 3. Earned delight (fun, all opt-in, all cozy-law compliant)

Quiet, earned, dismissible — never confetti-cannon. All scale with the
Liveliness dial (docs/15, `data-liveliness`); at Still they reduce to nothing.

- **Combo glow.** A run of correct answers adds a soft accumulating petal-glow on
  the card; breaking it just fades it — no punishment, no red.
- **Bloom on mastery.** When a topic crosses into Bloom (solid), a quiet bloom
  animation + a small coin payout (reuse docs/07 payouts) fires once.
- **Study streak leaf.** A daily "tended the garden" streak (leaf + number),
  same visual family as Quest/Health streaks. Soft dot, never a nagging badge.
- **Session-end bloom.** The results screen already blooms at ≥70% (`bloomBurst`).
  Extend it with the part breakdown and a single warm line ("Math bloomed today").

---

## 4. The method: the BLOOM study loop (how studying gets *easier*)

A named, repeatable loop the app gently guides you through — the study sibling of
COSMOS (docs/06). It is the "method to make studying easier."

- **B — Browse.** Skim the notebook/terms first to prime (no pressure, no grade).
- **L — Learn.** Flashcards, low-stakes, self-graded. Build familiarity.
- **O — Order.** App sorts what you know vs. don't (mastery buckets) so effort
  goes where it counts — you never waste time on Blooms.
- **O — Output.** Active recall: quiz yourself. Recall, not re-reading, is what
  makes it stick — and it's the part we make *varied* (§2.4).
- **M — Master.** Spaced return to weak spots only (the "Needs work" set we
  already build in `flashcards-focus.js`). Short, repeated, ending on a win.

The app doesn't lecture this — it *embodies* it: a "Study this" smart-start button
runs Browse→Learn→Output→Master automatically for the chosen deck, picking item
order per §2 (confidence-first, weakness-woven, win-ending).

---

## 5. Concrete builds (in recommended order)

Each is small, reuses existing engines, and is independently shippable.

### 5a. Mixed / adaptive session mode  *(biggest anti-burnout win)*
- A new session order option **"Adaptive"** (alongside Shuffled / In order) that
  applies §2: warm-up Blooms → weave weak/shaky → close on a known card.
- A **"Mixed types"** toggle on Quiz: a single session rotates MC / T-F / fill /
  reverse / tip-reveal per question instead of one type throughout. Generation
  already supports all types in `quiz-build.js` — this just varies `q.type`
  per question rather than per session.
- **Files:** `quiz-build.js` (order + per-question type), `quiz.js` (two new
  controls), `flashcards-study.js` (adaptive order reuse).

### 5b. Study Skills Flower (the garden view)  *(requested)*
- A Flower graph where **each Class/subject is a petal**, petal length = that
  subject's recall % (aggregated from mastery, the same math as
  `flashcards-focus.js#weakAreas` but over *all* classes, not just weak ones).
- **Complex particles** per petal = Units/Topics under that Class (the flower
  graph already supports composite sub-sources, docs/05 §Complex particles):
  each bud's brightness/size encodes its mastery stage (Seed→Bloom).
- Reuses `flowergraph.js` + `graph-engine.js` wholesale. The only new code is a
  mastery→petal data adapter (per-Class recall + per-Unit/Topic sub-values).
- Lives as a graph definition on the Study module's **Progress** page; also
  offerable as an "Add Study Skills flower" preset in the graph picker.

### 5c. Quiz Scores graph — time-of-day rebuild  *(requested)*
- **Replace** the day-aggregate bar with a **per-test scatter/line**: X = time of
  day across the 24h period, Y = score %. **Each point is one `quizResult`**,
  plotted at its `createdAt` time-of-day (data already stored — no migration).
  Point size = question count; tap → reopen that result's review.
- Range filter (today / 7d / 30d) still applies; multiple days overlay as faint
  series so you can see *when* of day you test best.
- **Files:** a `quizResult`→points adapter in `graph-data.js`; wire as a new
  graph `kind`/source or a dedicated read-only view in the Quiz internal.

### 5d. Deck-breakdown dropdowns (right/wrong % per scope)  *(requested)*
- A nested, collapsible tree aggregated across all `quizResult.questions` by
  their `context` (Class › Section › Unit › Topic — already on every question):
  expand a Class to see its Sections, each showing **correct/total and %**; drill
  to Unit, then Topic. The deeper you open, the more specific the recall %.
- Reuses the exact tree pattern already in `quiz.js` (`.qz-tree`, caret,
  `scopeExpand`) — read-only, with a % bar per row (the `partPanel` style from
  `quiz-run.js#review`).
- Lives in the Quiz internal "Progress/History" area and/or the Progress page.

### 5e. The Study Guide (struggle-based)  *(requested — as enhanced sets, not a new widget)*
- Per the prior decision (memory: *smart-sets-in-existing-widget, no new Study
  Guide widget*), surface a richer **"Trouble Terms"** experience built from the
  existing `needsWorkCards` set: one launch that blends Learn (flashcard) →
  Output (quiz) → Master for *only* the terms you struggle with, each shown with
  its Tip. This is the Study Guide, delivered as a smart set + a guided run, not
  a new widget type.
- If the user later wants a standalone all-in-one Study Guide widget, revisit —
  but default to sets to avoid widget sprawl.

---

## 6. What was already shipped (don't rebuild)

From the "Study + UX" sprint (v89–v92) — these cover most of the user's older
written notes:

- **Correct/incorrect counts + all-time tally** (v89) — not a lone %.
- **Tip field** (term · definition · details · example · **tip**) end-to-end
  (v90): notebook `Tip:` line → flashcard model → faces → quiz Q/A.
- **Mastery + "what to work on"** (v91): per-card outcome tracking, weak-area
  aggregation up Class→Unit→Topic, smart "Needs work" + per-area sets.
- **Per-part % breakdown** at flashcard + quiz finish (v91, "BY PART").
- **Bookmark/favorite while studying** → dynamic "Bookmarked" set (v92).

So §5 above is the *new* work; the user's note list is otherwise done.

---

## 7. Done-when (per build in §5)

Each §5 build meets the framework Definition of Done (§5 of docs/00): cozy
gut-check passed, offline, 60fps, 360px verified, no console errors, STATUS
updated, committed + pushed. Plus the study-specific check: **does it make a
tired studier more likely to do "just 5 more," and feel fine stopping when they
want?**
