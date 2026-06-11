/* Timeline widget (docs/08 §5): a horizontal, zoomable timeline of eras and
   events — auto-collecting dated history from Civilizations and Characters
   plus manual entries. Custom era names; category filter lanes; tap an event
   to peek and jump to its source. Year-grained v1 (months noted as deferred). */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, openPopover, openPanel, popMenu } from '../ui/components.js';
import { objectsOf, createObject } from './base.js';
import { worldEvents, openEntry, fmtWorldYear } from './wb-shared.js';

const CAT_COLORS = ['var(--accent)', 'var(--highlight)', 'var(--success)', 'var(--warn)', 'var(--text-soft)'];

function allEvents(widget) {
  const manual = objectsOf(widget.id, 'tevent').map(o => ({
    year: o.data.year, title: o.data.title, text: o.data.text || '',
    category: o.data.category || 'events', source: null, objId: o.id
  }));
  return [...manual, ...worldEvents(widget)].sort((a, b) => a.year - b.year);
}

registry.register({
  type: 'wtimeline',
  name: 'Timeline',
  icon: 'clock',
  description: 'Eras and events across your world’s history',
  keywords: ['world', 'timeline', 'history', 'era', 'events'],
  external: true, internal: true,
  defaultConfig: () => ({ eras: [], pxPerYear: 6, hiddenCats: [] }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const evs = allEvents(widget);
    if (!evs.length) {
      host.appendChild(el('<p class="soft" style="font-size:0.84rem">History unwritten — add dated events anywhere in the world.</p>'));
      return;
    }
    const span = `${fmtWorldYear(evs[0].year, widget.config)} → ${fmtWorldYear(evs[evs.length - 1].year, widget.config)}`;
    host.appendChild(el(`<div><div style="font-size:1.4rem;font-weight:650">${evs.length}</div><div class="soft" style="font-size:0.8rem">events · ${span}</div></div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const cfg = widget.config;
    cfg.hiddenCats = cfg.hiddenCats || [];
    const wrap = el('<div></div>');
    host.appendChild(wrap);

    const render = () => {
      wrap.innerHTML = '';
      const evs = allEvents(widget).filter(e => typeof e.year === 'number' && !Number.isNaN(e.year));
      const cats = [...new Set(evs.map(e => e.category))];
      const visible = evs.filter(e => !cfg.hiddenCats.includes(e.category));

      // controls: zoom, era editor, add event
      const ctl = el(`<div class="row" style="gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span class="soft" style="font-size:0.8rem">Zoom</span>
        <input type="range" class="range" min="0" max="100" style="width:130px">
        <button class="btn" style="padding:5px 11px;font-size:0.82rem">${icon('clock', 13)} Eras</button>
        <span class="grow"></span>
        <button class="btn btn-primary" style="padding:5px 11px;font-size:0.82rem">${icon('plus', 13)} Event</button></div>`);
      const [, zoom, erasBtn, , addBtn] = ctl.children;
      zoom.value = Math.round(Math.log(cfg.pxPerYear / 0.5) / Math.log(120 / 0.5) * 100);
      zoom.oninput = () => {
        cfg.pxPerYear = 0.5 * Math.pow(120 / 0.5, Number(zoom.value) / 100);
        store.put('widgets', widget);
        render();
      };
      erasBtn.onclick = () => editEras(widget, render);
      addBtn.onclick = (e) => addEvent(widget, e.currentTarget, render);
      wrap.appendChild(ctl);

      // category filter lane chips
      if (cats.length) {
        const chips = el('<div class="row" style="flex-wrap:wrap;gap:4px;margin-bottom:8px"></div>');
        cats.forEach((cat, i) => {
          const on = !cfg.hiddenCats.includes(cat);
          const chip = el(`<button class="chip" style="${on ? `color:${CAT_COLORS[i % CAT_COLORS.length]};border-color:currentColor` : 'opacity:0.45'}">${cat}</button>`);
          chip.onclick = () => {
            cfg.hiddenCats = on ? [...cfg.hiddenCats, cat] : cfg.hiddenCats.filter(c => c !== cat);
            store.put('widgets', widget);
            render();
          };
          chips.appendChild(chip);
        });
        wrap.appendChild(chips);
      }

      if (!visible.length) {
        wrap.appendChild(el('<div class="empty-state">' + icon('clock', 28) + '<p>Time hasn’t started yet. Add an event, or date some history in a civilization or character.</p></div>'));
        return;
      }

      // the strip: era bands + year ticks + per-category lanes
      const y0 = Math.floor(visible[0].year - 1);
      const y1 = Math.ceil(visible[visible.length - 1].year + 1);
      const ppy = Math.min(cfg.pxPerYear, 24000 / Math.max(1, y1 - y0)); // keep the strip sane
      const W = Math.max(360, (y1 - y0) * ppy + 80);
      const laneCats = cats.filter(c => !cfg.hiddenCats.includes(c));
      const laneH = 46;
      const strip = el(`<div class="tl-scroll"><div class="tl-strip" style="width:${W}px;height:${34 + laneCats.length * laneH + 26}px"></div></div>`);
      const inner = strip.querySelector('.tl-strip');
      const X = (year) => 40 + (year - y0) * ppy;

      // era bands
      const eras = (cfg.eras || []).slice().sort((a, b) => a.start - b.start);
      eras.forEach((era, i) => {
        const next = eras[i + 1];
        const x0 = Math.max(0, X(era.start));
        const x1 = next ? X(next.start) : W;
        if (x1 < 0 || x0 > W) return;
        const band = el(`<div class="tl-era" style="left:${x0}px;width:${Math.max(30, x1 - x0)}px"><span></span></div>`);
        band.querySelector('span').textContent = era.name;
        inner.appendChild(band);
      });

      // year ticks (~every 90px)
      const step = Math.max(1, Math.pow(10, Math.ceil(Math.log10(90 / ppy))));
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
        inner.appendChild(el(`<div class="tl-tick" style="left:${X(y)}px"><span>${y}</span></div>`));
      }

      // lanes + events
      laneCats.forEach((cat, li) => {
        const top = 34 + li * laneH;
        const color = CAT_COLORS[cats.indexOf(cat) % CAT_COLORS.length];
        inner.appendChild(el(`<div class="tl-lane" style="top:${top + laneH - 8}px"></div>`));
        inner.appendChild(el(`<div class="tl-lane-label" style="top:${top}px;color:${color}">${cat}</div>`));
        for (const ev of visible.filter(e => e.category === cat)) {
          const dot = el(`<button class="tl-event" style="left:${X(ev.year)}px;top:${top + 16}px;--c:${color}"><i></i><span></span></button>`);
          dot.querySelector('span').textContent = ev.title;
          dot.onclick = (e) => {
            const pop = openPopover(e.currentTarget, { title: fmtWorldYear(ev.year, cfg), width: 260 });
            pop.body.appendChild(el(`<p style="font-weight:600;margin-bottom:4px"></p>`)).textContent = ev.title;
            if (ev.text) pop.body.appendChild(el('<p class="soft" style="font-size:0.84rem"></p>')).textContent = ev.text;
            const row = el('<div class="row" style="gap:6px;margin-top:8px"></div>');
            if (ev.source) {
              const open = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px">${icon('arrow-right', 13)} Open source</button>`);
              open.onclick = () => { pop.close(); openEntry(ev.source, ctx); };
              row.appendChild(open);
            }
            if (ev.objId) {
              const del = el(`<button class="btn" style="font-size:0.8rem;padding:4px 10px;color:var(--warn)">${icon('trash', 13)} Remove</button>`);
              del.onclick = () => { store.trash('objects', ev.objId); pop.close(); render(); };
              row.appendChild(del);
            }
            if (row.children.length) pop.body.appendChild(row);
          };
          inner.appendChild(dot);
        }
      });
      wrap.appendChild(strip);
      wrap.appendChild(el('<p class="soft" style="font-size:0.74rem;margin-top:6px">Events come from here plus dated history on civilizations and characters.</p>'));
    };
    render();
  },

  renderSettings(host, widget) {
    host.appendChild(el('<p class="soft" style="font-size:0.84rem">Years are plain numbers; era names dress them up (“312 Age of Embers”). Months and custom year lengths may come later.</p>'));
  }
});

function addEvent(widget, anchor, done) {
  const pop = openPopover(anchor, { title: 'New event', width: 280 });
  const yF = el('<div class="field"><label>Year</label><input class="input" type="number"></div>');
  const tF = el('<div class="field"><label>Title</label><input class="input"></div>');
  const cF = el('<div class="field"><label>Category</label><input class="input" value="events"></div>');
  const ok = el('<button class="btn btn-primary" style="width:100%">Add</button>');
  pop.body.append(yF, tF, cF, ok);
  ok.onclick = () => {
    const year = Number(yF.querySelector('input').value);
    const title = tF.querySelector('input').value.trim();
    if (!title || Number.isNaN(year)) return;
    createObject(widget.id, 'tevent', { year, title, text: '', category: cF.querySelector('input').value.trim() || 'events' });
    pop.close();
    done();
  };
  setTimeout(() => yF.querySelector('input').focus(), 80);
}

function editEras(widget, done) {
  const d = openPanel({ title: 'Eras', iconName: 'clock' });
  const render = () => {
    d.body.innerHTML = '';
    for (const era of (widget.config.eras || []).slice().sort((a, b) => a.start - b.start)) {
      const row = el(`<div class="list-item" style="cursor:default"><span class="chip"></span><span class="li-main"><span class="li-title"></span></span><button class="btn-icon">${icon('x', 13)}</button></div>`);
      row.querySelector('.chip').textContent = `from ${era.start}`;
      row.querySelector('.li-title').textContent = era.name;
      row.querySelector('button').onclick = () => {
        widget.config.eras = widget.config.eras.filter(e => e !== era);
        store.put('widgets', widget);
        render();
        done();
      };
      d.body.appendChild(row);
    }
    const addRow = el(`<div class="row" style="gap:6px;margin-top:8px"><input class="input" type="number" placeholder="Start year" style="width:110px"><input class="input grow" placeholder="Era name"><button class="btn">${icon('plus', 14)}</button></div>`);
    const [sIn, nIn, addB] = addRow.children;
    addB.onclick = () => {
      if (!nIn.value.trim() || sIn.value === '') return;
      widget.config.eras = widget.config.eras || [];
      widget.config.eras.push({ name: nIn.value.trim(), start: Number(sIn.value) });
      store.put('widgets', widget);
      render();
      done();
    };
    d.body.appendChild(addRow);
  };
  render();
}
