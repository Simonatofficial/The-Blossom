# 09 — Deployment & Install (GitHub Pages, Android, Windows)

## Publishing via GitHub

1. Repo root = app root (no build step — what's committed is what's served).
2. GitHub → Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. App serves at `https://<user>.github.io/<repo>/`. **All paths must be relative** (`./js/app.js`, never `/js/app.js`) because the app lives in a subpath. The service worker must be at repo root (`sw.js`) and registered with `{ scope: './' }`.
4. Optional custom domain via CNAME later; nothing in the app may assume an origin.

## manifest.webmanifest

```json
{
  "name": "The Blossom",
  "short_name": "Blossom",
  "description": "Your cozy, all-in-one space to grow.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#1b1430",
  "theme_color": "#1b1430",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Icon: the cosmos-flower-in-orbit sigil (docs/06), exported from SVG at the three sizes (maskable version has 20% safe-zone padding).

**Orientation is locked to `portrait`** (CR-15): the Blossom is a phone-first cozy app whose chrome (bottom tab bar, bottom-docked Canvas toolbar, anchored popovers) is laid out for a tall viewport. Auto-rotating into landscape on a phone reflowed those surfaces awkwardly, so the installed PWA stays upright. (Desktop/tablet windows ignore the hint and resize freely.)

## Service worker (`sw.js`)

- **Strategy:** versioned cache-first app shell. `CACHE = 'blossom-v<N>'`; on `install`, pre-cache an explicit asset list (index.html, manifest, all css/js/icons/preset files — maintain `sw-assets.js`, a generated array; add a note in CLAUDE.md to regenerate when files are added). On `activate`, delete old caches. On `fetch`, cache-first for same-origin GET, falling back to network, falling back to cached index.html for navigations.
- **Updates:** bump `<N>` every release. When a new SW is waiting, show a quiet toast: "A new version has bloomed — refresh when ready" (button calls `skipWaiting` + reload). **Never auto-reload** (could interrupt the user mid-entry).
- **User data is never in the SW cache** — IndexedDB is untouched by updates (the "data survives updates" guarantee).

## Installing

- **Android (Chrome):** visit the Pages URL → Chrome shows the install prompt (the app also listens for `beforeinstallprompt` and surfaces a cozy "Plant Blossom on your home screen?" card in Settings → About). Installs as a standalone app.
- **Windows (Edge/Chrome):** visit URL → browser menu → "Install The Blossom" (or the address-bar install icon). Runs in its own window, pinned to taskbar/Start.
- **Storage durability:** on first save, call `navigator.storage.persist()` and reflect the result in Settings → Saves ("Storage: protected ✓ / best-effort — export backups regularly").

## Release checklist (run every release)

1. `python -m http.server` from repo root; full smoke test in Chrome + one Chromium-mobile emulation (360×740).
2. Lighthouse PWA pass: installable, offline-capable, no console errors.
3. Airplane-mode test: app boots and operates fully offline.
4. Update SW cache version + regenerate asset list.
5. Export a save code, wipe site data, re-import — verify round-trip.
6. Tag the release; push to `main` (Pages auto-deploys).
