/* Graph widget (docs/05 + V2 §23). Holds 1+ graph definitions, each with its
   own chart type, datasets (manual / linked / CSV), axes, range, and display
   options. Rendering + chart geometry live in graph-engine.js; the dataset
   model + resolution in graph-data.js. Tap a point/segment → tooltip → tap
   again → navigate to its source widget. */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { loop } from '../fx/loop.js';
import { icon } from '../ui/icons.js';
import { el, field, seg, input, openDrawer, popMenu, toast } from '../ui/components.js';
import { openLinkPicker } from '../ui/picker.js';
import { CHART_TYPES, RANGES, X_DIMENSIONS, GRAINS, Y_DIMENSIONS, periodLabelFor, chartType, newGraph, newDataset, datasetColor, resolveGraph, parseCSV, normalizeGraph } from './graph-data.js';
import { drawChart } from './graph-engine.js';

/** A labeled dropdown column (§W-6: clearly-labeled controls, not icon buttons). */
function labeledControl(label, ctrl) {
  const w = el(`<label class="graph-ctl"><span class="soft" style="font-size:0.7rem">${label}</span></label>`);
  w.appendChild(ctrl);
  return w;
}

function themeColors(host) {
  const s = getComputedStyle(host);
  const v = (n) => s.getPropertyValue(n).trim();
  return { accent: v('--accent'), highlight: v('--highlight'), success: v('--success'), warn: v('--warn'), textSoft: v('--text-soft'), border: v('--border'), glow: v('--glow') };
}

/* ---------- one canvas ---------- */

function renderGraph(holder, widget, gdef, ctx, big) {
  holder.innerHTML = '';
  holder.classList.add('graph-holder');
  const theme = themeColors(holder);
  const W = Math.max(260, holder.clientWidth || (big ? 620 : 300));
  const isRound = ['pie', 'donut', 'flower', 'radar', 'polar', 'solar', 'venn'].includes(gdef.kind);
  const H = isRound ? Math.min(W, big ? 460 : 300) : (big ? 280 : 190);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const canvas = el(`<canvas style="width:100%;height:${H}px"></canvas>`);
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr);
  holder.appendChild(canvas);
  const tip = el('<div class="graph-tip hidden"></div>');
  holder.appendChild(tip);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  let hits = [], selected = null;
  const resolved = resolveGraph(gdef, theme, widget);

  const paint = (now) => {
    const t = (now - start) / 1000;
    const r = drawChart(g, { gdef, datasets: resolved.datasets, segments: resolved.segments, theme, W, H, t, big, selected, reduced });
    hits = r.hits;
    return r.animating;
  };
  const unsub = loop.add((dt, now) => { if (!canvas.isConnected) { unsub(); return; } if (!paint(now)) unsub(); });
  // hidden documents never fire rAF → paint the final state immediately.
  paint(document.hidden || reduced ? start + 10000 : performance.now());

  const sourceFor = (hit) => {
    const ds = resolved.datasets.length > 1 ? resolved.datasets[hit.i] : resolved.datasets[0];
    const cfg = (widget.config.graphs.find(x => x.id === gdef.id)?.datasets || [])[resolved.datasets.length > 1 ? hit.i : 0];
    return cfg?.source === 'link' ? cfg.link?.sourceWidgetId : null;
  };
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = hits.find(h => h.test(x, y));
    if (!hit) { selected = null; tip.classList.add('hidden'); paint(performance.now()); return; }
    const same = selected && selected.i === hit.i && selected.j === hit.j && selected.kind === hit.kind;
    if (same) { const src = sourceFor(hit); if (src) ctx.goWidget(src); return; }
    selected = hit;
    const ds = resolved.datasets[hit.i] || resolved.datasets[0];
    let text;
    if (hit.kind === 'bin') text = hit.label;
    else if (hit.kind === 'pt') text = `${ds?.name ?? ''} · ${ds?.points[hit.j]?.label ?? ''} — ${Math.round((ds?.points[hit.j]?.y ?? 0) * 100) / 100}`;
    else { const sgmt = resolved.segments[hit.i]; text = `${sgmt?.label ?? ''} — ${Math.round((sgmt?.value ?? 0) * 100) / 100}`; }
    tip.textContent = sourceFor(hit) ? text + '  ·  tap again to visit' : text;
    tip.classList.remove('hidden');
    tip.style.left = `${Math.min(Math.max(8, x - 60), W - 150)}px`;
    tip.style.top = `${Math.max(4, y - 34)}px`;
    paint(performance.now());
  });
}

/* ---------- settings UI ---------- */

function chartTypePicker(gdef, onPick) {
  const d = openDrawer({ title: 'Chart type', iconName: 'bar-chart' });
  const groups = [...new Set(CHART_TYPES.map(c => c.group))];
  for (const grp of groups) {
    d.body.appendChild(el(`<h3 class="soft" style="font-size:0.74rem;margin:10px 0 6px">${grp.toUpperCase()}</h3>`));
    const grid = el('<div class="chart-type-grid"></div>');
    for (const c of CHART_TYPES.filter(x => x.group === grp)) {
      const b = el(`<button class="chart-type-cell ${c.key === gdef.kind ? 'active' : ''}"><span class="ctc-name"></span></button>`);
      b.querySelector('.ctc-name').textContent = c.name;
      b.onclick = () => { onPick(c.key); d.close(); };
      grid.appendChild(b);
    }
    d.body.appendChild(grid);
  }
}

function manualDataEditor(widget, gdef, ds, save, rerender) {
  const d = openDrawer({ title: `${ds.name || 'Data'} — points`, iconName: 'edit' });
  const bubble = gdef.kind === 'bubble';
  const list = el('<div></div>');
  ds.points = ds.points || [];
  const render = () => {
    list.innerHTML = '';
    list.appendChild(el(`<div class="row soft" style="font-size:0.74rem;gap:6px"><span style="flex:1">X (date/label)</span><span style="flex:1">Y value</span>${bubble ? '<span style="flex:1">Size</span>' : ''}<span style="width:28px"></span></div>`));
    ds.points.forEach((pt, i) => {
      const row = el(`<div class="row" style="gap:6px;margin-bottom:6px"></div>`);
      const xi = input(pt.x ?? '', 'x'); xi.style.flex = '1';
      xi.addEventListener('change', () => { pt.x = xi.value; save(); });
      const yi = input(pt.y ?? '', 'y'); yi.type = 'number'; yi.style.flex = '1';
      yi.addEventListener('change', () => { pt.y = Number(yi.value) || 0; save(); });
      row.append(xi, yi);
      if (bubble) { const ri = input(pt.r ?? '', 'size'); ri.type = 'number'; ri.style.flex = '1'; ri.addEventListener('change', () => { pt.r = Number(ri.value) || 0; save(); }); row.append(ri); }
      const del = el(`<button class="btn-icon">${icon('trash', 14)}</button>`);
      del.onclick = () => { ds.points.splice(i, 1); save(); render(); };
      row.append(del);
      list.appendChild(row);
    });
  };
  render();
  d.body.appendChild(list);
  const add = el(`<button class="btn-soft-wide" style="margin-top:8px">${icon('plus', 14)} Add point</button>`);
  add.onclick = () => { ds.points.push({ x: '', y: 0 }); save(); render(); };
  d.body.appendChild(add);
  const done = el(`<button class="btn btn-primary" style="width:100%;margin-top:10px">Done</button>`);
  done.onclick = () => { d.close(); rerender(); };
  d.body.appendChild(done);
}

function csvImport(widget, gdef, save, rerender) {
  const d = openDrawer({ title: 'Import CSV', iconName: 'upload' });
  d.body.appendChild(el('<p class="soft" style="font-size:0.84rem;margin-bottom:8px">First column = X (date or label). Each further column becomes a dataset. A text header row names them.</p>'));
  const ta = el('<textarea class="textarea" rows="6" placeholder="day,Steps,Sleep\nMon,8000,7.5\nTue,9200,6.8"></textarea>');
  d.body.appendChild(ta);
  const go = el('<button class="btn btn-primary" style="width:100%;margin-top:10px">Add datasets</button>');
  go.onclick = () => {
    const parsed = parseCSV(ta.value);
    if (!parsed.length) { toast('Nothing to import — check the format.', 'info'); return; }
    gdef.xAxis.type = 'category';
    for (const col of parsed) { const ds = newDataset(col.name); ds.points = col.points; gdef.datasets.push(ds); }
    save(); d.close(); rerender();
    toast(`Added ${parsed.length} dataset${parsed.length === 1 ? '' : 's'}`, 'flower');
  };
  d.body.appendChild(go);
}

function datasetManager(host, widget, gdef, save, rerender) {
  const theme = themeColors(host);
  const wrap = el('<div class="ds-manager"></div>');
  gdef.datasets.forEach((ds, i) => {
    const src = ds.source === 'link' && ds.link ? store.get('widgets', ds.link.sourceWidgetId) : null;
    const row = el(`<div class="ds-row row" style="gap:6px;align-items:center;margin-bottom:6px">
      <input type="color" class="ds-color" style="width:22px;height:22px;border:none;background:none;padding:0;cursor:pointer">
      <input class="input ds-name" style="flex:1">
      <span class="chip ds-src"></span>
      <button class="btn-icon ds-edit"></button>
      <button class="btn-icon ds-del">${icon('trash', 14)}</button></div>`);
    const cur = datasetColor(i, theme, ds.color);
    const colorIn = row.querySelector('.ds-color');
    if (/^#([0-9a-f]{6})$/i.test(cur)) colorIn.value = cur;
    colorIn.oninput = () => { ds.color = colorIn.value; save(); rerender(); };
    const nameIn = row.querySelector('.ds-name');
    nameIn.value = ds.name || src?.name || '';
    nameIn.addEventListener('change', () => { ds.name = nameIn.value; save(); });
    row.querySelector('.ds-src').textContent = ds.source === 'link' ? `↪ ${src?.name || '?'} · ${ds.link?.output || ''}` : ds.source === 'study' ? 'auto · per class' : `${ds.points?.length || 0} pts`;
    const edit = row.querySelector('.ds-edit');
    edit.innerHTML = icon('edit', 14);
    edit.style.visibility = ds.source === 'link' || ds.source === 'study' ? 'hidden' : 'visible';
    edit.onclick = () => manualDataEditor(widget, gdef, ds, save, rerender);
    row.querySelector('.ds-del').onclick = () => { gdef.datasets.splice(i, 1); save(); rerender(); };
    wrap.appendChild(row);
  });
  host.appendChild(wrap);

  const addBtn = el(`<button class="btn-soft-wide">${icon('plus', 14)} Add dataset</button>`);
  addBtn.onclick = (e) => popMenu(e.currentTarget, [
    { label: 'Link a widget value', iconName: 'link', fn: () => openLinkPicker({ consumerWidget: widget, onPick: (link) => { gdef.datasets.push(newDataset(null, link)); if (!gdef.xAxis) gdef.xAxis = {}; save(); rerender(); } }) },
    { label: 'Study skills (auto)', iconName: 'flower', fn: () => { const ds = newDataset('Study skills'); ds.source = 'study'; gdef.datasets.push(ds); gdef.kind = 'flower'; gdef.absoluteScale = true; gdef.scaleMax = 100; gdef.xAxis = { ...(gdef.xAxis || {}), type: 'category', grain: null }; save(); rerender(); } },
    { label: 'Manual data', iconName: 'edit', fn: () => { const ds = newDataset('Data ' + (gdef.datasets.length + 1)); gdef.datasets.push(ds); save(); manualDataEditor(widget, gdef, ds, save, rerender); } },
    { label: 'Import CSV', iconName: 'upload', fn: () => csvImport(widget, gdef, save, rerender) }
  ]);
  host.appendChild(addBtn);
}

/* ---------- widget ---------- */

registry.register({
  type: 'graph',
  name: 'Graph',
  icon: 'bar-chart',
  description: '20+ chart types — line, bar, pie, radar, gauge, flower & more',
  linkable: false,
  external: true, internal: true,
  defaultConfig: () => ({ graphs: [newGraph('line')] }),

  renderCard(host, widget, ctx) {
    host.innerHTML = '';
    (widget.config.graphs || []).forEach(normalizeGraph);
    const wrap = el(`<div class="graph-stack ${(widget.config.graphs || []).length > 2 ? 'grid' : ''}"></div>`);
    host.appendChild(wrap);
    for (const gdef of widget.config.graphs || []) {
      const holder = el('<div></div>');
      wrap.appendChild(holder);
      setTimeout(() => renderGraph(holder, widget, gdef, ctx, false), 0);
    }
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const save = () => store.put('widgets', widget);
    (widget.config.graphs || []).forEach(normalizeGraph);

    const renderAll = () => {
      host.innerHTML = '';
      for (const gdef of widget.config.graphs) {
        const panel = el('<div class="panel" style="padding:12px;margin-bottom:16px"></div>');
        const holder = el('<div></div>');
        panel.appendChild(holder);

        // §W-6 dropdown controls: Chart type · X dimension · granularity · Y dimension · range
        const isSeries = ['line', 'area', 'bar', 'dualaxis'].includes(gdef.kind);
        const isXY = ['scatter', 'bubble'].includes(gdef.kind);
        const controls = el('<div class="graph-controls"></div>');
        const typeSel = el('<select class="select"></select>');
        for (const grp of [...new Set(CHART_TYPES.map(c => c.group))]) {
          const og = document.createElement('optgroup'); og.label = grp;
          for (const c of CHART_TYPES.filter(x => x.group === grp)) og.appendChild(new Option(c.name, c.key));
          typeSel.appendChild(og);
        }
        typeSel.value = gdef.kind;
        typeSel.onchange = () => { gdef.kind = typeSel.value; if (gdef.kind === 'flower') gdef.rotationDeg = gdef.rotationDeg || 0; save(); renderAll(); };
        controls.appendChild(labeledControl('Chart type', typeSel));

        if (isSeries) {
          const xSel = el('<select class="select"></select>');
          for (const x of X_DIMENSIONS) xSel.appendChild(new Option(x.label, x.key));
          xSel.value = gdef.xAxis?.type === 'time' ? 'time' : (gdef.xAxis?.type || 'time');
          xSel.onchange = () => { gdef.xAxis = { ...gdef.xAxis, type: xSel.value }; save(); renderAll(); };
          controls.appendChild(labeledControl('X axis', xSel));

          if (gdef.xAxis?.type === 'time') {
            const grainSel = el('<select class="select"></select>');
            grainSel.appendChild(new Option('Rolling range', ''));
            for (const gr of GRAINS) grainSel.appendChild(new Option(gr.label, gr.key));
            grainSel.value = gdef.xAxis?.grain || '';
            grainSel.onchange = () => { gdef.xAxis = { ...gdef.xAxis, grain: grainSel.value || null, period: 0 }; save(); renderAll(); };
            controls.appendChild(labeledControl('Granularity', grainSel));
          }

          const ySel = el('<select class="select"></select>');
          for (const y of Y_DIMENSIONS) ySel.appendChild(new Option(y.label, y.key));
          ySel.value = gdef.yAxis?.dim || 'custom';
          ySel.onchange = () => { const yd = Y_DIMENSIONS.find(y => y.key === ySel.value); gdef.yAxis = { ...gdef.yAxis, dim: yd.key, label: yd.key === 'custom' ? (gdef.yAxis?.label || '') : yd.label, unit: yd.key === 'custom' ? (gdef.yAxis?.unit || '') : yd.unit }; save(); renderAll(); };
          controls.appendChild(labeledControl('Y axis', ySel));
        }

        if (isXY || (isSeries && gdef.xAxis?.type === 'time' && !gdef.xAxis?.grain)) {
          const rSel = el('<select class="select"></select>');
          for (const r of RANGES) rSel.appendChild(new Option(r.label, r.key));
          rSel.value = gdef.range;
          rSel.onchange = () => { gdef.range = rSel.value; save(); renderAll(); };
          controls.appendChild(labeledControl('Date range', rSel));
        }
        panel.appendChild(controls);

        // period navigation (Time + granularity)
        if (isSeries && gdef.xAxis?.type === 'time' && gdef.xAxis?.grain) {
          const nav = el(`<div class="graph-period row-between"><button class="btn-icon gp-prev" title="Previous">${icon('chevron-left', 16)}</button><strong class="gp-label"></strong><button class="btn-icon gp-next" title="Next">${icon('chevron-right', 16)}</button></div>`);
          nav.querySelector('.gp-label').textContent = periodLabelFor(gdef);
          nav.querySelector('.gp-prev').onclick = () => { gdef.xAxis.period = (gdef.xAxis.period || 0) - 1; save(); renderAll(); };
          nav.querySelector('.gp-next').onclick = () => { gdef.xAxis.period = (gdef.xAxis.period || 0) + 1; save(); renderAll(); };
          panel.appendChild(nav);
        }

        // axis label/unit text (X label always; Y label/unit only for the Custom dimension)
        if (isSeries) {
          const ax = el('<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px"></div>');
          const xl = input(gdef.xAxis?.label || '', 'X label'); xl.style.width = '110px';
          xl.addEventListener('change', () => { gdef.xAxis = { ...gdef.xAxis, label: xl.value }; save(); });
          ax.append(xl);
          if ((gdef.yAxis?.dim || 'custom') === 'custom') {
            const yl = input(gdef.yAxis?.label || '', 'Y label'); yl.style.width = '110px';
            yl.addEventListener('change', () => { gdef.yAxis = { ...gdef.yAxis, label: yl.value }; save(); renderAll(); });
            const yu = input(gdef.yAxis?.unit || '', 'Y unit'); yu.style.width = '80px';
            yu.addEventListener('change', () => { gdef.yAxis = { ...gdef.yAxis, unit: yu.value }; save(); renderAll(); });
            ax.append(yl, yu);
          }
          panel.appendChild(ax);
        }
        if (gdef.kind === 'gauge') {
          const gr = el('<div class="row" style="gap:6px;margin-top:8px"></div>');
          const mn = input(gdef.gauge?.min ?? 0, 'min'); mn.type = 'number'; mn.style.width = '80px';
          mn.addEventListener('change', () => { gdef.gauge = { ...gdef.gauge, min: Number(mn.value) || 0 }; save(); renderAll(); });
          const mx = input(gdef.gauge?.max ?? 100, 'max'); mx.type = 'number'; mx.style.width = '80px';
          mx.addEventListener('change', () => { gdef.gauge = { ...gdef.gauge, max: Number(mx.value) || 100 }; save(); renderAll(); });
          gr.append(field('Min', mn), field('Max', mx));
          panel.appendChild(gr);
        }

        // display toggles
        const toggles = el('<div class="row" style="flex-wrap:wrap;margin-top:8px;gap:6px"></div>');
        const tog = (label, key, defOn) => {
          const on = gdef[key] !== false && (gdef[key] !== undefined || defOn);
          const chip = el(`<button class="chip ${on ? 'accent' : ''}" style="cursor:pointer"></button>`);
          chip.textContent = label;
          chip.onclick = () => { gdef[key] = !on; save(); renderAll(); };
          return chip;
        };
        toggles.append(tog('Legend', 'legend', true), tog('Value labels', 'valueLabels', true), tog('Gridlines', 'gridlines', true));
        if (['line', 'area'].includes(gdef.kind)) toggles.append(tog('Smooth', 'smooth', false));
        if (gdef.kind === 'bar') toggles.append(tog('Stacked', 'stacked', false), tog('Horizontal', 'horizontal', false));
        if (gdef.kind === 'flower') {
          const rot = el('<input type="range" min="0" max="360" step="5" style="width:120px" title="Rotation">');
          rot.value = gdef.rotationDeg || 0;
          rot.onchange = () => { gdef.rotationDeg = Number(rot.value); save(); renderAll(); };
          toggles.appendChild(rot);
        }
        panel.appendChild(toggles);

        // datasets
        panel.appendChild(el('<h3 class="soft" style="font-size:0.74rem;margin:12px 0 6px">DATASETS</h3>'));
        datasetManager(panel, widget, gdef, save, renderAll);

        const removeG = el(`<button class="chip" style="cursor:pointer;margin-top:10px">${icon('trash', 11)} Remove this graph</button>`);
        removeG.onclick = () => { widget.config.graphs = widget.config.graphs.filter(x => x.id !== gdef.id); save(); renderAll(); };
        panel.appendChild(removeG);

        host.appendChild(panel);
        setTimeout(() => renderGraph(holder, widget, gdef, ctx, true), 0);
      }
      const add = el(`<button class="btn-soft-wide">${icon('plus', 15)} Add a graph</button>`);
      add.onclick = () => { widget.config.graphs.push(newGraph('line')); save(); renderAll(); };
      host.appendChild(add);
    };
    renderAll();
  }
});
