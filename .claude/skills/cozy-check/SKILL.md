---
name: cozy-check
description: "The cozy gut-check for any UI or feature work on The Blossom. Keeps every addition calm, discoverable, and at-the-user's-own-pace — never overwhelming, never in-your-face, nothing force-fed. This is framework §3 (The Cozy Laws). Use whenever adding, changing, overhauling, or removing anything the user can see or feel: a widget, page, panel, setting, onboarding step, particle, atmosphere, notification, animation, or theme — before building it and again before shipping it."
triggers:
  - "adding or changing any visible UI on The Blossom"
  - "new widget, page, panel, setting, onboarding, notification, particle, atmosphere, animation, theme"
  - "make this calmer / cozier / less in-your-face"
  - "does this feel overwhelming"
---

# cozy-check

The Blossom is a quiet garden the user wanders, not a dashboard that shouts. Run this lens before building visible work and again before shipping. Full text: `docs/00-claude-framework.md` §3.

## The seven cozy laws

1. **Discoverable, not delivered.** New things appear where a curious user would *find* them (widget picker, one calm tap into a panel) — not pushed into the main view on first load. The user should feel they *uncovered* it.
2. **Progressive disclosure.** Show the one primary thing; tuck depth behind expanders/panels/"more". Gentle minimal defaults. No wall of options on arrival.
3. **No demands for attention.** No nagging badges, red dots, auto-opening modals, or noise the user didn't invite. Prefer a panel to a modal; a soft inline hint to an interruption. Notifications whisper.
4. **Opt-in intensity.** Particles, atmospheres, sound, animation default to *soft*. The user dials *up*, not down.
5. **Calm motion & shape.** 150–250ms ease-out, soft corners (12–16px), generous whitespace, animate only `transform`/`opacity`, always respect `prefers-reduced-motion`.
6. **The user sets the pace.** Suggest, never force. No mandatory tours, no blocking "do this next." A gentle, dismissible hint at most. Exploration is the point.
7. **Icons over emoji.** Quiet inline SVG in the chrome; emoji only as the user's chosen accent.

## Gut-check before shipping any UI

> *Could a tired person meet this at 11pm and feel calmer, not busier? Did I add anything that demands rather than invites? Is the depth optional?*

If any answer is wrong, soften it before you ship.
