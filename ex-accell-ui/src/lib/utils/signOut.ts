/** Ends the session on the server and returns to the sign-in page. Used by the user menu and the mobile menu. */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login';
  }
}
