<script lang="ts">
  import { page } from '$app/stores';
  import ChangePasswordForm from '$lib/components/ChangePasswordForm.svelte';
  import { signOut, signOutEverywhere } from '$lib/utils/signOut';

  let isSigningOut = false;

  async function handleSignOut() {
    isSigningOut = true;
    await signOut();
  }

  async function handleSignOutEverywhere() {
    isSigningOut = true;
    await signOutEverywhere();
  }

  $: user = $page.data.user as { name: string; email: string; role: string } | null | undefined;
</script>

{#if user}
  <div class="hidden md:flex items-center space-x-3">
    <div class="hidden min-[1700px]:block text-right leading-tight" title="{user.name} ({user.role})">
      <p class="text-sm font-medium text-gray-900">{user.name}</p>
      <p class="text-xs text-gray-500 capitalize">{user.role}</p>
    </div>
    <div class="flex">
    <button
      type="button"
      on:click={handleSignOut}
      disabled={isSigningOut}
      title="Signed in as {user.name} ({user.role})"
      class="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-300 rounded-l-lg transition-colors disabled:opacity-60"
    >
      Sign out
    </button>
      <details class="relative">
        <summary aria-label="More sign-out options" class="flex h-full cursor-pointer list-none items-center rounded-r-lg border border-l-0 border-gray-300 px-2 text-xs text-gray-600 hover:bg-gray-50">▾</summary>
        <div class="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <button type="button" on:click={handleSignOutEverywhere} disabled={isSigningOut} class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Sign out on all devices</button>
          <p class="mt-2 text-xs text-gray-600">Ends every session of yours, on every device, including this one.</p>
          <hr class="my-3 border-gray-200" />
          <ChangePasswordForm />
          {#if user.role === 'admin'}
            <hr class="my-3 border-gray-200" />
            <a href="/settings/users" class="block rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Manage users</a>
          {/if}
        </div>
      </details>
    </div>
  </div>
{/if}
