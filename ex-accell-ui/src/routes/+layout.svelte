<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { beforeNavigate } from '$app/navigation';
  import { dismissApiErrors } from '$lib/stores/apiErrors';
  import Navigation from '$lib/components/Navigation.svelte';
  import ApiErrorBanner from '$lib/components/ApiErrorBanner.svelte';

  // Failures belong to the page that requested the data; don't carry them to the next one
  beforeNavigate(() => dismissApiErrors());

  // Hide nav on full-screen investigation workbench and the login page
  $: isFullScreen = $page.url.pathname.match(/^\/investigations\/\d+/) || $page.url.pathname === '/login';
</script>

{#if !isFullScreen}
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:top-2 focus:left-2 focus:rounded">Skip to content</a>
  <Navigation />
{/if}

<main id="main-content">
  {#if !isFullScreen}<ApiErrorBanner />{/if}
  <slot />
</main>