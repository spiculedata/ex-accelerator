<script lang="ts">
  import { Modal } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import type { DatasetRow } from '$lib/utils/datasetRows';

  export let open: boolean;
  /** The datasets that are not yet linked to the workspace */
  export let datasets: DatasetRow[];
  /** The dataset being linked, if any; the others are disabled meanwhile */
  export let linkingId: number | null;
  export let linkError = '';
  export let onLink: (dataset: DatasetRow) => void;
  export let onClose: () => void;
</script>

<Modal {open} title="Link a dataset" description="Choose a dataset to add to this workspace. It then scopes the dashboards and analysis." onclose={onClose}>
  {#if linkError}
    <p role="alert" class="mb-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-ink-900">{linkError}</p>
  {/if}
  <ul class="space-y-2">
    {#each datasets as dataset (dataset.id)}
      <li>
        <button
          type="button"
          on:click={() => onLink(dataset)}
          disabled={linkingId !== null}
          class="w-full rounded-lg border border-ink-200 p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60"
        >
          <div class="font-medium text-ink-900">{dataset.name}{#if linkingId === dataset.id}<span class="ml-2 text-sm font-normal text-ink-600">Linking…</span>{/if}</div>
          <div class="mt-1 text-sm text-ink-600">{String(dataset.description ?? '').substring(0, 80)}</div>
          <div class="mt-2 flex items-center space-x-3 text-xs text-ink-500">
            <span>{dataset.dataset_type}</span>
            <span>{formatNumber(parseInt(String(dataset.record_count)) || 0)} records</span>
          </div>
        </button>
      </li>
    {:else}
      <li class="py-4 text-center text-sm text-ink-600">Every available dataset is already linked to this workspace.</li>
    {/each}
  </ul>
  <svelte:fragment slot="footer">
    <button type="button" on:click={onClose} class="w-full rounded-lg bg-ink-100 px-4 py-2 text-sm text-ink-700 hover:bg-ink-200">Close</button>
  </svelte:fragment>
</Modal>
