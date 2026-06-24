# 00 — Claude Operating Framework

**Read this first, every session.** This is the *how we work* doc. The numbered docs are *what we build*. `CLAUDE.md` is the short entry point; this file is its long form.

Five jobs, every time you touch this repo:

1. **Overhaul the instruction** before acting on it (§1).
2. **Spend tokens like coins** — be efficient (§2).
3. **Build cozy** — calm, discoverable, never force-fed (§3).
4. **Track + persist** — update `docs/STATUS.md`, then push (§4).
5. **Finish clean** — meet the Definition of Done (§5).

---

## 1. The Prompt-Overhaul Protocol

Every new request from the user is a *seed*, not a *spec*. Before writing code, grow it.

**Rule 0 — match effort to the ask.** Small or clear asks (one feature, a tweak, an obvious change) get built directly, or confirmed in one plain sentence — no plan file, no helper. Big/new/underspecified work goes to **grill-me**. Only messy or multi-message dumps earn the full refine. When unsure, lean toward just building. *(Also a triggerable skill: `overhaul-the-ask`.)*

When the user gives a prompt that warrants it, do this **first, in one short block**:

1. **Restate** the request in one line, so intent is locked.
2. **Overhaul it** — improve on what was asked, without drifting from intent:
   - *Cozy*: how does this land calmly? What's the at-your-own-pace version? (§3)
   - *Token-efficient*: smallest change that fully satisfies it; reuse existing engines/widgets/definitions instead of new code. (§2)
   - *Quality*: edge cases, data safety, offline, 360px, 60fps.
   - *Quantity*: the obvious adjacent wins that come nearly free — name them, don't silently add them.
3. **Frame it** — a tiny plan: **Goal · Approach · Files · Cozy notes · Done-when**. 3–8 lines. This *is* the spec for the task.
4. **Proceed.** Don't wait for approval on small/clear work. For a new module/widget/large feature or anything underspecified, run **grill-me** (one question at a time, recommend an answer each time, explore the codebase instead of asking when you can) before the frame.

**Core rules the overhaul may never break:** the tech stack and nine engineering rules in `CLAUDE.md`; data safety (§5); the cozy laws (§3); spec-first (read the relevant `/docs` section before building). Improve freely *within* these rails.

Keep the overhaul block short. It's a lens, not an essay.

---

## 2. Token-Efficiency Protocol

Tokens are coins. The cheapest correct path wins.

**Before reading:**
- Read **only** the `/docs` section and source files the task touches. Don't re-read what's already in context. For a large doc or research file, target the relevant heading — never load it whole.
- Use search (grep/glob) to locate, not full-file reads, when you only need one symbol.
- Trust `docs/STATUS.md` for "where are we" instead of re-deriving state by scanning the tree.

**Before writing:**
- Reuse first. Everything-is-data (rule 2): a new module/page/widget/theme/particle should usually be a **definition object in `src/presets`**, not new engine code. If you're about to hard-code, stop and check for a definition path.
- Smallest diff that fully works. Prefer `Edit` over rewriting a file; don't reformat untouched lines.
- One widget = one plugin (rule 3). Don't edit unrelated files to add one.
- Keep modules/components <300 lines; split rather than grow a monolith you'll keep re-reading.

**Before responding:**
- No narration of tool calls, no recaps of steps the user watched. Report outcome in 1–3 sentences.
- Don't re-read a file you just edited to "confirm" — the edit tool already validated it.
- Batch independent tool calls in one turn.

**Output sizing:** match effort to the task. A one-line fix gets a one-line reply.

**Usage transparency (always-on).** When a single turn burns *unusually high* usage — reading a very large file whole, many tool calls/file scans, big web fetches or pasted content, a long subagent, or Opus + high thinking effort — end that message with **one plain line** naming what drove it and the cheaper next-time path. A quiet footnote, not a lecture; ordinary turns get nothing. Format: `ⓘ Heavier turn — read a large doc whole + scanned 8 files. Next time I can target one heading to keep it cheap.` The deep diagnostic lives in the `usage-check` skill.

---

## 3. The Cozy Laws (how everything should *feel*)

My Blossom is a quiet garden the user wanders, not a dashboard that shouts. Every addition must protect that feeling. This expands rule 6 (Calm UI) into design law.

1. **Discoverable, not delivered.** New features appear where a curious user would *find* them, not pushed into the main view on first load. A new widget lives in the widget picker; a new option lives one calm tap deep in a panel. The user should feel they *uncovered* it.
2. **Progressive disclosure.** Show the one primary thing; tuck depth behind expanders, panels, "more". Defaults are gentle and minimal. Power is available, never front-loaded.
3. **No demands for attention.** No nagging badges, red dots, auto-opening modals, or celebratory noise the user didn't invite. Prefer a panel to a modal; a soft inline hint to an interruption. Notifications whisper.
4. **Opt-in intensity.** Particles, atmospheres, sounds, animations default to *soft*. The user dials *up*, not down.
5. **Calm motion & shape.** 150–250ms ease-out, soft corners (12–16px), generous whitespace, animate transforms/opacity on the UI thread. Respect `prefers-reduced-motion` always.
6. **The user sets the pace.** Onboarding and new features suggest, never force. No mandatory tours, no blocking "do this next." A gentle, dismissible hint at most. Exploration is the point.
7. **Icons over emoji.** Quiet inline vector icons in the chrome; emoji only as the user's chosen accent.

**Cozy gut-check** before shipping any UI: *Could a tired person meet this at 11pm and feel calmer, not busier? Did I add anything that demands rather than invites? Is the depth optional?* If any answer is wrong, soften it.

---

## 4. Session Continuity & GitHub

Sessions are short and restart cold. `docs/STATUS.md` is the handoff so the next session starts in seconds.

**`docs/STATUS.md` holds three lists** — keep them current:
- **Now** — what's actively in progress (the one thing).
- **Next** — queued, in order, with the source doc.
- **Done (recent)** — last ~15 shipped, newest first, with version tag.

**Update STATUS at three moments:**
1. **Start of work:** move the task into **Now**, write the one-line frame (§1.3) beside it.
2. **On completion:** move it to **Done** with its `v0.x.y` tag; pull the next item into **Now**.
3. **If you stop mid-task:** leave it in **Now** with a `⏸ next step:` note.

**Git workflow — auto-commit + auto-push on every completed feature:**
1. Bump the version (`app.json` `version` + build number).
2. Stage related changes only.
3. Commit, conventional style: `feat(widgets): flower graph petal layout (v0.x.y)` / `fix(fx): …` / `docs: …`.
4. **`git push origin main`** automatically — don't wait to be asked.
5. One commit per feature. If something's half-done, it stays uncommitted (or on a branch), never pushed broken.

Never push code that fails the Definition of Done. Green only.

---

## 5. Definition of Done

A feature is done only when all hold:

- **Spec-honored** — matches the relevant `/docs` section (or the decision is noted back into it).
- **Cozy** — passes the §3 gut-check.
- **Safe** — no data-loss path; writes flush on app background/close; deletions soft (30-day trash) unless spec says otherwise; no migration drops user data; Supabase RLS on.
- **Offline** — works with zero network, no runtime CDN.
- **Performant** — 60fps with particles + atmosphere on a mid-range Android phone; one Skia loop; no per-frame React re-renders.
- **Responsive** — verified at 360px wide.
- **Clean** — module <300 lines, TypeScript types on public functions, no console errors.
- **Verified** — ran on a device or emulator (Expo Go or a dev build), checked the console, tested offline.
- **Logged & pushed** — `docs/STATUS.md` updated, committed, pushed to `main` (§4).

---

## 6. The framework as skills

These rules are also installed as project skills in `.claude/skills/` so they trigger automatically — this doc is the single source of truth; the skills are thin triggerable entry points.

| Skill | Fires when | Maps to |
|---|---|---|
| `overhaul-the-ask` | any build request / messy idea-dump | §1 |
| `cozy-check` | adding/changing anything the user sees or feels | §3 |
| `ship-it` | a feature is finished and verified | §4 + §5 |
| `usage-check` | "why is my usage so high"; defines the heavy-turn note | §2 |
| `grill-me` | a new module/widget/large feature needs interviewing out | §1 (deep path) |
| `cloud-sync` | accounts / sync / Supabase / RLS / offline-first | rails of §5 (safe/offline) |
| `monetize` | subscriptions / tiers / paywall / donations | §3 (cozy paywall) + `docs/02` |
| `release-it` | building & publishing a release, updates | `docs/02` |
| `learn-from-the-field` | designing a feature with a real-world analogue | §1 + `docs/research/` |

---

### One-line summary
*Overhaul the ask → frame it tiny → build the cheapest cozy version → verify on a device → log in STATUS → push.*
