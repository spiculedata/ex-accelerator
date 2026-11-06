<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';

  export let data: { next: string };

  let email = '';
  let password = '';
  let errorMessage = '';
  let isSubmitting = false;

  async function signIn(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    isSubmitting = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        errorMessage = result?.error ?? 'Sign-in failed. Please try again.';
        return;
      }

      await invalidateAll();
      await goto(data.next, { replaceState: true });
    } catch {
      errorMessage = 'Could not reach the server. Check your connection and try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in | Social Explorer</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="flex items-center justify-center mb-8">
      <div class="h-10 w-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
        <span class="text-white font-bold text-xl">SE</span>
      </div>
      <h1 class="ml-3 text-2xl font-bold text-gray-900">Social Explorer</h1>
    </div>

    <form on:submit={signIn} class="bg-white shadow-lg rounded-xl border border-gray-200 p-6 space-y-5" aria-labelledby="signin-heading">
      <h2 id="signin-heading" class="text-lg font-semibold text-gray-900">Sign in</h2>

      <div aria-live="polite">
        {#if errorMessage}
          <p role="alert" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{errorMessage}</p>
        {/if}
      </div>

      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="email"
          type="email"
          autocomplete="username"
          required
          bind:value={email}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          id="password"
          type="password"
          autocomplete="current-password"
          required
          bind:value={password}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  </div>
</div>
