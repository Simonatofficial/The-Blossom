# Opening & Publishing The Blossom

The Blossom is a zero-build progressive web app (PWA). **What's in this folder _is_ the
app** — there's no compile step. You can run it two ways:

1. **Locally** on this PC (works right now, no account needed).
2. **Published to the web** via free GitHub Pages, so you get a real link and can install
   it on your phone.

This file walks through both. The deeper reference is [`docs/09-deployment.md`](docs/09-deployment.md).

---

## 1. Run it locally (right now)

This machine has no Python or Node, so use the bundled PowerShell server.

1. Open **PowerShell** in this folder.
2. Start the server:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8642
   ```
   You'll see `Serving … at http://localhost:8642/`. Leave this window open.
3. Open **Edge or Chrome** and go to **http://localhost:8642**
4. To keep it as an app: in the address bar click the **install icon** (or **⋯ menu →
   Install The Blossom**). It opens in its own window, pinned to the taskbar/Start, and
   works fully offline after the first load.

To stop the server, close the PowerShell window (or press `Ctrl+C` in it).

> **Note:** localhost only exists on this computer. You can't open it from your phone or
> share the link. For that, publish it (below).

---

## 2. Publish to the web (GitHub Pages)

This gives you a permanent URL like `https://<your-username>.github.io/the-blossom/`,
installable on Android (Chrome) and Windows (Edge/Chrome). It's free and the app is
already built for it — every path is relative, the service worker sits at the repo root,
and the manifest is complete. Publishing is purely a hosting step, not a code change.

### One-time setup

1. **Create a GitHub account** at <https://github.com> if you don't have one.
2. **Create a new repository** (the green **New** button). Name it e.g. `the-blossom`.
   Leave it empty — no README, no .gitignore, no license (this folder already has them).
   Public is simplest; Pages also works on private repos.
3. **Connect this folder to it.** GitHub shows the exact URL after you create the repo.
   In PowerShell here:
   ```powershell
   git remote add origin https://github.com/<your-username>/the-blossom.git
   git branch -M main
   git push -u origin main
   ```
   (If git asks you to sign in, follow the browser prompt once.)
4. **Turn on Pages.** On GitHub: **Settings → Pages → Build and deployment →
   Source: _Deploy from a branch_ → Branch: `main`, folder `/ (root)` → Save.**
5. Wait ~1 minute. The Pages section shows the live URL. Open it — you're live.

### Every time you change the app afterward

```powershell
git add -A
git commit -m "describe what changed"
git push
```
Pages redeploys automatically within a minute or so.

### Why it just works here (don't break these)

- **All paths are relative** (`./js/app.js`, never `/js/app.js`) because the app lives at a
  sub-path (`/the-blossom/`). If you ever hand-edit a path, keep it relative.
- **`sw.js` is at the repo root** and registered with `{ scope: './' }` — leave it there.
- **Your data is never published.** All notes/widgets/saves live in your browser's
  IndexedDB on each device. The repo only contains the app, never your content. Publishing
  does **not** sync your data between devices — each install starts empty. Move data with
  **Settings → Saves → Download file / Copy save code**, then **Import** on the other device.

---

## 3. Release checklist (run before each publish)

From [`docs/09-deployment.md`](docs/09-deployment.md):

1. Smoke-test locally in Chrome **and** a 360×740 mobile emulation.
2. No console errors; app boots and works in **airplane mode** (offline).
3. If you **added or removed any file**, regenerate the asset list:
   ```powershell
   powershell -File tools/gen-sw-assets.ps1
   ```
4. **Bump the cache version** in [`sw.js`](sw.js) — `const CACHE = 'blossom-vN'` → `N+1`.
   (This is what makes installed copies pick up your changes. Current: `blossom-v22`.)
5. Export a save code, wipe site data, re-import — confirm the round-trip.
6. `git add -A && git commit && git push`.

---

## 4. TODO / decide later

_(Your space — add notes as you research hosting.)_

- [ ] Decide: keep it local-only, or publish to GitHub Pages?
- [ ] If publishing: pick a repo name (this becomes part of the URL).
- [ ] Optional: a custom domain (add a `CNAME` file + DNS) instead of `*.github.io`.
- [ ] Run a Lighthouse PWA audit once live (DevTools → Lighthouse → Progressive Web App).
- [ ] Test install + offline on your actual phone.
