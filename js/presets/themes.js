/* Preset theme definitions (docs/03 · re-tuned per V2 §9): rich multi-stop
   gradients matched to each atmosphere's light source, saturated accents, and a
   `glow` token (translucent accent) for tabs, badges, fills, and flower petals.
   Vibrancy lives in accents/gradients/glows — body text stays AA. */

export const PRESET_THEMES = [
  {
    id: 'flower', name: 'Flower', preset: true,
    colors: {
      bg: '#fbeee2', bgGradient: ['#fbeede', '#ffdce4', '#f6bfd0', '#e6d2ef', '135deg'],
      surface: 'rgba(251,245,239,0.80)', surfaceAlt: 'rgba(248,240,234,0.66)',
      border: 'rgba(214,96,128,0.34)', text: '#412c37', textSoft: '#8e6c7c',
      accent: '#d6436e', accentSoft: 'rgba(214,67,110,0.16)', highlight: '#ec9636',
      success: '#5aa66c', warn: '#d68f3c', glow: 'rgba(236,150,180,0.40)'
    },
    atmosphere: { preset: 'dayNight', options: { speed: 0.3 } },
    // petals drift over a subtle starfield (V2 §9)
    particles: [
      { preset: 'cherryBlossoms', overrides: {}, enabled: true },
      { preset: 'starfield', overrides: { maxCount: 28 }, enabled: true }
    ],
    pointerFx: { preset: 'blossomBurst', overrides: {} }
  },
  {
    id: 'space', name: 'Space', preset: true,
    colors: {
      bg: '#0c0820', bgGradient: ['#160f3a', '#3a1d6e', '#120d2e', '#05030c', '200deg'],
      surface: 'rgba(34,24,66,0.76)', surfaceAlt: 'rgba(48,36,90,0.64)',
      border: 'rgba(170,140,255,0.30)', text: '#efe9ff', textSoft: '#a99edb',
      accent: '#9d6bff', accentSoft: 'rgba(157,107,255,0.18)', highlight: '#67e8f0',
      success: '#7fe0b2', warn: '#f0bd72', glow: 'rgba(103,232,240,0.42)'
    },
    atmosphere: { preset: 'constellations', options: {} },
    particles: [
      { preset: 'starfield', overrides: {} },
      { preset: 'comets', overrides: { maxCount: 2, speed: 4 } }
    ],
    pointerFx: { preset: 'starSparkle', overrides: {} }
  },
  {
    id: 'forest', name: 'Forest', preset: true,
    colors: {
      bg: '#0f2417', bgGradient: ['#0d2014', '#234a2c', '#5c8a52', '#e6e0c2', '160deg'],
      surface: 'rgba(30,56,40,0.76)', surfaceAlt: 'rgba(42,72,52,0.64)',
      border: 'rgba(124,212,148,0.30)', text: '#e9f6ec', textSoft: '#9cc2a6',
      accent: '#5fd07f', accentSoft: 'rgba(95,208,127,0.16)', highlight: '#ffd98a',
      success: '#5fd07f', warn: '#e0a45c', glow: 'rgba(95,208,127,0.38)'
    },
    atmosphere: { preset: 'forest', options: { density: 60 } },
    particles: [
      { preset: 'summerLeaves', overrides: {}, enabled: true },
      { preset: 'fireflies', overrides: { maxCount: 18 }, enabled: true }
    ],
    pointerFx: { preset: 'leafFlutter', overrides: {} }
  },
  {
    id: 'ocean', name: 'Ocean', preset: true,
    colors: {
      bg: '#041726', bgGradient: ['#031320', '#0a3a50', '#1e8a86', '#9fe8d8', '190deg'],
      surface: 'rgba(15,55,76,0.74)', surfaceAlt: 'rgba(20,72,98,0.62)',
      border: 'rgba(80,224,212,0.30)', text: '#e6f8f8', textSoft: '#8fc0cb',
      accent: '#3fe0d0', accentSoft: 'rgba(63,224,208,0.16)', highlight: '#baffe6',
      success: '#62e0a8', warn: '#eebd72', glow: 'rgba(63,224,208,0.38)'
    },
    atmosphere: { preset: 'waves', options: { energy: 55 } },
    particles: [
      { preset: 'bubbles', overrides: {}, enabled: true },
      { preset: 'tropicalFish', overrides: {}, enabled: true }
    ],
    pointerFx: { preset: 'bubblePop', overrides: {} }
  },
  {
    id: 'sunset', name: 'Sunset', preset: true,
    colors: {
      bg: '#2a0f3a', bgGradient: ['#260e38', '#7a2342', '#d65a3a', '#f5b14e', '170deg'],
      surface: 'rgba(72,32,66,0.72)', surfaceAlt: 'rgba(92,42,80,0.60)',
      border: 'rgba(255,148,100,0.32)', text: '#fdeee4', textSoft: '#cfa0a8',
      accent: '#ff8a5c', accentSoft: 'rgba(255,138,92,0.17)', highlight: '#ffc46b',
      success: '#9fce8f', warn: '#ffc46b', glow: 'rgba(255,138,92,0.42)'
    },
    atmosphere: { preset: 'sunset', options: { sunPos: 50 } },
    particles: [
      { preset: 'fireflies', overrides: {}, enabled: true },
      { preset: 'starfield', overrides: { maxCount: 28 }, enabled: true }
    ],
    pointerFx: { preset: 'glowRing', overrides: {} }
  },
  {
    id: 'sunrise', name: 'Sunrise', preset: true,
    colors: {
      bg: '#f3ecdd', bgGradient: ['#9aa6c4', '#c6b6d8', '#f6c2a8', '#ffe6a8', '170deg'],
      surface: 'rgba(255,255,255,0.78)', surfaceAlt: 'rgba(255,250,238,0.62)',
      border: 'rgba(224,150,70,0.34)', text: '#473c30', textSoft: '#8a7a6a',
      accent: '#e0821e', accentSoft: 'rgba(224,130,30,0.15)', highlight: '#6f8fd0',
      success: '#74b078', warn: '#cf8a3a', glow: 'rgba(224,130,30,0.32)'
    },
    atmosphere: { preset: 'sunrise', options: { sunPos: 30 } },
    particles: [
      { preset: 'dandelionSeeds', overrides: {}, enabled: true },
      { preset: 'starfield', overrides: { maxCount: 22 }, enabled: true }
    ],
    pointerFx: { preset: 'shimmer', overrides: {} }
  },
  {
    id: 'solar', name: 'Solar System', preset: true,
    colors: {
      bg: '#04040a', bgGradient: ['#04040a', '#241338', '#1c2a4a', '#0a0a16', '165deg'],
      surface: 'rgba(26,22,40,0.82)', surfaceAlt: 'rgba(38,30,56,0.66)',
      border: 'rgba(255,196,90,0.26)', text: '#f0ece2', textSoft: '#a098b4',
      accent: '#ffc24d', accentSoft: 'rgba(255,194,77,0.15)', highlight: '#7fb3ff',
      success: '#7fe0a8', warn: '#ffc24d', glow: 'rgba(255,194,77,0.38)'
    },
    atmosphere: { preset: 'solarSystem', options: { speed: 1 } },
    particles: [
      { preset: 'starfield', overrides: { maxCount: 40 }, enabled: true },
      { preset: 'shootingStars', overrides: {}, enabled: true },
      { preset: 'comets', overrides: {}, enabled: true }
    ],
    pointerFx: { preset: 'orbitPulse', overrides: {} }
  },
  {
    // id stays 'crimson' so existing theme references keep working; renamed to
    // Autumn with a rich autumn palette (V2 §9).
    id: 'crimson', name: 'Autumn', preset: true,
    colors: {
      bg: '#2a160e', bgGradient: ['#6e3318', '#b5662a', '#8a3d24', '#3e2417', '145deg'],
      surface: 'rgba(64,34,22,0.78)', surfaceAlt: 'rgba(84,46,30,0.62)',
      border: 'rgba(230,150,70,0.30)', text: '#f6ece4', textSoft: '#c2a08e',
      accent: '#e07a3c', accentSoft: 'rgba(224,122,60,0.17)', highlight: '#f2bd5e',
      success: '#9fb06f', warn: '#f2bd5e', glow: 'rgba(224,122,60,0.40)'
    },
    atmosphere: { preset: 'forest', options: { density: 40 } },
    particles: [
      { preset: 'autumnLeaves', overrides: {}, enabled: true },
      { preset: 'fireflies', overrides: { maxCount: 16 }, enabled: true }
    ],
    pointerFx: { preset: 'emberSpark', overrides: {} }
  }
];
