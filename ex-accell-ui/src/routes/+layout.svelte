<script>
  import '../app.css';
  import { page } from '$app/stores';
  import Navigation from '$lib/components/Navigation.svelte';

  // Hide nav on full-screen investigation workbench
  $: isFullScreen = $page.url.pathname.match(/^\/investigations\/\d+/);
</script>

{#if !isFullScreen}
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:top-2 focus:left-2 focus:rounded">Skip to content</a>
  <Navigation />
{/if}

<main id="main-content">
  <slot />
</main>