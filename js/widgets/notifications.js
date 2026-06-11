/* Notifications widget (docs/05): the quiet inbox. A reverse-chron feed of
   app events the user opted into. Never badges — a soft dot when unread.
   Events arrive via the 'notify' bus event and are kept in meta (capped). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { events } from '../core/events.js';
import { icon } from '../ui/icons.js';
import { el, switchEl } from '../ui/components.js';

const CATEGORIES = {
  levelup: 'Level-ups',
  streak: 'Streak milestones',
  rollover: 'Day summaries',
  goal: 'Goal blooms'
};
const CAT_ICON = { levelup: 'sparkles', streak: 'leaf', rollover: 'sun', goal: 'flower' };

/** Append to the global feed (called via events 'notify'). */
events.on('notify', ({ category, text }) => {
  const feed = store.getMeta('notifications', []);
  feed.unshift({ category, text, at: Date.now() });
  store.setMeta('notifications', feed.slice(0, 60));
});

registry.register({
  type: 'notifications',
  name: 'Notifications',
  icon: 'bell',
  description: 'A quiet inbox of milestones',
  external: true, internal: true,
  defaultConfig: () => ({ categories: { levelup: true, streak: true, rollover: true, goal: true }, seenAt: 0 }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const feed = store.getMeta('notifications', []).filter(n => widget.config.categories[n.category] !== false);
    const unread = feed.filter(n => n.at > (widget.config.seenAt || 0)).length;
    const latest = feed[0];
    host.appendChild(el(`<div class="row">
      ${unread ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex:none"></span>' : ''}
      <p class="soft" style="font-size:0.88rem;margin:0">${latest ? latest.text : 'All quiet in the garden.'}</p></div>`));
  },

  renderFull(host, widget) {
    widget.config.seenAt = Date.now();
    store.put('widgets', widget);
    host.innerHTML = '';
    const feed = store.getMeta('notifications', []).filter(n => widget.config.categories[n.category] !== false);
    for (const n of feed) {
      const dt = new Date(n.at);
      host.appendChild(el(`<div class="list-item" style="cursor:default">
        <span style="color:var(--accent)">${icon(CAT_ICON[n.category] || 'bell', 16)}</span>
        <span class="li-main"><span class="li-title" style="font-weight:400">${n.text}</span>
        <span class="li-sub">${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span></div>`));
    }
    if (!feed.length) host.appendChild(el('<p class="soft" style="text-align:center;padding:20px">Nothing yet — milestones will gather here.</p>'));
  },

  renderSettings(host, widget, ctx) {
    for (const [key, label] of Object.entries(CATEGORIES)) {
      const row = el(`<div class="row-between" style="margin-bottom:10px"><span style="font-size:0.9rem">${label}</span></div>`);
      row.appendChild(switchEl(widget.config.categories[key] !== false, (v) => {
        widget.config.categories[key] = v;
        store.put('widgets', widget);
        ctx.events.emit('widget:changed', { widgetId: widget.id });
      }));
      host.appendChild(row);
    }
  }
});
