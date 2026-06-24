---
name: ship-it
description: "The closing ritual for any completed feature on The Blossom. Runs the Definition of Done, updates the docs/STATUS.md ledger so the next session resumes fast, then auto-commits and auto-pushes to GitHub main. This is framework §4 + §5. Use the moment a feature, fix, change, or overhaul is finished and verified — and whenever the user says 'ship it', 'push it', 'commit this', 'we're done', or 'save my progress'."
triggers:
  - "a feature / fix / change / overhaul is finished and verified"
  - "ship it / push it / commit this / we're done / save my progress"
  - "update STATUS / log this / push to github"
---

# ship-it

Close out a finished feature cleanly so sessions stay short and the repo stays green. Full text: `docs/00-claude-framework.md` §4–§5.

## 1. Pass the Definition of Done (all must hold)

- **Spec-honored** — matches the relevant `/docs` section, or the decision is noted back into it.
- **Cozy** — passes the `cozy-check` gut-check.
- **Safe** — no data-loss path; writes flush on `visibilitychange`/`pagehide`; deletions soft (30-day trash) unless spec says otherwise; no migration drops user data.
- **Offline** — works with zero network, no runtime CDN.
- **Performant** — 60fps with particles + atmosphere on a mid-range Android phone; animate only `transform`/`opacity`.
- **Responsive** — verified at 360px wide.
- **Clean** — module <300 lines, JSDoc on public functions, no console errors.
- **Verified** — ran the local server (`tools/serve.ps1` or `python -m http.server`), tested in browser, checked console, tested offline.

If any fail, it is not done — fix before shipping. Never push red.

## 2. Update docs/STATUS.md

- Move the task from **Now** to **Done (recent)**, newest first, with its `v##` tag and a one-line what-changed.
- Pull the next item into **Now**; if you stopped mid-task instead, leave it in **Now** with a `⏸ next step:` note.
- Bump *Last updated* and *Latest pushed version*.

## 3. Auto-commit + auto-push

1. Bump the version (service-worker cache name / asset version, per `docs/09`).
2. Stage only the related changes — one feature per commit, never bundle unrelated work.
3. Commit, conventional style + version tag: `feat(widgets): flower graph petal layout (v##)` / `fix(fx): …` / `docs: …`.
4. `git push origin main` automatically — don't wait to be asked.

Half-done work stays uncommitted (or on a branch), never pushed broken.
