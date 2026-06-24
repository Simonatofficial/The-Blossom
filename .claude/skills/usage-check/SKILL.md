---
name: usage-check
description: "Diagnose why Claude usage / cost is running out fast and suggest the simplest fixes, in plain words, changing nothing without permission. Also defines the always-on heavy-turn note: when a single turn burns unusually high usage, Claude ends that message with one plain line explaining what drove it. Use when the user asks 'why is my usage so high', 'why did that cost so much', 'I'm running out fast', 'how do I save tokens/credits', or mentions hitting limits."
triggers:
  - "why is my usage so high / why did that cost so much"
  - "I'm running out of usage/credits fast"
  - "how do I save tokens / use less"
  - "I keep hitting my limit"
---

# usage-check

Help the user spend less, explained simply. Never change a setting without a yes.

## Always-on: the heavy-turn note

When a single turn burns **unusually high usage**, end that message with **one plain line** naming what drove it and the cheaper next-time path. Keep it cozy and brief — this is a quiet footnote, not a lecture, and it only appears on genuinely heavy turns (not normal ones).

Treat a turn as heavy if it did any of: read a very large file whole (e.g. the ~120KB `docs/13-v2-framework.md`), made many tool calls or file scans, pulled big web fetches or pasted content into context, ran a long subagent, or ran on Opus + high thinking effort. Format:

> ⓘ Heavier turn — read the full V2 doc (~120KB) + scanned 8 files. Next time I can target one heading to keep it cheap.

If the turn was ordinary, add nothing.

## On request: the diagnostic

Check these, explain each in plain words, suggest the single easiest fix, and **ask before changing anything**:

1. **Which model?** Opus costs several times more per answer than Sonnet. Recommend Sonnet as the everyday default.
2. **High thinking effort on?** It multiplies token use. Recommend low/medium for normal building.
3. **How long is this chat?** Every message re-sends the whole conversation, so long chats get pricey. Recommend a fresh chat between unrelated tasks.
4. **How big are the instruction files** (`CLAUDE.md`, the `/docs` Claude reads each turn)? They're re-read every turn — trim to essentials. (This project already keeps `CLAUDE.md` lean and the heavy specs in on-demand docs.)
5. **Large files pulled into chat?** That text re-sends every turn. Open only the parts needed; point Claude at files instead of pasting.
6. **Extra tools / MCP servers loaded?** They add weight to every message. Turn off any not in use.

Full reference: `why-usage-is-high.md` in this folder.

## Habits that save the most

Use Sonnet by default and save Opus for genuinely hard problems; keep thinking effort low/medium; start a new chat when switching tasks; keep instructions short; point at files instead of pasting big chunks.
