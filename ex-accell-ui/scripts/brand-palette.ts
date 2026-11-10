// Writes docs-site/.vitepress/theme/palette.json from the OKLCH ramps in src/lib/styles/brand-tokens.css, so the
// swatch labels in the brand guide cannot drift from the tokens. Run with `npm run brand:palette`; the unit test
// src/lib/utils/brandPalette.test.ts fails when the file is stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBrandTokens } from '../src/lib/utils/oklch';

const tokensPath = fileURLToPath(new URL('../src/lib/styles/brand-tokens.css', import.meta.url));
const palettePath = fileURLToPath(new URL('../../docs-site/.vitepress/theme/palette.json', import.meta.url));

const { ramps } = parseBrandTokens(readFileSync(tokensPath, 'utf8'));
// Same shape as the file the docs site already ships (one-space indent, no trailing newline)
writeFileSync(palettePath, JSON.stringify(ramps, null, 1));
console.log(`Wrote ${Object.keys(ramps).length} ramps to ${palettePath}`);
