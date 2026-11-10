import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import Page from './+page.svelte';

const project = {
  id: 1,
  name: 'Harbour works',
  description: '',
  keywords: ['harbour'],
  date_start: '2026-01-01',
  date_end: '2026-03-01',
  sources: { gdelt: false, radio: false, social: true },
  event_count: 12,
  workspace_count: 1,
  investigation_count: 0,
  project_type: 'social',
  last_activity: '2026-02-01T00:00:00Z',
  sparkline: [1, 2, 3],
  avg_sentiment: 0.1,
  sentiment_trend: 'neutral',
  anomaly: null
};

/** Answers /api/home-overview the way the API does. */
function serve(projects: unknown[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true, projects, activity: [], summary: { total_projects: projects.length, total_events: 0, alerts: 0 } }), {
      headers: { 'content-type': 'application/json' }
    })
  );
}

describe('/ first run', () => {
  it('points researchers at data sharing as optional, without saying it is on', async () => {
    serve([]);
    render(Page);

    expect(await screen.findByText('Start here')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Share a dataset with collaborators' });
    expect(link).toHaveAttribute('href', '/data-sharing');
    const mention = link.closest('p');
    expect(mention).toHaveTextContent(/optional/i);
    expect(mention).toHaveTextContent(/off until an administrator turns it on/i);
  });

  it('keeps the mention out of the dashboard once a project has a workspace', async () => {
    serve([project]);
    render(Page);

    expect(await screen.findByText('Harbour works')).toBeInTheDocument();
    expect(screen.queryByText('Start here')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Share a dataset with collaborators' })).toBeNull();
  });
});
