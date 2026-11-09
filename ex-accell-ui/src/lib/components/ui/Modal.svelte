<script lang="ts">
  import { tick } from 'svelte';

  /**
   * An accessible dialog: role and labelling, focus moves in and returns, Tab stays inside, Esc and a click
   * on the backdrop close it. Put the body in the default slot and buttons in `footer`.
   */
  export let open = false;
  export let title: string;
  export let description = '';
  export let onclose: () => void;
  export let size: 'md' | 'lg' = 'md';

  let panel: HTMLElement | undefined;
  let returnFocusTo: HTMLElement | null = null;
  let wasOpen = false;
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;

  $: if (open !== wasOpen) {
    wasOpen = open;
    if (open) {
      returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      void tick().then(() => (panel?.querySelector<HTMLElement>('[data-autofocus], button, a[href], input, select, textarea') ?? panel)?.focus());
    } else if (returnFocusTo) {
      returnFocusTo.focus();
      returnFocusTo = null;
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      onclose();
      return;
    }
    if (event.key !== 'Tab' || !panel) return;
    const focusable = [...panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window on:keydown|capture={onKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
    <button type="button" class="absolute inset-0 cursor-default" aria-label="Close dialog" tabindex="-1" on:click={onclose}></button>
    <div
      bind:this={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      class="relative flex max-h-[85vh] w-full flex-col rounded-2xl bg-white shadow-xl {size === 'lg' ? 'max-w-2xl' : 'max-w-lg'}"
    >
      <header class="border-b border-ink-200 px-6 py-4">
        <h2 id={titleId} class="text-lg font-semibold text-ink-900">{title}</h2>
        {#if description}<p class="mt-1 text-sm text-ink-600">{description}</p>{/if}
      </header>
      <div class="flex-1 overflow-y-auto px-6 py-4"><slot /></div>
      <footer class="border-t border-ink-200 px-6 py-3"><slot name="footer" /></footer>
    </div>
  </div>
{/if}
