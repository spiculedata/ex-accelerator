import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';

const service = vi.hoisted(() => ({
  getAttentionSpans: vi.fn(),
  getContentEngagement: vi.fn(),
  getCognitiveLoadData: vi.fn(),
  getDigitalPhenotype: vi.fn(),
  getResearchFindings: vi.fn(),
  getTransitionFlow: vi.fn()
}));
const echartsInit = vi.hoisted(() => vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })));
vi.mock('$lib/services/androidResearchDb', () => ({ androidResearchDb: service }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('echarts', () => ({ init: echartsInit }));

import Page from './+page.svelte';

const empty = <T,>(data: T) => ({ data, hasData: false });

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

beforeEach(() => {
  for (const fn of Object.values(service)) fn.mockReset();
  echartsInit.mockClear();
});

describe('/android-research', () => {
  it('says there is no Android data yet, with no example figures and no charts', async () => {
    nothingLoaded();
    render(Page);

    expect(await screen.findByText('No Android data yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Data Capture/ })).toHaveAttribute('href', '/data-capture');
    expect(screen.queryByText(/Example data/)).toBeNull();
    expect(screen.queryByText(/Demo Mode/)).toBeNull();
    expect(screen.queryByText(/Moderate User/)).toBeNull();
    expect(screen.queryByText('Daily Usage')).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Report' })).toBeDisabled();

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(echartsInit).not.toHaveBeenCalled();
  });

  it('shows an error with a Retry button when the load fails, then loads again', async () => {
    nothingLoaded();
    service.getAttentionSpans.mockRejectedValueOnce(new Error('HTTP 500: Internal Server Error'));
    render(Page);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByText('No Android data yet')).toBeNull();
    expect(screen.queryByText('Daily Usage')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No Android data yet')).toBeInTheDocument();
    expect(service.getAttentionSpans).toHaveBeenCalledTimes(2);
  });

  it('shows the dashboard, built from the loaded sessions, when real rows exist', async () => {
    nothingLoaded();
    service.getAttentionSpans.mockResolvedValue({ data: spans, hasData: true });
    service.getResearchFindings.mockResolvedValue({ data: [{ title: 'Evening peak', finding: 'Most use at 21:00', significance: 'n=1', implication: 'None yet' }], hasData: true });
    render(Page);

    expect(await screen.findByText('Daily Usage')).toBeInTheDocument();
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('150s')).toBeInTheDocument();
    expect(screen.queryByText('No Android data yet')).toBeNull();
    expect(screen.queryByText(/Example data/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Report' })).toBeEnabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Research Findings' }));
    expect(await screen.findByText('Evening peak')).toBeInTheDocument();
  });
});
