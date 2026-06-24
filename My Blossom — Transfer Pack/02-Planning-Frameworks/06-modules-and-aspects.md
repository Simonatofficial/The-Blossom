# 06 — Modules, Aspects & the Growth Model

The structural heart of My Blossom, locked from Simon's filled design doc (`docs/DESIGN-DOC.md` — the product source of truth). This doc is the *architecture* of growth: the five aspects, their Attribute→Skill layers, the six modules, the Blossom loop, and how it all renders as flowers + a radar. Read with `docs/05` (Liri) and `docs/04` (visual).

> **Source of truth:** `docs/DESIGN-DOC.md` holds the full, Simon-authored detail (every attribute & skill, per-module intent). When this doc and the design doc ever disagree, the design doc wins — update this one to match.

---

## 1. The growth hierarchy: Aspect → Attribute → Skill ✅

Growth has **three nested levels** (this replaces the old flat "aspect + sub-skill"):

- **Aspect** — a domain of life (5 of them). Rendered as a **flower**; the flower grows more colourful as the aspect levels.
- **Attribute** — a facet of an aspect. Rendered as a **petal** of that aspect's flower; the petal **grows** as the attribute levels.
- **Skill** — a concrete practice under an attribute. Rendered as a **star** orbiting the flower; the star **glows brighter** as the skill levels.

A skill may feed **more than one** attribute, and an attribute may feed **more than one** aspect, *when it genuinely fits*. Growth flows up: skills → attributes → aspects → the Liri.

---

## 2. The five aspects & their modules ✅

| Aspect | Module (feeds it) | The module is the ultimate hub for… |
|---|---|---|
| **Mental** | **Productivity** | learning, studying, focus, problem-solving, knowledge |
| **Physical** | **Activity** | movement, training, the body, nutrition, recovery |
| **Emotional** | **Meditation** | breath, calm, regulation, resilience, self-compassion |
| **Social** | **Connection** | communication, empathy, relationships, teamwork, leadership |
| **Recreation** | **Recreation** (Entertainment) | creativity, mastery of hobbies, mindfulness, adventure, joy |

Plus the hub: **My Blossom**. So **six modules total** (one hub + five aspect-modules). The full Attribute/Skill roster for each aspect is authored in `docs/DESIGN-DOC.md` Floor 1.3 (e.g. Activity → Strength/Conditioning/Flexibility/Nutrition/Recovery, each with 4 skills) — pull it into each module's preset as that module is built (don't duplicate the whole list here; keep one source).

---

## 3. The Blossom loop ✅

Every aspect-module feeds its aspect; aspects grow the Liri. The hub shows it all.

```
Productivity ─▶ Mental    ─┐
Activity     ─▶ Physical  ─┤
Meditation   ─▶ Emotional ─┼─▶  My Blossom (hub) ─▶ Liri grows + responds
Connection   ─▶ Social    ─┤
Recreation   ─▶ Recreation┘
```

**Implement as data/events:** a module emits an aspect-XP event (with attribute/skill tags); the Blossom consumes it; tools never reach into each other (`organized-code` §3, `docs/01`). Doing anything anywhere makes the Liri visibly respond — it must feel **soul-bonded and personal**.

---

## 4. How it renders

- **Aspect pages:** each aspect is shown as its **flower** (petals = attributes, stars = skills). This is the per-aspect view.
- **The Liri page:** shows the five aspect-flowers beneath the Liri, plus a **radar graph** of the Liri's level across the five aspects (a quick at-a-glance shape of the person). (`docs/04` §8 covers the visual spec; the flower is a *whole bloom*.)
- **Home (My Blossom):** greeting + overview + today's quests/habits/tasks across all aspects.

---

## 5. The six modules (intent — full overhaul per `DESIGN-DOC.md` Floor 6)

Each module must be **clean, organized, detailed, useful, and cozy**, and the ultimate tool for its aspect. Build them fresh (don't port the original's dead widgets); create tools that actually serve the purpose.

- **My Blossom (hub):** connects the five modules. Home + Overview + the habit/quest/task system that spans all aspects, + the **Liri** companion and everything it offers (`docs/05`).
- **Productivity → Mental:** the ultimate learning hub — study material, notebooks/flashcards/quizzes, skill-learning, focus tools; with the Cosmos tier, deep **guides/databases** (e.g. math: algebra→calculus taught step by step). **Priority module.**
- **Activity → Physical:** the ultimate body hub — an **interactive human-body / muscle-group display** you tap to track exercises & measurements, exercise tracking, a **meal planner**, and (Cosmos) exercise guides/databases. **Priority module.**
- **Meditation → Emotional:** breath, calm, mood, reflection, resilience tools.
- **Connection → Social:** tending people — bonds, reach-outs, shared moments; later, an optional privacy-first friends layer (`docs/DESIGN-DOC.md` 10.3).
- **Recreation → Entertainment:** the *fun* aspect — creativity, hobby mastery, mindfulness, adventure, joy; plan fun, grow positively.

**Build priority (Simon):** Productivity & Activity first; Connection / Meditation / Recreation after.

---

## 6. Liri Life (the duck-life-style companion game) ✦ draft

A cozy "care for your Liri" game where the **aspects power the Liri's performance**: Physical → faster races/swimming; Mental → knows more; Emotional → focuses more; Social → more friends; Recreation → (fun mini-games). Living your real life levels the aspects, which makes your Liri better in-game. Needs its own deeper framework later (`docs/DESIGN-DOC.md` 4.5 / 7.5). A v1 must-have alongside the **Blossoms** game.

---

## 7. Where the detail lives (so we never duplicate)

- **Full attribute/skill lists, per-module intent, exact decisions** → `docs/DESIGN-DOC.md` (source of truth).
- **Liri / elements / quiz / growth-of-creature** → `docs/05`.
- **Flower/radar visuals, themes, atmospheres** → `docs/04`.
- **This doc** = the structural map tying them together. Keep it short; point, don't copy.

---

### One-line summary
*Five aspects (Mental·Physical·Emotional·Social·Recreation), each a flower of attribute-petals and skill-stars, fed by six modules (My Blossom hub + Productivity·Activity·Meditation·Connection·Recreation), all flowing up into the soul-bonded Liri — built Productivity & Activity first.*
