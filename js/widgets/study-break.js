/* Study break nudge (docs/16 §2, anti-burnout law #5): a gentle, dismissible
   "rest your petals?" offer shown mid-session when it's run long or hit a rough
   patch. Never forced — the user chooses to rest or keep going, and it's offered
   at most once per session. Shared by the flashcard + quiz runtimes. */

import { el } from '../ui/components.js';
import { icon } from '../ui/icons.js';

/** Why (if at all) to offer a breather: a rough patch beats a long stretch.
    @returns {'rough'|'long'|null} */
export function breakReason(count, recentMisses, opts = {}) {
  if (recentMisses >= 4) return 'rough';        // ≥4 of the last 5 missed
  if (count >= (opts.longAt ?? 12)) return 'long';
  return null;
}

/** Render the breather card into `host` (replacing its contents). */
export function showBreakNudge(host, { reason, count, onBreak, onContinue }) {
  const msg = reason === 'rough'
    ? 'These are tricky ones — rest your petals and come back fresh, or keep going?'
    : `You've tended ${count} — a lovely stretch. Rest your petals, or keep going?`;
  const panel = el(`<div class="panel study-break" style="padding:18px;text-align:center">
    <div style="color:var(--accent);margin-bottom:8px">${icon('sprout', 28)}</div>
    <p style="margin:0 0 14px;font-size:0.94rem">${msg}</p>
    <div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="btn btn-primary sb-go">Keep going</button>
      <button class="btn sb-rest">Take a break</button>
    </div></div>`);
  panel.querySelector('.sb-go').onclick = onContinue;
  panel.querySelector('.sb-rest').onclick = onBreak;
  host.innerHTML = '';
  host.appendChild(panel);
}
