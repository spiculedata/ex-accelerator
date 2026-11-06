<script lang="ts">
  import { page } from '$app/stores';

  let isSigningOut = false;

  async function signOut() {
    isSigningOut = true;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  $: user = $page.data.user as { name: string; email: string; role: string } | null | undefined;
</script>

{#if user}
  <div class="hidden md:flex items-center space-x-3">
    <div class="text-right leading-tight">
      <p class="text-sm font-medium text-gray-900">{user.name}</p>
      <p class="text-xs text-gray-500 capitalize">{user.role}</p>
    </div>
    <button
      type="button"
      on:click={signOut}
      disabled={isSigningOut}
      class="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors disabled:opacity-60"
    >
      Sign out
    </button>
  </div>
{/if}
