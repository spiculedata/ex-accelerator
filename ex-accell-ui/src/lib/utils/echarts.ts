// ECharts utilities: lazy loading of the bundled package plus safe init, dispose and resize helpers

type EChartsInstance = any;
type EChartsStatic = any;

let loading: Promise<EChartsStatic> | null = null;

const BRAND_THEME = 'social-explorer';
const SANS = "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif";

/**
 * Brand chart theme (docs-site/brand/data-visualisation): the brand sans for all chart text, ink for
 * labels and grid, and the colour-blind-safe categorical series order. Per-chart options still win, so
 * sentiment charts set their own colours from getSentimentColor.
 */
export const brandChartTheme = {
  color: ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#0f1926'],
  backgroundColor: 'transparent',
  // ECharts writes a generated text description (title, series, values) onto the chart for screen readers
  aria: { enabled: true },
  textStyle: { fontFamily: SANS, color: '#344253' },
  title: { textStyle: { fontFamily: SANS, color: '#0f1926', fontWeight: 600 }, subtextStyle: { fontFamily: SANS, color: '#667384' } },
  legend: { textStyle: { fontFamily: SANS, color: '#344253' } },
  tooltip: { textStyle: { fontFamily: SANS } },
  categoryAxis: { axisLine: { lineStyle: { color: '#cfd5de' } }, axisTick: { lineStyle: { color: '#cfd5de' } }, axisLabel: { color: '#485567' }, splitLine: { lineStyle: { color: '#e3e8ee' } } },
  valueAxis: { axisLine: { lineStyle: { color: '#cfd5de' } }, axisLabel: { color: '#485567' }, splitLine: { lineStyle: { color: '#e3e8ee' } } }
};

/**
 * Load ECharts (bundled from npm, code-split) and expose it on `window.echarts` for the helpers
 * below. Safe to call repeatedly; browser only.
 */
export async function waitForEcharts(): Promise<EChartsStatic> {
  if (typeof window === 'undefined') throw new Error('Not in browser environment');

  loading ??= import('echarts').catch((error: unknown) => {
    loading = null; // allow a retry after a failed (for example offline) load
    throw error;
  });
  const echarts = await loading;
  // Registered here so charts created directly with echarts.init(el, 'social-explorer') get the theme too
  echarts.registerTheme?.(BRAND_THEME, brandChartTheme);
  (window as any).echarts ??= echarts;
  return echarts;
}

/**
 * Safely initialize an ECharts instance on a container element.
 * Returns null if the container is not visible or echarts unavailable.
 */
export function initChart(container: HTMLElement | null): EChartsInstance | null {
  if (!container) return null;

  const echarts = (window as any).echarts;
  if (!echarts) return null;

  // Don't init on hidden containers
  if (container.offsetWidth === 0 && container.offsetHeight === 0) return null;

  // Dispose existing instance if any
  const existing = echarts.getInstanceByDom(container);
  if (existing) {
    existing.dispose();
  }

  // Registering is a cheap overwrite, so do it on every init instead of tracking state
  echarts.registerTheme(BRAND_THEME, brandChartTheme);
  return echarts.init(container, BRAND_THEME);
}

/**
 * Safely dispose an ECharts instance.
 */
export function disposeChart(chart: EChartsInstance | null): void {
  if (chart && !chart.isDisposed?.()) {
    try {
      chart.dispose();
    } catch {
      // Already disposed or invalid
    }
  }
}

/**
 * Set up a ResizeObserver to auto-resize charts when their container changes.
 * Returns a cleanup function.
 */
export function autoResize(chart: EChartsInstance | null, container: HTMLElement | null): () => void {
  if (!chart || !container || typeof ResizeObserver === 'undefined') {
    return () => {};
  }

  const observer = new ResizeObserver(() => {
    if (chart && !chart.isDisposed?.()) {
      chart.resize();
    }
  });

  observer.observe(container);

  return () => observer.disconnect();
}
