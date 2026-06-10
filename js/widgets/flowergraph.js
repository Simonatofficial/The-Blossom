/* The Flower Graph renderer (docs/05 — the signature graph).
   Petals are closed Bézier teardrops (not wedges): length = normalized value
   (25% minimum so zeros read as buds), width ≈ 2π/count with overlap, gentle
   tilt variance, radial gradients, rim light, bloom-in stagger, idle breathing.
   Pure canvas drawing — the Graph widget owns interaction and data. */

/** Tiny color helpers (hex → rgba strings at given alpha, lighten). */
export function hexA(hex, a) {
  const n = hex.replace('#', '');
  const v = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex, f) {
  const n = hex.replace('#', '');
  const v = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const ch = (i) => Math.min(255, Math.round(parseInt(v.slice(i, i + 2), 16) + (255 - parseInt(v.slice(i, i + 2), 16)) * f));
  return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
}

const easeOut = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/**
 * Draw the flower.
 * @param {CanvasRenderingContext2D} g
 * @param {{
 *   cx: number, cy: number, radius: number,
 *   petals: {label: string, value01: number, color: string, lifted?: boolean, particles?: {value01: number}[]}[],
 *   t: number,           // seconds since bloom start (for stagger + breathing)
 *   theme: {highlight: string, textSoft: string},
 *   showLabels: boolean,
 *   reducedMotion: boolean
 * }} opts
 * @returns {{petalHits: {angle: number, halfWidth: number, maxR: number}[], particleHits: {x:number,y:number,r:number,petal:number,index:number}[]}}
 */
export function drawFlower(g, opts) {
  const { cx, cy, radius, petals, t, theme, showLabels, reducedMotion } = opts;
  const n = Math.max(1, petals.length);
  const halfWidth = (Math.PI / n) * 1.1; // 8–12% overlap
  const breathe = reducedMotion ? 1 : 1 + 0.015 * Math.sin((t / 6) * Math.PI * 2);
  const petalHits = [];
  const particleHits = [];

  g.save();
  g.translate(cx, cy);
  g.scale(breathe, breathe);

  petals.forEach((p, i) => {
    // deterministic 3–5° natural variance per petal
    const variance = ((i * 2654435761 % 100) / 100 - 0.5) * (Math.PI / 36);
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2 + variance;
    const bloom = reducedMotion ? 1 : easeOut((t - i * 0.06) / 0.4);
    const L = radius * (0.25 + 0.75 * Math.max(0, Math.min(1, p.value01))) * bloom * (p.lifted ? 1.06 : 1);
    if (L <= 1) return;
    const W = Math.min(L * 0.62, 2 * L * Math.sin(halfWidth) * 0.62);

    g.save();
    g.rotate(angle + Math.PI / 2); // local: petal points up (-y)
    const grad = g.createRadialGradient(0, 0, L * 0.08, 0, 0, L);
    grad.addColorStop(0, hexA(p.color, 0.95));
    grad.addColorStop(0.65, hexA(p.color, 0.55));
    grad.addColorStop(1, hexA(p.color, 0.18));
    g.shadowColor = 'rgba(0,0,0,0.16)';
    g.shadowBlur = 7;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-W, -L * 0.35, -W * 0.82, -L * 0.78, 0, -L);
    g.bezierCurveTo(W * 0.82, -L * 0.78, W, -L * 0.35, 0, 0);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = hexA(lighten(p.color, 0.4).replace('rgb', 'rgba').replace(')', ',1)'), 0.5);
    g.strokeStyle = lighten(p.color, 0.45);
    g.globalAlpha = 0.5;
    g.lineWidth = 1;
    g.stroke();
    g.globalAlpha = 1;
    g.restore();

    petalHits.push({ angle, halfWidth, maxR: L });

    // complex particles: sub-values orbiting just past the petal tip (docs/05)
    if (p.particles?.length) {
      const count = Math.min(p.particles.length, Math.floor(40 / n));
      for (let k = 0; k < count; k++) {
        const spread = (k - (count - 1) / 2) * (halfWidth * 0.8 / Math.max(1, count - 1) * 2);
        const a = angle + spread;
        const pr = L + 9 + (k % 2) * 6;
        const sub = p.particles[k].value01;
        const size = 1.6 + sub * 2.6;
        const tw = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(t * 2 + i * 1.7 + k * 2.3);
        const px = Math.cos(a) * pr, py = Math.sin(a) * pr;
        g.beginPath();
        g.arc(px, py, size, 0, Math.PI * 2);
        g.fillStyle = hexA(p.color, (0.35 + sub * 0.6) * tw);
        g.fill();
        particleHits.push({ x: cx + px * breathe, y: cy + py * breathe, r: size + 6, petal: i, index: k });
      }
    }

    if (showLabels && bloom >= 1) {
      const lx = Math.cos(angle) * (L + (p.particles?.length ? 22 : 12));
      const ly = Math.sin(angle) * (L + (p.particles?.length ? 22 : 12));
      g.save();
      g.translate(lx, ly);
      let rot = angle + Math.PI / 2;
      if (Math.sin(angle) > 0.1) rot += Math.PI; // keep text upright
      g.rotate(rot);
      g.fillStyle = theme.textSoft;
      g.font = '11px system-ui';
      g.textAlign = 'center';
      g.fillText(p.label, 0, 0);
      g.restore();
    }
  });

  // core disc + stamen dot ring (theme highlight)
  const coreR = radius * 0.14;
  const coreGrad = g.createRadialGradient(0, 0, 1, 0, 0, coreR * 1.6);
  coreGrad.addColorStop(0, theme.highlight);
  coreGrad.addColorStop(1, hexA(theme.highlight.startsWith('#') ? theme.highlight : '#e0a23c', 0.0));
  g.beginPath();
  g.arc(0, 0, coreR * 1.6, 0, Math.PI * 2);
  g.fillStyle = coreGrad;
  g.fill();
  g.beginPath();
  g.arc(0, 0, coreR, 0, Math.PI * 2);
  g.fillStyle = theme.highlight;
  g.fill();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    g.beginPath();
    g.arc(Math.cos(a) * coreR * 0.62, Math.sin(a) * coreR * 0.62, 1.4, 0, Math.PI * 2);
    g.fillStyle = hexA('#ffffff', 0.55);
    g.fill();
  }

  g.restore();
  return { petalHits, particleHits };
}

/** Decorative botanical stem + leaves, drawn behind the flower (SVG string). */
export function stemSvg(width, height, cx, flowerBottomY, color) {
  const stemTop = flowerBottomY;
  const stemH = height - stemTop;
  if (stemH < 24) return '';
  return `<svg class="fg-stem" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="M ${cx} ${stemTop} C ${cx - 6} ${stemTop + stemH * 0.4}, ${cx + 8} ${stemTop + stemH * 0.6}, ${cx} ${height}"
      fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
    <path d="M ${cx} ${stemTop + stemH * 0.45} q -26 -4 -34 -26 q 30 -2 34 26z" fill="${color}" opacity="0.45"/>
    <path d="M ${cx} ${stemTop + stemH * 0.66} q 26 -4 34 -26 q -30 -2 -34 26z" fill="${color}" opacity="0.45"/>
  </svg>`;
}
