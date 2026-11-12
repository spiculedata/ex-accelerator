<script lang="ts">
  import ChangePasswordForm from '$lib/components/ChangePasswordForm.svelte';
  import { initials } from '$lib/utils/initials';
  import { signOut, signOutEverywhere } from '$lib/utils/signOut';
  import type { NavUser } from './navItems';

  export let user: NavUser | null | undefined;
</script>

{#if user}
  <div class="px-3 py-3 border-t border-ink-200">
    <div class="flex items-center space-x-3">
      <div class="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center shrink-0" aria-hidden="true">
        <span class="text-white font-medium text-sm">{initials(user.name, user.email)}</span>
      </div>
      <div class="min-w-0">
        <div class="text-sm font-medium text-ink-900 truncate">{user.name}</div>
        <div class="text-xs text-ink-500 truncate">{user.email} · <span class="capitalize">{user.role}</span></div>
      </div>
    </div>
    <div class="mt-3 flex gap-2">
      <a href="/projects" class="flex-1 text-center px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-md hover:bg-ink-50">Switch project</a>
      <button type="button" on:click={signOut} class="flex-1 px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-md hover:bg-ink-50">Sign out</button>
    </div>
    <div class="mt-2 flex gap-2">
      <button type="button" on:click={signOutEverywhere} class="flex-1 px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-md hover:bg-ink-50">Sign out on all devices</button>
      {#if user.role === 'admin'}
        <a href="/settings/users" class="flex-1 text-center px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-md hover:bg-ink-50">Manage users</a>
      {/if}
    </div>
    <details class="mt-2 rounded-md border border-ink-300 px-3 py-2">
      <summary class="cursor-pointer text-sm font-medium text-ink-700">Change password</summary>
      <div class="mt-2"><ChangePasswordForm /></div>
    </details>
  </div>
{/if}
