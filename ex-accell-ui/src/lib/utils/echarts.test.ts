import { describe, it, expect, vi, beforeEach } from 'vitest';

const fakeEcharts = vi.hoisted(() => ({
  init: vi.fn(() => ({ dispose: vi.fn() })),
  getInstanceByDom: vi.fn(() => null)
}));

vi.mock('echarts', () => fakeEcharts);

import { initChart, waitForEcharts } from './echarts';

beforeEach(() => {
  delete (window as any).echarts;
  fakeEcharts.init.mockClear();
  fakeEcharts.getInstanceByDom.mockReset();
  fakeEcharts.getInstanceByDom.mockReturnValue(null);
});

const visibleContainer = () => {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: 400 });
  Object.defineProperty(el, 'offsetHeight', { value: 300 });
  return el;
};

describe('waitForEcharts', () => {
  it('loads the bundled ECharts package instead of a CDN script', async () => {
    const echarts = await waitForEcharts();

    expect(echarts.init).toBe(fakeEcharts.init);
    expect(document.querySelector('script[src*="cdn"]')).toBeNull();
  });

  it('makes ECharts available to initChart through window', async () => {
    await waitForEcharts();

    const chart = initChart(visibleContainer());

    expect(chart).not.toBeNull();
    expect(fakeEcharts.init).toHaveBeenCalledTimes(1);
  });

  it('returns the same module on repeated calls', async () => {
    const first = await waitForEcharts();
    const second = await waitForEcharts();

    expect(second).toBe(first);
  });
});

describe('initChart', () => {
  it('returns null before ECharts has loaded', () => {
    expect(initChart(visibleContainer())).toBeNull();
  });

  it('returns null for a missing or hidden container', async () => {
    await waitForEcharts();

    expect(initChart(null)).toBeNull();
    expect(initChart(document.createElement('div'))).toBeNull();
  });

  it('disposes an existing instance on the same container first', async () => {
    await waitForEcharts();
    const existing = { dispose: vi.fn() };
    fakeEcharts.getInstanceByDom.mockReturnValue(existing as any);

    initChart(visibleContainer());

    expect(existing.dispose).toHaveBeenCalled();
  });
});

describe('waitForEcharts after a failed load', () => {
  it('retries the import on the next call instead of caching the failure', async () => {
    vi.resetModules();
    let attempts = 0;
    vi.doMock('echarts', () => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return fakeEcharts;
    });
    delete (window as any).echarts;
    const fresh = await import('./echarts');

    await expect(fresh.waitForEcharts()).rejects.toThrow(); // Vitest wraps the factory error
    const echarts = await fresh.waitForEcharts();

    expect(echarts.init).toBe(fakeEcharts.init);
    expect(attempts).toBe(2);
    vi.doUnmock('echarts');
  });
});
