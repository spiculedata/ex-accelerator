<script lang="ts">
  import { Modal } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import type { DataRow } from '$lib/utils/dataManagement';

  export let open: boolean;
  /** The dataset or source row to describe */
  export let dataset: DataRow | null;
  export let onClose: () => void;
</script>

<Modal {open} title={dataset?.name ?? 'Dataset'} description="What this dataset contains" onclose={onClose}>
  {#if dataset}
    <dl class="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
      <dt class="text-ink-500">Description</dt><dd class="col-span-2 text-ink-900">{dataset.description || 'No description'}</dd>
      <dt class="text-ink-500">Type</dt><dd class="col-span-2 text-ink-900">{dataset.dataset_type || dataset.type || 'unknown'}</dd>
      {#if dataset.source_platform}<dt class="text-ink-500">Platform</dt><dd class="col-span-2 text-ink-900">{dataset.source_platform}</dd>{/if}
      <dt class="text-ink-500">Records</dt><dd class="col-span-2 text-ink-900">{formatNumber(parseInt(String(dataset.record_count)) || dataset.records || 0)}</dd>
      {#if dataset.date_range_start}<dt class="text-ink-500">Date range</dt><dd class="col-span-2 text-ink-900">{String(dataset.date_range_start).slice(0, 10)} to {String(dataset.date_range_end ?? '').slice(0, 10)}</dd>{/if}
      <dt class="text-ink-500">{dataset.workspace_id ? 'Link status' : 'Status'}</dt><dd class="col-span-2 text-ink-900">{dataset.status}</dd>
    </dl>
  {/if}
  <svelte:fragment slot="footer">
    <button type="button" on:click={onClose} class="w-full rounded-lg bg-ink-100 px-4 py-2 text-sm text-ink-700 hover:bg-ink-200">Close</button>
  </svelte:fragment>
</Modal>
