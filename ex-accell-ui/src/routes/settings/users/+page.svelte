<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  interface UserRow {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user' | 'viewer';
    isDisabled: boolean;
    createdAt: string | null;
    lastLoginAt: string | null;
  }

  const ROLES = ['admin', 'user', 'viewer'] as const;
  const ROLE_HELP = 'Admins manage accounts and run code; users read and write; viewers are read-only.';

  let users = $state<UserRow[]>([]);
  let isLoading = $state(true);
  let loadError = $state('');
  let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

  let newEmail = $state('');
  let newName = $state('');
  let newRole = $state<(typeof ROLES)[number]>('user');
  let newPassword = $state('');
  let isCreating = $state(false);

  let resetFor = $state<string | null>(null);
  let resetPassword = $state('');

  const currentUserId = $derived(($page.data.user as { id: string } | null | undefined)?.id ?? '');

  async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error: string }> {
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      return response.ok && result?.success ? { ok: true, error: '' } : { ok: false, error: result?.error ?? `The request failed (HTTP ${response.status}).` };
    } catch {
      return { ok: false, error: 'Could not reach the server. Try again.' };
    }
  }

  async function load() {
    isLoading = true;
    loadError = '';
    try {
      const response = await fetch('/api/users');
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error ?? `HTTP ${response.status}`);
      users = result.data.users;
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'Could not load the users.';
    } finally {
      isLoading = false;
    }
  }

  async function change(user: UserRow, body: Record<string, unknown>, done: string) {
    message = null;
    const result = await call(`/api/users/${user.id}`, 'PATCH', body);
    message = result.ok ? { kind: 'ok', text: done } : { kind: 'error', text: result.error };
    if (result.ok) await load();
  }

  async function createUser(event: SubmitEvent) {
    event.preventDefault();
    isCreating = true;
    message = null;
    const result = await call('/api/users', 'POST', { email: newEmail, name: newName, role: newRole, password: newPassword });
    isCreating = false;
    if (!result.ok) {
      message = { kind: 'error', text: result.error };
      return;
    }
    message = { kind: 'ok', text: `Created the account for ${newEmail}. Give them the password you set; they can change it after signing in.` };
    newEmail = newName = newPassword = '';
    newRole = 'user';
    await load();
  }

  async function submitReset(user: UserRow, event: SubmitEvent) {
    event.preventDefault();
    await change(user, { password: resetPassword }, `Password reset for ${user.email}. Their sessions were ended.`);
    resetPassword = '';
    resetFor = null;
  }

  const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : 'Never');

  onMount(load);
</script>

<svelte:head>
  <title>Users - Social Explorer</title>
  <meta name="description" content="Create accounts, change roles, disable access and reset passwords for the people who use Social Explorer." />
</svelte:head>

<PageHeader title="Users" subtitle="Create accounts, change roles, disable access and reset passwords" showProject={false} />

<main id="main-content" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  {#if message}
    <p role={message.kind === 'error' ? 'alert' : 'status'} class="rounded-lg border px-4 py-3 text-sm {message.kind === 'error' ? 'border-danger-300 bg-danger-50 text-danger-800' : 'border-success-300 bg-success-50 text-success-800'}">{message.text}</p>
  {/if}

  <section aria-labelledby="add-user" class="rounded-xl border border-ink-200 bg-white p-6">
    <h2 id="add-user" class="text-lg font-semibold text-ink-900">Add a person</h2>
    <p class="mt-1 text-sm text-ink-600">{ROLE_HELP} Passwords need at least 12 characters.</p>
    <form onsubmit={createUser} class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
      <label class="block text-sm font-medium text-ink-700">Email
        <input type="email" required bind:value={newEmail} autocomplete="off" class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm" />
      </label>
      <label class="block text-sm font-medium text-ink-700">Name
        <input type="text" required maxlength="100" bind:value={newName} autocomplete="off" class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm" />
      </label>
      <label class="block text-sm font-medium text-ink-700">Role
        <select bind:value={newRole} class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm">
          {#each ROLES as role}<option value={role}>{role}</option>{/each}
        </select>
      </label>
      <label class="block text-sm font-medium text-ink-700">Password
        <input type="password" required minlength="12" bind:value={newPassword} autocomplete="new-password" class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={isCreating} class="rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">{isCreating ? 'Creating…' : 'Create account'}</button>
    </form>
  </section>

  <section aria-labelledby="everyone">
    <h2 id="everyone" class="text-lg font-semibold text-ink-900">Everyone</h2>
    {#if isLoading}
      <p class="mt-3 text-sm text-ink-600" role="status">Loading…</p>
    {:else if loadError}
      <p class="mt-3 text-sm text-danger-800" role="alert">{loadError} <button type="button" onclick={load} class="underline">Try again</button></p>
    {:else}
      <div class="mt-3 overflow-x-auto rounded-xl border border-ink-200 bg-white">
        <table class="min-w-full text-sm">
          <caption class="sr-only">Accounts</caption>
          <thead class="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-600">
            <tr><th scope="col" class="px-4 py-3">Person</th><th scope="col" class="px-4 py-3">Role</th><th scope="col" class="px-4 py-3">Status</th><th scope="col" class="px-4 py-3">Last sign-in</th><th scope="col" class="px-4 py-3">Actions</th></tr>
          </thead>
          <tbody class="divide-y divide-ink-100">
            {#each users as user (user.id)}
              {@const isSelf = user.id === currentUserId}
              <tr>
                <td class="px-4 py-3">
                  <p class="font-medium text-ink-900">{user.name}{#if isSelf}<span class="ml-1 text-ink-600">(you)</span>{/if}</p>
                  <p class="text-ink-600">{user.email}</p>
                </td>
                <td class="px-4 py-3">
                  <select
                    aria-label="Role of {user.email}"
                    value={user.role}
                    disabled={isSelf}
                    title={isSelf ? 'You cannot change your own role' : ''}
                    onchange={(event) => change(user, { role: event.currentTarget.value }, `${user.email} is now ${event.currentTarget.value}. Their sessions were ended.`)}
                    class="rounded-lg border border-ink-300 px-2 py-1 disabled:opacity-60"
                  >
                    {#each ROLES as role}<option value={role}>{role}</option>{/each}
                  </select>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium {user.isDisabled ? 'bg-danger-100 text-danger-800' : 'bg-success-100 text-success-800'}">{user.isDisabled ? 'Disabled' : 'Active'}</span>
                </td>
                <td class="px-4 py-3 text-ink-700">{formatDate(user.lastLoginAt)}</td>
                <td class="px-4 py-3">
                  {#if isSelf}
                    <span class="text-ink-600">Use the user menu to change your password</span>
                  {:else if resetFor === user.id}
                    <form onsubmit={(event) => submitReset(user, event)} class="flex flex-wrap items-center gap-2">
                      <input type="password" required minlength="12" bind:value={resetPassword} aria-label="New password for {user.email}" autocomplete="new-password" class="rounded-lg border border-ink-300 px-2 py-1" />
                      <button type="submit" class="rounded-lg bg-primary-700 px-3 py-1 text-white">Set</button>
                      <button type="button" onclick={() => { resetFor = null; resetPassword = ''; }} class="rounded-lg border border-ink-300 px-3 py-1">Cancel</button>
                    </form>
                  {:else}
                    <div class="flex flex-wrap gap-2">
                      <button type="button" onclick={() => { resetFor = user.id; resetPassword = ''; }} class="rounded-lg border border-ink-300 px-3 py-1 hover:bg-ink-50">Reset password</button>
                      <button type="button" onclick={() => change(user, { disabled: !user.isDisabled }, user.isDisabled ? `${user.email} can sign in again.` : `${user.email} is disabled and was signed out everywhere.`)} class="rounded-lg border border-ink-300 px-3 py-1 hover:bg-ink-50">{user.isDisabled ? 'Enable' : 'Disable'}</button>
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</main>
