/* Pinboard widget (docs/08 §5): a Milanote-style freeform board on an
   infinite pan/zoom surface — draggable note cards and world-entry link
   cards, with connector arrows between them. For brainstorming the world
   before it's structured. (Frames deferred — noted in docs/08.) */

import { registry } from './registry.js';
import { store } from '../core/store.js';
import { icon } from '../ui/icons.js';
import { el, toast, popMenu } from '../ui/components.js';
import { objectsOf, createObject, saveObject } from './base.js';
import { InfiniteSurface } from './infcanvas-engine.js';
import { openEntryPicker, openEntry, resolveEntry } from './wb-shared.js';
import { getStamp, openStampPicker } from './wb-stamps.js';

const COLORS = ['rgba(216,105,127,0.16)', 'rgba(224,162,60,0.16)', 'rgba(127,174,127,0.16)', 'rgba(95,143,192,0.16)', 'rgba(154,127,209,0.16)'];

const cards = (w) => objectsOf(w.id, 'bcard');
const arrows = (w) => objectsOf(w.id, 'barrow');

registry.register({
  type: 'pinboard',
  name: 'Pinboard',
  icon: 'grid',
  description: 'A freeform board of cards and connections',
  keywords: ['world', 'board', 'brainstorm', 'cards', 'milanote'],
  external: true, internal: true,
  defaultConfig: () => ({ view: { cx: 0, cy: 0, zoomExp: 0 } }),

  renderCard(host, widget) {
    host.innerHTML = '';
    const n = cards(widget).length;
    host.appendChild(el(`<div><div style="font-size:1.4rem;font-weight:650">${n}</div><div class="soft" style="font-size:0.8rem">card${n === 1 ? '' : 's'} pinned · ${arrows(widget).length} threads</div></div>`));
  },

  renderFull(host, widget, ctx) {
    host.innerHTML = '';
    const cfg = widget.config;
    const wrap = el('<div class="ic-wrap"></div>');
    const box = el('<div class="ic-canvasbox" style="background:var(--surface-alt)"></div>');
    const canvas = el('<canvas class="ic-surface" style="background:transparent;cursor:grab"></canvas>');
    const layer = el('<div class="pb-layer"></div>');
    box.append(canvas, layer);
    wrap.appendChild(box);
    host.appendChild(wrap);

    const dpr = Math.min(2, devicePixelRatio || 1);
    const cssW = Math.max(300, (host.clientWidth || 720) - 62);
    const cssH = Math.min(Math.max(300, innerHeight - 210), Math.round(cssW * 0.75));
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    let connectFrom = null; // connect mode: first tapped card id
    const els = new Map();

    const surf = new InfiniteSurface(canvas, {
      drawTile: () => {},
      isPan: () => true,
      onViewChange: (v) => {
        cfg.view = { cx: v.cx, cy: v.cy, zoomExp: v.zoomExp };
        store.put('widgets', widget);
        sync();
      },
      drawOverlay: (g) => {
        // connector threads between card centers
        g.save();
        g.strokeStyle = 'var(--accent)';
        g.strokeStyle = getComputedStyle(box).getPropertyValue('--accent') || '#d8697f';
        g.globalAlpha = 0.55;
        g.lineWidth = Math.max(1, 1.6 * surf.scale());
        for (const a of arrows(widget)) {
          const ca = store.get('objects', a.data.a);
          const cb = store.get('objects', a.data.b);
          if (!ca || !cb) continue;
          const [x1, y1] = surf.toScreen(ca.data.x + ca.data.w / 2, ca.data.y + 40);
          const [x2, y2] = surf.toScreen(cb.data.x + cb.data.w / 2, cb.data.y + 40);
          g.beginPath();
          g.moveTo(x1, y1);
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 26;
          g.quadraticCurveTo(mx, my, x2, y2);
          g.stroke();
        }
        g.restore();
      }
    }, { ...cfg.view });

    /* ---- DOM card layer (world-anchored, like canvas text boxes) ---- */
    const k = () => {
      const r = canvas.getBoundingClientRect();
      return r.width / canvas.width; // backing px → CSS px
    };

    function sync() {
      const scale = surf.scale(), kk = k();
      for (const [id, elc] of els) {
        const o = store.get('objects', id);
        if (!o) { elc.remove(); els.delete(id); continue; }
        const [px, py] = surf.toScreen(o.data.x, o.data.y);
        elc.style.left = `${px * kk}px`;
        elc.style.top = `${py * kk}px`;
        elc.style.width = `${o.data.w * scale * kk}px`;
        elc.style.fontSize = `${Math.max(8, 14 * scale * kk)}px`;
      }
      surf.render();
    }

    function mount(o) {
      if (els.has(o.id)) return;
      const isLink = o.data.kind === 'link';
      const card = el(`<div class="pb-card${isLink ? ' pb-link' : ''}" data-id="${o.id}">
        <div class="pb-content" spellcheck="false"></div></div>`);
      card.style.background = o.data.color || COLORS[0];
      const content = card.querySelector('.pb-content');
      if (isLink) {
        const entry = resolveEntry(o.data.ref);
        content.innerHTML = `${icon(entry?.iconName || 'link', 14)} <b></b>`;
        content.querySelector('b').textContent = entry?.label || '(missing)';
      } else if (o.data.kind === 'stamp') {
        const s = getStamp(o.data.stampId);
        if (s) {
          content.innerHTML = '<img alt="" style="width:100%;display:block">';
          content.querySelector('img').src = s.img;
          card.style.background = 'transparent';
        } else content.textContent = '(stamp removed)';
      } else {
        content.innerHTML = o.data.html || '';
      }
      layer.appendChild(card);
      els.set(o.id, card);
      wireCard(card, o);
    }

    function wireCard(card, o) {
      const content = card.querySelector('.pb-content');
      let lastTap = 0;
      card.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (card.classList.contains('editing')) return;
        if (connectFrom) {
          if (connectFrom !== o.id) {
            const existing = arrows(widget).find(a =>
              (a.data.a === connectFrom && a.data.b === o.id) || (a.data.a === o.id && a.data.b === connectFrom));
            if (existing) store.del('objects', existing.id); // re-connect = unthread
            else createObject(widget.id, 'barrow', { a: connectFrom, b: o.id });
          }
          setConnect(null);
          sync();
          return;
        }
        const start = [e.clientX, e.clientY];
        const orig = { x: o.data.x, y: o.data.y };
        const kk = k(), scale = surf.scale();
        let moved = false;
        const onMove = (ev) => {
          const dx = (ev.clientX - start[0]) / kk / scale, dy = (ev.clientY - start[1]) / kk / scale;
          if (Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) > 4) moved = true;
          o.data.x = orig.x + dx;
          o.data.y = orig.y + dy;
          sync();
        };
        const onUp = (ev) => {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          if (moved) { saveObject(o); return; }
          const now = performance.now();
          if (now - lastTap < 420) {
            if (o.data.kind === 'link') openEntry(o.data.ref, ctx);
            else if (o.data.kind !== 'stamp') startEdit();
          } else if (ev.button === 2 || ev.ctrlKey) {
            cardMenu(ev);
          }
          lastTap = now;
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); cardMenu(e); });

      const cardMenu = (e) => popMenu({ getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 }) }, [
        ...(o.data.kind === 'link' ? [{ label: 'Open', iconName: 'arrow-right', fn: () => openEntry(o.data.ref, ctx) }]
          : o.data.kind === 'stamp' ? [
            { label: 'Bigger', iconName: 'plus', fn: () => { o.data.w *= 1.3; saveObject(o); sync(); } },
            { label: 'Smaller', iconName: 'minus', fn: () => { o.data.w = Math.max(40, o.data.w / 1.3); saveObject(o); sync(); } }
          ] : [{ label: 'Edit', iconName: 'edit', fn: startEdit }]),
        { label: 'Recolor', iconName: 'palette', fn: () => {
          o.data.color = COLORS[(COLORS.indexOf(o.data.color || COLORS[0]) + 1) % COLORS.length];
          card.style.background = o.data.color;
          saveObject(o);
        } },
        { label: 'Thread from here', iconName: 'link', fn: () => setConnect(o.id) },
        'sep',
        { label: 'Remove', iconName: 'trash', danger: true, fn: () => {
          for (const a of arrows(widget)) if (a.data.a === o.id || a.data.b === o.id) store.del('objects', a.id);
          store.del('objects', o.id);
          card.remove();
          els.delete(o.id);
          sync();
        } }
      ]);

      const startEdit = () => {
        card.classList.add('editing');
        content.contentEditable = 'true';
        setTimeout(() => content.focus(), 0);
      };
      content.addEventListener('blur', () => {
        if (!card.classList.contains('editing')) return;
        card.classList.remove('editing');
        content.contentEditable = 'false';
        o.data.html = content.innerHTML;
        saveObject(o);
      });
    }

    function setConnect(id) {
      connectFrom = id;
      for (const [cid, elc] of els) elc.classList.toggle('pb-connecting', cid === id);
      threadBtn.classList.toggle('on', !!id);
    }

    /* ---- toolbar ---- */
    const strip = el('<div class="ic-strip"></div>');
    const noteBtn = el(`<button class="ic-btn" title="New note card">${icon('note', 16)}</button>`);
    noteBtn.onclick = () => {
      const [wx, wy] = surf.toWorld(canvas.width / 2, canvas.height / 2);
      const o = createObject(widget.id, 'bcard', { kind: 'note', x: wx - 90, y: wy - 30, w: 180, html: 'A new thought…', color: COLORS[Math.floor(Math.random() * COLORS.length)] });
      mount(o);
      sync();
    };
    const linkBtn = el(`<button class="ic-btn" title="Pin a world entry">${icon('link', 16)}</button>`);
    linkBtn.onclick = () => openEntryPicker(widget, { title: 'Pin to the board', onPick: (e) => {
      const [wx, wy] = surf.toWorld(canvas.width / 2, canvas.height / 2);
      const o = createObject(widget.id, 'bcard', { kind: 'link', ref: { kind: e.kind, id: e.id }, x: wx - 80, y: wy - 20, w: 160, color: COLORS[3] });
      mount(o);
      sync();
      toast('Pinned to the board', 'grid');
    } });
    const stampBtn = el(`<button class="ic-btn" title="Place a stamp from My Stamps">${icon('sparkles', 16)}</button>`);
    stampBtn.onclick = (e) => openStampPicker(e.currentTarget, { title: 'Place a stamp', onPick: (s) => {
      const [wx, wy] = surf.toWorld(canvas.width / 2, canvas.height / 2);
      const o = createObject(widget.id, 'bcard', { kind: 'stamp', stampId: s.id, x: wx - 60, y: wy - 60, w: 120 });
      mount(o);
      sync();
    } });
    const threadBtn = el(`<button class="ic-btn" title="Thread two cards (tap one, then another)">${icon('link', 16)}${''}</button>`);
    threadBtn.innerHTML = icon('move', 16);
    threadBtn.title = 'Thread cards together';
    threadBtn.onclick = () => setConnect(connectFrom ? null : '*pick*');
    strip.append(noteBtn, linkBtn, stampBtn, threadBtn);
    wrap.prepend(strip);

    // connect mode that starts from the button: first tapped card becomes A
    const origSetConnect = setConnect;
    let pickingFirst = false;
    threadBtn.onclick = () => {
      pickingFirst = !pickingFirst && !connectFrom;
      if (!pickingFirst) origSetConnect(null);
      threadBtn.classList.toggle('on', pickingFirst);
    };
    layer.addEventListener('pointerdown', (e) => {
      const cardEl = e.target.closest('.pb-card');
      if (pickingFirst && cardEl) {
        pickingFirst = false;
        origSetConnect(cardEl.dataset.id);
      }
    }, true);

    for (const o of cards(widget)) mount(o);
    sync();
  }
});
