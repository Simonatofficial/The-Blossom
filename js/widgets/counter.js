/* Counter widget (docs/05): big number, big − / +, long-press to set/reset.
   Daily-reset mode keys counts by day (graphable, linkable). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { el, field, input, switchEl } from '../ui/components.js';
import { todayStr, dayObject, saveObject, objectsOf } from './base.js';

function readCount(widget, date = null) {
  if (widget.config.dailyReset) {
    const d = date || todayStr();
    const obj = store.all('objects').find(o => o.widgetId === widget.id && o.kind === 'counterDay' && o.date === d);
    return obj ? obj.data.count : 0;
  }
  return widget.config.count || 0;
}

function writeCount(widget, value, ctx) {
  if (widget.config.dailyReset) {
    const obj = dayObject(widget.id, 'counterDay', todayStr(), { count: 0 });
    obj.data.count = value;
    saveObject(obj);
  } else {
    widget.config.count = value;
    store.put('widgets', widget);
    ctx.events.emit('object:changed', { widgetId: widget.id }); // consumers refresh
  }
}

registry.register({
  type: 'counter',
  name: 'Counter',
  icon: 'hash',
  description: 'Count anything, one tap at a time',
  external: true, internal: false,
  defaultConfig: () => ({ count: 0, step: 1, dailyReset: false, target: null }),

  outputs: (widget) => [{
    key: 'count', name: 'Count', dayKeyed: !!widget.config.dailyReset,
    get: (date) => readCount(widget, date)
  }],

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    const count = readCount(widget);
    const met = widget.config.target != null && count >= widget.config.target;
    const card = el(`<div class="counter-widget ${met ? 'met' : ''}">
      <button class="c-btn" data-d="-1" aria-label="Decrease">−</button>
      <div>
        <div class="c-value"></div>
        ${widget.config.target != null ? `<div class="c-target">of ${widget.config.target}</div>` : ''}
      </div>
      <button class="c-btn" data-d="1" aria-label="Increase">+</button>
    </div>`);
    card.querySelector('.c-value').textContent = count;
    const show = () => {
      const v = readCount(widget);
      card.querySelector('.c-value').textContent = v;
      card.classList.toggle('met', widget.config.target != null && v >= widget.config.target);
    };
    for (const btn of card.querySelectorAll('.c-btn')) {
      btn.onclick = () => {
        writeCount(widget, readCount(widget) + Number(btn.dataset.d) * (widget.config.step || 1), ctx);
        show();
      };
    }
    // long-press the number to set / reset
    let timer = null;
    card.querySelector('.c-value').addEventListener('pointerdown', () => {
      timer = setTimeout(async () => {
        const { promptText } = await import('../ui/components.js');
        const v = await promptText({ title: 'Set counter', label: 'Value', value: String(readCount(widget)), confirmText: 'Set' });
        if (v != null && !Number.isNaN(Number(v))) {
          writeCount(widget, Number(v), ctx);
          show();
        }
      }, 550);
    });
    for (const evt of ['pointerup', 'pointercancel', 'pointermove']) {
      card.querySelector('.c-value').addEventListener(evt, () => clearTimeout(timer), { passive: true });
    }
    host.appendChild(card);
  },

  renderSettings(host, widget, ctx) {
    const save = () => { store.put('widgets', widget); ctx.events.emit('widget:changed', { widgetId: widget.id }); };
    const stepIn = input(String(widget.config.step), '1');
    stepIn.type = 'number';
    stepIn.addEventListener('change', () => { widget.config.step = Number(stepIn.value) || 1; save(); });
    host.appendChild(field('Step size', stepIn));

    const targetIn = input(widget.config.target == null ? '' : String(widget.config.target), 'none');
    targetIn.type = 'number';
    targetIn.addEventListener('change', () => {
      widget.config.target = targetIn.value === '' ? null : Number(targetIn.value);
      save();
    });
    host.appendChild(field('Target (optional)', targetIn));

    const row = el('<div class="row-between" style="margin-bottom:12px"><span>Reset daily</span></div>');
    row.appendChild(switchEl(widget.config.dailyReset, (v) => { widget.config.dailyReset = v; save(); }));
    host.appendChild(row);
  }
});
