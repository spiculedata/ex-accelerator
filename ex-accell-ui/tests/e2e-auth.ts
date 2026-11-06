// Shared by playwright.config.ts and tests/global-setup.ts.
// Test-only secret: the e2e web server and the minted session cookie must agree on it.
export const E2E_SESSION_SECRET = 'e2e-only-secret-not-for-production-use-0123456789';
export const E2E_STORAGE_STATE = 'tests/.auth/state.json';
