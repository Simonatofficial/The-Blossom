/* Widget type registry (docs/04). Every widget type registers itself here;
   new widgets require zero changes elsewhere. */

const types = new Map();

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
  register(def) { types.set(def.type, def); },

  /** @returns {object|undefined} */
  get(type) { return types.get(type); },

  /** @returns {object[]} all registered widget types. */
  all() { return [...types.values()]; }
};
