# 00 — Claude Operating Framework

**Read this first, every session.** This is the *how we work* doc. The numbered docs (`01`–`14`) are *what we build*. `CLAUDE.md` is the short entry point; this file is its long form.

Five jobs, every time you touch this repo:

1. **Overhaul the instruction** before acting on it (§1).
2. **Spend tokens like coins** — be efficient (§2).
3. **Build cozy** — calm, discoverable, never force-fed (§3).
4. **Track + persist** — update `docs/STATUS.md`, then push (§4).
5. **Finish clean** — meet the Definition of Done (§5).

---

## 1. The Prompt-Overhaul Protocol

Every new request from the user is a *seed*, not a *spec*. Before writing code, grow it.

When the user gives a prompt (new feature, change, fix, removal, overhaul), do this **first, in one short block**:

1. **Restate** the request in one line, so intent is locked.
2. **Overhaul it** — improve on what was asked along these axes, without drifting from intent:
   - *Cozy*: how does this land calmly? What's the at-your-own-pace version? (§3)
   - *Token-efficient*: smallest change that fully satisfies it; reuse existing engines/widgets/definitions instead of new code. (§2)
   - *Quality*: edge cases, data safety, offline, 360px, 60fps.
   - *Quantity*: the obvious adjacent wins that come nearly free — name them, don't silently add them.
3. **Frame it** — output a tiny plan: **Goal · Approach · Files · Cozy notes · Done-when**. 3–8 lines. This *is* the framework for that task.
4. **Proceed.** Don't wait for approval on small/clear work. For a new module/widget/large feature or anything underspecified, run **grill-me** (one question at a time, recommend an answer each time, explore the codebase instead of asking when you can) before the frame.

**Core rules the overhaul may never break:** the tech stack and the nine engineering rules in `CLAUDE.md`; data safety (§5); the cozy laws (§3); spec-first (read the relevant `/docs` section before building). Improve freely *within* these rails.

Keep the overhaul block short. It's a lens, not an essay — if it's longer than the change, you've over-thought it.

---

## 2. Token-Efficiency Protocol

Tokens are coins. The cheapest correct path wins. The app-building process has been wasteful; tighten it here.

**Before reading:**
- Read **only** the `/docs` section and source files the task touches. Don't re-read what's already in context. `docs/13-v2-framework.md` is huge (~120KB) — target the relevant heading, never load it whole.
- Use search (grep/glob) to locate, not full-file reads, when you only need one symbol.
- Trust `docs/STATUS.md` for "where are we" instead of re-deriving state by scanning the tree.

**Before writing:**
- Reuse first. Everything-is-data (rule 2): a new module/page/widget/theme/particle should usually be a **definition object in `/js/presets`**, not new engine code. If you're about to hard-code, stop and check for a definition path.
- Smallest diff that fully works. Prefer `Edit` over rewriting a file; don't reformat untouched lines.
- One widget = one plugin (rule 3). Don't edit unrelated files to add one.
- Keep modules <300 lines; split rather than grow a monolith you'll keep re-reading.

**Before responding:**
- No narration of tool calls, no recaps of steps the user watched. Report outcome in 1–3 sentences.
- Don't re-read a file you just edited to "confirm" — the edit tool already validated it.
- Batch independent tool calls in one turn.

**Output sizing:** match effort to the task. A one-line fix gets a one-line reply. Don't pad, don't over-explain, don't write a README nobody asked for.

---

## 3. The Cozy Laws (how everything should *feel*)

The Blossom is a quiet garden the user wanders, not a dashboard that shouts. Every addition must protect that feeling. This expands rule 6 (Calm UI) into design law.

**1. Discoverable, not delivered.** New features appear where a curious user would *find* them, not pushed into the main view on first load. A new widget lives in the widget picker; a new option lives one calm tap deep in a panel. The user should feel like they *uncovered* it.

**2. Progressive disclosure.** Show the one primary thing; tuck depth behind expanders, panels, "more" affordances. Defaults are gentle and minimal. Power is available, never front-loaded. No wall of options on arrival.

**3. No demands for attention.** No nagging badges, no red dots, no auto-opening modals, no celebratory noise the user didn't earn or invite. Prefer a panel to a modal; prefer a soft inline hint to an interruption. Notifications whisper.

**4. Opt-in intensity.** Particles, atmospheres, sounds, animations default to *soft*. The user dials *up*, not down. Nothing arrives at full volume.

**5. Calm motion & shape.** 150–250ms ease-out, soft corners (12–16px), generous whitespace, animate only `transform`/`opacity`. Respect `prefers-reduced-motion` always. Transitions invite the eye; they don't yank it.

**6. The user sets the pace.** Onboarding and new features suggest, never force. No mandatory tours, no blocking "do this next." A gentle, dismissible hint at most. Exploration is the point — let them find their own way in.

**7. Icons over emoji** (rule 7) — quiet inline SVG in the chrome; emoji only as the user's chosen accent.

**Cozy gut-check** before shipping any UI: *Could a tired person meet this at 11pm and feel calmer, not busier? Did I add anything that demands rather than invites? Is the depth optional?* If any answer is wrong, soften it.

---

## 4. Session Continuity & GitHub

Sessions are short and restart cold. `docs/STATUS.md` is the handoff so the next session starts in seconds, not in a re-scan.

**`docs/STATUS.md` holds three lists** — keep them current:
- **Now** — what's actively in progress (the one thing).
- **Next** — queued, in order, with the source doc/CR.
- **Done (recent)** — last ~15 shipped, newest first, with version tag.

**Update STATUS at three moments:**
1. **Start of work:** move the task into **Now**, write the one-line frame (§1.3) beside it.
2. **On completion:** move it to **Done** with its `v##` tag; pull the next item into **Now**.
3. **If you stop mid-task:** leave it in **Now** with a `⏸ next step:` note so the next session resumes exactly there.

**Git workflow — auto-commit + auto-push on every completed feature:**
1. Bump the version (service worker cache name / asset version, per `docs/09`).
2. Stage related changes only.
3. Commit, conventional style: `feat(widgets): flower graph petal layout (v##)` / `fix(fx): …` / `docs: …`.
4. **`git push origin main`** automatically — don't wait to be asked.
5. One commit per feature. Don't bundle unrelated work. If something's half-done, it stays uncommitted (or on a branch), never pushed broken.

Never push code that fails the Definition of Done. Green only.

---

## 5. Definition of Done

A feature is done only when all hold:

- **Spec-honored** — matches the relevant `/docs` section (or the decision is noted back into that doc).
- **Cozy** — passes the §3 gut-check.
- **Safe** — no data loss path; writes flush on `visibilitychange`/`pagehide`; deletions soft (30-day trash) unless spec says otherwise; no migration drops user data.
- **Offline** — works with zero network, no runtime CDN.
- **Performant** — 60fps with particles + atmosphere on a mid-range Android phone; animate only `transform`/`opacity`.
- **Responsive** — verified at 360px wide.
- **Clean** — module <300 lines, JSDoc on public functions, no console errors.
- **Verified** — ran the local server (`tools/serve.ps1`, or `python -m http.server`), tested in browser, checked console, tested offline.
- **Logged & pushed** — `docs/STATUS.md` updated, committed, pushed to `main` (§4).

---

### One-line summary
*Overhaul the ask → frame it tiny → build the cheapest cozy version → verify → log in STATUS → push.*
