/* Separator widget (docs/05): a labeled divider. Collapsing it hides the
   widgets that follow it on the page, until the next separator (cozy default
   noted in the docs). */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';

registry.register({
  type: 'separator',
  name: 'Separator',
  icon: 'minus',
  description: 'A labeled divider that folds its group',
  external: true, internal: false,
  noNest: true,
  defaultConfig: () => ({ icon: null }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const line = el('<div class="separator-widget"><span class="s-label"></span></div>');
    line.querySelector('.s-label').textContent = widget.name;
    if (widget.config.icon) {
      line.querySelector('.s-label').insertAdjacentHTML('beforebegin', `<span style="color:var(--accent)">${icon(widget.config.icon, 14)}</span>`);
    }
    if (widget.collapsed) {
      line.appendChild(el(`<span class="chip">${icon('chevron-right', 11)} folded</span>`));
    }
    host.appendChild(line);
  }
});
