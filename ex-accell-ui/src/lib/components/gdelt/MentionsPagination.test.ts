import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import MentionsPagination from './MentionsPagination.svelte';

const props = (over: Record<string, unknown> = {}) => ({
  position: 'top' as const,
  total: 1000,
  currentPage: 5,
  itemsPerPage: 25,
  itemsPerPageOptions: [25, 50, 100],
  onGoToPage: vi.fn(),
  onChangeItemsPerPage: vi.fn(),
  ...over
});

describe('MentionsPagination', () => {
  it('shows nothing for a list that fits the smallest page size', () => {
    const { container } = render(MentionsPagination, props({ total: 25 }));
    expect(container.querySelector('select')).toBeNull();
  });

  it('shows a window of pages around the current one with the first and last', () => {
    render(MentionsPagination, props());
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Previous', '1', '3', '4', '5', '6', '7', '40', 'Next']);
    expect(screen.getAllByText('...')).toHaveLength(2);
  });

  it('goes to a page and to the neighbours', async () => {
    const p = props();
    render(MentionsPagination, p);
    await fireEvent.click(screen.getByText('Next'));
    await fireEvent.click(screen.getByText('Previous'));
    await fireEvent.click(screen.getByText('40'));
    expect(p.onGoToPage.mock.calls.map(([page]) => page)).toEqual([6, 4, 40]);
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { unmount } = render(MentionsPagination, props({ currentPage: 1 }));
    expect((screen.getByText('Previous') as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(MentionsPagination, props({ currentPage: 40 }));
    expect((screen.getByText('Next') as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports a new page size', async () => {
    const p = props();
    render(MentionsPagination, p);
    await fireEvent.change(screen.getByDisplayValue('25 per page'), { target: { value: '50' } });
    expect(p.onChangeItemsPerPage).toHaveBeenCalledWith(50);
  });

  it('hides the page buttons when everything fits on one page', () => {
    render(MentionsPagination, props({ total: 60, itemsPerPage: 100, currentPage: 1 }));
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.getByText('Show:')).toBeTruthy();
  });
});
