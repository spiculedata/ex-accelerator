<script lang="ts">
  import { onDestroy } from 'svelte';

  /** A command in a code block with a Copy button. Copying can be blocked, so the text stays selectable. */
  export let command: string;
  let status: 'idle' | 'copied' | 'failed' = 'idle';
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(timer));

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      status = 'copied';
    } catch {
      status = 'failed';
    }
    clearTimeout(timer);
    timer = setTimeout(() => (status = 'idle'), 3000);
  }
</script>

<div class="flex items-stretch overflow-hidden rounded-lg bg-ink-900 text-sm">
  <code class="flex-1 select-all overflow-x-auto px-3 py-2 font-mono text-primary-200">{command}</code>
  <button type="button" on:click={copy} class="shrink-0 border-l border-ink-700 px-3 text-ink-100 hover:bg-ink-800">
    {status === 'copied' ? 'Copied' : status === 'failed' ? 'Select and copy' : 'Copy'}
  </button>
</div>
<span class="sr-only" role="status">{status === 'copied' ? 'Command copied' : status === 'failed' ? 'Could not copy. Select the command and copy it.' : ''}</span>
