/* Combo glow (docs/16 §3, earned delight): a soft halo that accumulates on the
   session card during a run of correct answers and gently fades on a miss — no
   red, no punishment. Applied to the *stable* session container (its inner HTML
   re-renders per card, the container persists) so the glow eases smoothly across
   cards. Scales with the Liveliness dial; off at Still / reduced-motion. */

const STEP = 0.34;  // glow added per correct answer
const CAP = 1.6;    // ceiling so a long streak doesn't blow out

/** Attach a combo tracker to a stable container element. */
export function makeCombo(container) {
  let streak = 0, level = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dial = () => document.body.dataset.liveliness || 'gentle';
  container.classList.add('study-combo');

  const paint = () => {
    if (reduced || dial() === 'still' || level < 0.01) {
      container.classList.remove('glow');
      container.style.removeProperty('--combo');
      return;
    }
    const scale = dial() === 'lively' ? 1.3 : 1;
    container.style.setProperty('--combo', (level * scale).toFixed(2));
    container.classList.add('glow');
  };

  return {
    /** Record an answer; returns the current streak length. */
    hit(correct) {
      if (correct) { streak++; level = Math.min(CAP, level + STEP); }
      else { streak = 0; level = 0; }
      paint();
      return streak;
    },
    count() { return streak; },
    clear() { streak = 0; level = 0; container.classList.remove('glow'); container.style.removeProperty('--combo'); }
  };
}
