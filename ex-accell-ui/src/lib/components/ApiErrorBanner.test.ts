import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ApiErrorBanner from './ApiErrorBanner.svelte';
import { dismissApiErrors, reportApiError } from '$lib/stores/apiErrors';

beforeEach(() => dismissApiErrors());

describe('ApiErrorBanner', () => {
  it('renders nothing when there are no errors', () => {
    render(ApiErrorBanner);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lists each failed request', async () => {
    reportApiError('Sentiment: sentiment-trends', 'HTTP 500');
    reportApiError('Topics: topics-overview', 'The request timed out');

    render(ApiErrorBanner);

    expect(screen.getByRole('alert').textContent).toContain('Some data could not be loaded');
    expect(screen.getByText(/Sentiment: sentiment-trends: HTTP 500/)).toBeTruthy();
    expect(screen.getByText(/Topics: topics-overview: The request timed out/)).toBeTruthy();
  });

  it('goes away when dismissed', async () => {
    reportApiError('A: x', 'boom');
    render(ApiErrorBanner);

    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows plain text, never markup, from an error message', () => {
    reportApiError('A: x', '<img src=x onerror=alert(1)>');

    render(ApiErrorBanner);

    expect(document.querySelector('img')).toBeNull();
  });
});
