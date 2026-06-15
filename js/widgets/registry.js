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

/* Category per type (P-3 / V2 §11). Lets the FAB Widgets panel and the widget
   gallery group long lists into collapsible sections. A widget def may override
   by passing its own `category`; unknown types fall through to 'Other'. */
const CATEGORIES = {
  tracker: 'Productivity', quest: 'Productivity', habit: 'Productivity',
  routine: 'Productivity', goal: 'Productivity', calendar: 'Productivity', alarm: 'Productivity',
  questboard: 'Productivity', reminder: 'Productivity',
  notes: 'Notes & Writing', journal: 'Notes & Writing', docshelf: 'Notes & Writing', library: 'Notes & Writing',
  skill: 'Growth & Rewards', health: 'Growth & Rewards', market: 'Growth & Rewards',
  characteristic: 'Growth & Rewards',
  graph: 'Data & Charts', counter: 'Data & Charts', flowergraph: 'Data & Charts', overview: 'Data & Charts',
  canvas: 'Creative', infcanvas: 'Creative', gallery: 'Creative', music: 'Creative', pinboard: 'Creative', canvaboard: 'Creative',
  notebook: 'Study', quiz: 'Study', flashcards: 'Study', elements: 'Study',
  calculator: 'Utility', dice: 'Utility', time: 'Utility', notifications: 'Utility', separator: 'Utility',
  hub: 'Organization', pagewidget: 'Organization',
  snake: 'Games', solitaire: 'Games', blossoms: 'Games',
  statblock: 'Tabletop', loottable: 'Tabletop', sessionlog: 'Tabletop', initiative: 'Tabletop',
  encounter: 'Tabletop', dndinventory: 'Tabletop', dndcombat: 'Tabletop', dndstory: 'Tabletop',
  dndsheet: 'Tabletop', spellbook: 'Tabletop', pcsheet: 'Tabletop', levelplanner: 'Tabletop',
  worldmap: 'World', worldchars: 'World', civprofile: 'World', wtimeline: 'World',
  lorewiki: 'World', relationshipweb: 'World'
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

  /** Category for a widget type, for grouping long lists (P-3). @returns {string} */
  categoryOf(type) {
    return types.get(type)?.category || CATEGORIES[type] || 'Other';
  },

  /** @returns {object[]} all registered widget types. */
  all() { return [...types.values()]; }
};
