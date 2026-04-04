/**
 * Authentication Store
 *
 * Svelte store for managing authentication state across the application.
 * Integrates with AuthService and provides reactive auth state.
 *
 * Usage:
 * ```svelte
 * <script>
 *   import { auth, currentUser, isAuthenticated } from '$lib/stores/authStore';
 *
 *   async function handleLogin() {
 *     await auth.login({ email, password });
 *   }
 * </script>
 *
 * {#if $isAuthenticated}
 *   <p>Welcome, {$currentUser?.name}!</p>
 * {:else}
 *   <button on:click={handleLogin}>Login</button>
 * {/if}
 * ```
 */

import { writable, derived, type Readable } from 'svelte/store';
import { authService, type User, type LoginCredentials, type RegisterData } from '$lib/services/authService';

// ===================================================================
// Auth State Interface
// ===================================================================

export interface AuthState {
  /**
   * Current authenticated user (null if not authenticated)
   */
  user: User | null;

  /**
   * Whether auth is currently loading
   */
  loading: boolean;

  /**
   * Last error from auth operation
   */
  error: string | null;

  /**
   * Whether auth has been initialized
   */
  initialized: boolean;
}

// ===================================================================
// Auth Store
// ===================================================================

/**
 * Create the auth store
 */
function createAuthStore() {
  const initialState: AuthState = {
    user: null,
    loading: true,
    error: null,
    initialized: false
  };

  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,

    /**
     * Initialize auth (load session from storage)
     */
    async init(): Promise<void> {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const user = await authService.getCurrentUser();
        set({
          user,
          loading: false,
          error: null,
          initialized: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize auth';
        set({
          user: null,
          loading: false,
          error: errorMessage,
          initialized: true
        });
      }
    },

    /**
     * Log in user
     */
    async login(credentials: LoginCredentials): Promise<void> {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const user = await authService.login(credentials);
        set({
          user,
          loading: false,
          error: null,
          initialized: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        throw error; // Re-throw for component error handling
      }
    },

    /**
     * Log out user
     */
    async logout(): Promise<void> {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        await authService.logout();
        set({
          user: null,
          loading: false,
          error: null,
          initialized: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Logout failed';
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        throw error;
      }
    },

    /**
     * Register new user
     */
    async register(data: RegisterData): Promise<void> {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const user = await authService.register(data);
        set({
          user,
          loading: false,
          error: null,
          initialized: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Registration failed';
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        throw error;
      }
    },

    /**
     * Update user profile
     */
    async updateProfile(updates: Partial<User>): Promise<void> {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const user = await authService.updateProfile(updates);
        update(state => ({
          ...state,
          user,
          loading: false,
          error: null
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        throw error;
      }
    },

    /**
     * Clear error
     */
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },

    /**
     * Refresh user session
     */
    async refresh(): Promise<void> {
      update(state => ({ ...state, loading: true }));

      try {
        await authService.refreshToken();
        const user = await authService.getCurrentUser();
        update(state => ({
          ...state,
          user,
          loading: false,
          error: null
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Session refresh failed';
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage
        }));
        // Auto-logout on refresh failure
        await this.logout();
      }
    }
  };
}

// ===================================================================
// Exported Stores
// ===================================================================

/**
 * Main auth store
 */
export const auth = createAuthStore();

/**
 * Current authenticated user (derived store)
 */
export const currentUser: Readable<User | null> = derived(
  auth,
  $auth => $auth.user
);

/**
 * Whether user is authenticated (derived store)
 */
export const isAuthenticated: Readable<boolean> = derived(
  auth,
  $auth => $auth.user !== null && !$auth.loading
);

/**
 * Whether auth is loading (derived store)
 */
export const authLoading: Readable<boolean> = derived(
  auth,
  $auth => $auth.loading
);

/**
 * Auth error message (derived store)
 */
export const authError: Readable<string | null> = derived(
  auth,
  $auth => $auth.error
);

/**
 * Whether auth is initialized (derived store)
 */
export const authInitialized: Readable<boolean> = derived(
  auth,
  $auth => $auth.initialized
);

/**
 * Current user's role (derived store)
 */
export const userRole: Readable<User['role'] | null> = derived(
  currentUser,
  $currentUser => $currentUser?.role || null
);

/**
 * Whether current user is admin (derived store)
 */
export const isAdmin: Readable<boolean> = derived(
  userRole,
  $userRole => $userRole === 'admin'
);

/**
 * User's display name (derived store)
 */
export const userDisplayName: Readable<string> = derived(
  currentUser,
  $currentUser => $currentUser?.name || 'Guest'
);

// ===================================================================
// Helper Functions
// ===================================================================

/**
 * Check if user has specific role
 */
export function hasRole(role: User['role']): boolean {
  return authService.hasRole(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(roles: User['role'][]): boolean {
  return authService.hasAnyRole(roles);
}

/**
 * Check if user can perform action
 */
export function can(permission: string): boolean {
  return authService.can(permission);
}

/**
 * Get current user ID (or null if not authenticated)
 */
export async function getCurrentUserId(): Promise<string | null> {
  return authService.isAuthenticated()
    ? authService.getCurrentUser().then(u => u?.id || null)
    : null;
}

/**
 * Get auth token for API calls
 */
export function getAuthToken(): string | null {
  return authService.getToken();
}

// ===================================================================
// Auto-initialization
// ===================================================================

/**
 * Initialize auth on module load (browser only)
 */
if (typeof window !== 'undefined') {
  auth.init().catch(error => {
    console.error('[AuthStore] Auto-initialization failed:', error);
  });
}
