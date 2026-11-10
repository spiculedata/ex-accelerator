<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { beforeNavigate } from '$app/navigation';
  import { dismissApiErrors } from '$lib/stores/apiErrors';
  import Navigation from '$lib/components/Navigation.svelte';
  import ApiErrorBanner from '$lib/components/ApiErrorBanner.svelte';
  import { onMount } from 'svelte';
  import { projectNotice } from '$lib/stores/projectStore';
  import { sessionExpired, watchForExpiredSession } from '$lib/utils/sessionExpiry';

  // Failures belong to the page that requested the data; don't carry them to the next one
  // A notice about the project has been seen by the time the visitor moves on
  beforeNavigate(() => { dismissApiErrors(); projectNotice.set(null); });

  onMount(() => watchForExpiredSession(window, () => sessionExpired.set(true), window.location.origin, () => sessionExpired.set(false)));

  // Hide nav on full-screen investigation workbench and the login page
  $: isFullScreen = $page.url.pathname.match(/^\/investigations\/\d+/) || $page.url.pathname === '/login';
</script>

{#if !isFullScreen}
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:top-2 focus:left-2 focus:rounded">Skip to content</a>
  <Navigation />
{/if}

<main id="main-content">
  {#if !isFullScreen}<ApiErrorBanner />{/if}
  <!-- The live region is always present so a notice added later is announced -->
  <div role="status" aria-live="polite">
    {#if !isFullScreen && $sessionExpired}
      <div class="mx-auto mt-4 flex max-w-7xl items-start justify-between gap-3 rounded-lg border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-ink-900">
        <p>Your session has expired, so some data could not load.</p>
        <a class="shrink-0 font-medium text-primary-700 hover:underline" href="/login?next={encodeURIComponent($page.url.pathname + $page.url.search)}">Sign in again</a>
      </div>
    {/if}
    {#if !isFullScreen && $projectNotice}
      <div class="mx-auto mt-4 flex max-w-7xl items-start justify-between gap-3 rounded-lg border border-signal-300 bg-signal-50 px-4 py-3 text-sm text-ink-900">
        <p>{$projectNotice}</p>
        <button type="button" class="shrink-0 font-medium text-primary-700 hover:underline" on:click={() => projectNotice.set(null)}>Dismiss</button>
      </div>
    {/if}
  </div>
  <slot />
</main>