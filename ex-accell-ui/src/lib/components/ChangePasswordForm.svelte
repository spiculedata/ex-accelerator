<script lang="ts">
  // Changes the signed-in person's own password. Other devices are signed out; this one stays signed in.
  let currentPassword = $state('');
  let newPassword = $state('');
  let isSaving = $state(false);
  let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    isSaving = true;
    message = null;
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        message = { kind: 'error', text: result?.error ?? `Could not change the password (HTTP ${response.status}).` };
        return;
      }
      message = { kind: 'ok', text: 'Password changed. Your other devices were signed out.' };
      currentPassword = newPassword = '';
    } catch {
      message = { kind: 'error', text: 'Could not reach the server. Try again.' };
    } finally {
      isSaving = false;
    }
  }
</script>

<form onsubmit={submit} class="space-y-2">
  <label class="block text-xs font-medium text-gray-700">Current password
    <input type="password" required bind:value={currentPassword} autocomplete="current-password" class="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs" />
  </label>
  <label class="block text-xs font-medium text-gray-700">New password (12 or more characters)
    <input type="password" required minlength="12" bind:value={newPassword} autocomplete="new-password" class="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs" />
  </label>
  <button type="submit" disabled={isSaving} class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">{isSaving ? 'Saving…' : 'Change password'}</button>
  {#if message}
    <p role={message.kind === 'error' ? 'alert' : 'status'} class="text-xs {message.kind === 'error' ? 'text-danger-700' : 'text-success-700'}">{message.text}</p>
  {/if}
</form>
