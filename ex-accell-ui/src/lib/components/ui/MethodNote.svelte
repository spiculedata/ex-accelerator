<script lang="ts">
  /** A short, collapsed "how this is calculated" note, so a figure can be understood before it is trusted. */
  export let title = 'How this is calculated';
</script>

<details class="rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-700">
  <summary class="cursor-pointer font-medium text-ink-900">{title}</summary>
  <div class="mt-2 space-y-2 leading-relaxed">
    <slot />
  </div>
</details>
