---
name: overhaul-the-ask
description: "The front door for any build request on The Blossom. Turns a request — even a messy, rambling, multi-message idea-dump — into a short, clear, cozy frame before building, without overwhelming the user or wasting tokens. Lightweight by default: small or clear asks get built directly; only big or messy dumps get a quick refine pass. This is framework §1 (the Prompt-Overhaul Protocol) merged with braindump-to-spec. Use when the user asks for a new feature/widget/module, a change, a fix, an overhaul, a removal, or says 'turn my messy notes into a plan', 'clean this up before building', 'refine this into something buildable', 'sort out what I actually want', or 'braindump to spec'."
triggers:
  - "new feature / widget / module / change / fix / overhaul / removal on The Blossom"
  - "turn my messy notes into a plan"
  - "clean this up before building"
  - "refine this into something buildable"
  - "sort out what I actually want here"
  - "braindump to spec"
---

# overhaul-the-ask

Every request is a *seed*, not a spec. Grow it into a tiny cozy frame, then build. This merges the Prompt-Overhaul Protocol (`docs/00-claude-framework.md` §1) with the old `braindump-to-spec` skill. It is lightweight on purpose — it stays out of the way for small asks and only does real work when the input is a genuine pile.

## Rule 0 — match the effort to the ask

Judge the request first:

- **Small or clear** (one feature, a tweak, an obvious change): just build it, or confirm in one plain sentence. Do NOT write a plan file, do NOT spawn a helper, do NOT run the steps below.
- **Big, new, or underspecified** (a new module/widget/large feature): hand off to **grill-me** — interview one question at a time, recommend an answer each time, explore the codebase instead of asking when you can.
- **Messy or spread across several messages**: run the quick refine below.

When unsure, lean toward just building. The refine only earns its cost when the input is a real mess.

## The overhaul (one short block, before code)

1. **Restate** the request in one line, so intent is locked.
2. **Overhaul it** — improve on what was asked without drifting from intent, along four axes:
   - *Cozy* — the calm, at-your-own-pace version (see the `cozy-check` skill / framework §3).
   - *Token-efficient* — smallest change that fully satisfies it; reuse engines/widgets/definitions over new code (framework §2).
   - *Quality* — edge cases, data safety, offline, 360px, 60fps.
   - *Quantity* — the near-free adjacent wins; name them, don't silently add them.
3. **Frame it** — a tiny plan: **Goal · Approach · Files · Cozy notes · Done-when**. 3–8 lines. This *is* the spec for the task.
4. **Proceed.** Don't wait for approval on small/clear work.

## When the input is a big messy dump

1. **Read it cleanly.** If it's very large, read it in a helper subagent so the noise stays out of the main chat and the chat stays cheap. The next thing the user sees is a short frame, not the raw mess.
2. **Check in like a human.** A short, warm summary — not a document:
   > "Here's what I think you want: [one line]. Two quick things before I start: [q1] and [q2]. Sound right?"
   Never paste a wall of sections. Avoid jargon like "spec" / "acceptance criteria" with a beginner.
3. **Build once confirmed.** Fold in answers. A scratch plan file is fine if it helps you keep your place, but the user never has to read it.

## Always — the rails the overhaul may never break

- **Follow their exact request.** Improve *around* it; never drop, shrink, or override what they actually asked. If something seems off, ASK — don't change it silently.
- **Never invent.** If the dump didn't say it, ask.
- **Honor the core rails:** the tech stack + nine engineering rules in `CLAUDE.md`, data safety, the cozy laws, and spec-first (read the relevant `/docs` section before building).
- **Keep it plain and short.** Lead with *what you'll do*, not *how the planning works*.
