/* Preset theme definitions (docs/03). Pure data — rendered by fx/themes.js.
   atmosphere/particles/pointerFx reference preset keys in fx engines (Phase 5);
   until those engines exist the color sets alone apply. */

export const PRESET_THEMES = [
  {
    id: 'flower', name: 'Flower', preset: true,
    colors: {
      bg: '#fbf1ec', bgGradient: ['#fdf6ef', '#f9e0e4', '150deg'],
      surface: 'rgba(255,255,255,0.78)', surfaceAlt: 'rgba(255,249,244,0.62)',
      border: 'rgba(216,134,150,0.30)', text: '#4a3540', textSoft: '#9b7f8a',
      accent: '#d8697f', accentSoft: 'rgba(216,105,127,0.14)', highlight: '#e0a23c',
      success: '#7fae7f', warn: '#d9a05b'
    },
    atmosphere: { preset: 'dayNight', options: {} },
    particles: { preset: 'cherryBlossoms', overrides: {} },
    pointerFx: { preset: 'blossomBurst', overrides: {} }
  },
  {
    id: 'space', name: 'Space', preset: true,
    colors: {
      bg: '#1b1430', bgGradient: ['#1b1430', '#2a1f4d', '160deg'],
      surface: 'rgba(38,28,70,0.72)', surfaceAlt: 'rgba(52,40,94,0.60)',
      border: 'rgba(167,139,250,0.22)', text: '#ece7fb', textSoft: '#a99ec9',
      accent: '#a78bfa', accentSoft: 'rgba(167,139,250,0.16)', highlight: '#cdbcf5',
      success: '#7fd1a8', warn: '#e8b76f'
    },
    atmosphere: { preset: 'constellations', options: {} },
    particles: { preset: 'starfield', overrides: {} },
    pointerFx: { preset: 'starSparkle', overrides: {} }
  },
  {
    id: 'forest', name: 'Forest', preset: true,
    colors: {
      bg: '#16241a', bgGradient: ['#16241a', '#243b2a', '160deg'],
      surface: 'rgba(34,54,40,0.72)', surfaceAlt: 'rgba(46,70,52,0.60)',
      border: 'rgba(140,190,150,0.22)', text: '#e7f2e9', textSoft: '#9db8a4',
      accent: '#8fc99b', accentSoft: 'rgba(143,201,155,0.16)', highlight: '#d9c39a',
      success: '#8fc99b', warn: '#d9a05b'
    },
    atmosphere: { preset: 'clouds', options: { speed: 0.5 } },
    particles: { preset: 'forestFloat', overrides: {} },
    pointerFx: { preset: 'leafFlutter', overrides: {} }
  },
  {
    id: 'ocean', name: 'Ocean', preset: true,
    colors: {
      bg: '#0e1f2d', bgGradient: ['#0e1f2d', '#16374a', '170deg'],
      surface: 'rgba(22,55,74,0.70)', surfaceAlt: 'rgba(30,70,92,0.58)',
      border: 'rgba(126,214,223,0.22)', text: '#e3f4f6', textSoft: '#94b9c4',
      accent: '#67c9c9', accentSoft: 'rgba(103,201,201,0.16)', highlight: '#b8ecd9',
      success: '#7fd1a8', warn: '#e0b36e'
    },
    atmosphere: { preset: 'waves', options: { edge: 'bottom' } },
    particles: { preset: 'bubbles', overrides: {} },
    pointerFx: { preset: 'bubblePop', overrides: {} }
  },
  {
    id: 'sunset', name: 'Sunset', preset: true,
    colors: {
      bg: '#2c1a30', bgGradient: ['#4a2336', '#2c1a40', '170deg'],
      surface: 'rgba(70,38,60,0.66)', surfaceAlt: 'rgba(88,48,72,0.55)',
      border: 'rgba(232,134,90,0.25)', text: '#f6e9e2', textSoft: '#c5a3a8',
      accent: '#e8865a', accentSoft: 'rgba(232,134,90,0.16)', highlight: '#f2b06b',
      success: '#9fbb8f', warn: '#f2b06b'
    },
    atmosphere: { preset: 'sunset', options: {} },
    particles: { preset: 'dustMotes', overrides: {} },
    pointerFx: { preset: 'glowRing', overrides: {} }
  },
  {
    id: 'sunrise', name: 'Sunrise', preset: true,
    colors: {
      bg: '#fdf6e8', bgGradient: ['#fdf3e3', '#dcecf7', '150deg'],
      surface: 'rgba(255,255,255,0.74)', surfaceAlt: 'rgba(255,251,240,0.60)',
      border: 'rgba(214,160,96,0.30)', text: '#4b4036', textSoft: '#99836f',
      accent: '#e09b57', accentSoft: 'rgba(224,155,87,0.15)', highlight: '#6fa8d4',
      success: '#87b88a', warn: '#cf9352'
    },
    atmosphere: { preset: 'sunrise', options: {} },
    particles: { preset: 'dandelionSeeds', overrides: {} },
    pointerFx: { preset: 'shimmer', overrides: {} }
  },
  {
    id: 'beach', name: 'Beach', preset: true,
    colors: {
      bg: '#faf2e4', bgGradient: ['#faf2e4', '#cfe8ee', '160deg'],
      surface: 'rgba(255,253,247,0.76)', surfaceAlt: 'rgba(252,247,236,0.62)',
      border: 'rgba(226,140,118,0.30)', text: '#4d4338', textSoft: '#9c8874',
      accent: '#e2826e', accentSoft: 'rgba(226,130,110,0.15)', highlight: '#5fa8c0',
      success: '#8fbf8f', warn: '#d9a05b'
    },
    atmosphere: { preset: 'waves', options: { edge: 'bottom', intensity: 0.5, clouds: true } },
    particles: { preset: 'heatShimmer', overrides: {} },
    pointerFx: { preset: 'sandFlick', overrides: {} }
  },
  {
    id: 'solar', name: 'Solar System', preset: true,
    colors: {
      bg: '#0a0a12', bgGradient: ['#0a0a12', '#16121f', '160deg'],
      surface: 'rgba(26,22,38,0.80)', surfaceAlt: 'rgba(36,30,52,0.65)',
      border: 'rgba(196,170,120,0.22)', text: '#ece8e0', textSoft: '#9c95a8',
      accent: '#d8a85a', accentSoft: 'rgba(216,168,90,0.15)', highlight: '#8fb7e8',
      success: '#8fc99b', warn: '#d8a85a'
    },
    atmosphere: { preset: 'constellations', options: { variant: 'planets' } },
    particles: { preset: 'comets', overrides: {} },
    pointerFx: { preset: 'orbitPulse', overrides: {} }
  },
  {
    id: 'crimson', name: 'Crimson', preset: true,
    colors: {
      bg: '#1d1216', bgGradient: ['#241318', '#160f12', '165deg'],
      surface: 'rgba(48,26,32,0.74)', surfaceAlt: 'rgba(62,34,42,0.60)',
      border: 'rgba(214,168,90,0.25)', text: '#f1e6e6', textSoft: '#b39399',
      accent: '#c25b66', accentSoft: 'rgba(194,91,102,0.16)', highlight: '#d6a85a',
      success: '#8fb88f', warn: '#d6a85a'
    },
    atmosphere: null,
    particles: { preset: 'smokeWisps', overrides: {} },
    pointerFx: { preset: 'emberSpark', overrides: {} }
  }
];
