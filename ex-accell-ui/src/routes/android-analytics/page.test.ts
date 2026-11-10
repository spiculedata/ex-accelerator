import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';

const service = vi.hoisted(() => ({
  getAnalyticsSummary: vi.fn(),
  getAccessibilityEvents: vi.fn(),
  getAppSegments: vi.fn(),
  getScreenshots: vi.fn()
}));
vi.mock('$lib/services/androidAnalyticsDb', () => ({ androidAnalyticsDb: service }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import Page from './+page.svelte';

const zeroSummary = { totalSessions: 0, totalScreenshots: 0, uniqueApps: 0, sessionDuration: 0, totalEvents: 0, activeUsers: 0 };
const segment = { apk: 'com.android.chrome', t_unix_ts_segment_start: 1744765042854, duration_segment_ms: 245000, id_session: 's1', id_user: 'u1' };

function rowsReturn(segments: unknown[] = [], screenshots: unknown[] = []) {
  service.getAccessibilityEvents.mockResolvedValue([]);
  service.getAppSegments.mockResolvedValue(segments);
  service.getScreenshots.mockResolvedValue(screenshots);
}

beforeEach(() => {
  for (const fn of Object.values(service)) fn.mockReset();
});

describe('/android-analytics', () => {
  it('says there is no Android data yet, and that loading it is not available, instead of showing sample rows', async () => {
    service.getAnalyticsSummary.mockResolvedValue({ data: zeroSummary, hasData: false });
    rowsReturn();
    render(Page);

    expect(await screen.findByText('No Android data yet')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/not available in this release/i);
    expect(screen.queryByRole('link', { name: /Data Capture/ })).toBeNull();
    expect(screen.queryByText(/YouTube/)).toBeNull();
    expect(screen.queryByText(/sample data/i)).toBeNull();
    expect(screen.queryByText('Active Sessions')).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Analysis' })).toBeDisabled();
  });

  it('shows an error with a Retry button when the load fails, then loads again', async () => {
    service.getAnalyticsSummary.mockRejectedValueOnce(new Error('HTTP 500: Internal Server Error'));
    rowsReturn();
    render(Page);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByText(/YouTube/)).toBeNull();
    expect(screen.queryByText('No Android data yet')).toBeNull();

    service.getAnalyticsSummary.mockResolvedValue({ data: zeroSummary, hasData: false });
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('No Android data yet')).toBeInTheDocument();
    expect(service.getAnalyticsSummary).toHaveBeenCalledTimes(2);
  });

  it('shows the dashboard when real rows exist', async () => {
    service.getAnalyticsSummary.mockResolvedValue({ data: { ...zeroSummary, totalSessions: 1 }, hasData: true });
    rowsReturn([segment]);
    render(Page);

    expect((await screen.findAllByText('Chrome Browser')).length).toBeGreaterThan(0);
    expect(screen.queryByText('No Android data yet')).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Analysis' })).toBeEnabled();
  });

  it('reads BIGINT columns that arrive as strings without producing NaN or Invalid Date', async () => {
    service.getAnalyticsSummary.mockResolvedValue({ data: zeroSummary, hasData: false });
    rowsReturn([{ ...segment, t_unix_ts_segment_start: '1744765042854', duration_segment_ms: '245000' }]);
    render(Page);

    expect(await screen.findByText('4 min')).toBeInTheDocument();
    expect(screen.getByText('4 minutes')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Invalid Date/);
  });

  it('shows the measured screenshot interval rather than a stock "3-5 seconds"', async () => {
    service.getAnalyticsSummary.mockResolvedValue({ data: zeroSummary, hasData: false });
    const shot = (t_epoch_ts_ms: number) => ({ id_user: 'u1', file: `shot-${t_epoch_ts_ms}.jpg`, apk: 'com.android.chrome', app: 'Chrome', text: '', t_epoch_ts_ms, t_natural_day_ts: '04/14/2025' });
    rowsReturn([segment], [shot(1744765040000), shot(1744765046000)]);
    render(Page);

    expect(await screen.findByText('Every ~6s on average')).toBeInTheDocument();
    expect(screen.queryByText('Every ~3-5 seconds')).toBeNull();
  });
});
