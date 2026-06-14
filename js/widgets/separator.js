/* Category Divider widget (docs/05 · V2 §18): a collapsible section header.
   Collapsing it folds the widgets grouped beneath it (until the next divider),
   and its row shows how many widgets that section holds. The grouped widgets are
   gently indented by the module engine. (A true nested-container model with
   drag-into-divider is a later refinement.) */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';

registry.register({
  type: 'separator', // type kept for back-compat; label is now "Category Divider"
  name: 'Category Divider',
  icon: 'minus',
  description: 'A collapsible section header that groups the widgets beneath it',
  external: true, internal: false,
  noNest: true,
  defaultConfig: () => ({ icon: null }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const line = el('<div class="separator-widget"><span class="s-label"></span><span class="s-count"></span></div>');
    line.querySelector('.s-label').textContent = widget.name;
    if (widget.config.icon) {
      line.querySelector('.s-label').insertAdjacentHTML('beforebegin', `<span style="color:var(--accent)">${icon(widget.config.icon, 14)}</span>`);
    }
    // count the widgets grouped under this divider (flat model: until the next one)
    const page = ctx.store.get('pages', widget.pageId);
    let count = 0;
    if (page) {
      const i = page.widgets.indexOf(widget.id);
      for (let k = i + 1; k < page.widgets.length; k++) {
        const w = ctx.store.get('widgets', page.widgets[k]);
        if (!w) continue;
        if (w.type === 'separator') break;
        count++;
      }
    }
    const cnt = line.querySelector('.s-count');
    cnt.textContent = count;
    cnt.title = `${count} widget${count === 1 ? '' : 's'} in this section`;
    if (widget.collapsed) line.appendChild(el(`<span class="chip">${icon('chevron-right', 11)} folded</span>`));
    host.appendChild(line);
  }
});
