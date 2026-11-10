// Colours for charts, canvas and SVG, where a CSS variable cannot be used. Every value is a brand token resolved to hex
// (docs-site/brand, src/lib/styles/brand-tokens.css), so a chart and a page agree. Take colours from here, not from a
// hex value typed into a page; hardCodedColours.test.ts holds the count of those down. Colours that mean sentiment come
// from getSentimentColor in colorUtils.

export const CHART = {
  white: '#ffffff',

  // Text, axes, grid and neutral marks (ink ramp)
  ink100: '#f1f4f8',
  ink200: '#e3e8ee',
  ink300: '#cfd5de',
  ink400: '#98a2ae',
  ink500: '#667384',
  ink600: '#485567',
  ink700: '#344253',
  ink800: '#1e2938',
  ink900: '#0f1926',

  // Brand accent, and the three status hues
  primary100: '#d6f1f8',
  primary400: '#46b5ce',
  primary500: '#0097b1',
  primary600: '#007b95',
  primary700: '#006278',
  success600: '#247e56',
  danger500: '#e6443d',
  danger600: '#c51e21',
  danger700: '#a20711',

  // Colour-blind-safe categorical series (--se-cat-1 to --se-cat-8), in the order charts take them
  catBlue: '#0072b2',
  catOrange: '#e69f00',
  catGreen: '#009e73',
  catPink: '#cc79a7',
  catSky: '#56b4e9',
  catVermilion: '#d55e00',
  catYellow: '#f0e442'
} as const;

/** Series colours in the order a chart should use them. */
export const CATEGORICAL = [CHART.catBlue, CHART.catOrange, CHART.catGreen, CHART.catPink, CHART.catSky, CHART.catVermilion, CHART.catYellow, CHART.ink900] as const;

/** A diverging scale from low to high (cool to warm), for heat maps and correlation. */
export const DIVERGING = ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] as const;
