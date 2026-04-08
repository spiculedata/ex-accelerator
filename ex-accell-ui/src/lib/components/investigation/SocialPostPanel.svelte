<script lang="ts">
  import { investigationSelection, toggleSelectedId, setHoveredId } from '$lib/stores/investigationStore';
  import type { InvestigationSelection } from '$lib/stores/investigationStore';

  export let posts: {
    id: string | number;
    text: string;
    sentiment_category?: string;
    confidence_score?: number;
    platform?: string;
    timestamp?: string;
  }[] = [];

  let selection: InvestigationSelection;
  investigationSelection.subscribe((v) => (selection = v));

  let displayCount = 50;
  const PAGE_SIZE = 50;

  function postId(post: (typeof posts)[0]): string {
    return 'social-' + post.id;
  }

  function isSelected(post: (typeof posts)[0]): boolean {
    return selection.selectedIds.has(postId(post));
  }

  function isHovered(post: (typeof posts)[0]): boolean {
    return selection.hoveredId === postId(post);
  }

  function truncate(text: string, len: number): string {
    if (!text) return '';
    if (text.length <= len) return text;
    return text.slice(0, len) + '...';
  }

  function sentimentBadgeClass(sentiment?: string): string {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'bg-emerald-100 text-emerald-700';
      case 'negative':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  function platformBadgeClass(platform?: string): string {
    switch (platform?.toLowerCase()) {
      case 'twitter':
      case 'x':
        return 'bg-sky-100 text-sky-700';
      case 'facebook':
        return 'bg-blue-100 text-blue-700';
      case 'instagram':
        return 'bg-pink-100 text-pink-700';
      case 'reddit':
        return 'bg-orange-100 text-orange-700';
      case 'telegram':
        return 'bg-cyan-100 text-cyan-700';
      case 'youtube':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  function platformIcon(platform?: string): string {
    switch (platform?.toLowerCase()) {
      case 'twitter':
      case 'x':
        return 'X';
      case 'facebook':
        return 'FB';
      case 'instagram':
        return 'IG';
      case 'reddit':
        return 'R';
      case 'telegram':
        return 'TG';
      case 'youtube':
        return 'YT';
      default:
        return platform?.slice(0, 2).toUpperCase() || '??';
    }
  }

  function formatTimestamp(ts?: string): string {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  }

  function matchesFilters(post: (typeof posts)[0]): boolean {
    if (selection.sentiment && selection.sentiment.length > 0) {
      const label = (post.sentiment_category || 'neutral').toLowerCase();
      if (!selection.sentiment.includes(label)) return false;
    }

    if (selection.timeRange && post.timestamp) {
      if (post.timestamp < selection.timeRange.start || post.timestamp > selection.timeRange.end) return false;
    }

    return true;
  }

  function loadMore() {
    displayCount = Math.min(displayCount + PAGE_SIZE, filteredPosts.length);
  }

  $: filteredPosts = posts.filter(matchesFilters);
  $: visiblePosts = filteredPosts.slice(0, displayCount);
  $: hasMore = displayCount < filteredPosts.length;
  $: postCount = filteredPosts.length;
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
    <div class="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <h3 class="text-sm font-semibold text-gray-800">Social Posts</h3>
    </div>
    <span class="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
      {postCount.toLocaleString()} post{postCount !== 1 ? 's' : ''}
    </span>
  </div>

  {#if posts.length === 0}
    <div class="flex flex-col items-center justify-center flex-1 py-12 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <p class="text-sm">No social posts available</p>
    </div>
  {:else}
    <div class="overflow-auto flex-1 p-3 space-y-2">
      {#each visiblePosts as post (post.id)}
        {@const pid = postId(post)}
        <div
          class="rounded-lg border p-3 transition-all duration-150 cursor-pointer
            {isSelected(post) ? 'border-blue-400 border-2 bg-blue-50/30' : 'border-gray-200'}
            {isHovered(post) ? 'ring-2 ring-blue-200' : ''}
            hover:border-gray-300 hover:shadow-sm"
          on:mouseenter={() => setHoveredId(pid)}
          on:mouseleave={() => setHoveredId(null)}
          on:click={() => toggleSelectedId(pid)}
          role="button"
          tabindex="0"
          on:keydown={(e) => { if (e.key === 'Enter') toggleSelectedId(pid); }}
        >
          <!-- Top row: platform, timestamp, sentiment -->
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              {#if post.platform}
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded {platformBadgeClass(post.platform)}">
                  {platformIcon(post.platform)}
                </span>
              {/if}
              {#if post.timestamp}
                <span class="text-xs text-gray-400">{formatTimestamp(post.timestamp)}</span>
              {/if}
            </div>
            <div class="flex items-center gap-1.5">
              {#if post.sentiment_category}
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded {sentimentBadgeClass(post.sentiment_category)}">
                  {post.sentiment_category}
                </span>
              {/if}
              {#if post.confidence_score != null}
                <span class="text-[10px] text-gray-400">{(post.confidence_score * 100).toFixed(0)}%</span>
              {/if}
            </div>
          </div>

          <!-- Post text -->
          <p class="text-xs text-gray-700 leading-relaxed">{truncate(post.text, 200)}</p>
        </div>
      {/each}

      <!-- Load More -->
      {#if hasMore}
        <div class="flex justify-center pt-2 pb-1">
          <button
            class="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
            on:click|stopPropagation={loadMore}
          >
            Load more ({filteredPosts.length - displayCount} remaining)
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
