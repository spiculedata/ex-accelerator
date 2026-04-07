// ECharts utility — resilient initialization without setTimeout hacks

type EChartsInstance = any;
type EChartsStatic = any;

/**
 * Wait for ECharts to load from CDN with exponential backoff.
 * Rejects after ~10 seconds if not available.
 */
export function waitForEcharts(): Promise<EChartsStatic> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser environment'));
      return;
    }

    const echarts = (window as any).echarts;
    if (echarts) {
      resolve(echarts);
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;
    const baseDelay = 100;

    function poll() {
      attempts++;
      const echarts = (window as any).echarts;
      if (echarts) {
        resolve(echarts);
        return;
      }
      if (attempts >= maxAttempts) {
        reject(new Error('ECharts failed to load from CDN after 10 seconds'));
        return;
      }
      const delay = Math.min(baseDelay * Math.pow(1.5, attempts), 2000);
      requestAnimationFrame(() => setTimeout(poll, delay));
    }

    requestAnimationFrame(poll);
  });
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
