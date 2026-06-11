/* Preset theme definitions (docs/03, re-tuned per CR-4): multi-stop gradients
   matched to each atmosphere's light source, saturated accents, and a `glow`
   token (translucent accent) for tabs, badges, fills, and flower petals.
   Vibrancy lives in accents/gradients/glows — body text stays AA. */

export const PRESET_THEMES = [
  {
    id: 'flower', name: 'Flower', preset: true,
    colors: {
      bg: '#fff6ee', bgGradient: ['#fff8ef', '#ffe4e9', '#ffd2dc', '150deg'],
      surface: 'rgba(255,255,255,0.80)', surfaceAlt: 'rgba(255,248,242,0.65)',
      border: 'rgba(222,110,140,0.32)', text: '#46303c', textSoft: '#977585',
      accent: '#e0507a', accentSoft: 'rgba(224,80,122,0.15)', highlight: '#f0a032',
      success: '#5fae72', warn: '#dd9540', glow: 'rgba(224,80,122,0.35)'
    },
    atmosphere: { preset: 'dayNight', options: {} },
    // CR-7: layered particles — petals drift over faint wind streaks
    particles: [
      { preset: 'windStreaks', overrides: { maxCount: 7, color: 'rgba(255,255,255,0.22)' }, enabled: true },
      { preset: 'cherryBlossoms', overrides: {}, enabled: true }
    ],
    pointerFx: { preset: 'blossomBurst', overrides: {} }
  },
  {
    id: 'space', name: 'Space', preset: true,
    colors: {
      bg: '#1b1430', bgGradient: ['#150f28', '#2a1f4d', '#43307c', '160deg'],
      surface: 'rgba(40,29,75,0.74)', surfaceAlt: 'rgba(56,42,100,0.62)',
      border: 'rgba(183,148,255,0.28)', text: '#efe9ff', textSoft: '#ab9ed1',
      accent: '#b794ff', accentSoft: 'rgba(183,148,255,0.18)', highlight: '#dcc8ff',
      success: '#7fe0b2', warn: '#f0bd72', glow: 'rgba(183,148,255,0.45)'
    },
    atmosphere: { preset: 'constellations', options: {} },
    // CR-7: twinkling stars with rare comets passing through
    particles: [
      { preset: 'starfield', overrides: {} },
      { preset: 'comets', overrides: { maxCount: 2 } }
    ],
    pointerFx: { preset: 'starSparkle', overrides: {} }
  },
  {
    id: 'forest', name: 'Forest', preset: true,
    colors: {
      bg: '#13231a', bgGradient: ['#0f1f15', '#1e3a26', '#2f5c39', '165deg'],
      surface: 'rgba(33,58,42,0.74)', surfaceAlt: 'rgba(45,76,55,0.62)',
      border: 'rgba(124,212,148,0.28)', text: '#e9f6ec', textSoft: '#9cc2a6',
      accent: '#6fdb8b', accentSoft: 'rgba(111,219,139,0.16)', highlight: '#ffd98a',
      success: '#6fdb8b', warn: '#e0a45c', glow: 'rgba(111,219,139,0.38)'
    },
    atmosphere: { preset: 'clouds', options: { speed: 0.5 } },
    particles: { preset: 'summerLeaves', overrides: {} },
    pointerFx: { preset: 'leafFlutter', overrides: {} }
  },
  {
    id: 'ocean', name: 'Ocean', preset: true,
    colors: {
      bg: '#081a28', bgGradient: ['#06141f', '#0e3a52', '#15737f', '#36c7ab', '170deg'],
      surface: 'rgba(15,55,76,0.72)', surfaceAlt: 'rgba(20,72,98,0.60)',
      border: 'rgba(80,224,212,0.28)', text: '#e6f8f8', textSoft: '#8fc0cb',
      accent: '#3fe0d0', accentSoft: 'rgba(63,224,208,0.16)', highlight: '#baffe6',
      success: '#62e0a8', warn: '#eebd72', glow: 'rgba(63,224,208,0.38)'
    },
    atmosphere: { preset: 'waves', options: { edge: 'bottom' } },
    particles: { preset: 'bubbles', overrides: {} },
    pointerFx: { preset: 'bubblePop', overrides: {} }
  },
  {
    id: 'sunset', name: 'Sunset', preset: true,
    colors: {
      bg: '#2b1036', bgGradient: ['#240d33', '#6e2853', '#c75a48', '#f29a55', '170deg'],
      surface: 'rgba(72,32,66,0.70)', surfaceAlt: 'rgba(92,42,80,0.58)',
      border: 'rgba(255,148,100,0.30)', text: '#fdeee4', textSoft: '#cfa0a8',
      accent: '#ff8a5c', accentSoft: 'rgba(255,138,92,0.17)', highlight: '#ffc46b',
      success: '#9fce8f', warn: '#ffc46b', glow: 'rgba(255,138,92,0.42)'
    },
    atmosphere: { preset: 'sunset', options: {} },
    particles: { preset: 'dustMotes', overrides: {} },
    pointerFx: { preset: 'glowRing', overrides: {} }
  },
  {
    id: 'sunrise', name: 'Sunrise', preset: true,
    colors: {
      bg: '#fff4dc', bgGradient: ['#fff6d8', '#ffe3de', '#cde7fb', '155deg'],
      surface: 'rgba(255,255,255,0.78)', surfaceAlt: 'rgba(255,250,238,0.62)',
      border: 'rgba(224,150,70,0.34)', text: '#473c30', textSoft: '#94806a',
      accent: '#e0821e', accentSoft: 'rgba(224,130,30,0.15)', highlight: '#4f97d4',
      success: '#74b078', warn: '#cf8a3a', glow: 'rgba(224,130,30,0.32)'
    },
    atmosphere: { preset: 'sunrise', options: {} },
    particles: { preset: 'dandelionSeeds', overrides: {} },
    pointerFx: { preset: 'shimmer', overrides: {} }
  },
  {
    id: 'beach', name: 'Beach', preset: true,
    colors: {
      bg: '#fdf0d5', bgGradient: ['#fef2d2', '#fbe0bb', '#a5e0ef', '165deg'],
      surface: 'rgba(255,253,246,0.80)', surfaceAlt: 'rgba(253,247,232,0.64)',
      border: 'rgba(238,118,90,0.32)', text: '#4a3e32', textSoft: '#97826a',
      accent: '#ee6a4e', accentSoft: 'rgba(238,106,78,0.15)', highlight: '#1f9bc4',
      success: '#76b97c', warn: '#d99a4e', glow: 'rgba(238,106,78,0.30)'
    },
    atmosphere: { preset: 'waves', options: { edge: 'bottom', intensity: 0.5, clouds: true } },
    particles: { preset: 'dustMotes', overrides: {} },
    pointerFx: { preset: 'sandFlick', overrides: {} }
  },
  {
    id: 'solar', name: 'Solar System', preset: true,
    colors: {
      bg: '#05050c', bgGradient: ['#040409', '#151028', '#2c1d42', '160deg'],
      surface: 'rgba(26,22,40,0.82)', surfaceAlt: 'rgba(38,30,56,0.66)',
      border: 'rgba(255,196,90,0.26)', text: '#f0ece2', textSoft: '#a098b4',
      accent: '#ffc24d', accentSoft: 'rgba(255,194,77,0.15)', highlight: '#7fb3ff',
      success: '#7fe0a8', warn: '#ffc24d', glow: 'rgba(255,194,77,0.38)'
    },
    atmosphere: { preset: 'constellations', options: { variant: 'planets' } },
    particles: { preset: 'comets', overrides: {} },
    pointerFx: { preset: 'orbitPulse', overrides: {} }
  },
  {
    id: 'crimson', name: 'Crimson', preset: true,
    colors: {
      bg: '#220d13', bgGradient: ['#2b0f18', '#4d1626', '#170a0e', '165deg'],
      surface: 'rgba(58,26,36,0.78)', surfaceAlt: 'rgba(76,34,46,0.62)',
      border: 'rgba(236,168,84,0.28)', text: '#f6e8e8', textSoft: '#bb929b',
      accent: '#ee5570', accentSoft: 'rgba(238,85,112,0.17)', highlight: '#f2bd5e',
      success: '#8fb88f', warn: '#f2bd5e', glow: 'rgba(238,85,112,0.42)'
    },
    atmosphere: null,
    particles: { preset: 'smokeWisps', overrides: {} },
    pointerFx: { preset: 'emberSpark', overrides: {} }
  }
];
