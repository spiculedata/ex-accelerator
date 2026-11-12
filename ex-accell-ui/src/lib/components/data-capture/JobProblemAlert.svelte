<script lang="ts">
  import CopyCommand from '$lib/components/ui/CopyCommand.svelte';
  import type { JobStateProblem } from '$lib/utils/jobStateProblem';

  export let jobProblem: JobStateProblem;
  export let retry: () => void;
</script>

<div role="alert" class="mb-4 rounded-xl border border-ink-200 bg-white px-6 py-5">
  <p class="font-medium text-ink-900">{jobProblem.title}</p>
  <p class="mt-1 text-sm text-ink-600">{jobProblem.detail}</p>
  {#if jobProblem.command}<div class="mt-3 max-w-md"><CopyCommand command={jobProblem.command} /></div>{/if}
  <button type="button" on:click={retry} class="mt-3 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Try again</button>
</div>
