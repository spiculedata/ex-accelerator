import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

const fetchPosts = vi.hoisted(() => vi.fn());
vi.mock('$lib/services/postsApi', () => ({ fetchPosts }));

import PostDrilldown from './PostDrilldown.svelte';

const post = (id: number, text = `post ${id}`) => ({
  id,
  platform: 'telegram',
  author: 'someone',
  created_at: '2026-11-07T15:50:18.733Z',
  sentiment_category: 'Positive',
  confidence: 0.9,
  text,
  engagement_likes: 1,
  engagement_shares: 2,
  engagement_comments: 3
});
const page = (ids: number[], total = ids.length, nextCursor: string | null = null) => ({ posts: ids.map((id) => post(id)), total, limit: 25, nextCursor });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const props = (over: Record<string, unknown> = {}) => ({ open: true, title: 'Positive posts', filters: { sentiment: 'Positive' }, onclose: vi.fn(), ...over });

beforeEach(() => fetchPosts.mockReset());

describe('PostDrilldown', () => {
  it('loads the posts behind a number and says how many match', async () => {
    fetchPosts.mockResolvedValue(page([1, 2], 2));
    render(PostDrilldown, props());

    expect(await screen.findByText('post 1')).toBeTruthy();
    expect(screen.getByText('post 2')).toBeTruthy();
    expect(screen.getByText(/2 posts match/)).toBeTruthy();
    expect(fetchPosts).toHaveBeenCalledWith({ sentiment: 'Positive' }, { limit: 25 });
  });

  it('does nothing while closed', () => {
    render(PostDrilldown, props({ open: false }));
    expect(fetchPosts).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores a slow answer to an earlier choice when a newer one has been made', async () => {
    const slow = deferred<ReturnType<typeof page>>();
    fetchPosts.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page([9], 1));
    const { rerender } = render(PostDrilldown, props({ filters: { sentiment: 'Positive' } }));
    await rerender(props({ title: 'Negative posts', filters: { sentiment: 'Negative' } }));

    expect(await screen.findByText('post 9')).toBeTruthy();
    expect(fetchPosts).toHaveBeenCalledTimes(2); // the open and the newer choice really were two requests
    slow.resolve(page([1, 2], 2)); // the older request finishes last
    await slow.promise;
    await tick();

    expect(screen.queryByText('post 1')).toBeNull();
    expect(screen.getByText('post 9')).toBeTruthy();
  });

  it('pages: asks for the next 25, appends them and skips any already listed', async () => {
    const first = Array.from({ length: 25 }, (_, i) => i + 1);
    fetchPosts.mockResolvedValueOnce(page(first, 30, 'cursor-after-25')).mockResolvedValueOnce({ ...page([25, 26, 27, 28, 29, 30], 0), total: null });
    render(PostDrilldown, props());

    const more = await screen.findByRole('button', { name: 'Show 5 more' });
    await fireEvent.click(more);

    await waitFor(() => expect(screen.getByText('post 30')).toBeTruthy());
    expect(fetchPosts).toHaveBeenLastCalledWith({ sentiment: 'Positive' }, { limit: 25, cursor: 'cursor-after-25' });
    expect(screen.getByText(/30 posts match/)).toBeTruthy(); // the count from the first page is kept
    expect(screen.getAllByText('post 25')).toHaveLength(1); // the overlap was not listed twice
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull(); // everything is shown
  });

  it('says "Show more" rather than a wrong number when the first count is out of date', async () => {
    const first = Array.from({ length: 25 }, (_, i) => i + 1);
    fetchPosts.mockResolvedValueOnce(page(first, 20, 'c25')); // the count says 20 but there is a next page
    render(PostDrilldown, props());
    expect(await screen.findByRole('button', { name: 'Show more' })).toBeTruthy();
  });

  it('explains a failure and tries again on request', async () => {
    fetchPosts.mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValueOnce(page([4], 1));
    render(PostDrilldown, props());

    expect((await screen.findByRole('alert')).textContent).toContain('We could not load these posts.');
    await fireEvent.click(screen.getByRole('button', { name: /Try again/ }));

    expect(await screen.findByText('post 4')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('closes on Escape pressed on the focused control, before any other handler on the page sees it', async () => {
    fetchPosts.mockResolvedValue(page([1], 1));
    const onclose = vi.fn();
    const pageHandler = vi.fn();
    document.addEventListener('keydown', pageHandler);
    render(PostDrilldown, props({ onclose }));
    await screen.findByText('post 1');
    await tick();

    // A real Escape press is dispatched on the focused element (the close button), not on the window
    await fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });

    expect(onclose).toHaveBeenCalledTimes(1);
    expect(pageHandler).not.toHaveBeenCalled();
    document.removeEventListener('keydown', pageHandler);
  });

  it('closes from the close button', async () => {
    fetchPosts.mockResolvedValue(page([1], 1));
    const onclose = vi.fn();
    render(PostDrilldown, props({ onclose }));
    await screen.findByText('post 1');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('does not leave "Show more" stuck on Loading when the choice changes while a page is loading', async () => {
    const first = Array.from({ length: 25 }, (_, i) => i + 1);
    const slowMore = deferred<ReturnType<typeof page>>();
    fetchPosts.mockResolvedValueOnce(page(first, 40, 'c25')).mockReturnValueOnce(slowMore.promise).mockResolvedValueOnce(page(Array.from({ length: 25 }, (_, i) => i + 101), 40, 'c125'));
    const { rerender } = render(PostDrilldown, props());
    await fireEvent.click(await screen.findByRole('button', { name: 'Show 15 more' }));
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeTruthy();

    await rerender(props({ title: 'Negative posts', filters: { sentiment: 'Negative' } }));
    expect(await screen.findByText('post 101')).toBeTruthy();
    slowMore.resolve(page([26], 40));
    await slowMore.promise;
    await tick();

    expect((await screen.findByRole('button', { name: 'Show 15 more' })).hasAttribute('disabled')).toBe(false);
  });
});

describe('PostDrilldown focus', () => {
  it('moves focus into the panel when it opens and back to what opened it when it closes', async () => {
    fetchPosts.mockResolvedValue(page([1], 1));
    const opener = document.createElement('button');
    opener.textContent = 'open';
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(PostDrilldown, props({ open: false }));
    await rerender(props({ open: true }));
    await screen.findByText('post 1');
    await tick();
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Close');

    await rerender(props({ open: false }));
    await tick();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('keeps Tab inside the open panel', async () => {
    fetchPosts.mockResolvedValue(page(Array.from({ length: 25 }, (_, i) => i + 1), 30, 'c25'));
    render(PostDrilldown, props());
    const more = await screen.findByRole('button', { name: 'Show 5 more' });
    more.focus(); // the last focusable control in the panel

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    more.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true); // Tab from the last control wraps instead of leaving the panel
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Close');
  });
});
