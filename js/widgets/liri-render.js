/* Procedural Liri vignette (docs/17 §4). A cozy SVG creature that reflects the live appearance
   from js/core/liri.js — element colour (deepened by Emotional), size (Physical), form silhouette,
   outfits (Social → bow/collar/crown), and ability orbs (Mental). This is a charming placeholder;
   Simon's final layered art swaps in over the same `appearance` contract later. Pure string out. */

function clampHex(h) { const n = h.replace('#', ''); return n.length === 3 ? n.split('').map(c => c + c).join('') : n; }
function mix(a, b, t) { // blend hex a→b by t (0..1)
  const A = clampHex(a), B = clampHex(b);
  const ch = (i) => { const x = parseInt(A.slice(i, i + 2), 16), y = parseInt(B.slice(i, i + 2), 16); return Math.round(x + (y - x) * t).toString(16).padStart(2, '0'); };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}
function alpha(hex, a) { const n = clampHex(hex); return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`; }

const FORMS = {
  'flying-fox':         { ears: 'big',     feature: 'wings' },
  'dragon-cat':         { ears: 'pointy',  feature: 'horns' },
  'dog-narwhal':        { ears: 'floppy',  feature: 'tusk' },
  'elephant-wolf':      { ears: 'bigfloppy', feature: 'trunk' },
  'porcupine-squirrel': { ears: 'small',   feature: 'spikes' }
};

/** Ear shapes around the head centred at (cx,cy) with head radius r. */
function ears(kind, cx, cy, r, fill, stroke) {
  const ex = r * 0.72, ey = -r * 0.7;
  const ear = (sx) => {
    const x = cx + sx * ex, y = cy + ey;
    if (kind === 'pointy') return `<path d="M${x - r * 0.22} ${y + r * 0.3} L${x} ${y - r * 0.5} L${x + r * 0.22} ${y + r * 0.3} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
    if (kind === 'floppy') return `<ellipse cx="${x}" cy="${y + r * 0.28}" rx="${r * 0.26}" ry="${r * 0.42}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
    if (kind === 'bigfloppy') return `<ellipse cx="${x}" cy="${y + r * 0.4}" rx="${r * 0.34}" ry="${r * 0.6}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
    if (kind === 'small') return `<circle cx="${x}" cy="${y + r * 0.1}" r="${r * 0.24}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
    return `<ellipse cx="${x}" cy="${y}" rx="${r * 0.3}" ry="${r * 0.46}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`; // big
  };
  return ear(-1) + ear(1);
}

function feature(kind, cx, cy, r, fill, stroke) {
  if (kind === 'wings') {
    const w = (sx) => `<path d="M${cx + sx * r * 0.9} ${cy} q${sx * r * 0.9} ${-r * 0.5} ${sx * r * 0.5} ${r * 0.55} q${-sx * r * 0.2} ${-r * 0.1} ${-sx * r * 0.5} ${-r * 0.05} Z" fill="${alpha(fill, 0.55)}" stroke="${stroke}" stroke-width="1"/>`;
    return w(-1) + w(1);
  }
  if (kind === 'horns') { const h = (sx) => `<path d="M${cx + sx * r * 0.34} ${cy - r * 0.78} q${sx * r * 0.1} ${-r * 0.4} ${sx * r * 0.02} ${-r * 0.55}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/>`; return h(-1) + h(1); }
  if (kind === 'tusk') return `<path d="M${cx - r * 0.05} ${cy + r * 0.4} q${-r * 0.05} ${r * 0.5} ${r * 0.05} ${r * 0.62}" fill="none" stroke="#fffaf0" stroke-width="3" stroke-linecap="round"/>`;
  if (kind === 'trunk') return `<path d="M${cx} ${cy + r * 0.35} q${r * 0.05} ${r * 0.5} ${-r * 0.2} ${r * 0.7}" fill="none" stroke="${fill}" stroke-width="${r * 0.28}" stroke-linecap="round"/>`;
  if (kind === 'spikes') { let s = ''; for (let i = -2; i <= 2; i++) { const a = -Math.PI / 2 + i * 0.5; s += `<path d="M${cx + Math.cos(a) * r * 0.95} ${cy + Math.sin(a) * r * 0.95} l${Math.cos(a) * r * 0.3} ${Math.sin(a) * r * 0.3}" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`; } return s; }
  return '';
}

/**
 * @param {object} app appearance from liri.js liriAppearance()
 * @param {{px?:number}} [opts] pixel size (default 180)
 * @returns {string} an <svg> string
 */
export function liriSVG(app, opts = {}) {
  const px = opts.px || 180;
  const form = FORMS[app.form] || FORMS['flying-fox'];
  const base = app.color || '#a9c8ff', deep = app.deep || '#6f97e6';
  const body = mix(base, deep, 0.25 + 0.55 * (app.colorDepth || 0)); // Emotional deepens
  const belly = mix(body, '#ffffff', 0.55);
  const stroke = mix(deep, '#202030', 0.35);
  const r = 24 + 12 * (app.size || 0.5);     // Physical → size
  const cx = 50, cy = 56;
  const happy = 0.4 + 0.6 * (app.liveliness || 0.4);

  const glow = `<defs><radialGradient id="lg" cx="50%" cy="46%" r="60%">
    <stop offset="0%" stop-color="${alpha(base, 0.5)}"/><stop offset="100%" stop-color="${alpha(base, 0)}"/></radialGradient></defs>
    <circle cx="50" cy="50" r="48" fill="url(#lg)"/>`;

  // ability orbs (Mental) ring above
  let orbs = '';
  const n = Math.min(5, app.abilities || 0);
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5; const ox = cx + Math.cos(a) * (r + 12), oy = cy - r * 0.4 + Math.sin(a) * 6; orbs += `<circle cx="${ox}" cy="${oy}" r="2.6" fill="${alpha('#fff7d6', 0.95)}"><animate attributeName="opacity" values="0.5;1;0.5" dur="${2 + i * 0.3}s" repeatCount="indefinite"/></circle>`; }

  // outfits (Social): 1=collar, 2=bow, 3+=little crown
  let outfit = '';
  if ((app.adornment || 0) >= 1) outfit += `<path d="M${cx - r * 0.6} ${cy + r * 0.62} q${r * 0.6} ${r * 0.3} ${r * 1.2} 0" fill="none" stroke="${mix(deep, '#ffffff', 0.2)}" stroke-width="3" stroke-linecap="round"/>`;
  if ((app.adornment || 0) >= 2) outfit += `<g><circle cx="${cx}" cy="${cy + r * 0.66}" r="3" fill="#ff9ec2"/><path d="M${cx - 6} ${cy + r * 0.66} l-5 -4 v8 z M${cx + 6} ${cy + r * 0.66} l5 -4 v8 z" fill="#ff9ec2"/></g>`;
  if ((app.adornment || 0) >= 3) outfit += `<path d="M${cx - r * 0.4} ${cy - r * 0.95} l${r * 0.2} ${r * 0.3} l${r * 0.2} ${-r * 0.22} l${r * 0.2} ${r * 0.22} l${r * 0.2} ${-r * 0.3} v${r * 0.34} h${-r * 0.8} z" fill="#ffd86b" stroke="${alpha('#b88a1e', 0.8)}" stroke-width="1"/>`;

  const eyeY = cy - r * 0.05, eyeX = r * 0.34;
  const mouth = `<path d="M${cx - 5} ${cy + r * 0.34} q5 ${4 * happy} 10 0" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/>`;

  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${app.name || 'Liri'}">
    ${glow}
    ${feature(form.feature, cx, cy, r, body, stroke)}
    ${ears(form.ears, cx, cy, r, body, stroke)}
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.96}" fill="${body}" stroke="${stroke}" stroke-width="1.4"/>
    <ellipse cx="${cx}" cy="${cy + r * 0.22}" rx="${r * 0.62}" ry="${r * 0.6}" fill="${belly}"/>
    <circle cx="${cx - eyeX}" cy="${eyeY}" r="${r * 0.12}" fill="#26242f"/>
    <circle cx="${cx + eyeX}" cy="${eyeY}" r="${r * 0.12}" fill="#26242f"/>
    <circle cx="${cx - eyeX + 1}" cy="${eyeY - 1}" r="1.1" fill="#fff"/>
    <circle cx="${cx + eyeX + 1}" cy="${eyeY - 1}" r="1.1" fill="#fff"/>
    <ellipse cx="${cx - eyeX - 1}" cy="${eyeY + r * 0.16}" rx="2.4" ry="1.5" fill="${alpha('#ff9ec2', 0.5)}"/>
    <ellipse cx="${cx + eyeX + 1}" cy="${eyeY + r * 0.16}" rx="2.4" ry="1.5" fill="${alpha('#ff9ec2', 0.5)}"/>
    ${mouth}
    ${outfit}
    ${orbs}
  </svg>`;
}
