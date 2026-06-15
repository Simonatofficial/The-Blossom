/* Page Widget (V2 §24): a full page rendered AS a widget. Its card is a small
   non-interactive preview; tapping opens the inner page full-screen (a routed
   widget page). Use it to tuck a long, specific set of widgets behind one slot
   so the parent page stays calm. */

import { registry } from './registry.js';
import { icon } from '../ui/icons.js';
import { el } from '../ui/components.js';
import { childWidgetsOf } from './base.js';
import { openWidgetGallery } from '../ui/picker.js';

registry.register({
  type: 'pagewidget',
  name: 'Page',
  icon: 'copy',
  description: 'A whole page tucked into one widget slot',
  container: true, external: true, internal: true,
  defaultConfig: () => ({}),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const kids = childWidgetsOf(widget.id);
    const preview = el('<div class="pw-preview"></div>');
    if (!kids.length) {
      preview.appendChild(el('<span class="soft" style="font-size:0.85rem">Empty page — tap to build it.</span>'));
    } else {
      const thumbs = el('<div class="pw-thumbs"></div>');
      for (const k of kids.slice(0, 8)) {
        const def = registry.get(k.type);
        thumbs.appendChild(el(`<span class="pw-thumb" title="${k.name}">${icon(def?.icon || 'circle', 14)}</span>`));
      }
      preview.appendChild(thumbs);
      preview.appendChild(el(`<span class="soft pw-count">${kids.length} widget${kids.length === 1 ? '' : 's'} — tap to open</span>`));
    }
    host.appendChild(preview);
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const grid = el('<div class="widget-grid"></div>');
    const renderKids = () => {
      grid.innerHTML = '';
      const kids = childWidgetsOf(widget.id);
      if (!kids.length) grid.appendChild(el('<p class="soft">This page is quiet. Plant a widget below.</p>'));
      for (const k of kids) grid.appendChild(ctx.renderWidgetCard(k));
    };
    renderKids();
    host.appendChild(grid);
    const add = el(`<button class="btn-soft-wide" style="margin-top:12px">${icon('plus', 15)} Plant a widget</button>`);
    add.onclick = () => openWidgetGallery({ parentWidgetId: widget.id, onCreated: renderKids });
    host.appendChild(add);
  }
});
