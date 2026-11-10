import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';

const service = vi.hoisted(() => ({
  getAttentionSpans: vi.fn(),
  getContentEngagement: vi.fn(),
  getCognitiveLoadData: vi.fn(),
  getDigitalPhenotype: vi.fn(),
  getResearchFindings: vi.fn(),
  getTransitionFlow: vi.fn()
}));
const setOption = vi.hoisted(() => vi.fn());
const echartsInit = vi.hoisted(() => vi.fn(() => ({ setOption, resize: vi.fn(), dispose: vi.fn() })));
vi.mock('$lib/services/androidResearchDb', () => ({ androidResearchDb: service }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('echarts', () => ({ init: echartsInit }));

import Page from './+page.svelte';

const empty = <T,>(data: T) => ({ data, hasData: false });
const loaded = <T,>(data: T) => ({ data, hasData: true });

function nothingLoaded() {
  service.getAttentionSpans.mockResolvedValue(empty([]));
  service.getContentEngagement.mockResolvedValue(empty([]));
  service.getCognitiveLoadData.mockResolvedValue(empty([]));
  service.getDigitalPhenotype.mockResolvedValue(empty(null));
  service.getResearchFindings.mockResolvedValue(empty([]));
  service.getTransitionFlow.mockResolvedValue(empty([]));
}

const spans = [
  { app: 'YouTube', meanDuration: 150, sessions: [{ duration: 120, timestamp: Date.UTC(2026, 3, 14, 21), taskSwitches: 0, interruptions: 0 }, { duration: 180, timestamp: Date.UTC(2026, 3, 14, 9), taskSwitches: 1, interruptions: 0 }] }
];
const transitions = [
  { source: 'YouTube', target: 'Chrome', value: 5 },
  { source: 'Chrome', target: 'YouTube', value: 2 }
];

const chartOptions = () => setOption.mock.calls.map((call) => call[0] as { series: Array<Record<string, unknown>> });
const seriesOfType = (type: string) => chartOptions().flatMap((option) => option.series).filter((series) => series.type === type);

// jsdom lays nothing out, so every element is 0px wide and the page would (rightly) skip every chart.
// Give elements a width so the tests prove when charts are and are not drawn.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 800 });
});
afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
});

beforeEach(() => {
  for (const fn of Object.values(service)) fn.mockReset();
  echartsInit.mockClear();
  setOption.mockClear();
});

describe('/android-research', () => {
  it('says there is no Android data yet, and that loading it is not available, with no example figures and no charts', async () => {
    nothingLoaded();
    render(Page);

    expect(await screen.findByText('No Android data yet')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/not available in this release/i);
    expect(screen.queryByRole('link', { name: /Data Capture/ })).toBeNull();
    expect(screen.queryByText(/Example data/)).toBeNull();
    expect(screen.queryByText(/Demo Mode/)).toBeNull();
    expect(screen.queryByText(/Moderate User/)).toBeNull();
    expect(screen.queryByText(/Daily Usage/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Report' })).toBeDisabled();

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(echartsInit).not.toHaveBeenCalled();
  });

  it('shows an error with a Retry button when the load fails, then loads again', async () => {
    nothingLoaded();
    service.getAttentionSpans.mockRejectedValueOnce(new Error('HTTP 500: Internal Server Error'));
    render(Page);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByText('No Android data yet')).toBeNull();
    expect(screen.queryByText(/Daily Usage/)).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No Android data yet')).toBeInTheDocument();
    expect(service.getAttentionSpans).toHaveBeenCalledTimes(2);
  });

  it('recovers from a failed load to the dashboard when Retry succeeds with data', async () => {
    nothingLoaded();
    service.getAttentionSpans.mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValue(loaded(spans));
    render(Page);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('5m')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(echartsInit).toHaveBeenCalled());
  });

  it('shows the dashboard, built from the loaded sessions, and draws the charts from them', async () => {
    nothingLoaded();
    service.getAttentionSpans.mockResolvedValue(loaded(spans));
    service.getTransitionFlow.mockResolvedValue(loaded(transitions));
    service.getResearchFindings.mockResolvedValue(loaded([{ title: 'Evening peak', finding: 'Most use at 21:00', significance: 'n=1', implication: 'None yet' }]));
    render(Page);

    expect(await screen.findByText('Usage per day')).toBeInTheDocument();
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('150s')).toBeInTheDocument();
    expect(screen.getByText('Transitions per hour')).toBeInTheDocument();
    expect(screen.getByText('0.3')).toBeInTheDocument();
    expect(screen.queryByText('No Android data yet')).toBeNull();
    expect(screen.queryByText(/Example data/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Report' })).toBeEnabled();

    // The temporal tab draws its line chart and heatmap from the sessions' apps
    await waitFor(() => expect(echartsInit).toHaveBeenCalledTimes(2));
    expect(seriesOfType('line').map((series) => series.name)).toEqual(['YouTube']);
    expect(seriesOfType('heatmap')).toHaveLength(1);

    // The network tab draws the Sankey from the transitions with the cycle broken
    await fireEvent.click(screen.getByRole('button', { name: 'Network Analysis' }));
    await waitFor(() => expect(seriesOfType('sankey')).toHaveLength(1));
    expect(seriesOfType('sankey')[0].links).toEqual([{ source: 'YouTube', target: 'Chrome', value: 5 }]);
    expect(seriesOfType('graph')[0].links).toHaveLength(2);

    await fireEvent.click(screen.getByRole('button', { name: 'Research Findings' }));
    expect(await screen.findByText('Evening peak')).toBeInTheDocument();
  });

  it('says when a section has nothing recorded instead of drawing an empty chart', async () => {
    nothingLoaded();
    service.getResearchFindings.mockResolvedValue(loaded([{ title: 'Only finding', finding: 'f', significance: 's', implication: 'i' }]));
    render(Page);

    expect(await screen.findByText(/Nothing recorded for this section yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Usage per day/)).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Engagement Analysis' }));
    expect(await screen.findByText(/Nothing recorded for this section yet/)).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(echartsInit).not.toHaveBeenCalled();
  });
});
