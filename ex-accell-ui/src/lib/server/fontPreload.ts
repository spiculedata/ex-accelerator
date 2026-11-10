// Which build files SvelteKit may preload in the page head. By default fonts are not preloaded, so the body font is only
// requested once the stylesheet has been parsed. Preloading just the upright Latin face (not every weight, subset and
// style) starts that request early without making the page heavier.

const BODY_FONT = /atkinson-hyperlegible-next-latin-wght-normal\.[\w-]+\.woff2$/;

export function preloadFont({ type, path }: { type: 'font' | 'js' | 'css' | 'asset'; path: string }): boolean {
  if (type === 'font') return BODY_FONT.test(path);
  // The default is to preload scripts and styles, and nothing else
  return type === 'js' || type === 'css';
}
