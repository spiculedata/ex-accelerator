<script lang="ts">
  import type { ExportState } from '$lib/utils/exportAction';

  /** Tells the visitor what an export did. The live region is always present so a result added later is announced. */
  export let state: ExportState;
</script>

<div role="status" aria-live="polite">
  {#if state.kind === 'done' || state.kind === 'error'}
    <p class="mb-4 rounded-lg border px-4 py-2 text-sm {state.kind === 'error' ? 'border-danger-300 bg-danger-50 text-danger-900' : 'border-success-300 bg-success-50 text-success-900'}">{state.message}</p>
  {/if}
</div>
