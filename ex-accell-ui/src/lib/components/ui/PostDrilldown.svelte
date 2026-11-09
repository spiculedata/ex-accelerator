<script lang="ts">
  import { tick } from 'svelte';
  import { fetchPosts, type Post, type PostFilters } from '$lib/services/postsApi';
  import { getSentimentColor } from '$lib/utils/colorUtils';
  import { splitHighlight } from '$lib/utils/highlight';

  /**
   * The posts behind a number. Opens beside the page when a topic, hashtag, phrase or sentiment segment
   * is chosen, so a figure can always be followed back to the evidence.
   */
  interface Props {
    open: boolean;
    /** What was chosen, for example "Topic: Public Transit". Shown as the panel title. */
    title: string;
    filters: PostFilters;
    /** An optional line under the count, for example how a phrase is matched */
    note?: string;
    onclose: () => void;
  }
  let { open, title, filters, note = '', onclose }: Props = $props();

  const PAGE_SIZE = 25;

  let posts: Post[] = $state([]);
  let total = $state(0);
  let loading = $state(false);
  let loadingMore = $state(false);
  let errorMessage = $state('');
  let unavailable = $state(false);

  let panel: HTMLElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();
  let returnFocusTo: HTMLElement | null = null;
  // Responses from an older request must not overwrite a newer one
  let requestId = 0;

  const highlightTerms = $derived([filters.q, filters.hashtag ? `#${filters.hashtag.replace(/^#/, '')}` : undefined].filter((t): t is string => !!t));

  async function load() {
    const current = ++requestId;
    loading = true;
    errorMessage = '';
    unavailable = false;
    posts = [];
    total = 0;
    try {
      const page = await fetchPosts(filters, { limit: PAGE_SIZE, offset: 0 });
      if (current !== requestId) return;
      posts = page.posts;
      total = page.total;
      unavailable = !!page.unavailable;
    } catch (error) {
      if (current !== requestId) return;
      errorMessage = error instanceof Error ? error.message : 'Could not load posts.';
    } finally {
      if (current === requestId) loading = false;
    }
  }

  async function loadMore() {
    const current = requestId;
    loadingMore = true;
    try {
      const page = await fetchPosts(filters, { limit: PAGE_SIZE, offset: posts.length });
      if (current !== requestId) return;
      // New posts arriving between pages shift the offsets, so skip any that are already listed
      const listed = new Set(posts.map((p) => p.id));
      posts = [...posts, ...page.posts.filter((p) => !listed.has(p.id))];
      total = page.total;
    } catch (error) {
      if (current !== requestId) return;
      errorMessage = error instanceof Error ? error.message : 'Could not load more posts.';
    } finally {
      if (current === requestId) loadingMore = false;
    }
  }

  // Load when opened or when the chosen filters change while open
  let lastKey = '';
  $effect(() => {
    if (!open) {
      lastKey = '';
      return;
    }
    const key = JSON.stringify(filters);
    if (key === lastKey) return;
    lastKey = key;
    void load();
  });

  // Focus handling: move focus into the panel when it opens and give it back when it closes
  $effect(() => {
    if (open) {
      returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      void tick().then(() => closeButton?.focus());
    } else if (returnFocusTo) {
      returnFocusTo.focus();
      returnFocusTo = null;
    }
  });

  function onKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      onclose();
      return;
    }
    if (event.key !== 'Tab' || !panel) return;
    // Keep Tab inside the panel while it is open
    const focusable = [...panel.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const count = (n: number | null) => (n ?? 0).toLocaleString();
</script>

<!-- Capture phase, so Esc closes this panel before any other handler on the page sees it -->
<svelte:window onkeydowncapture={onKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex justify-end">
    <button type="button" class="absolute inset-0 bg-ink-950/40" aria-label="Close posts panel" tabindex="-1" onclick={onclose}></button>

    <div
      bind:this={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-drilldown-title"
      class="relative flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
    >
      <header class="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-4">
        <div class="min-w-0">
          <h2 id="post-drilldown-title" class="truncate font-display text-xl font-semibold text-ink-900">{title}</h2>
          <p class="mt-0.5 text-sm text-ink-600" aria-live="polite">
            {#if loading}Loading posts…{:else if errorMessage && posts.length === 0}Could not load posts{:else}{total.toLocaleString()} post{total === 1 ? '' : 's'} match{total === 1 ? 'es' : ''}{#if posts.length > 0 && posts.length < total}, showing {posts.length.toLocaleString()}{/if}{/if}
          </p>
          {#if note}<p class="mt-1 text-xs text-ink-500">{note}</p>{/if}
        </div>
        <button bind:this={closeButton} type="button" onclick={onclose} class="rounded-md p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Close">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        {#if loading}
          <div class="space-y-4" aria-hidden="true">
            {#each Array(4) as _}
              <div class="animate-pulse space-y-2 rounded-lg border border-ink-200 p-4">
                <div class="h-3 w-1/3 rounded bg-ink-200"></div>
                <div class="h-3 w-full rounded bg-ink-100"></div>
                <div class="h-3 w-2/3 rounded bg-ink-100"></div>
              </div>
            {/each}
          </div>
        {:else if errorMessage && posts.length === 0}
          <div role="alert" class="rounded-lg border border-danger-200 bg-danger-50 p-4">
            <p class="font-medium text-ink-900">We could not load these posts.</p>
            <p class="mt-1 text-sm text-ink-700">{errorMessage}</p>
            <button type="button" onclick={() => void load()} class="mt-3 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Try again</button>
          </div>
        {:else if posts.length === 0}
          <div role="status" class="rounded-lg border border-ink-200 p-6 text-center">
            {#if unavailable}
              <p class="font-medium text-ink-900">Post data is not available yet.</p>
              <p class="mt-1 text-sm text-ink-600">Posts appear here once data has been loaded into this installation.</p>
            {:else}
              <p class="font-medium text-ink-900">No posts match.</p>
              <p class="mt-1 text-sm text-ink-600">Nothing in this project has this topic, tag or phrase yet.</p>
            {/if}
          </div>
        {:else}
          <ul class="space-y-3">
            {#each posts as post (post.id)}
              <li class="rounded-lg border border-ink-200 p-4">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
                  <span class="rounded bg-ink-100 px-1.5 py-0.5 font-medium text-ink-700">{post.platform}</span>
                  {#if post.author}<span>{post.author}</span>{/if}
                  <time datetime={post.created_at}>{formatDate(post.created_at)}</time>
                  {#if post.sentiment_category}
                    <span class="rounded-full px-2 py-0.5 font-medium {getSentimentColor(post.sentiment_category, 'tailwind')}">
                      {post.sentiment_category}{#if post.confidence !== null}, {Math.round(post.confidence * 100)}%{/if}
                    </span>
                  {/if}
                </div>
                <p class="mt-2 whitespace-pre-wrap break-words text-sm text-ink-900">{#each splitHighlight(post.text, highlightTerms) as segment}{#if segment.match}<mark class="rounded bg-signal-200 px-0.5 text-ink-900">{segment.text}</mark>{:else}{segment.text}{/if}{/each}</p>
                <p class="mt-2 text-xs text-ink-500">{count(post.engagement_likes)} likes · {count(post.engagement_shares)} shares · {count(post.engagement_comments)} comments</p>
              </li>
            {/each}
          </ul>

          {#if errorMessage}
            <p role="alert" class="mt-3 text-sm text-danger-700">{errorMessage}</p>
          {/if}
          {#if posts.length < total}
            <div class="mt-4 text-center">
              <button type="button" onclick={() => void loadMore()} disabled={loadingMore} class="rounded-md border border-ink-300 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60">
                {loadingMore ? 'Loading…' : `Show ${Math.min(PAGE_SIZE, total - posts.length)} more`}
              </button>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
