<script lang="ts">
  /**
   * Shown when a module has no data because it has not been set up or loaded yet, as opposed to an error.
   * Say what the page is for, why it is empty, and what to do next. Never show table names or raw errors.
   */
  export let title: string;
  export let description: string;
  export let actionLabel = '';
  export let actionHref = '';
</script>

<div role="status" class="rounded-xl border border-ink-200 bg-white px-6 py-5">
  <p class="font-medium text-ink-900">{title}</p>
  <p class="mt-1 text-sm text-ink-600">{description}</p>
  {#if actionLabel && actionHref}
    <a href={actionHref} class="mt-3 inline-block text-sm font-medium text-primary-700 hover:underline">{actionLabel}</a>
  {/if}
</div>
