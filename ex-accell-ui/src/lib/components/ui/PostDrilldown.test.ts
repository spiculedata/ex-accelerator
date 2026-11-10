import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';

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
const page = (ids: number[], total = ids.length) => ({ posts: ids.map((id) => post(id)), total, limit: 25, offset: 0 });
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
    expect(fetchPosts).toHaveBeenCalledWith({ sentiment: 'Positive' }, { limit: 25, offset: 0 });
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
    slow.resolve(page([1, 2], 2)); // the older request finishes last
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.queryByText('post 1')).toBeNull();
    expect(screen.getByText('post 9')).toBeTruthy();
  });

  it('pages: asks for the next 25, appends them and skips any already listed', async () => {
    const first = Array.from({ length: 25 }, (_, i) => i + 1);
    fetchPosts.mockResolvedValueOnce(page(first, 30)).mockResolvedValueOnce(page([25, 26, 27, 28, 29, 30], 30));
    render(PostDrilldown, props());

    const more = await screen.findByRole('button', { name: 'Show 5 more' });
    await fireEvent.click(more);

    await waitFor(() => expect(screen.getByText('post 30')).toBeTruthy());
    expect(fetchPosts).toHaveBeenLastCalledWith({ sentiment: 'Positive' }, { limit: 25, offset: 25 });
    expect(screen.getAllByText('post 25')).toHaveLength(1); // the overlap was not listed twice
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull(); // everything is shown
  });

  it('explains a failure and tries again on request', async () => {
    fetchPosts.mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValueOnce(page([4], 1));
    render(PostDrilldown, props());

    expect((await screen.findByRole('alert')).textContent).toContain('We could not load these posts.');
    await fireEvent.click(screen.getByRole('button', { name: /Try again/ }));

    expect(await screen.findByText('post 4')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('closes on Escape and from the close button', async () => {
    fetchPosts.mockResolvedValue(page([1], 1));
    const onclose = vi.fn();
    render(PostDrilldown, props({ onclose }));
    await screen.findByText('post 1');

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onclose).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onclose).toHaveBeenCalledTimes(2);
  });
});
