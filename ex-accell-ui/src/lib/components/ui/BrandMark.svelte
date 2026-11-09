<script lang="ts">
  /**
   * The Social Explorer mark: a compass ring that the needle breaks out of.
   * The ring and needle tail follow `currentColor`; the needle tip is always Signal amber.
   * Pass `title` when the mark is the only label (for example a standalone icon button).
   */
  export let size: number | string = 32;
  export let title = '';
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 64 64"
  class="shrink-0 {$$props.class ?? ''}"
  role={title ? 'img' : undefined}
  aria-label={title || undefined}
  aria-hidden={title ? undefined : 'true'}
>
  {#if title}<title>{title}</title>{/if}
  <path d="M55.01 22.23 A25 25 0 1 1 41.77 8.99" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
  <path d="M22.10 41.90 L35.68 35.68 L28.32 28.32 Z" fill="currentColor" />
  <path d="M50.38 13.62 L35.68 35.68 L28.32 28.32 Z" fill="var(--se-signal-400)" />
</svg>
