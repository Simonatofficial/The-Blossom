/* Liri content (docs/17 §4 + Transfer Pack 05-companion §9, LOCKED). PURE DATA: the four
   elements + sub-elements, the five starting forms, and the 15-question element quiz. The
   *system* is firm; this exact content (quiz wording, form silhouettes) is a cozy v1 that
   Simon can re-author — final layered creature art swaps in over the procedural draw later. */

/** Element = your fixed elemental nature (Air/Water/Earth/Fire). Colors theme the Liri. */
export const ELEMENTS = {
  air:   { id: 'air',   name: 'Air',   icon: 'wind',    color: '#a9c8ff', deep: '#6f97e6', word: 'clarity & freedom',        subs: ['Wind', 'Storm', 'Sound', 'Aurora'] },
  water: { id: 'water', name: 'Water', icon: 'droplet', color: '#6fc6e0', deep: '#3f96c4', word: 'empathy & flow',           subs: ['Ice', 'Snow', 'Cloud', 'Mist'] },
  earth: { id: 'earth', name: 'Earth', icon: 'sprout',  color: '#a7c87e', deep: '#6f9a4e', word: 'stability & patience',     subs: ['Metal', 'Wood', 'Crystal', 'Clay'] },
  fire:  { id: 'fire',  name: 'Fire',  icon: 'zap',     color: '#ff9b6b', deep: '#e2643a', word: 'drive & transformation',   subs: ['Lightning', 'Lava', 'Ash', 'Light'] }
};
export const ELEMENT_LIST = Object.values(ELEMENTS);

/** The aspect whose level drives the sub-element evolution → an element per aspect (cozy mapping). */
export const SUBELEMENT_BY_ASPECT = { physical: 'earth', mental: 'air', emotional: 'water', social: 'water', recreation: 'fire' };

/** Five starting forms (locked). `ears/body/tail/feature` drive the procedural silhouette. */
export const FORMS = [
  { id: 'flying-fox',        name: 'Flying Fox',        ears: 'big',     body: 'round', tail: 'bushy', feature: 'wings',  blurb: 'Soft, wide-eared, and built to glide.' },
  { id: 'dragon-cat',        name: 'Dragon-Cat',        ears: 'pointy',  body: 'sleek', tail: 'long',  feature: 'horns',  blurb: 'Sleek and curious, with little horns.' },
  { id: 'dog-narwhal',       name: 'Dog-Narwhal',       ears: 'floppy',  body: 'round', tail: 'fin',   feature: 'tusk',   blurb: 'A gentle swimmer with a single tusk.' },
  { id: 'elephant-wolf',     name: 'Elephant-Wolf',     ears: 'bigfloppy', body: 'big', tail: 'tuft',  feature: 'trunk',  blurb: 'Sturdy and kind, never in a hurry.' },
  { id: 'porcupine-squirrel', name: 'Porcupine-Squirrel', ears: 'small', body: 'round', tail: 'bushy', feature: 'spikes', blurb: 'Bright-eyed, quick, a little prickly.' }
];
export const formById = (id) => FORMS.find(f => f.id === id) || FORMS[0];

/* ---- the 15-question element quiz (locked at 15; ¼ of the 16personalities length) ----
   Each answer leans on one axis. Element = N/S first, then T/F (for N) or J/P (for S):
   N+T → Air · N+F → Water · S+J → Earth · S+P → Fire. I/E and A/T are flavor (seed mood). */

/** @type {{q:string, a:{label:string,axis:string}, b:{label:string,axis:string}}[]} */
export const QUIZ = [
  { q: 'A free afternoon opens up. You drift toward…', a: { label: 'imagining what could be', axis: 'N' }, b: { label: 'doing something real and tangible', axis: 'S' } },
  { q: 'When you learn something new, you reach first for…', a: { label: 'the big idea behind it', axis: 'N' }, b: { label: 'the concrete steps to use it', axis: 'S' } },
  { q: 'A friend describes a problem. You instinctively offer…', a: { label: 'a clear, logical breakdown', axis: 'T' }, b: { label: 'warmth and understanding', axis: 'F' } },
  { q: 'Your space tends to be…', a: { label: 'planned and tidy', axis: 'J' }, b: { label: 'open and flexible', axis: 'P' } },
  { q: 'You feel most alive when…', a: { label: 'exploring ideas and possibilities', axis: 'N' }, b: { label: 'present in the here and now', axis: 'S' } },
  { q: 'A good decision is mostly about…', a: { label: 'what makes sense', axis: 'T' }, b: { label: 'what feels right for everyone', axis: 'F' } },
  { q: 'Your ideal day has…', a: { label: 'a plan you can follow', axis: 'J' }, b: { label: 'room to follow the moment', axis: 'P' } },
  { q: 'At a gathering, your energy comes from…', a: { label: 'a few deep conversations', axis: 'I' }, b: { label: 'the buzz of the whole room', axis: 'E' } },
  { q: 'You trust…', a: { label: 'patterns and theories', axis: 'N' }, b: { label: 'experience and evidence', axis: 'S' } },
  { q: 'Feedback lands best when it is…', a: { label: 'honest and direct', axis: 'T' }, b: { label: 'kind and encouraging', axis: 'F' } },
  { q: 'Deadlines feel…', a: { label: 'steadying — I like finishing early', axis: 'J' }, b: { label: 'flexible — I rally near the end', axis: 'P' } },
  { q: 'You recharge by…', a: { label: 'quiet time alone', axis: 'I' }, b: { label: 'being around people', axis: 'E' } },
  { q: 'A story grabs you most for its…', a: { label: 'meaning and themes', axis: 'N' }, b: { label: 'vivid, real detail', axis: 'S' } },
  { q: 'When plans change suddenly, you feel…', a: { label: 'a little thrown — I had a plan', axis: 'J' }, b: { label: 'fine — new plan, let’s go', axis: 'P' } },
  { q: 'At your best, people would call you…', a: { label: 'clear-headed and fair', axis: 'T' }, b: { label: 'caring and kind', axis: 'F' } }
];

/**
 * Score the quiz answers (an array of 'a'|'b') into an element + axis tallies.
 * @param {Array<'a'|'b'>} answers
 * @returns {{element:string, tallies:Object}}
 */
export function scoreQuiz(answers) {
  const t = { N: 0, S: 0, T: 0, F: 0, J: 0, P: 0, I: 0, E: 0 };
  QUIZ.forEach((qq, i) => { const pick = answers[i] === 'b' ? qq.b : qq.a; if (pick) t[pick.axis]++; });
  const intuition = t.N >= t.S; // tie → intuition (Air/Water)
  let element;
  if (intuition) element = t.T >= t.F ? 'air' : 'water';
  else element = t.J >= t.P ? 'earth' : 'fire';
  return { element, tallies: t };
}
