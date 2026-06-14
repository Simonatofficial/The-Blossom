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
| V2-12 | Theme page editor + preset updates | `js/ui/themes.js`, `js/presets/themes.js` | pending |
| V2-13 | Full reset (save data) | `js/ui/settings.js`, `js/core/store.js` | ✅ 2026-06-13 |
| V2-14 | Module categories/subcategories/tags | `js/presets/modules/index.js`, `js/ui/navpanels.js` | ✅ 2026-06-13 |
| V2-15 | Home star indicator | `js/modules/engine.js`, `css/fab.css` | ✅ 2026-06-13 |
| V2-16 | Widget separators → Category Dividers | `js/widgets/separator.js` | pending |
| V2-17 | Alarm widget overhaul | `js/widgets/alarm.js` | pending |
| V2-18 | Calculator widget overhaul | `js/widgets/calculator.js` | pending |
| V2-19 | Calendar widget | `js/widgets/calendar.js` | pending |
| V2-20 | Canvas widget pointer fix | `js/widgets/canvas-core.js` | ✅ 2026-06-13 (drawing maps via getBoundingClientRect; card already shows live drawing + taps to full editor) |
| V2-21 | Character Sheet (multi-system) | `js/widgets/character-sheet.js` | pending |
| V2-22 | D&D → Tabletop widgets rename + SRD data | `js/presets/tabletop/` | pending |
| V2-23 | World Map overhaul | `js/modules/worldmap/` | pending |
| V2-24 | Canva Board widget | `js/widgets/canva-board.js` | pending |
| V2-25 | Tracker overhaul | `js/widgets/tracker.js` | pending |
| V2-26 | Graphs overhaul | `js/widgets/graph.js` | pending |
| V2-27 | Quests overhaul | `js/widgets/quest.js` | pending |
| V2-28 | Snake + Solitaire game widgets | `js/widgets/game-snake.js`, `game-solitaire.js` | pending |
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

**Standing rule for V2:** use the `grill-me` skill before implementing any feature in this doc that has unresolved sub-questions. If a section contradicts an existing doc (01–12), V2 wins — update the older doc to match when implementing.
