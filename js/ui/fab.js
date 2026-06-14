/* FAB navigation (V2 §3): one floating + button that fans open to Modules,
   Pages, and Widgets — the single entry point that replaces the scattered
   module switcher / page-hold / widget gallery affordances. */

import { icon } from './icons.js';
import { el } from './components.js';
import { openModulesPanel, openPagesPanel, openWidgetsPanel } from './navpanels.js';

const ITEMS = [
  { key: 'modules', label: 'Modules', iconName: 'grid', open: openModulesPanel },
  { key: 'pages', label: 'Pages', iconName: 'note', open: openPagesPanel },
  { key: 'widgets', label: 'Widgets', iconName: 'layers', open: openWidgetsPanel }
];

let open = false;

export function initFab() {
  document.getElementById('fab-root')?.remove();
  const root = el('<div id="fab-root"></div>');
  const scrim = el('<div class="fab-scrim" aria-hidden="true"></div>');
  const menu = el('<div class="fab-menu" role="menu" aria-label="Navigate"></div>');
  for (const item of ITEMS) {
    const b = el(`<button class="fab-item" role="menuitem"><span class="fab-item-label"></span><span class="fab-item-ic">${icon(item.iconName, 20)}</span></button>`);
    b.querySelector('.fab-item-label').textContent = item.label;
    b.onclick = () => { setOpen(false); item.open(); };
    menu.appendChild(b);
  }
  const fab = el(`<button id="fab" aria-label="Navigate" aria-expanded="false">${icon('plus', 26)}</button>`);
  fab.onclick = () => setOpen(!open);
  scrim.onclick = () => setOpen(false);

  root.append(scrim, menu, fab);
  document.body.appendChild(root);

  function setOpen(v) {
    open = v;
    root.classList.toggle('open', v);
    fab.setAttribute('aria-expanded', v ? 'true' : 'false');
    fab.setAttribute('aria-label', v ? 'Close navigation' : 'Navigate');
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });
}
