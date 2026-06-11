/* The Flower Graph renderer (docs/05, reworked per CR-6).
   Stemless bloom floating on a soft radial glow. Petals are refined Bézier
   teardrops — pinched base (waist ≈ 58% of max width), bulge mid-petal,
   gently pointed tip — with a two-layer fill (rich gradient + inner highlight
   petal), rim light, per-petal ±6° hue shift, and glow halos on high values.
   Global rotation offset = π/petalCount (4 petals sit as ×, never +).
   Pure canvas drawing — the Graph widget owns interaction and data. */

/** hex → rgba string at alpha. */
export function hexA(hex, a) {
  const n = hex.replace('#', '');
  const v = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function lightenHex(hex, f) {
  const n = hex.replace('#', '');
  const v = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  const ch = (i) => Math.min(255, Math.round(parseInt(v.slice(i, i + 2), 16) + (255 - parseInt(v.slice(i, i + 2), 16)) * f))
    .toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

/** Rotate a hex color's hue by `deg` (for the ±6° per-petal variation). */
export function hueShift(hex, deg) {
  const n = hex.replace('#', '');
  const v = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  let r = parseInt(v.slice(0, 2), 16) / 255, g = parseInt(v.slice(2, 4), 16) / 255, b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  h = (h + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let [r2, g2, b2] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (q) => Math.round((q + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r2)}${to(g2)}${to(b2)}`;
}

const easeOut = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/** One petal path in local coords (base at origin, tip at (0,-L)). */
function petalPath(g, L, W) {
  const waist = 0.58; // base pinch ≈ 58% of max width (CR-6)
  g.beginPath();
  g.moveTo(0, -2);
  g.bezierCurveTo(-W * waist, -L * 0.12, -W * 1.02, -L * 0.34, -W * 0.94, -L * 0.55);
  g.bezierCurveTo(-W * 0.84, -L * 0.76, -W * 0.34, -L * 0.92, 0, -L);
  g.bezierCurveTo(W * 0.34, -L * 0.92, W * 0.84, -L * 0.76, W * 0.94, -L * 0.55);
  g.bezierCurveTo(W * 1.02, -L * 0.34, W * waist, -L * 0.12, 0, -2);
  g.closePath();
}

/**
 * Draw the flower.
 * @param {CanvasRenderingContext2D} g
 * @param {{
 *   cx: number, cy: number, radius: number,
 *   petals: {label: string, value01: number, color: string, lifted?: boolean, particles?: {value01: number}[]}[],
 *   t: number,
 *   rotation?: number,    // extra manual rotation (radians)
 *   theme: {highlight: string, textSoft: string, glow?: string},
 *   showLabels: boolean,
 *   reducedMotion: boolean
 * }} opts
 * @returns {{petalHits: {angle, halfWidth, maxR}[], particleHits: {x, y, r, petal, index}[]}}
 */
export function drawFlower(g, opts) {
  const { cx, cy, radius, petals, t, theme, showLabels, reducedMotion } = opts;
  const n = Math.max(1, petals.length);
  const halfWidth = (Math.PI / n) * 1.1; // 8–12% overlap
  const offset = Math.PI / n + (opts.rotation || 0); // ×-orientation rule (CR-6)
  const breathe = reducedMotion ? 1 : 1 + 0.015 * Math.sin((t / 6) * Math.PI * 2);
  const glowColor = theme.glow || hexA('#ffffff', 0.12);
  const petalHits = [];
  const particleHits = [];

  g.save();
  g.translate(cx, cy);
  g.scale(breathe, breathe);

  // the flower floats on a soft radial glow (replaces the old stem)
  const halo = g.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius * 1.25);
  halo.addColorStop(0, glowColor);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.beginPath();
  g.arc(0, 0, radius * 1.25, 0, Math.PI * 2);
  g.fillStyle = halo;
  g.fill();

  petals.forEach((p, i) => {
    const variance = ((i * 2654435761 % 100) / 100 - 0.5) * (Math.PI / 36); // 3–5° natural tilt
    const angle = -Math.PI / 2 + offset + (i / n) * Math.PI * 2 + variance;
    const bloom = reducedMotion ? 1 : easeOut((t - i * 0.06) / 0.4);
    const L = radius * (0.25 + 0.75 * Math.max(0, Math.min(1, p.value01))) * bloom * (p.lifted ? 1.06 : 1);
    if (L <= 1) return;
    const W = Math.min(L * 0.58, 2 * L * Math.sin(halfWidth) * 0.6);
    const color = hueShift(p.color, i % 2 ? 6 : -6); // adjacent petals never identical

    // halo behind high-value petals
    if (p.value01 > 0.66) {
      const hx = Math.cos(angle) * L * 0.6, hy = Math.sin(angle) * L * 0.6;
      const ph = g.createRadialGradient(hx, hy, 2, hx, hy, L * 0.75);
      ph.addColorStop(0, theme.glow ? glowColor : hexA(color, 0.22));
      ph.addColorStop(1, 'rgba(0,0,0,0)');
      g.beginPath();
      g.arc(hx, hy, L * 0.75, 0, Math.PI * 2);
      g.fillStyle = ph;
      g.fill();
    }

    g.save();
    g.rotate(angle + Math.PI / 2);

    // layer 1: body gradient, rich at base → translucent tip
    const grad = g.createRadialGradient(0, 0, L * 0.06, 0, 0, L);
    grad.addColorStop(0, hexA(color, 0.97));
    grad.addColorStop(0.55, hexA(color, 0.62));
    grad.addColorStop(1, hexA(color, 0.16));
    g.shadowColor = 'rgba(0,0,0,0.2)';
    g.shadowBlur = 9;
    petalPath(g, L, W);
    g.fillStyle = grad;
    g.fill();
    g.shadowBlur = 0;

    // rim light on the outer edge
    g.strokeStyle = lightenHex(color, 0.5);
    g.globalAlpha = 0.55;
    g.lineWidth = 1;
    g.stroke();
    g.globalAlpha = 1;

    // layer 2: inner highlight petal for depth (70% scale, lower opacity)
    const hgrad = g.createRadialGradient(0, 0, L * 0.04, 0, 0, L * 0.7);
    hgrad.addColorStop(0, hexA(lightenHex(color, 0.55), 0.45));
    hgrad.addColorStop(1, hexA(color, 0));
    petalPath(g, L * 0.7, W * 0.62);
    g.fillStyle = hgrad;
    g.fill();

    g.restore();

    petalHits.push({ angle, halfWidth, maxR: L });

    // complex particles: sub-values arcing past the petal tip (docs/05)
    if (p.particles?.length) {
      const count = Math.min(p.particles.length, Math.floor(40 / n));
      for (let k = 0; k < count; k++) {
        const spread = count === 1 ? 0 : (k - (count - 1) / 2) * (halfWidth * 1.6 / (count - 1));
        const a = angle + spread;
        const pr = L + 10 + (k % 2) * 7;
        const sub = p.particles[k].value01;
        const size = 1.8 + sub * 2.8;
        const tw = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(t * 2 + i * 1.7 + k * 2.3);
        const px = Math.cos(a) * pr, py = Math.sin(a) * pr;
        g.beginPath();
        g.arc(px, py, size, 0, Math.PI * 2);
        g.fillStyle = hexA(color, (0.4 + sub * 0.6) * tw);
        g.fill();
        // ≥44px touch target regardless of visual size (CR-6)
        particleHits.push({ x: cx + px * breathe, y: cy + py * breathe, r: Math.max(22, size + 6), petal: i, index: k });
      }
    }

    if (showLabels && bloom >= 1) {
      const lx = Math.cos(angle) * (L + (p.particles?.length ? 26 : 13));
      const ly = Math.sin(angle) * (L + (p.particles?.length ? 26 : 13));
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
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
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
