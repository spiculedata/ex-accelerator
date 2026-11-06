// ECharts utility — resilient initialization without setTimeout hacks

type EChartsInstance = any;
type EChartsStatic = any;

let loading: Promise<EChartsStatic> | null = null;

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

  return echarts.init(container);
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
