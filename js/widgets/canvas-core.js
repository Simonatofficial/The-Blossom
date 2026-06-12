/* Drawing core (docs/05): vector strokes, layers, undo/redo, zoom/pan,
   pressure. Shared by the Canvas widget today and the Infinite Canvas module
   later. Strokes live in document coordinates; layers cache to offscreen
   canvases and only re-render when their strokes change. */

/* Live image elements are kept OUT of the doc (IndexedDB can't clone them);
   layers persist an imageBlob and re-hydrate here on demand. */
const layerImages = new WeakMap();

/** Attach a live image to a layer (the blob is what persists). */
export function setLayerImage(layer, img) { layerImages.set(layer, img); }

export function newDoc(w = 1600, h = 1200) {
  return {
    w, h,
    layers: [{ id: 'l1', name: 'Layer 1', visible: true, strokes: [], image: null }]
  };
}

export class DrawingSurface {
  /**
   * @param {HTMLElement} host
   * @param {{doc: object, onChange: () => void}} opts
   */
  constructor(host, { doc, onChange }) {
    this.doc = doc;
    this.onChange = onChange;
    this.tool = 'pen';
    this.color = '#d8697f';
    this.size = 6;
    this.opacity = 1;
    this.activeLayer = doc.layers[0].id;
    this.undoStack = [];
    this.redoStack = [];
    this.view = { x: 0, y: 0, scale: 1 };
    this.caches = new Map(); // layerId -> {canvas, dirty}

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'draw-surface';
    this.canvas.style.touchAction = 'none';
    host.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.resize(host);

    this.pointers = new Map();
    this.current = null;
    this.canvas.addEventListener('pointerdown', e => this.down(e));
    this.canvas.addEventListener('pointermove', e => this.move(e));
    this.canvas.addEventListener('pointerup', e => this.up(e));
    this.canvas.addEventListener('pointercancel', e => this.up(e));
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.1 : 0.9);
    }, { passive: false });

    this.fitToView();
    this.render();
  }

  resize(host) {
    const w = host.clientWidth || 600;
    this.canvas.width = w;
    this.canvas.height = Math.min(innerHeight - 220, Math.round(w * 0.75));
  }

  fitToView() {
    const s = Math.min(this.canvas.width / this.doc.w, this.canvas.height / this.doc.h) * 0.96;
    this.view.scale = s;
    this.view.x = (this.canvas.width - this.doc.w * s) / 2;
    this.view.y = (this.canvas.height - this.doc.h * s) / 2;
  }

  toDoc(x, y) {
    return [(x - this.view.x) / this.view.scale, (y - this.view.y) / this.view.scale];
  }

  zoomAt(x, y, f) {
    const s = Math.max(0.1, Math.min(8, this.view.scale * f));
    const [dx, dy] = this.toDoc(x, y);
    this.view.scale = s;
    this.view.x = x - dx * s;
    this.view.y = y - dy * s;
    this.render();
  }

  layer() { return this.doc.layers.find(l => l.id === this.activeLayer) || this.doc.layers[0]; }

  down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (this.pointers.size === 2) { this.current = null; return; } // two fingers = pan/zoom
    const [x, y] = this.toDoc(e.offsetX, e.offsetY);
    this.current = {
      tool: this.tool, color: this.color, size: this.size, opacity: this.opacity,
      pts: [[x, y, e.pressure || 0.6]]
    };
  }

  move(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (!this.pinch) this.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
      else {
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
        this.zoomAt(cx, cy, d / this.pinch.d);
        this.view.x += cx - this.pinch.cx;
        this.view.y += cy - this.pinch.cy;
        this.pinch = { d, cx, cy };
        this.render();
      }
      return;
    }
    if (!this.current) return;
    const [x, y] = this.toDoc(e.offsetX, e.offsetY);
    const last = this.current.pts[this.current.pts.length - 1];
    if (Math.hypot(x - last[0], y - last[1]) < 1.2 / this.view.scale) return;
    this.current.pts.push([x, y, e.pressure || 0.6]);
    this.render();
  }

  up(e) {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    if (this.current && this.current.pts.length > 1) {
      const layer = this.layer();
      layer.strokes.push(this.current);
      this.undoStack.push({ layerId: layer.id, stroke: this.current });
      if (this.undoStack.length > 50) this.undoStack.shift();
      this.redoStack = [];
      this.invalidate(layer.id);
      this.onChange?.();
    }
    this.current = null;
    this.render();
  }

  undo() {
    const op = this.undoStack.pop();
    if (!op) return;
    const layer = this.doc.layers.find(l => l.id === op.layerId);
    const i = layer?.strokes.indexOf(op.stroke);
    if (i >= 0) layer.strokes.splice(i, 1);
    this.redoStack.push(op);
    this.invalidate(op.layerId);
    this.onChange?.();
    this.render();
  }

  redo() {
    const op = this.redoStack.pop();
    if (!op) return;
    this.doc.layers.find(l => l.id === op.layerId)?.strokes.push(op.stroke);
    this.undoStack.push(op);
    this.invalidate(op.layerId);
    this.onChange?.();
    this.render();
  }

  invalidate(layerId) {
    const c = this.caches.get(layerId);
    if (c) c.dirty = true;
  }

  layerCanvas(layer) {
    let c = this.caches.get(layer.id);
    if (!c) {
      const canvas = document.createElement('canvas');
      canvas.width = this.doc.w;
      canvas.height = this.doc.h;
      c = { canvas, dirty: true };
      this.caches.set(layer.id, c);
    }
    if (c.dirty) {
      const g = c.canvas.getContext('2d');
      g.clearRect(0, 0, this.doc.w, this.doc.h);
      let img = layerImages.get(layer);
      if (!img && layer.imageBlob) {
        img = new Image();
        img.onload = () => { this.invalidate(layer.id); this.render(); };
        img.src = URL.createObjectURL(layer.imageBlob);
        layerImages.set(layer, img);
      }
      if (img?.complete && img.naturalWidth) g.drawImage(img, 0, 0, this.doc.w, this.doc.h);
      for (const s of layer.strokes) drawStroke(g, s, this.doc.w, this.doc.h);
      c.dirty = false;
    }
    return c.canvas;
  }

  render() {
    const { g, canvas, view } = this;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.save();
    g.translate(view.x, view.y);
    g.scale(view.scale, view.scale);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, this.doc.w, this.doc.h);
    for (const layer of this.doc.layers) {
      if (!layer.visible) continue;
      g.drawImage(this.layerCanvas(layer), 0, 0);
      if (this.current && layer.id === this.activeLayer) drawStroke(g, this.current, this.doc.w, this.doc.h);
    }
    g.restore();
  }

  /** Flattened PNG blob (also used for the cached thumbnail). */
  async toPNG(maxSize = null) {
    const out = document.createElement('canvas');
    const scale = maxSize ? Math.min(1, maxSize / Math.max(this.doc.w, this.doc.h)) : 1;
    out.width = Math.round(this.doc.w * scale);
    out.height = Math.round(this.doc.h * scale);
    const g = out.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, out.width, out.height);
    g.scale(scale, scale);
    for (const layer of this.doc.layers) {
      if (layer.visible) g.drawImage(this.layerCanvas(layer), 0, 0);
    }
    return new Promise(res => out.toBlob(res, 'image/png'));
  }
}

/* CR-13b: segments stamp a shared buffer at full alpha; the whole stroke
   composites once at its opacity, so joints never double-darken. */
let scratch = null;

function drawStroke(g, s, w, h) {
  if (!scratch || scratch.width !== w || scratch.height !== h) {
    scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
  }
  const b = scratch.getContext('2d');
  b.clearRect(0, 0, w, h);
  b.strokeStyle = s.color;
  b.lineCap = 'round';
  b.lineJoin = 'round';
  for (let i = 1; i < s.pts.length; i++) {
    const [x0, y0, p0] = s.pts[i - 1];
    const [x1, y1, p1] = s.pts[i];
    b.lineWidth = Math.max(0.5, s.size * ((p0 + p1) / 2) * (s.tool === 'marker' ? 2 : 1.4));
    b.beginPath();
    b.moveTo(x0, y0);
    b.lineTo(x1, y1);
    b.stroke();
  }
  g.save();
  if (s.tool === 'eraser') g.globalCompositeOperation = 'destination-out';
  else if (s.tool === 'marker') { g.globalAlpha = 0.35 * s.opacity; g.globalCompositeOperation = 'multiply'; }
  else g.globalAlpha = s.opacity;
  g.drawImage(scratch, 0, 0);
  g.restore();
}
