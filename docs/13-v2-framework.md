# 13 — V2 Framework

This document is the authoritative spec for all V2 changes. Work these in the priority order listed in §15. Read the relevant section before implementing any feature. When a CR completes, mark it `✅ + date` in §15.

---

## §1 — Supabase Cloud Sync

**Goal:** optional cross-device sync (web + mobile) layered on top of the existing IndexedDB-first architecture. The frontend stays on Vercel/Netlify; Supabase is the sync backend only — it never replaces local storage.

### Architecture

- IndexedDB remains the source of truth. Supabase is a sync mirror.
- All reads come from local DB (offline always works). Writes go to local DB first, then sync to Supabase in the background.
- Add `js/core/sync.js` — the only file that touches Supabase. All other modules stay ignorant of it.
- Load the Supabase JS client from CDN in `index.html`:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  ```

### Configuration

Create `.env.example` at repo root:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

At runtime, `sync.js` reads from `window.BLOSSOM_CONFIG` (a global object the user injects via a config script or their Netlify/Vercel environment variable injection). Provide `public/config.js.example`:
```js
window.BLOSSOM_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
```

### Auth

- On first sync, call `supabase.auth.signInAnonymously()`. Store the session in `localStorage` (`blossom_auth`). Every user gets a unique ID automatically.
- Expose "Upgrade to email/password" in Settings → Account: calls `supabase.auth.updateUser({ email, password })`. No data migration needed — the user ID persists.
- If Supabase is not configured (`BLOSSOM_CONFIG` missing/empty), sync is silently disabled — no errors shown.

### Data sync

Supabase table schema (`notes` is the generic sync table — rename to `blossom_sync`):
```sql
create table blossom_sync (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  record_type text not null,       -- 'module' | 'page' | 'widget' | 'object' | 'theme' | 'meta'
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz default now(),
  unique(user_id, record_type, record_id)
);
alter table blossom_sync enable row level security;
create policy "own rows" on blossom_sync for all using (auth.uid() = user_id);
```

Sync logic in `sync.js`:
- `push(recordType, recordId, payload)` — upsert one record to Supabase after any local write (debounced 2s).
- `pull()` — fetch all records newer than `lastSyncAt` (stored in `localStorage`) and merge into local IndexedDB (local wins on conflict if `updatedAt` ties).
- `syncAll()` — full push/pull on app start when online.
- Emit `sync:status` events (`idle | syncing | error`) for the UI indicator in the settings drawer.

### Ko-fi Support Button

Add a "Support ☕" button in Settings → About:
```html
<a href="https://ko-fi.com/YOUR_HANDLE" target="_blank" rel="noopener" class="btn-support">
  Support on Ko-fi
</a>
```
Optionally embed the Ko-fi widget button script. Keep it opt-in — only show if `BLOSSOM_CONFIG.kofiHandle` is set.

**Accept when:** a user on two devices both signed in to the same Supabase account sees data sync within 5 seconds; offline works with zero Supabase config.

---

## §2 — Mobile Rotation Lock

**Status:** ✅ already implemented via CR-15 (`manifest.webmanifest` `orientation: "portrait"`). No further action needed.

---

## §3 — FAB Navigation Button (+)

**Goal:** replace the current scattered entry points (module switcher, page hold, widget gallery) with a single floating action button that gives access to all three in one coherent flow.

### Placement & appearance

- Fixed `position: fixed; bottom: 24px; right: 24px; z-index: 200`.
- Circle, 56px diameter, `background: var(--accent); color: var(--accentFg)`.
- Icon: `+` (morphs to `×` when open via CSS `rotate(45deg)` transition 150ms).
- Soft drop shadow: `0 4px 16px var(--shadow)`.
- On tap: opens a bottom-sheet radial menu (three arcs) with labels:

```
     [Modules]
  [Pages]  [Widgets]
       [+]          ← FAB
```

Arcs animate outward 200ms ease-out; backdrop scrim 20% opacity; tap scrim or `×` to dismiss.

### Modules panel

Opens as a Panel (CR-11 taxonomy). Shows:
- Search bar at top (search by name, category, tag).
- Current module highlighted.
- Modules grouped by **Category → Subcategory** (collapsible sections, see §11).
- Per-module row: icon · name · subcategory chip · `···` menu (Edit, Copy Code, Delete, Set as Home).
- Bottom bar: **"+ New Module"** · **"Import Code"**.
- Swap to a module: tap its row → navigates immediately, panel closes.

### Pages panel

Opens as a Panel. Scope: pages in the active module. Shows:
- Page list (same order as tab bar) with drag-to-reorder handles.
- Current page highlighted.
- Per-page row: icon · name · `···` menu (Edit, Copy Code, Delete).
- Bottom bar: **"+ New Page"** · **"Import Code"**.
- Tap a page → navigate to it, panel closes.

### Widgets panel

Opens as a Panel. Scope: widgets on the active page. Shows:
- Widget list (render order top-to-bottom).
- Per-widget row: widget type icon · name · type label · `···` menu (Edit, Open, Copy Code, Delete).
- Bottom bar: **"+ Add Widget"** (opens existing gallery) · **"Import Code"**.
- "Open" → navigates to widget's internal view page (CR-11).

**Accept when:** tapping + from any page gives access to swap module, add/remove/navigate pages, and add/open/remove widgets without hunting through the top chrome.

---

## §4 — Theme Transitions Between Scopes

**Goal:** when navigating to a module, page, or widget with a different theme set, the full visual environment transitions — colors, particles, atmosphere, and weather all cross-fade together.

### Implementation

In `fx/themes.js`, when `applyTheme(newTheme, opts)` is called during navigation:
1. Snapshot the current canvas state (particles, atmosphere frame).
2. Begin a 400ms cross-fade: new theme layers fade in over old ones via `opacity` on the canvas wrappers.
3. Swap particle emitters mid-fade (new emitters start at opacity 0, old ones drain naturally — no pop).
4. Atmosphere engine receives new config and blends its tint/overlay over 400ms.
5. Weather layer (§8) swaps immediately (no blend needed — weather is additive on top).

Respect `prefers-reduced-motion`: skip the fade, snap instantly.

**Accept when:** navigating from the default Flower theme to a Space-themed widget visibly transitions all particles, atmosphere, and colors over ~400ms.

---

## §5 — Immersiveness & Coziness Pass

### Widget opacity control

Add `opacity` to the widget config schema (0.1–1.0, default 1.0). In the widget card's CSS: `background: rgba(var(--surfaceRaw), <opacity>)`. Expose the slider in the widget `···` → Edit → Appearance section, labeled "Background opacity" with a live preview. Store as `widget.style.opacity`.

### Sliders with numeric readouts

All sliders across the app (particles, atmospheres, widget settings, etc.) must show their current value as a live number next to the slider. Use a compact `<input type="number">` beside the `<input type="range">` that bidirectionally syncs. Format with appropriate units (px, %, °, ×) derived from the slider's `unit` field.

### Atmosphere/particle disable toggle

Replace the current ambiguous control with a clearly labeled row:
- Section header: **"Visual Effects"**
- Two explicit toggles: **"Particles"** (on/off switch) and **"Atmosphere"** (on/off switch) plus **"Weather"** (on/off switch).
- Toggling OFF disables rendering but preserves the selected preset — re-enabling restores it exactly. Stored in `meta.settings.fx.particlesEnabled`, `.atmosphereEnabled`, `.weatherEnabled`.
- Visual: standard `role="switch"` toggles (same component as elsewhere in settings), not a mystery icon.

### Settings & module buttons covering widget 3-dots

Move the top-right chrome buttons (Settings gear, Module switcher) to a **unified top-right menu** that collapses into a single small icon (24px) in the safe area corner, reducing overlap with widget menus. Specifically:
- On mobile (< 600px): combine Settings + Module into a single `···` icon button at top-right, 44×44px tap target, opens a small popover with two items: "Settings" and "Modules".
- On desktop (≥ 600px): keep both icons but reduce size to 20px and ensure they have ≥ 8px gap from the widget's `···` menu by pushing the tab bar's z-stack so widgets' 3-dot menus render above the chrome row.
- Alternatively, move the chrome row to the **bottom safe area** on mobile, above the FAB (§3).

**Accept when:** on a 360px phone, the top widget's `···` menu is never obscured by chrome buttons.

---

## §6 — Particles Overhaul

### Particle picker UI

Replace the scrolling list with a **grid of thumbnail cards** (3 columns on mobile, 4–5 on desktop). Each card: a small animated canvas preview (64×64) + particle name beneath. Clicking a card selects it. A search/filter bar sits above the grid. Categories (Nature, Celestial, Weather, Magic, Tech, Custom) as horizontal filter chips.

### Multi-layer particles

Already implemented via CR-7. Ensure the new picker applies to each layer independently.

### Particle creator enhancements

**Behavior names:** rename to plain English — `Fall Down` → "Fall", `Float Up` → "Float", `Move Left` → "Move Left", `Move Right` → "Move Right". Add new behavior: **Swim** (randomizes X and Y velocity at small random intervals, like a fish drifting — range ±vx, ±vy configurable).

**Angle:** add `angle` property (0–360°) — the particle's visual rotation stays fixed at this angle regardless of movement direction. Show a rotation wheel control.

**Spawn area:** replace spawn-position selector with:
- **Spawn X range** (slider: 0–100% of canvas width) — defines left/right bounds of the spawn zone.
- **Spawn Y range** (slider: 0–100% of canvas height) — defines top/bottom bounds.
- **Spawn area shape**: Box (rectangle) or Radial (ellipse) — toggle.
- **Spread** (slider, 0–100%) — width/radius of the spawn zone within the range.

**Diagonal flow angle:** a single 0–360° slider replacing the directional preset.

**Effects — fixed and enhanced:**
- **Twinkle:** faster oscillation (period: 0.3–1.0s configurable), stronger opacity range (0.2→1.0 not 0.6→1.0). Rename description to "Twinkle / glitter".
- **Grow:** rename to "Pulse Grow". Max scale 1.5× (not 3×). Smooth sine curve (no sudden pop).
- **Shrink:** rename to "Pulse Shrink". Smooth sine curve, minimum 0.5× scale.
- **Sway:** rename to "Sway Angle" and clarify it affects horizontal drift offset (not spawn angle). Add a separate **"Spawn Angle Spread"** slider (degrees of randomness around the base angle).
- All sliders show numeric values.

**Particles are always optional:** particles can be individually disabled per layer. Theme-specific default particles are on by default but can be turned off or replaced without touching the theme preset (via CR-5 override layer).

**Images and emoji as particles:** in the Custom particle creator, add a source selector:
- **Shape** (existing vector shapes)
- **Emoji** — text input for any emoji; the particle renders it at the configured size with optional color tint.
- **Image** — upload a PNG/JPG/WebP (max 512×512); stored as a data-URL in the particle definition. Images are scaled to the particle's `size` setting.

**Pointer effects and screen particles share one picker.** Both draw from the same particle registry. The effect type (background / pointer / pointer-drag) is a property of the usage slot, not the particle definition.

**Drag particles on mobile:** use `pointermove` with `pointerType === 'touch'` and ensure the throttle is ≤ 16ms. Test on actual device.

### Specific particle fixes

**Remove from particles:** Snow, Rain, Wind (→ §8 Weather), Fire Embers/Streaks (→ §8 Weather).

**Autumn Leaves:** add Autumn Leaf emoji (`🍂`) as a variant alongside the vector particle. Add subtle 2-stop gradient color variation (amber→russet). Increase fall speed by 40%. Keep vector variant as well.

**Summer Leaves:** add Green Leaf emoji (`🌿`) variant. 2-stop gradient (lime→forest). Increase fall speed 40%.

**Cherry Blossoms:** add `🌸` emoji variant. Slight pink hue rotation gradient. Increase fall speed 30%.

**Hearts:** increase base size 30%, reduce count by 40%, increase upward velocity 50%, correct rotation so they float right-side-up. Add gradient (pink→rose→red). Add `❤️` emoji variant.

**Stars:** reduce movement amplitude by 60% (subtler drift). Strengthen twinkle effect (use new Twinkle fix above). Stars stay mostly stationary with a gentle twinkle.

**Shooting Stars:** redesign entirely.
- Remove horizontal line artifact.
- Trail is a tapered gradient line drawn at the particle's `angle` property (default 225° — top-right to bottom-left).
- Particles spawn along the top 30% of the screen (configurable Y range).
- Small (4–8px head), fast (2–4s cross-screen). Trail: 60–120px, fades from bright white → transparent.
- The spawn area controls (§6 creator) apply.

**Bubbles:** reduce count by 30%, increase size 25%, increase upward velocity 25%. Add a random pop animation (scale to 0 + opacity 0 over 100ms) at a random point mid-flight (probability configurable, default 20% per bubble).

**Fireflies:** increase base count by 50%, size +2px, strengthen glow (outer glow radius +4px, peak opacity 0.9). Add random hue rotation per particle (±30° from base green) for color variation.

**Tech Glyphs:** replace with **Binary Rain** — characters are `0` and `1` in a monospace font, falling in vertical columns (Matrix-style), medium green, random column density, fade in/out at top/bottom. Behavior: Fall, with slight random lateral drift per column segment.

**Smoke Wisps:** keep as-is but add gradient color variation per particle (light grey → medium grey → transparent tip). The Grow/Shrink Pulse effects now apply correctly.

**Dust Motes:** remove entirely.

**Dandelion Seeds:** redesign — small elongated teardrop shape with a thin stem and a tiny burst at the top, pale white/cream. Floats upward, gentle sway. Must not look like a star.

**Comets:** same spawn/angle redesign as Shooting Stars but:
- Larger head (12–16px), much longer trail (150–300px).
- Head color: deep blue/cyan. Trail: bright white → cyan → transparent.
- Slower than shooting stars (4–8s cross-screen).
- Trail uses a thick-to-thin tapered stroke, not a uniform line.

**Custom:** all creator options from above apply.

---

## §7 — Atmospheres Overhaul

Every atmosphere must have a clearly labeled slider with a numeric readout and a tooltip describing exactly what it controls.

### Existing atmosphere fixes

**Day/Night Cycle:** redesign.
- Sun and Moon are rendered as SVG circles moving along a circular arc (center of canvas as pivot). Sun arc: bottom-left to bottom-right via the top. Moon arc: same path, 180° offset.
- Sky gradient shifts: predawn (deep blue-violet) → sunrise (amber/rose) → midday (bright sky blue) → sunset (orange/deep rose) → dusk (purple) → night (near-black with subtle starfield tint). At least 6 color stops interpolated across the 24h cycle.
- Sun has a soft radial glow (warm yellow). Moon has a cooler silver glow + subtle halo.
- Slider: cycle speed (×0.1 — one real-hour cycle through 24h, to ×10 — a 2.4-minute full cycle). Label: "Cycle speed".
- The gradient tinting applies to the `--bgOverlay` CSS variable so all theme colors are warmed/cooled accordingly.

**Constellations:** redesign.
- Stars: small bright circles (2–4px), soft radial glow, random placement seeded per session.
- Twinkling: each star has independent twinkle timing (0.5–3s period), opacity oscillating 0.4→1.0 with the enhanced Twinkle effect.
- Constellation lines: only connect stars that are genuinely close (max distance: 15% of canvas width). Lines are thin (0.5px), low opacity (0.25), drawn in the constellation's accent color.
- Preset constellation shapes: Orion, Ursa Major, Cassiopeia, Scorpius, and 4 others — chosen randomly per session, rotated to look natural.
- The whole starfield slowly pans/rotates across the sky (very slow, 60s per full rotation by default).
- Slider: rotation speed.

**Sunset:** reposition to center-bottom of the canvas. The sun disk (80–150px radius) sits at the horizon. Sky radiates upward through: deep gold → amber → rose → violet → dark indigo. Slider: sun position (0% = fully below horizon/night colors, 50% = horizon/golden hour, 100% = high in sky/bright day). Colors shift realistically with position.

**Sunrise:** same as Sunset but reversed color ramp and the sky transitions from pre-dawn grey-blue → pale gold → soft peach → warm white. Slider: same sun position control.

**Waves:** rewrite the wave renderer.
- Full-width sinusoidal wave forms, 3–5 stacked waves with slight phase offsets (depth layering).
- Each wave: translucent fill from the crest down, so they look like ocean swells.
- Crests have subtle white foam highlights (thin bright stroke).
- Waves fill the bottom 30–50% of the canvas.
- Colors derived from theme accent (ocean blue, etc.).
- Slider: wave size & energy (affects amplitude, speed, number of layers simultaneously).

**Remove:** Clouds atmosphere → moved to Weather (§8).

### New atmospheres

**Mountain Range:**
- Silhouette layers (3–5) of jagged mountain peaks, each a slightly different shade/transparency.
- Foreground layer darkest, background lightest (depth).
- Optional: small waterfall ribbons (thin white vertical streaks) and tree silhouettes at foothills (random density).
- Slider: terrain variation — 0% = gentle rolling hills, 100% = dramatic sharp peaks with waterfalls and dense forest.

**Forest:**
- Tree silhouettes of varying heights and species (pine, oak, willow) rendered as SVG-like shapes.
- Layered depth (3 layers, each slightly lighter).
- Subtle light rays through the canopy (optional, toggleable).
- Slider: forest density (sparse meadow → dense old-growth).

**Solar System:**
- Sun at canvas center-left (large, warm radial glow).
- Planets (8 preset: Mercury → Neptune) in elliptical orbits, sizes/colors accurate-ish.
- Each planet has a subtle glow in its theme color.
- Orbits shown as faint ellipse lines (very low opacity).
- Slider: orbit speed multiplier.

---

## §8 — Weather / Screen Effects

Weather effects are a new layer — they sit *above* atmosphere (which is background) but *below* widget cards, except for specified effects that appear on top of everything. Weather can be enabled/disabled globally and per-effect. **Weather must never interfere with the user experience** — effects are decorative and interactive, not obstructive.

New store key: `meta.settings.fx.weather` = `{ enabled: bool, activeEffect: string | null, intensity: number 0–1 }`.

New engine: `fx/weather.js`. One canvas per visual layer (background and foreground). Foreground canvas: `position: fixed; inset: 0; pointer-events: none; z-index: 150` (above widgets but `pointer-events: none` so UI stays interactive, except for interactive elements that use a separate overlay).

### Snow

**Background:** snowflakes fall (reuse particle engine, remove from §6 weather-specific removal).

**Screen effect (foreground):**
- Frosted glass vignette on screen edges (CSS `backdrop-filter: blur()` strip along all four edges, animated to grow slightly over time).
- Icicles grow downward from the top edge: thin tapered polygons, semi-transparent blue-white, grow at rate set by slider.
- Tapping an icicle: shatters animation (particles burst outward, icicle disappears, new one begins growing in its place over 10–60s).
- Slider: icicle growth speed.

### Rain

**Background:** rain streaks (angled lines, fast, semi-transparent).

**Screen effect:**
- Water droplets appear on the screen surface (rendered as small circular blobs with a slight refraction distortion shader or CSS `backdrop-filter: blur(1px)` clip). Accumulate slowly over time.
- Tapping a droplet: it "runs" downward (animated path, fading as it goes).
- Slider: droplet accumulation rate.

### Clouds

**Background:** clouds drift horizontally (left ↔ right) across the sky area. Cloud shapes: soft fluffy polygons with blurred edges.

**Screen effect (top):** lighter, more transparent cloud wisps drift across the top 20% of the screen.

**Interaction:** tapping a cloud causes it to puff apart into 3–5 smaller clouds that continue drifting off-screen.

**Slider:** cloud type (0% = small, white, peaceful cumulus → 100% = large, dark, stormy cumulonimbus).

### Wind

**Background:** horizontal streaks across the full canvas, semi-transparent, fast. Density and opacity vary.

**Screen effect:** subtle wind streaks appear and fade across the entire screen at random intervals (very low opacity, don't cover content).

**Widget effect:** widgets have a gentle "wobble" — a very slight CSS `rotate()` oscillation (±1–2°) at a slow period (3–6s). Amplitude increases with slider value.

**Slider:** wind speed (affects streak speed, density, and wobble strength).

### Fire

**Background:** a realistic fire at the bottom-center of the screen. Flames use a particle simulation: warm particles (yellow → orange → red → smoke grey) rise and fade. Ember particles shoot upward randomly.

**Screen effect:** warm amber glow at the bottom edge (radial gradient overlay, low opacity).

**Interactive element:** 3–5 s'mores on sticks arranged around the fire at the bottom edge. Each s'more starts un-cooked (pale marshmallow). Cooking progress shown visually (marshmallow browning animation over time). When fully cooked: a subtle sparkle effect. Tapping a cooked s'more: eating animation (shrink + fade), replaced by a new un-cooked s'more at a random position around the fire after 2s.

**Slider:** fire size and s'more cooking speed.

**Accept when:** all five weather effects are toggleable independently, appear in the correct layers, interactive elements respond to touch/click, and no weather effect blocks tapping any widget.

---

## §9 — Themes Overhaul

Theme editing opens as a dedicated **Page** (not a settings scroll). The "Edit" button on any theme navigates to `/theme/<id>/edit` — a full-page editor with sections for Colors, Gradient, Effects, and Preview.

### Theme gradient editor

`bgGradient` supports 2–6 color stops. The editor shows a linear gradient preview bar with draggable stop handles. Each stop: color picker + position (0–100%). Angle picker (0–360°). Live preview on the app background.

### Preset theme updates

**Flower:**
- Gradient: soft cream → blush pink → rose → pale lilac (135°, 4 stops).
- Accents: deeper rose, petal pink glow.
- Default particles (layer 1): Cherry Blossoms. (layer 2): Stars (subtle).
- Default atmosphere: Day/Night Cycle (slow, daytime locked default).
- Remove excessive brightness — shift base lightness down 8%.

**Space:**
- Gradient: deep indigo → vibrant nebula purple → midnight blue → black (200°, 4 stops). Must feel like a galaxy, not just dark purple.
- Accent: electric violet, with cyan glow tokens.
- Default particles (layer 1): Stars. (layer 2): Comets (rare, slow).
- Default atmosphere: Constellations.

**Forest:**
- Gradient: deep forest green → moss → sage → warm cream (160°, 4 stops). Richer, more saturated.
- Default particles (layer 1): Summer Leaves (green leaf emoji variant). (layer 2): Forest Flowers.
- Default atmosphere: Forest.

**Ocean:**
- Gradient: deep abyss navy → teal → seafoam → pale aqua (190°, 4 stops). Gradient rises from bottom to match waves.
- Default particles: Bubbles + Tropical Fish (🐠, 🐡, 🐟 emoji variants, gentle swim behavior).
- Default atmosphere: Waves.

**Sunset:**
- Gradient: deep plum → rose red → ember orange → warm gold (170°, 4 stops). Richer — should feel like a real golden hour.
- Default particles (layer 1): Fireflies. (layer 2): Stars.
- Default atmosphere: Sunset (sun at horizon by default).

**Sunrise:**
- Gradient: pre-dawn grey-blue → soft lavender → pale peach → warm gold (170°, 4 stops). Must be distinctly different from Beach/Sunset.
- Default particles: Dandelion Seeds + Stars.
- Default atmosphere: Sunrise (sun just below horizon by default).

**Beach:** Remove this theme entirely.

**Solar System:**
- Gradient: near-black → deep charcoal → dark slate → subtle midnight blue (four stops, dark but nuanced). Spice: add a faint nebula-like color smear (magenta or teal tint in mid-gradient).
- Default particles: Stars + Shooting Stars + Comets.
- Default atmosphere: Solar System.

**Crimson → Autumn:**
- Rename to "Autumn". Gradient: burnt sienna → deep amber → russet → warm brown (145°, 4 stops). Rich autumn palette.
- Default particles (layer 1): Autumn Leaves. (layer 2): Fireflies.
- Default atmosphere: Forest (or new autumn-specific forest variant).

**Accept when:** all themes show visibly distinct, rich gradients and their default particles + atmosphere are set correctly.

---

## §10 — Save Data: Full Reset

Add to Settings → Saves:

**"Reset All Data"** action (dangerous — place at bottom, with a red destructive style).

Three-step confirmation:
1. Tap "Reset All Data" → bottom-sheet appears: "This will permanently delete all your modules, pages, widgets, objects, themes, and settings. Are you sure?" → two buttons: "Cancel" and "Delete Everything".
2. Tap "Delete Everything" → second confirmation: "Are you absolutely sure? This cannot be undone." → "Cancel" and "Yes, Delete Everything".
3. Third step: a text-input dialog: "Type DELETE to confirm." → text input → "Confirm Reset" button (only enabled when input exactly equals "DELETE").

On confirmed reset: clear all IndexedDB stores, clear `localStorage`, reload the app. Show no animation — just a clean restart.

**Accept when:** a user who mistaps cannot accidentally delete data; only someone who completes all three steps loses data; after reset, the app starts fresh with onboarding.

---

## §11 — Module Organization

### Categories, subcategories, and tags

Module schema gains:
```js
{
  category: string,       // e.g. "Personal", "Gaming", "Work", "Creative"
  subcategory: string,    // e.g. "D&D", "Health", "Finance"
  tags: string[],         // e.g. ["habit", "journal", "wellness"]
}
```

Preset modules get appropriate defaults. User-created modules can set these in the New Module / Edit Module flow.

### Module list redesign

- The Modules panel (§3) opens to a **categorized view**:
  - Top: search bar (searches name, category, subcategory, tags).
  - Below: collapsible category groups (disclosure triangles). Each group shows subcategory subgroups (another level of disclosure). Modules appear as rows within their subcategory.
  - Uncategorized modules appear in a default "General" group.
- The Module Templates gallery (presets) uses the same structure.

### Home star

Pages designated as "Home" for a module show a small ⭐ indicator (filled star, 12px, `color: var(--accent)`) in the top-right corner of the page content area — subtle, not distracting.

---

## §12 — Widget Improvements

### Hold-to-move threshold

Increase hold duration before widget enters drag mode: 600ms (from current ~200ms). During the hold, the widget shows a subtle border glow that grows over the hold duration (CSS animation on `box-shadow` from 0→max over 600ms). On release before threshold: no move. On threshold reached: haptic feedback if available (`navigator.vibrate(30)`), widget is now draggable.

### Widget context menu

Replace current `···` menu options with: **Edit** · **Copy Widget Code** · **Delete**.
- Remove "Theme" (merged into Edit → Appearance tab).
- Remove "Move to Page" (use hold-drag instead).
- The glow on `···` tap should be subtle — a gentle highlight on the menu button only, not the entire widget card flashing.

### Widget drop zones

When dragging a widget, show three drop indicator types: "Drop above [widget name]", "Drop below [widget name]", "Drop inside [widget name]" (for Separator widgets). Indicators are clean line separators with a small label.

### Widget internal views

All widgets open their internal view as a **Page** (CR-11). The internal view must show the widget's full data and configuration. Specifically:

---

## §12a — Alarm Widget Overhaul

**Rename** to just "Alarm". **Never display military time** (always 12h AM/PM).

Widget page view: active/upcoming alarms, active countdowns (timers), stopwatch display.
Widget internal view (Page): full Alarm, Stopwatch, and Timer management.

**Alarms:**
- Each alarm has: time (12h), days of week (toggle each day) OR "every N days at [time]", name, enabled toggle, Profile assignment.
- Categories/Profiles for grouping alarms (e.g., "Morning Routine", "Work", "Medications").
- Upcoming alarms shown as notifications inside the app (not OS notifications initially — OS notification support as a later enhancement).
- Notification shows: alarm name, time remaining, and buttons to +5min / +10min / Dismiss.

**Stopwatch:** Start / Stop / Lap / Reset. Laps displayed in a scrollable list below the timer. Display format: `MM:SS.ms`.

**Timers:**
- Each timer: duration (HH:MM:SS input), name, category/profile.
- Multiple timers can run simultaneously.
- Completion triggers an in-app notification.

**Profiles (alarm/timer presets):**
- Name, color, icon.
- Settings: alarm sound (from built-in set — no external files initially), volume (0–100%), volume fade-in (off / 5s / 15s / 30s / 60s), fade-in interval, vibrate (off/soft/medium/strong), vibrate pattern, vibrate delay, loop sound, override DnD (flag — actual enforcement depends on OS permissions).
- Pre-alarm: optional alarm that fires N minutes before the main alarm. Has its own volume/vibration settings. No snooze on pre-alarm.
- Post-alarm confirmation: after alarm is dismissed, waits N minutes then sends a "Are you awake?" confirmation prompt. If not confirmed within N seconds, alarm plays again. Separate volume/vibration settings.

**Accept when:** user can set a 7:30 AM alarm for Mon/Wed/Fri with a "Morning" profile, see it in the widget, receive an in-app notification, and dismiss or add 5 minutes via the notification.

---

## §12b — Calculator Widget Overhaul

Widget page view: standard calculator (number pad + basic operations).
Widget internal view (Page): Desmos-style graphing calculator.

**Basic calculator:** standard layout, history of last 10 calculations shown above the display.

**Graphing calculator (internal view):**
- Equation input panel (left on desktop, bottom sheet on mobile): add/remove equations, each with a color, toggle visibility.
- Supports: `y = f(x)`, parametric, inequalities, tables of values.
- Canvas: zoomable/pannable coordinate plane, axis labels, grid lines.
- Takes heavy inspiration from https://www.desmos.com/calculator (feature parity as a goal, but built with vanilla JS + canvas — no iframe embed).
- Equations are saved with the widget.

**Accept when:** basic calculator computes correctly; graphing view renders `y = sin(x)` as a smooth wave on a pannable canvas.

---

## §12c — Calendar Widget

Widget page view: monthly view with event dots.
Widget internal view (Page): full calendar with month/week/day view toggle.

Implement to Google Calendar-level feature parity (local data only initially, sync via §1 later):
- Events: title, date/time (start + end), recurrence (none / daily / weekly / monthly / custom), color, notes, location (text).
- Month view: events shown as colored chips on days.
- Week view: time-grid with events as blocks.
- Day view: hour-by-hour with events.
- "Add event" from any view: tap on a day/time slot.
- Optional: deep link to Google Calendar or TimeTree (open in browser, not embedded).

**Accept when:** user can create a recurring weekly event, see it across month/week/day views, and tap it to edit.

---

## §12d — Canvas Widget Fix

Drawing must occur exactly at the pointer position. Fix the offset bug: use `canvas.getBoundingClientRect()` and subtract `rect.left`/`rect.top` from pointer coordinates. Apply to both mouse and touch events. Test at all page scroll positions and zoom levels.

Widget page view: shows the live canvas (tappable → opens internal view).
Widget internal view (Page): full canvas editor (same tool subset as Infinite Canvas but without infinite scroll — fixed canvas size, user-set in widget settings).

---

## §12e — Character Sheet

Follows D&D 5e by default with options for D&D 3.5e, 4e, Pathfinder 1e, Pathfinder 2e, and Starfinder. Take heavy design inspiration from https://www.dndbeyond.com/.

Each edition has its own schema and form layout. The edition is set per-character and cannot be changed post-creation (with a warning).

Widget page view: key stats — HP (current/max), AC, Initiative, Speed, Passive Perception.
Widget internal view (Page): full character sheet, organized into tabs: Attributes · Combat · Skills · Spells · Equipment · Features · Bio · Notes.

---

## §13 — D&D Widgets → Tabletop Widgets

Rename all D&D-specific widgets to "Tabletop" equivalents. They support all systems listed in §12e.

- "D&D Character Sheet" → "Character Sheet" (§12e).
- "D&D DM Manager" → "Tabletop DM Manager".
- All widgets display system-accurate information — pull rulebook data from public SRDs (5e SRD is CC-BY-4.0, embed the relevant tables directly in `js/presets/tabletop/`).
- Take inspiration from: D&D Beyond, 5e Companion, Royal Road (for layout/UX), RPG Notebook.

---

## §14 — Infinite Canvas: See CR-10, CR-12, CR-13 (all ✅ complete)

No new work needed. If regressions appear, file as CR-16+.

---

## §15 — World Map Overhaul

All issues per user feedback. Approach: treat this as a full rewrite of `WorldMap` on top of the existing tile/sector engine from CR-10/12.

**Brush fixes:**
- Land brushes must use proper smooth stroke rendering (same stroke-buffer pipeline from CR-13).
- Brush options: size, opacity, hardness, color (all shown as numeric values).
- Brush preview cursor (show brush size/shape at pointer).

**Stamps:** use the My Stamps system from CR-14.

**Text boxes:** use the rich text-box objects from CR-10/14 (movable, re-editable, Notes-style formatting).

**Pointer tool:** as defined in CR-14.

**Text curve bug:** when text is curved along a path, it must be stored as an editable object (not rasterized on creation). The user can select it with the pointer tool and edit text or curve amount at any time. Zoom/pan should not cause the text to be embedded permanently.

**General fix:** ensure the canvas is not stretched/distorted on any viewport. Use correct `devicePixelRatio` scaling.

---

## §16 — Canva-Style Canvas

New widget type: **Canva Board**. A design-oriented canvas distinct from the drawing Infinite Canvas and the World Map.

Widget page view: thumbnail of the current board design.
Widget internal view (Page): full Canva-like editor.

**Features:**
- Object-based (not raster): Text boxes, Shapes (rectangle, circle, triangle, custom polygon), Images (uploaded), Icons (from `js/ui/icons.js` + emoji), Lines/arrows.
- Each object: position, size, rotation, opacity, layer order (z-index), lock (prevents selection/move).
- Text: font size, weight, color, alignment, line height.
- Shapes: fill color, stroke color, stroke width, corner radius.
- Pages/slides: multiple pages within one board (like Canva slides). Navigation: page thumbnails at bottom.
- Templates: a small set of pre-built board templates (blank, simple card, poster, phone wallpaper).
- Export: render to PNG (via `canvas.toDataURL()`).

**Accept when:** user can place a text box, a colored rectangle, and an image on a board, rearrange their layers, and export as PNG.

---

## §17 — Tracker Overhaul

The existing Tracker widget is too limited and messy. Redesign from scratch (preserve existing data — migrate from old schema).

**Tracked item types:**
- **Count** — increment/decrement integer. Shows current value, goal (optional), and a circular progress ring.
- **Measure** — record a decimal value with a unit (kg, km, cups, etc.). Shows last recorded value and a mini sparkline of recent entries.
- **Scale** — rate on a 1–N scale (configurable N, default 10). Shows last rating as filled circles/dots.
- **Yes/No** — boolean daily check. Shows streak + last 7 days as colored dots.
- **Timer** — how long something was done. Shows today's total.
- **Text note** — a short free-text entry per day (for qualitative tracking).

**Display:** each item is a card with: name, type icon, current value (large), progress toward goal (if set), and a sparkline (last 7/30 days, toggled by a small chart icon).

Shows **percentage** and **days tracked** prominently.

**History view:** tapping an item opens its full history — a graph (line or bar, auto-selected by type) of all recorded data, date picker to view any past entry.

**Widget width:** implement properly — Tracker items reflow between 1 and 2 columns based on the widget's width setting (`widget.style.colSpan`). On mobile: always 1 column.

**Accept when:** user can track water intake (Count, goal 8), mood (Scale 1–10), exercise (Yes/No), and see their 7-day trend for each in the widget card.

---

## §18 — Widget Separators / Category Dividers

Rename "Separator" to **"Category Divider"**.

Redesign: a divider widget is a collapsible section header. Widgets placed "inside" a divider are visually indented and collapse/expand with the divider.

**Implementation:**
- Divider widget has a `children: widgetId[]` array.
- In the widget grid, children are rendered indented (16px left padding on mobile, 24px on desktop) below their parent divider.
- The divider row has: an expand/collapse chevron (left) · section name (center-left) · widget count badge · `···` (right).
- Collapsing hides all children with a smooth `height: 0` transition.
- Drag-and-drop: a widget can be dragged *into* a divider (drop on the divider header → becomes a child) or *out of* a divider (drag to the space between sections).
- Nested dividers allowed (max depth: 3).
- The `+` button's Widgets panel (§3) shows dividers with their children indented.

**Accept when:** user creates a "Morning Routine" divider, places Habit, Health, and Journal widgets inside it, collapses it to one row, and expands it again.

---

## §19 — Graphs Overhaul

All graph types get:
- Clean, modern style (thin lines, subtle grid, nice axis labels).
- Numeric value labels on data points (optional toggle, default on).
- Legend (optional).
- Color picker per data series.
- Smooth bezier interpolation option for line graphs.
- Hover/tap tooltip showing exact value at that point.

**Graph types:**
- Line (existing, fix rendering)
- Bar (vertical and horizontal)
- Pie / Donut
- Area (filled line)
- Scatter
- **Flower Graph** (existing, CR-6 fixes applied)
- Sparkline (tiny, inline, used by Tracker §17)
- Radar / Spider (for character stats, etc.)

**Accept when:** a Line graph with 7 data points renders cleanly with value labels, a visible legend, and a tap tooltip on a 360px viewport.

---

## §20 — Quests Overhaul

Quests are a key gamification feature. The current implementation needs a UX rewrite.

**Quest card redesign:**
- Each quest: banner image (optional, user-uploaded or emoji) · title · description · progress bar (n of N steps completed) · XP reward · difficulty badge (Easy/Medium/Hard/Legendary) · due date (optional).
- Cards in a vertical scrollable list with subtle card separation.
- Filter/sort bar: filter by status (Active/Completed/Failed), difficulty, due date; sort by due date / XP / alphabetical.

**Quest creation (simplified):**
- Title · Description · Steps (checklist items, reorderable) · XP reward (auto-suggested based on step count) · Difficulty · Due date · Linked Objects (link to habits/goals/trackers — uses existing value system).

**Quest progress:**
- Each step is a checkbox. Completing all steps triggers the "Quest Complete" celebration animation (existing).
- Partial progress is shown on the card.
- Failed quests (past due, incomplete): shown in a "Failed" section, can be reactivated.

**Accept when:** user creates a 5-step quest, completes 3 steps, sees 60% progress on the card, and the celebration fires when step 5 is checked.

---

## §21 — Game Widgets

New widget category: **Games**.

### Mini Games (standard widgets)

**Snake:** classic Snake game in a widget-sized canvas. Touch controls (swipe to turn) + keyboard (arrow keys). Score displayed. High score persisted in widget data.

**Solitaire (Klondike):** standard Klondike solitaire. Card graphics from SVG. Touch-drag to move cards. Auto-complete when winnable.

Both open to full-page view (CR-11 Page) for a bigger playfield.

### Blossoms (flagship game — high priority)

Blossoms is a cozy clicker/strategy/sim hybrid. It is a special widget that can run in both widget card view and full-page view.

**Resources:** Blossoms 🌸, Food 🍎, Housing 🏠, Wood 🪵, Ore ⛏️.

**Core loop:** tap the Large Blossom → gain Blossoms. Use Blossoms + resources to buy upgrades, buildings, and units.

**Map:** the planet is a **grid** (3 layers):
- Layer 1 (Micro): individual building plots, farm tiles, quarry cells, logging cells. The "ground floor" where citizens live and work.
- Layer 2 (Macro): your Kingdom — grows as Layer 1 fills out. Camp → Village → Town → City → Kingdom.
- Layer 3 (Global): your Empire — consists of multiple Kingdoms across the planet grid.

Map is **randomly seeded** per save (ore deposits, wood zones, enemy camps at preset locations). Seed is stored in save data.

**Buildings (Layer 1):**
- **Blossom** — large interactive tappable object. Tapping yields Blossoms. Upgradeable (more per tap, auto-tap frequency).
- **Farm** (crop types: Wheat, Berry, Carrot, Sunflower; animal types: Chicken, Cow, Rabbit) — yields Food. Better varieties cost more.
- **Quarry** (ore types: Iron, Copper, Bronze, Gold, Diamond) — yields Ore. Tiered quality.
- **Logging Site** (tree types: Pine, Oak, Redwood) — yields Wood. Tiered quality.
- **Home** (types: Tent, Cabin, House, Manor) — increases Housing capacity.

**Villagers:**
Types: Peasant, Worker, Knight, Prince, Princess, Queen, King.
Villagers require Food (per villager per period) and Housing (per villager).
Assigned jobs: Farm / Quarry / Logging Site / Blossom (tapping assist).
Better villager types are more productive.

**Battles (Side-scrolling strategy, Layer 1 → 2):**
- Enemy Camps exist on the map. Each camp has a level (1–10).
- Attacking a camp opens a side-scrolling battle view (left-right lanes, like Stick War / Battle Cats).
- Player units deploy from the left. Enemy units deploy from the right.
- Units: Peasant (cheap, weak), Worker (medium), Knight (strong, expensive). Unlocked progressively.
- Units have HP and attack. Player taps to deploy units (costs Blossoms). Enemy AI deploys automatically.
- Win → capture the camp and its resources. Lose → no penalty, retry.

**Progression:**
- Each Layer 2 Kingdom is conquered when all enemy buildings are defeated.
- Each Layer 3 Empire is conquered when all Kingdoms are taken.
- Goal: fill the planet.

**Auto-saving:** every 60 seconds + on `visibilitychange`. Save includes the map seed, all building states, all resource counts, all villager assignments.

**Import/export:** Blossom Code for the save (uses existing `blm:` code system).

**Widget card view:** shows the large Blossom (tappable), current Blossom count, and a mini resource summary.

**Full-page view:** full game interface — map overview, resource HUD, Blossom tap target, build menus.

**Accept when:** user can tap the Blossom 10 times, see their count increase, build a Farm, assign a Peasant to it, and see Food incrementing. Map renders correctly on 360px viewport.

---

## §15 — Order of Work (V2)

Work in this sequence. Mark each `✅ date` when acceptance criteria pass on 360px + desktop.

| # | Feature | File(s) | Status |
|---|---|---|---|
| V2-1 | Supabase sync + Ko-fi | `js/core/sync.js`, `index.html`, `.env.example`, `config.example.js` | ✅ 2026-06-13 |
| V2-2 | FAB (+) button | `js/ui/fab.js`, `js/ui/navpanels.js`, `css/fab.css` | ✅ 2026-06-13 |
| V2-3 | Settings/module button repositioning | `js/ui/shell.js` | ✅ 2026-06-13 |
| V2-4 | Widget hold threshold + context menu | `js/modules/engine.js`, `css/widgets.css` | ✅ 2026-06-13 |
| V2-5 | Widget opacity setting | `js/widgets/base.js`, `css/widgets.css` | ✅ 2026-06-13 |
| V2-6 | Sliders with numeric readouts | `js/ui/components.js` | ✅ 2026-06-13 |
| V2-7 | Atmosphere/particle/weather toggle redesign | `js/ui/settings.js`, `js/fx/themes.js` | ✅ 2026-06-13 (weather toggle stores pref; engine lands with V2-10) |
| V2-8 | Particles overhaul (picker UI + creator + specific fixes) | `js/fx/particles.js`, `js/presets/particles.js`, `js/ui/particleeditor.js`, `js/ui/particlepicker.js` | ✅ 2026-06-13 (Snow/Rain/Wind/embers kept until Weather V2-10; pointer-FX picker stays a list for now) |
| V2-9 | Atmospheres overhaul | `js/fx/atmosphere.js`, `js/ui/settings.js` | ✅ 2026-06-13 (renders verified non-blank; visual polish wants a visible pass) |
| V2-10 | Weather system | `js/fx/weather.js`, `css/weather.css` | ✅ 2026-06-13 (engine + 5 effects + picker; fine interactions basic; visual polish wants a visible pass) |
| V2-11 | Theme transitions | `js/fx/themes.js` | ✅ 2026-06-13 (environment cross-fades in over 400ms on theme change; colour vars still snap — see notes) |
| V2-12 | Theme page editor + preset updates | `js/presets/themes.js`, `js/presets/particles.js` | 🟡 2026-06-13 (preset gradients/particles/atmospheres done; Beach removed; Crimson→Autumn; Tropical Fish added. Draggable-stop gradient PAGE editor still TODO — existing drawer editor works) |
| V2-13 | Full reset (save data) | `js/ui/settings.js`, `js/core/store.js` | ✅ 2026-06-13 |
| V2-14 | Module categories/subcategories/tags | `js/presets/modules/index.js`, `js/ui/navpanels.js` | ✅ 2026-06-13 |
| V2-15 | Home star indicator | `js/modules/engine.js`, `css/fab.css` | ✅ 2026-06-13 |
| V2-16 | Widget separators → Category Dividers | `js/widgets/separator.js`, `js/modules/engine.js` | 🟡 2026-06-13 (renamed + count badge + indented group + fold; true nested-container with drag-into-divider deferred to a visible pass) |
| V2-17 | Alarm widget overhaul | `js/widgets/alarm.js` | pending |
| V2-18 | Calculator widget overhaul | `js/widgets/calculator.js` | pending |
| V2-19 | Calendar widget | `js/widgets/calendar.js` | ✅ done (v47) |
| V2-20 | Canvas widget pointer fix | `js/widgets/canvas-core.js` | ✅ 2026-06-13 (drawing maps via getBoundingClientRect; card already shows live drawing + taps to full editor) |
| V2-21 | Character Sheet (multi-system) | `js/widgets/character-sheet.js` | pending |
| V2-22 | D&D → Tabletop widgets rename + SRD data | `js/presets/tabletop/` | pending |
| V2-23 | World Map overhaul | `js/modules/worldmap/` | pending |
| V2-24 | Canva Board widget | `js/widgets/canva-board.js` | pending |
| V2-25 | Tracker overhaul | `js/widgets/tracker.js` | pending |
| V2-26 | Graphs overhaul | `js/widgets/graph.js` | 🟡 2026-06-13 (added Area/Scatter/Donut + value labels + legend + bezier smooth + per-series colour; Radar/Spider, Sparkline-as-kind, horizontal bar still TODO) |
| V2-27 | Quests overhaul | `js/widgets/quest.js` | pending |
| V2-28 | Snake + Solitaire game widgets | `js/widgets/snake.js`, `solitaire.js` | ✅ done (v46) |
| V2-29 | **Blossoms game** | `js/widgets/blossoms/` | **high priority** |

---

## Implementation notes — Batch 1 (2026-06-13)

Decisions taken where the spec left room, so later work matches:

- **§3 FAB** is a vertical speed-dial (labelled pills rising from the +) rather than a literal three-arc radial — it reads cleanly at the screen's right edge and keeps the Modules/Pages/Widgets labels legible. Same three destinations, same scrim + `+`→`×` morph.
- **§5 chrome** collapses the top-right Settings + Modules into a single `···` menu button on **all** sizes (not two 20px icons on desktop). One small button meets the "top widget `···` never obscured" criterion, and Modules is also one tap away in the FAB.
- **§1 config** ships as a root `config.example.js` (copy → `config.js`, git-ignored) plus a root `.env.example`. The literal `public/config.js.example` path doesn't fit this no-build, root-served GitHub Pages app; `index.html` loads `./config.js` and fails gracefully when it's absent.
- **§1 sync** model: a local delete also deletes its remote row (so the next pull can't resurrect it). Cross-device delete propagation needs tombstones and is deferred. The `blossom_sync` SQL/RLS in §1 is unchanged.
- **§5/§7 Weather toggle** is stored as `meta.settings.fx.weatherEnabled` (default off) and will be honoured when the weather engine (V2-10) lands. The Particles and Atmosphere toggles are live now (wired through `applyEffects`).
- A reusable `rangeField()` (§6) now lives in `js/ui/components.js`; new sliders use it. Retrofitting every legacy slider is left to each feature's own pass.

## Implementation notes — V2-8 Particles (2026-06-13)

- The engine stays pooled/capped/auto-degrading; new features are additive and back-compatible (old defs render unchanged). Per-particle variety (emoji-alongside-vector, gradient spread, hue jitter) is pre-rasterised into sprite *variants* picked per particle — no per-frame cost.
- New def fields: `behavior:'swim'|'flow'`, `flowAngle`, `angle`, `spawnAngleSpread`, `spawn:{xRange,yRange,shape,spread}`, `twinkle:{period,min,max}`, `gradient`, `hueJitter`, `driftAmp`, `trail:{len,head,mid}`, `shapes:[…]`, `popRate`, and `shape.kind:'image'`.
- `pulseGrow`/`pulseShrink` are NEW sine effects; the legacy age-based `grow`/`shrink` are kept (pointer-FX bursts depend on them) and simply aren't offered in the creator.
- The angle/flow "rotation wheel" (§6) is presented as a 0–360° slider with a numeric readout for now.
- Snow/Rain/Wind/Fire-embers are **not** removed from particles yet — they only move once the Weather engine (V2-10) exists, so nothing regresses meanwhile. Dust Motes removed (Sunset/Beach themes repointed to Fireflies).
- Pointer-FX still uses its dropdown; the shared grid picker is wired for background particle layers. `openParticlePicker({source})` already accepts `'pointer'`, so flipping pointer-FX over is a one-line follow-up.

## Implementation notes — V2-9 Atmospheres (2026-06-13)

- The engine still renders at half-res with one scene at a time; new/redesigned scenes precompute their geometry in `init` so frames stay cheap. Each scene was verified to render non-blank (no errors) by driving `tickOnce` + sampling the canvas — but the dev preview tab runs `document.hidden`, so **visual quality wasn't eyeballed**; a visible pass to tune colours/sizes is the natural follow-up.
- Day/Night, Sunset and Sunrise paint a full-canvas sky gradient (the cozy way to shift the whole scene's colour) instead of mutating a `--bgOverlay` CSS var as §7 suggested — keeps the existing "atmosphere owns its canvas" architecture.
- Each atmosphere now exposes one labelled slider with a numeric readout and a hover tooltip, configured by the exported `ATMOSPHERE_OPTIONS` map and rendered inline in the effects panel.
- Clouds removed from the catalog (→ Weather V2-10); its renderer is kept for back-compat. Forest theme → new `forest` atmosphere; Solar System theme → new `solarSystem` atmosphere (the old constellations `variant:'planets'` path is gone).

## Implementation notes — V2-10 Weather (2026-06-13)

- `js/fx/weather.js` is the new layer: two JS-created canvases — `#weather-bg` (z-index 1, above atmosphere, below cards) and `#weather-fg` (z-index 150, over everything, `pointer-events:none`) — plus a CSS overlay `#weather-fx` (z-index 149) for cheap glows/vignettes. Interactions hit-test from a document click so the UI never loses taps. One effect at a time, off under reduced-motion. Stored in `meta.settings.fx.weather = {activeEffect, intensity}`, gated by the existing `weatherEnabled` master toggle; the engine reacts to a `weather:changed` event.
- All five backgrounds are implemented (snow fall, rain streaks, drifting clouds, wind streaks, a bottom-centre fire sim with embers). Screen effects: snow frost vignette + fire bottom glow (CSS), wind widget wobble (CSS `body.wx-wind .widget-card`, amplitude from `--wx-wob`). Interactions: tap an icicle to shatter (regrows), tap a droplet to run, tap a cloud to puff apart, tap a cooked s'more to eat it (a new one cooks after 2s).
- Each effect was verified to render non-blank (no errors) by driving `weatherTickOnce`; **the dev tab is `document.hidden` so visuals weren't eyeballed.** The interactive timings/curves (s'more cooking speed, icicle regrow, droplet physics) are functional but un-tuned — a visible pass should refine them. Settings: a Weather effect picker (Off/Snow/Rain/Clouds/Wind/Fire) + intensity slider appears under the master toggle.

---

## Implementation notes — V2-12 Gradient editor + weather/fish tweaks (2026-06-14)

- **Gradient editor (§9):** built into the existing `js/ui/themeeditor.js` drawer rather than a separate routed page (deliberate deviation — keeps the calm one-panel pattern and full live preview; a future routed `/theme/<id>/edit` page can wrap the same `buildGradientEditor`). It renders a live gradient bar with draggable colour-stop handles (2–6 stops), a per-stop colour + position input, an angle range/number, and add/remove. Drag updates only the cheap background vars (`liveBar`); discrete changes run the full `preview()` so the **atmosphere re-colours** (it already receives `theme.colors` via `applyEffects → setAtmosphere`); weather keeps running on its own layer. Every theme is now editable — the Themes list shows a **Customize** pencil on presets (opens an editable copy; presets are never mutated) as well as Edit on custom themes.
- **bgGradient format extended:** stops may now carry a position (`"#rrggbb 30%"`). `themes.js · colorVars` strips the `%` for the bare `--bg-grad-1/2` fallback colours and passes full positioned stops to `--bg-image`. Fully backward-compatible with the old pure-colour `[c1,…,angle]` arrays (presets unchanged).
- **Weather/particle tuning (§8 / §6):** fish (`particles.js` `swim`) now glide side-to-side with a gentle bob and flip to face travel direction. Snow icicles have a wider tap target + a bigger shatter burst. Rain spawns from the top **and** left edges (even coverage) with larger, easier-to-tap droplets. Clouds keep their behind-widget drift and gained visible **foreground clouds confined to the top of the screen**. Wind wobble is gentler/slower (`--wx-wob` ≈0.5–1.5°, 6s). Fire is wider with slider-driven height, and s'mores moved well above the bottom nav with a bigger hitbox so they're actually tappable.
- Verified via DOM/state + `weatherTickOnce` (dev tab is `document.hidden`, so visuals/tap-feel still want an on-device pass).

---

## Implementation notes — V2-29 Blossoms game MVP (2026-06-14)

Grill-me'd to a **cozy MVP slice** (battles, villager tiers Knight→King, and the Layer 2/3 Kingdom/Empire are deferred). Built as a widget `blossoms` (`internal:true`, keywords incl. game/clicker/idle — the gallery is a flat searchable list so "Games" is conceptual). Files: `blossoms-data.js` (resources/buildings/villager/tiers/upgrades/grid), `blossoms-engine.js` (pure JSON game + rules: tap, build/upgrade/demolish, recruit/assign, `rates`/`tick`, tier check, `applyOffline`), `blossoms.js` (registration + per-widget live game controller in a module `games` Map, ticked by the shared `fx/loop`, throttled notify, autosave 60s + on hide, offline-on-load, shared view helpers `fmt`/`blossomSVG`/`doTap`/`subscribe`/`save`), `blossoms-ui.js` (full-page: HUD, SVG Blossom tap target, tap/auto upgrades, settlement plot grid, per-plot build/manage sheet). Card view = tappable SVG Blossom + counts + "Open garden". Game state lives in `widget.config.game` (so the existing `wgt` Blossom code exports it). **Design choices:** real-time + capped 8h offline catch-up (gentle "while away" toast); Peasants only (boost +60% each, Food upkeep, Housing cap); settlement tiers Camp→Hamlet→Village→Town unlock plots (4/6/9/12); emoji + soft theme-tinted tiles. CSS in `widgets.css` (`.bl-*`). Verified via engine unit checks + DOM render (all §21 acceptance criteria pass: tap×10, build Farm, build Home, recruit+assign Peasant, Food 0.56→0.92/s; full-page renders 12 plots + 5-resource HUD on mobile), 0 errors. SW v37. **Visuals want an on-device eyeball pass.**

---

## §P — Priority Bugs & Quick UX Fixes (do these first before resuming the V2 table)

These are high-confidence, low-ambiguity fixes. Work them in order before picking up pending V2 table items.

### P-1 — Landscape mode still rotating on mobile

`manifest.webmanifest` already has `"orientation": "portrait"` (CR-15), but that only locks the installed PWA. When opened as a browser tab (not installed), the OS auto-rotate still fires.

Fix: add a `<meta name="screen-orientation" content="portrait">` to `index.html`. Additionally, call `screen.orientation.lock('portrait').catch(() => {})` on app boot in `app.js` (the `.catch` swallows the DOMException on desktop where it's unsupported). This covers both installed + browser-tab cases across Android Chrome.

**Accept when:** tilting a phone in browser tab mode does not rotate the layout.

### P-2 — Widget interaction model: tap to use/open, hold to configure

**Current problem:** users must navigate to widget settings (context menu) to do things that should be directly interactive on the card itself.

**New rule:**
- **Tap widget card** → directly interacts with or opens the widget (e.g. tapping a Note widget opens the note editor; tapping a Counter increments; tapping a Habit checks it off; tapping a Quest opens its steps). This replaces the need to "tap settings" for primary actions.
- **Hold (600ms, per §12)** → enters drag/reorder mode with the glowing border animation.
- **`···` button** (visible on cards, tapped separately) → widget meta-actions only: Edit appearance/settings, Copy Widget Code, Delete.
- The `···` button must always be visually distinct from the widget content area so users never confuse it with interaction.
- Audit every widget type: define its "primary tap action" and wire it directly. Document in `docs/05-widgets.md` per widget.

**Accept when:** tapping a Note card opens the note; tapping a Counter card increments; tapping a Habit card toggles completion — with no trip through settings required.

### P-3 — Widget list in FAB panel should default to collapsed sections (like Modules)

In the Widgets panel (§3 FAB), widgets should be grouped by type (using the same category system as Modules — §11). Groups default to **collapsed** (showing just the group header + count) so the list stays clean. Tapping a group header expands it in-place (same disclosure-triangle pattern as module categories).

Apply the same pattern to the Module preset gallery and any other long list in the app.

### P-4 — Paste page Blossom code does not add page to the active module

**Bug:** importing a page via Blossom code shows a preview but never inserts the page into the current module.

**Fix:** in the code-import flow (`js/core/codes.js` or wherever import resolves), when the decoded type is `page`, append it to `activeModule.pages[]` and call `renderModule()` to refresh the tab bar. Show a success toast: "Page added to [module name]."

**Accept when:** pasting a `pge:` code in the Pages panel adds the page visibly to the current module's tab bar.

---

## §22 — Tracker Widget Revised Spec

*Replaces the spec in §17. Keep existing data — migrate old schema.*

**Philosophy:** the Tracker starts completely empty. The user builds it up by adding tracked items. Clicking into the widget (primary tap, per P-2) opens the tracking view, not settings.

### Tracked item types (revised)

| Type | Interaction | Card display |
|---|---|---|
| **Count** | Tap `+` / `−` buttons directly on card | Current value · unit label · optional goal ring |
| **Measure** | Tap card → number input (keyboard) | Last recorded value + **unit label beside the value** (e.g. "72 kg") |
| **Scale** | Tap card → N-step selector (user sets max, default 10) | Last score as filled dots (1–N) |
| **Yes/No** | Tap card → toggles; user sets how many Yes/No items (each is individually labeled) | Each item as a checkbox row |
| **Timer** | Tap card → starts/stops stopwatch-style | Today's accumulated duration |
| **Text Note** | Tap card → opens single-line input | Today's note (truncated) |

**Unit label:** always shown beside the numeric value on the card. For Count and Measure: configurable unit string (kg, cups, pages, reps, km — user types any string). Never hidden.

**Scale:** user sets the max (2–100). Default 10. Rendered as N dots/steps, filled to the last rating. No "out of 5" restriction.

**Yes/No:** user can add multiple Yes/No items per tracker entry (e.g. "Drank water?", "Took meds?", "Exercised?"). Each is its own labeled checkbox. The card shows all of them.

### Graph inside the Tracker (not settings)

Tapping into the Tracker widget page opens: a list of all tracked items, then below it the **history graph**. The graph shows:
- X-axis: Days / Weeks / Months (user toggles).
- Y-axis: the tracked value.
- For Yes/No items: **% completed** per day (number of Yes answers ÷ total items × 100).
- For Count/Measure/Scale: the recorded value per period.
- **Days tracked** shown as a stat below the graph (e.g. "Tracked 14 of the last 30 days").
- **% goal completion** if a goal is set (circular ring + percentage text).

The graph starts empty and fills as data is recorded. Uses the full Graph engine (§25).

**Accept when:** user creates a Count item "Water" (unit: cups, goal: 8), increments it 6 times from the card, taps into the widget, sees "6 cups" with a 75% goal ring, and a daily bar graph with one bar.

---

## §23 — Graph Widget Full Overhaul

*Replaces §19. The graph is one of the most important widgets — it needs to be powerful, readable, and beautiful.*

### Core requirements

- **Data persistence:** graphs save their data internally (as `widget.config.datasets[]`). Data points are added by: manual entry, linking to another widget's output (value system), or importing a CSV.
- **Multi-dataset:** one graph can show multiple datasets simultaneously. Each dataset has a name, color, and series of `{date, value}` points.
- **Dimensions:** user configures X-axis (time: day/week/month/year OR a categorical label) and Y-axis (the numeric value being measured). Both axes are labeled.
- **Time navigation:** for time-series graphs, a date range picker (7d / 30d / 90d / 1y / All, or custom) filters the visible range.
- **Empty state:** when no data, show a helpful empty state: "No data yet — tap + to add your first entry."

### Chart types

All types share the core requirements above. Each has its own settings panel.

**Standard:**
- **Line** — smooth bezier, optional area fill, multi-series support, value labels on points (optional).
- **Bar** — vertical or horizontal, grouped or stacked, multi-series. Values labeled on bars.
- **Area** — filled line, stacked area for multi-series.
- **Pie / Donut** — single dataset, segments labeled with name + value + %. Donut has a center label showing total.
- **Scatter Plot** — X and Y are both numeric, points plotted. Trend line optional.
- **Bubble Chart** — scatter + a third dimension as bubble size.
- **Radar / Spider** — multi-axis polygon for comparing across dimensions (great for character stats, skill levels).
- **Histogram** — distribution of values in configurable bins.
- **Polar Area** — like pie but with equal angles, area encoding the value.

**Advanced / specialty:**
- **Gauge** — single value shown on a semicircular dial. Min/max configurable. Color zones (green/yellow/red).
- **Funnel** — stages with decreasing values. Conversion % between stages.
- **Pyramid / Cone** — stacked segments, top-to-bottom, widening (pyramid) or narrowing (cone).
- **Mekko (Marimekko)** — two-dimensional bar chart (width and height both encode data).
- **Dual-Axis** — a bar graph + a line graph overlaid, each with its own Y-axis (left/right).
- **Venn Diagram** — two or three overlapping circles, values in intersections.
- **Pictogram** — icons/emoji repeated to represent count (e.g. 7 🌟 icons = 7 days).

**Blossom specials:**
- **Flower Graph (Blossom)** — existing implementation (CR-6 applied).
- **Solar System** — values encoded as planet sizes orbiting a central sun. Fun for comparisons.

**Widget linking dimensions:**
When a dataset is linked to another widget (via value system), these source options are available (examples — not exhaustive):
- Widget's current numeric value (counter, scale, measure).
- Widget's level (Skill, Characteristic).
- Widget's item count (number of objects/tasks inside).
- Widget's streak count.
- Widget's XP total.
- Widget's daily completion % (Habit, Tracker Yes/No).

### Graph settings (per chart)

- Chart type selector (visual grid of chart thumbnails).
- Dataset manager: add/remove datasets, name + color + source (manual or linked widget).
- Axis labels (X and Y custom text + unit).
- Legend (on/off, position).
- Grid lines (on/off, density).
- Value labels on data points (on/off).
- Color scheme (per series or a global palette).
- Animation on load (on/off).
- Background (transparent / surface / custom color).

### Display

All charts render on `<canvas>` (no third-party charting library — vanilla JS). Responsive: re-renders on widget width change. All text uses theme font. Colors pull from `var(--accent)` family by default.

**Accept when:** user creates a Line graph linked to a Skill widget's level, and sees a line chart with labeled axes, today's level plotted, a legend, and a tap tooltip showing the exact value.

---

## §24 — New Organizational Widgets

These widgets exist to solve the organizational chaos caused by long, unstructured widget lists.

### Hub Widget

A container widget that displays other widgets as a clean mini-page inside itself. Think of it as a page-within-a-page at widget scale.

**Configuration:** user adds any widgets to the Hub (same as adding to a page — pick from the gallery). Added widgets are "nested" inside this Hub.

**Card view:** shows a summary row for each nested widget: widget icon · widget name · key stat or value (e.g. Skill level, Habit streak, XP). A small chevron opens the Hub to full view.

**Full-page view (primary tap):** renders all nested widgets in a scrollable view inside the Hub's own page. Each nested widget is fully interactive here. The Hub page has its own name and icon.

**Hub + Widget XP:** the Hub card shows aggregate XP from all nested Skill/Characteristic widgets as a combined progress bar. This is the "much needed organization for long skill lists" use case.

**Use case example:** "Morning Routine Hub" containing Habit, Health, Journal, and Counter widgets — all accessible from one card.

**Accept when:** user creates a Hub, adds 3 widgets, sees them summarized on the card, taps to enter and uses all 3 from within the Hub.

### Page Widget

The inverse of the Hub: instead of nesting widgets inside a container widget, the Page Widget acts as a full module page but rendered *as* a widget on the parent page.

**Configuration:** the Page Widget contains its own independent page (with its own widget list). This page is edited like any other page — full widget gallery, drag/reorder, etc.

**Card view:** shows the page's name + a miniature preview (non-interactive thumbnail).

**Full-page view (primary tap):** navigates into the Page Widget's inner page (a full-screen route, CR-11 Page taxonomy).

**Use case:** nest a long, specific set of widgets (e.g. all "Study" widgets) inside a single Page Widget slot on the main page. The parent page stays clean; the sub-page has full complexity.

**Accept when:** user creates a Page Widget named "Study Tools", adds 5 widgets to it, and taps it from the parent page to navigate into those 5 widgets full-screen.

### Characteristics Widget

A meta-skill widget whose level is determined by the levels of Skill widgets nested within it.

**Configuration:** user nests Skill widgets inside (or links existing Skill widgets by reference). Each linked skill contributes to the Characteristic's XP pool.

**Formula:** `Characteristic Level = f(sum of linked Skill levels)`. Default formula: every 3 linked skill levels = 1 Characteristic level (configurable).

**Card view:** the Characteristic's name, level, icon, and a compact list of contributing skills (name + level).

**Full-page view:** full breakdown of all contributing skills, the formula, and the Characteristic's progression history graph.

**Use case example:** "Athleticism" Characteristic linked to "Running", "Strength", and "Flexibility" skills. As those skills level up, Athleticism levels up.

**Accept when:** user creates "Athleticism", links 3 Skill widgets, levels up one skill, and sees Athleticism's XP increase.

### Skills Widget Enhancement

Skill widget should allow referencing other widgets inside it — so that completing tasks inside the Skill's context directly awards XP without opening the Skill's internal view.

Add: Skill card view shows its linked sub-widgets (Habit, Task, Routine) as a compact checklist. Completing items from the card awards XP. The user does not need to open the Skill to maintain it.

### Quest Board Widget

Similar to the Hub, but displays only **what needs to be done today** from all nested widgets.

**Content:** scans linked Quests, Habits, Tasks, and Routines for items due today or overdue. Displays them as a prioritized checklist.

**Card view:** count of pending items today + a mini checklist of the top 3–5 most urgent. Checkboxes are directly interactive on the card.

**Full-page view:** full list of all today's items, grouped by source widget (Quest → Step, Habit → Today's check, etc.). Each item checkable inline.

**Accept when:** user links a Quest and a Habit to the Quest Board; both today's items appear on the card and are completable without opening either source widget.

### Overview Widget

Displays statistics and summaries from any linked widget. More powerful than a Graph (shows textual stats, progress rings, and sparklines together in a dashboard layout).

**Configuration:** user links any number of widgets. For each, selects which stats to show: level, XP, streak, completion %, last value, goal ring, sparkline, etc.

**Card view:** a responsive grid of stat blocks. Each block = widget name + chosen stat prominently displayed. Tapping a stat block navigates to that widget's page.

**Full-page view:** expanded dashboard with larger stat blocks, more detail, and historical graphs.

**Use case:** link 5 Skill widgets and see all their levels in one dashboard widget. Or link a Tracker + Habit + Goal and see a combined health dashboard.

**Accept when:** user links a Skill and a Habit; the card shows Skill level + Habit streak; tapping either stat navigates to that widget.

---

## §25 — Study Module Overhaul

The Study module replaces the existing Study Guide preset. It has three pages: **Notes**, **Overview**, and **Study**.

### Study Module — Notes Page

The Notes page is the primary note-taking workspace for academic use.

**Default widgets on Notes page:**

**Library Widget (enhanced):** existing Library widget gains **groups**. A group is a named folder. Inside a group: any number of documents (notes, PDFs, imported text). Groups are collapsible. Unlimited nesting (group within group). Search bar searches across all groups and documents. On the Notes page, Library acts as the central filing cabinet for all study materials.

**Notebook Widget** (new — see §26).

**Graph Widget:** shows study statistics derived from the Notebook: total key terms recorded per Subject (bar chart), study/writing hours by time of day (area chart, derived from entry timestamps). Uses the new Graph engine (§23).

### Notebook Widget

The Notebook is a structured note-taking system for academic content, organized as **Classes → Units → Topics → Notes**.

**Structure:**
- **Class** — a course or subject (e.g. "Biology 101"). Contains Units.
- **Unit** — a chapter or module within a Class (e.g. "Unit 3: Cell Division"). Contains Topics.
- **Topic** — a specific subject within a Unit (e.g. "Mitosis"). Contains the actual Notes.
- **Notes (within a Topic)** — rich text content with all Notes widget features plus the Study-specific additions below.

**Navigation:** a three-panel sidebar (Class list → Unit list → Topic list → Notes content). On mobile: drill-down navigation (tap Class → see Units → tap Unit → see Topics → tap Topic → see Notes).

**Notes content within a Topic:**

Includes everything in the standard Notes widget (rich text, checklists, bold/italic, etc.) plus:

**Key Terms:**
Triggered by the pattern `Term: definition text`. The parser identifies:
- `Term:` — the key term (everything before the colon on that line).
- The definition — the text immediately following the colon on the same line.
- `- detail` / `— detail` / `— detail` lines following the term → stored as **Details** for that term.
- `1.`, `2.`, `3.` … numbered lines following → stored as **Examples** for that term.

The term is highlighted inline in the note (soft accent background). The full term card (term + definition + details + examples) is stored separately and accessible in the Elements Widget (§27).

Both inline and separated-line formats are supported:
```
Bouldering: a discipline of rock climbing...
- Unlike roped climbing...
1. Climbing a 4-meter overhang...
```
or on one line:
```
Bouldering: a discipline of rock climbing... - Unlike roped climbing... 1. Climbing a 4-meter overhang...
```

**Themes, Concepts, and Ideas:**
User can highlight any text and tag it as Theme / Concept / Idea (via a selection popover). Tagged text is highlighted with a type-specific color and stored in the Elements Widget alongside Key Terms.

**Card view (Notebook widget):** shows current Class/Unit/Topic breadcrumb + last-edited timestamp + a quick-add button.

**Full-page view:** the full Class → Unit → Topic → Notes navigation interface.

**Accept when:** user types "Mitosis: the process of cell division" in a topic, sees it highlighted, and finds it in the Elements Widget with definition stored.

### Elements Widget

Aggregates all saved Key Terms, Themes, Concepts, and Ideas from all Notebook widgets (or a selected subset).

**Display:**

Four tabs: **Terms** · **Themes** · **Concepts** · **Ideas**.

Each item is a card:
- **Term card:** Term (bold) · Definition · Details (bulleted) · Examples (numbered). Collapsible.
- **Theme/Concept/Idea card:** the highlighted text + the note context (Topic → Unit → Class) it came from.

**Search bar:** searches across all types by text content.

**Filter by Class/Unit:** filter to show only elements from a specific Class or Unit.

**Export:** generate a study sheet (formatted text or PDF) of all Terms/Themes/Concepts from a selected scope.

**Accept when:** after saving 5 key terms across 2 topics, the Elements Widget shows all 5 in the Terms tab with full definitions, filterable by class.

### Study Module — Overview Page

The Overview is the home/dashboard page for the Study module.

**Icon:** instead of a house icon on the top right, the home designation is indicated by the page icon's **color** changing to the accent color (a subtle, clean indicator).

**Default widgets:**
- **Overview Widget** (§24) — links to Notebook, Flashcard, and Quiz widgets; shows total terms recorded, quiz scores this week, flashcards due for review.
- **Graph Widget** — study time per day (area chart, from Notebook entry timestamps).
- **Quest Board Widget** (§24) — today's study tasks: flashcard review sessions, quizzes due, notes to review.
- **Notes Widget** — a simple quick-notes area for today's study session reminders.

### Study Module — Study Page

The Study page is for active recall practice.

**Default widgets:**

**Flash Card Widget** (enhanced — see §27).

**Quiz Widget** (enhanced — see §28).

---

## §26 — Flash Card Widget Overhaul

### Structure

Cards are organized in **infinite nested groups**: Deck → Group → Subgroup → … (no depth limit, configurable).

Example structure:
```
School (root deck)
  └── Biology 101 (class)
        └── Unit 3 (unit)
              └── Mitosis (topic)
                    └── [cards]
```

This mirrors the Notebook structure. When a Notebook exists in the same module, a **"Generate from Notebook"** action creates a matching deck structure, populating cards from stored Key Terms, Themes, Concepts, and Ideas.

### Card format

Each flashcard has:
- **Front** and **Back** sides (rich text, supports images/emoji).
- When generated from Notebook terms: user chooses which fields map to Front/Back:
  - Term → Definition
  - Term → Details
  - Definition → Example
  - Definition → Term (reverse)
  - Example → Term
  - (any combination)
- User can also set the answer order: e.g. "Show definition on front, term on back."

### Study modes

- **Individual deck** or **multiple decks at once** (select any combination of groups/decks).
- **Shuffle** on/off.
- Results after a session are sorted into: **Hard** · **Good** · **Easy** (user rates each card after flipping). Next session can be filtered to just Hard cards, etc.

### Session options

- Number of cards per session (custom or "All").
- Whether to repeat cards in the same session.
- Card flip animation style (flip / fade / slide).

**Accept when:** user generates a deck from a Notebook topic with 5 terms, studies them in Term → Definition mode, rates 2 as Hard, and starts a follow-up session with only the Hard cards.

---

## §27 — Quiz Widget Overhaul

### Core fixes

- **No card limit:** user sets any number of questions. No hard cap.
- **Deck deselection:** all decks can be deselected (no auto-select-all). The user explicitly chooses which decks to test on.
- **Deck organization:** decks shown in the same Class → Unit → Topic hierarchy as Notes and Flashcards. User can select entire groups at once.

### Question types

Each question is built from saved Notebook data (Term, Definition, Details, Examples) or manually created.

**Multiple choice:** user configures:
- What gets displayed as the question (Key Term / Definition / Detail / Example).
- What the correct answer is (any of the above from the same item).
- Where wrong answers come from: same topic / same unit / same class / random. Default: same topic.
- Number of answer options: 2–8 (default 4). If fewer valid distractors exist from the same scope, pull from the next scope up.
- Whether to show if the answer was correct/incorrect immediately (green ✓ / red ✗ buttons) or at the end.

**Matching, True/False, Short answer:** additional types (lower priority, implement after multiple choice is solid).

### Session options

- Question order: sequential or shuffled.
- Whether questions repeat within the session.
- **Format:**
  - One at a time (forward only, no going back).
  - List view (all questions visible, can jump around, bookmark).
  - Scroll view (all visible, scroll through continuously).

### Results

At the end of every quiz:
- Summary: score (X/Y correct, % correct), time taken.
- Full review: every question shown with the user's answer (highlighted green/correct or red/incorrect) and the correct answer (always shown if wrong).
- **Semi-correct** (multi-part questions): if a question had multiple answer components and the user got some right — tracked separately from fully correct or fully wrong.
- Result sorted into three buckets: **Incorrect** · **Semi-correct** · **Correct**.
- Option to retry only Incorrect or Semi-correct questions.

### Quiz history

Every quiz is saved with: date, deck selection, questions, user's answers, correct answers. User can open any past quiz and see the full question/answer review.

**Accept when:** user selects the Biology 101 Unit 3 deck, sets 10 questions (Term → Definition, from same topic), completes the quiz, sees immediate color feedback per answer, and can open the full review at the end.

---

## Updated Work Order (append to §15 table)

Add these rows to the §15 work order table:

| # | Feature | File(s) | Status |
|---|---|---|---|
| P-1 | Landscape rotation fix | `index.html`, `app.js` | ✅ done (v38) |
| P-2 | Widget tap-to-use UX | `js/modules/engine.js`, `registry.categoryOf`, `counter.js`, `dice.js` | ✅ done (v38) |
| P-3 | Widget list grouped + collapsed in FAB | `js/ui/navpanels.js`, `js/widgets/registry.js` | ✅ done (v38) |
| P-4 | Page Blossom code paste bug | `js/core/codes.js`, `js/ui/settings.js` | ✅ done (v38) |
| V2-22 | Tracker revised spec (§22) | `js/widgets/tracker.js` | ✅ done (v39) |
| V2-23x | Graph full overhaul (§23) | `js/widgets/graph.js`, `graph-data.js`, `graph-engine.js` | ✅ done (v40) |
| V2-24a | Hub Widget (§24) | `js/widgets/hub.js` | ✅ done (v41) |
| V2-24b | Page Widget (§24) | `js/widgets/pagewidget.js` | ✅ done (v41) |
| V2-24c | Characteristics Widget (§24) | `js/widgets/characteristic.js` | ✅ done (v41) |
| V2-24d | Skill widget sub-widget references (§24) | `js/widgets/skill.js` | ✅ done (v41) |
| V2-24e | Quest Board Widget (§24) | `js/widgets/questboard.js` | ✅ done (v41) |
| V2-24f | Overview Widget (§24) | `js/widgets/overview.js` | ✅ done (v41) |
| V2-25 | Study Module (§25) | `js/presets/modules/study.js`, `index.js` (home) | ✅ done (v45) |
| V2-25a | Library widget groups (§25) | `js/widgets/docshelf.js` | ✅ done (v45) |
| V2-25b | Notebook Widget (§25) | `js/widgets/notebook.js`, `notebook-parse.js` | ✅ done (v42) |
| V2-25c | Elements Widget (§25) | `js/widgets/elements.js` | ✅ done (v42) |
| V2-25d | Study Overview page config (§25) | `js/presets/modules/study.js`, `shell.js` (home icon) | ✅ done (v45) |
| V2-26 | Flash Card Widget overhaul (§26) | `js/widgets/flashcards.js` | ✅ done (v43) |
| V2-27 | Quiz Widget overhaul (§27) | `js/widgets/quiz.js` | ✅ done (v44) |

---

**Standing rule for V2:** use the `grill-me` skill before implementing any feature in this doc that has unresolved sub-questions. If a section contradicts an existing doc (01–12), V2 wins — update the older doc to match when implementing.
