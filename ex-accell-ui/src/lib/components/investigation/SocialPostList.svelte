<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { setCrossFilter } from '$lib/stores/investigationStore';
  import { isPostNoted, type Annotation } from '$lib/utils/annotations';
  import { formatPostDate, sentimentDotColor } from '$lib/utils/investigationFormat';
  import type { WorkbenchPost } from '$lib/utils/investigationTypes';

  export let loading: boolean;
  /** Posts after the cross-filter */
  export let posts: WorkbenchPost[];
  export let annotations: Annotation[];
  /** How many posts match; 200 means the load limit was reached */
  export let tabCount: number;
  export let expandedId: string | number | null;

  const dispatch = createEventDispatcher<{ addToNotes: WorkbenchPost }>();
</script>

<div role="tabpanel" id="panel-social" aria-labelledby="tab-social" class="h-full">
{#if loading}
  <div class="flex items-center justify-center h-full"><svg class="animate-spin h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>
{:else if posts.length === 0}
  <div class="flex items-center justify-center h-full text-slate-500 text-sm">No social posts found</div>
{:else}
  <div class="h-full overflow-y-auto">
    <p class="px-3 py-1.5 text-xs text-slate-400 bg-slate-900/60 border-b border-slate-800">
      Keywords match anywhere in a word, so “bus” also finds “business”.
      {#if tabCount >= 200}<span class="text-amber-300">Showing the first 200 matches; narrow the keywords or dates to see others.</span>{/if}
    </p>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-slate-800/30 p-1">
      {#each posts as post}
        {@const isExpanded = expandedId === post.id}
        {@const likes = Number(post.engagement_likes || 0)}
        {@const shares = Number(post.engagement_shares || 0)}
        {@const comments = Number(post.engagement_comments || 0)}
        {@const totalEng = likes + shares + comments}
        <div
          class="bg-slate-900 p-3 hover:bg-slate-800/50 transition-colors cursor-pointer {isExpanded ? 'col-span-1 md:col-span-2 xl:col-span-3 bg-slate-800/50' : ''}"
          on:click={() => expandedId = isExpanded ? null : post.id}
          on:keydown={(e) => { if (e.target === e.currentTarget && e.key === 'Enter') expandedId = isExpanded ? null : post.id; }}
          role="button"
          tabindex="0"
        >
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full {sentimentDotColor(post.sentiment_category)}"></span>
              {#if post.platform}
                <span class="text-[10px] font-medium text-sky-400">{post.platform}</span>
              {/if}
              {#if post.sentiment_category}
                {@const sentNorm = (post.sentiment_category || '').toLowerCase().includes('positive') ? 'positive' : (post.sentiment_category || '').toLowerCase().includes('negative') ? 'negative' : 'neutral'}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <span
                  class="text-[9px] px-1 py-0 rounded cursor-pointer transition-all hover:ring-1 hover:ring-indigo-400/40 {sentNorm === 'positive' ? 'bg-sentiment-positive/20 text-sentiment-positive' : sentNorm === 'negative' ? 'bg-sentiment-negative/20 text-sentiment-negative' : 'bg-sentiment-neutral/20 text-slate-400'}"
                  on:click|stopPropagation={() => setCrossFilter({ dimension: 'sentiment', value: sentNorm, label: post.sentiment_category || sentNorm })}
                  role="button"
                  tabindex="0"
                >{post.sentiment_category}</span>
              {/if}
            </div>
            <div class="flex items-center gap-2">
              <!-- Inline engagement -->
              {#if totalEng > 0}
                <div class="flex items-center gap-1.5 text-[9px] text-slate-600">
                  {#if likes > 0}<span title="Likes">❤ {likes.toLocaleString()}</span>{/if}
                  {#if shares > 0}<span title="Shares">↗ {shares.toLocaleString()}</span>{/if}
                  {#if comments > 0}<span title="Comments">💬 {comments.toLocaleString()}</span>{/if}
                </div>
              {/if}
              {#if post.confidence_score}
                <span class="text-[11px] font-mono text-slate-600">{(post.confidence_score * 100).toFixed(0)}%</span>
              {/if}
              {#if post.timestamp}
                <span class="text-[11px] font-mono text-slate-600">{formatPostDate(post.timestamp)}</span>
              {/if}
            </div>
          </div>

          {#if isExpanded}
            <!-- Expanded view -->
            <p class="text-sm text-slate-200 leading-relaxed mb-3 whitespace-pre-wrap">{post.text}</p>
            <button
              type="button"
              on:click|stopPropagation={() => dispatch('addToNotes', post)}
              disabled={isPostNoted(annotations, post)}
              class="mb-3 px-2 py-1 text-[11px] font-medium rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white"
            >{isPostNoted(annotations, post) ? 'In your notes' : 'Add to notes'}</button>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-700/30">
              <div>
                <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Engagement</span>
                <div class="flex items-center gap-3 text-xs">
                  <span class="text-rose-400">❤ {likes.toLocaleString()}</span>
                  <span class="text-sky-400">↗ {shares.toLocaleString()}</span>
                  <span class="text-amber-400">💬 {comments.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Sentiment</span>
                <span class="text-xs text-slate-300">{post.sentiment_category || 'Unknown'}</span>
                {#if post.confidence_score}
                  <span class="text-[9px] text-slate-500 ml-1">({(post.confidence_score * 100).toFixed(0)}% confidence)</span>
                {/if}
              </div>
              {#if post.emotions}
                <div>
                  <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Emotions</span>
                  <span class="text-xs text-slate-300">{post.emotions}</span>
                </div>
              {/if}
              <div>
                <span class="text-[9px] uppercase tracking-wider text-slate-600 block mb-0.5">Platform</span>
                <span class="text-xs text-sky-400">{post.platform || 'Unknown'}</span>
                {#if post.timestamp}
                  <span class="text-[9px] text-slate-500 ml-1">{formatPostDate(post.timestamp)}</span>
                {/if}
              </div>
            </div>
          {:else}
            <p class="text-xs text-slate-300 leading-snug line-clamp-3">{post.text}</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
</div>
