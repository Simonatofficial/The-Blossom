/* Widget type registry (docs/04). Every widget type registers itself here;
   new widgets require zero changes elsewhere. */

const types = new Map();

/* Search keywords per type (CR-2). Kept here so the registry stays the single
   source of search metadata; widget files may also pass their own keywords. */
const KEYWORDS = {
  tracker: ['habit', 'log', 'water', 'sleep', 'mood', 'daily', 'measure'],
  notes: ['write', 'text', 'document', 'rich', 'page'],
  quest: ['task', 'todo', 'streak', 'rep', 'daily'],
  journal: ['diary', 'entry', 'write', 'draw', 'reflect'],
  skill: ['level', 'xp', 'grow', 'rpg'],
  graph: ['chart', 'flower', 'plot', 'visualize', 'stats', 'line', 'bar', 'pie'],
  counter: ['count', 'tally', 'number', 'increment'],
  calendar: ['month', 'events', 'schedule', 'agenda'],
  habit: ['cosmos', 'anchor', 'trigger', 'tiny', 'streak'],
  health: ['vine', 'hp', 'vitality', 'bar'],
  goal: ['target', 'milestone', 'progress', 'seed'],
  market: ['shop', 'coins', 'rewards', 'store', 'buy'],
  canvas: ['draw', 'sketch', 'paint', 'art', 'layers'],
  music: ['audio', 'songs', 'player', 'playlist'],
  alarm: ['timer', 'pomodoro', 'clock', 'focus', 'countdown'],
  gallery: ['images', 'photos', 'pictures', 'lightbox'],
  dice: ['roll', 'd20', 'random', 'dnd', 'tabletop'],
  calculator: ['math', 'numbers', 'scientific'],
  routine: ['checklist', 'morning', 'bundle', 'ritual'],
  separator: ['divider', 'group', 'section', 'fold'],
  time: ['clock', 'date', 'today', 'pinned'],
  notifications: ['inbox', 'alerts', 'milestones', 'feed']
};

export const registry = {
  /**
   * @param {{
   *  type: string, name: string, icon: string, description?: string,
   *  container?: boolean, external?: boolean, internal?: boolean,
   *  defaultConfig?: () => object,
   *  outputs?: (widget: object) => {key: string, name: string, dayKeyed?: boolean, get: (date?: string) => number}[],
   *  renderCard?: (el: HTMLElement, widget: object, ctx: object) => void,
   *  renderFull?: (el: HTMLElement, widget: object, ctx: object) => void,
   *  renderSettings?: (el: HTMLElement, widget: object, ctx: object) => void,
   *  onDayRolled?: (widget: object, ctx: object) => void,
   *  onLinkedChange?: (widget: object, ctx: object) => void
   * }} def
   */
  register(def) {
    def.keywords = def.keywords || KEYWORDS[def.type] || [];
    types.set(def.type, def);
  },

  /** @returns {object|undefined} */
  get(type) { return types.get(type); },

  /** @returns {object[]} all registered widget types. */
  all() { return [...types.values()]; }
};
