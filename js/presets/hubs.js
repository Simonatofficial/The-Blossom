/* The default Hub map (docs/17 §5.2) — DATA ONLY for Phase 0. A Hub is a real layer above
   Module (Workspace → Hub → Module → Page → Tool → Object): a package of connected modules
   that also links to other hubs. The My Blossom hub is the centre; each aspect module is
   reachable from it and links back.

   A live Hub object (the Phase-1 `hubs` store kind) is:
     { id, name, icon, theme?, moduleIds:[], links:[{toHubId, rel}], identity? }
   This template can't hard-code `moduleIds` (those are minted per install), so it lists
   `modulePresetKeys` instead; the Phase-1 groups→hubs migration resolves them against the
   user's actual modules with a read-through fallback (no data loss, docs/17 §5.1). */

/** @typedef {{ id:string, name:string, icon:string, center?:boolean, aspect?:string, modulePresetKeys:string[], linkKeys:string[] }} HubTemplate */

/** @type {HubTemplate[]} */
export const DEFAULT_HUBS = [
  {
    id: 'hub-blossom', name: 'My Blossom', icon: 'flower', center: true,
    modulePresetKeys: ['blossom', 'starter'],
    linkKeys: ['hub-productivity', 'hub-activity', 'hub-meditation', 'hub-connection', 'hub-entertainment']
  },
  { id: 'hub-productivity', name: 'Productivity', icon: 'target', aspect: 'mental', modulePresetKeys: ['productivity'], linkKeys: ['hub-blossom'] },
  { id: 'hub-activity', name: 'Activity', icon: 'activity', aspect: 'physical', modulePresetKeys: ['activity'], linkKeys: ['hub-blossom'] },
  { id: 'hub-meditation', name: 'Meditation', icon: 'leaf', aspect: 'emotional', modulePresetKeys: ['meditation'], linkKeys: ['hub-blossom'] },
  { id: 'hub-connection', name: 'Connection', icon: 'users', aspect: 'social', modulePresetKeys: ['connection'], linkKeys: ['hub-blossom'] },
  { id: 'hub-entertainment', name: 'Entertainment', icon: 'smile', aspect: 'recreation', modulePresetKeys: ['entertainment'], linkKeys: ['hub-blossom'] }
];

/** The centre hub of the default map. */
export const CENTER_HUB_ID = 'hub-blossom';

/**
 * Resolve a hub template into a live Hub object against the current modules.
 * Phase 1 uses this during the groups→hubs migration. Pure — no store writes here.
 * @param {HubTemplate} tmpl
 * @param {Array<{id:string, presetKey?:string}>} modules the user's actual modules
 * @returns {{id,name,icon,moduleIds:string[],links:Array<{toHubId:string,rel:string}>,aspect?:string,center?:boolean}}
 */
export function resolveHub(tmpl, modules) {
  const moduleIds = modules
    .filter(m => tmpl.modulePresetKeys.includes(m.presetKey))
    .map(m => m.id);
  return {
    id: tmpl.id, name: tmpl.name, icon: tmpl.icon,
    center: !!tmpl.center, aspect: tmpl.aspect || null,
    moduleIds,
    links: tmpl.linkKeys.map(toHubId => ({ toHubId, rel: tmpl.center ? 'aspect' : 'center' }))
  };
}
