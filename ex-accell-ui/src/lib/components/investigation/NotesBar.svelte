<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Annotation } from '$lib/utils/annotations';

  export let annotations: Annotation[];
  export let newAnnotation: string;
  export let saveStatus: '' | 'saving' | 'saved' | 'error';
  export let saveErrorMessage: string;
  export let unsaved: boolean;

  const dispatch = createEventDispatcher<{ add: void; remove: string; exportNotes: void }>();
</script>

<!-- ============ ANNOTATIONS ============ -->
<div class="flex-shrink-0 bg-slate-900 border-b border-slate-700/50 px-3 py-1">
  <div class="flex items-center gap-2">
    <div class="flex-1 flex flex-wrap gap-1">
      {#each annotations as annotation (annotation.id)}
        <div class="flex items-center gap-1 bg-slate-800 border border-slate-700/50 rounded px-1.5 py-0.5 max-w-[200px]">
          <p class="text-[9px] text-slate-300 truncate">{annotation.text}</p>
          <button on:click={() => dispatch('remove', annotation.id)} class="text-slate-600 hover:text-rose-400 text-[9px] flex-shrink-0">x</button>
        </div>
      {/each}
      {#if annotations.length === 0}
        <span class="text-[9px] text-slate-600">No notes yet</span>
      {/if}
    </div>
    <span role="status" class="text-[9px] {saveStatus === 'error' ? 'text-danger-400' : 'text-slate-500'}">
      {#if saveStatus === 'error'}{saveErrorMessage || 'Could not save notes. Try again.'}{:else if saveStatus === 'saving'}Saving…{:else if unsaved}Unsaved{:else if annotations.length > 0}Saved, {annotations.length} note{annotations.length === 1 ? '' : 's'}{/if}
    </span>
    <input
      bind:value={newAnnotation}
      placeholder="Add note..."
      class="w-40 px-1.5 py-0.5 text-[9px] bg-slate-800 border border-slate-700 rounded text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
      on:keydown={(e) => { if (e.key === 'Enter') dispatch('add'); }}
    />
    <button on:click={() => dispatch('add')} class="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-medium rounded">Add</button>
    <button on:click={() => dispatch('exportNotes')} disabled={annotations.length === 0} class="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-[9px] font-medium rounded" title="Download the notes as a Markdown file">Export notes</button>
  </div>
</div>
