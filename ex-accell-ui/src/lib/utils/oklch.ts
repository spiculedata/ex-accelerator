// OKLCH to sRGB hex, and a reader for the brand tokens. The ramps in src/lib/styles/brand-tokens.css are written in
// OKLCH so they step evenly; charts, canvas, the docs palette and chartColors.ts need the same colours as hex. One
// conversion here, used by the generator (scripts/brand-palette.ts) and the tests that stop the copies drifting.

const DEG = Math.PI / 180;

function gamma(channel: number): number {
  const v = Math.min(1, Math.max(0, channel));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function toHexByte(channel: number): string {
  return Math.round(gamma(channel) * 255)
    .toString(16)
    .padStart(2, '0');
}

/** CSS Color 4 OKLCH (lightness 0..1, chroma, hue in degrees) to a lower-case #rrggbb, clamped to the sRGB gamut. */
export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const a = chroma * Math.cos(hue * DEG);
  const b = chroma * Math.sin(hue * DEG);

  // OKLab to LMS (cube roots), then LMS to linear sRGB
  const l = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
}

export interface BrandPalette {
  /** Each OKLCH ramp (ink, primary, signal, success, danger) as step -> hex */
  ramps: Record<string, Record<string, string>>;
  /** Tokens already written as hex (sentiment and categorical), by name without the --se- prefix */
  named: Record<string, string>;
}

const OKLCH_TOKEN = /--se-([a-z]+)-(\d+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;
// Only the data-visualisation tokens are written as hex; a role such as --se-surface (white) is an alias, not palette
const HEX_TOKEN = /--se-((?:sentiment|cat)-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g;

/** The first `:root {` block: the light theme, which is the palette. The dark block re-declares the ink steps. */
function lightBlock(css: string): string {
  const start = css.indexOf(':root {');
  if (start < 0) return css;
  const end = css.indexOf('}', start);
  return end < 0 ? css.slice(start) : css.slice(start, end);
}

/** Reads the colour tokens out of brand-tokens.css. Role aliases (surfaces, var(--se-...)) are not palette colours. */
export function parseBrandTokens(fullCss: string): BrandPalette {
  const css = lightBlock(fullCss);
  const ramps: Record<string, Record<string, string>> = {};
  for (const [, ramp, step, l, c, h] of css.matchAll(OKLCH_TOKEN)) {
    ramps[ramp] = { ...(ramps[ramp] ?? {}), [step]: oklchToHex(Number(l), Number(c), Number(h)) };
  }
  const named: Record<string, string> = {};
  for (const [, name, hex] of css.matchAll(HEX_TOKEN)) {
    named[name] = hex.toLowerCase();
  }
  return { ramps, named };
}
