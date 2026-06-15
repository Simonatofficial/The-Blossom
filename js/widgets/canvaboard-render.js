/* Canva Board rendering (V2 §16). Draws an object-based board page onto a 2D
   canvas — shared by the card thumbnail and PNG export. The editor itself is
   DOM-based (canvaboard.js); this is the pixel-accurate renderer. */

import { store } from '../core/store.js';

const imgURLs = new Map(); // imgId -> object URL
export function imgURL(imgId) {
  if (!imgId) return null;
  if (!imgURLs.has(imgId)) { const o = store.get('objects', imgId); if (!o?.data?.blob) return null; imgURLs.set(imgId, URL.createObjectURL(o.data.blob)); }
  return imgURLs.get(imgId);
}

function loadImage(url) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }

function roundRect(g, x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function drawObj(g, o, s, imgs) {
  g.save();
  g.globalAlpha = o.opacity ?? 1;
  const cx = (o.x + o.w / 2) * s, cy = (o.y + o.h / 2) * s;
  g.translate(cx, cy); g.rotate((o.rotation || 0) * Math.PI / 180);
  const w = o.w * s, h = o.h * s, x = -w / 2, y = -h / 2;
  if (o.type === 'rect') {
    roundRect(g, x, y, w, h, (o.radius || 0) * s);
    if (o.fill) { g.fillStyle = o.fill; g.fill(); }
    if (o.stroke && o.strokeWidth) { g.lineWidth = o.strokeWidth * s; g.strokeStyle = o.stroke; g.stroke(); }
  } else if (o.type === 'circle') {
    g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (o.fill) { g.fillStyle = o.fill; g.fill(); }
    if (o.stroke && o.strokeWidth) { g.lineWidth = o.strokeWidth * s; g.strokeStyle = o.stroke; g.stroke(); }
  } else if (o.type === 'triangle') {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w / 2, h / 2); g.lineTo(-w / 2, h / 2); g.closePath();
    if (o.fill) { g.fillStyle = o.fill; g.fill(); }
    if (o.stroke && o.strokeWidth) { g.lineWidth = o.strokeWidth * s; g.strokeStyle = o.stroke; g.stroke(); }
  } else if (o.type === 'image') {
    const im = imgs.get(o.imgId); if (im) g.drawImage(im, x, y, w, h);
    else { g.fillStyle = '#d9d4ec'; g.fillRect(x, y, w, h); }
  } else if (o.type === 'emoji') {
    g.font = `${(o.fontSize || 48) * s}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.text || '🌸', 0, 0);
  } else if (o.type === 'text') {
    g.fillStyle = o.color || '#1b1430'; g.font = `${o.weight || 400} ${(o.fontSize || 24) * s}px system-ui, sans-serif`;
    g.textBaseline = 'top'; g.textAlign = o.align || 'left';
    const lh = (o.lineHeight || 1.3) * (o.fontSize || 24) * s;
    const ax = o.align === 'center' ? 0 : o.align === 'right' ? w / 2 : x;
    (o.text || '').split('\n').forEach((line, i) => g.fillText(line, ax, y + i * lh));
  } else if (o.type === 'line') {
    g.strokeStyle = o.stroke || '#1b1430'; g.lineWidth = (o.strokeWidth || 3) * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(w / 2, h / 2); g.stroke();
    if (o.arrow) { const ang = Math.atan2(h, w), a = 10 * s; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - a * Math.cos(ang - 0.5), h / 2 - a * Math.sin(ang - 0.5)); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - a * Math.cos(ang + 0.5), h / 2 - a * Math.sin(ang + 0.5)); g.stroke(); }
  }
  g.restore();
}

/** Render a board page to a 2D context at `scale` (px per board unit). Async — waits for images. */
export async function renderPage(g, page, scale) {
  const W = page.w * scale, H = page.h * scale;
  g.canvas.width = W; g.canvas.height = H;
  g.clearRect(0, 0, W, H);
  g.fillStyle = page.bg || '#ffffff'; g.fillRect(0, 0, W, H);
  const objs = [...(page.objects || [])].sort((a, b) => (a.z || 0) - (b.z || 0));
  const imgs = new Map();
  await Promise.all(objs.filter(o => o.type === 'image' && o.imgId).map(async o => { const u = imgURL(o.imgId); if (u) imgs.set(o.imgId, await loadImage(u)); }));
  for (const o of objs) drawObj(g, o, scale, imgs);
}
