/**
 * Authentication Service
 *
 * Handles user authentication, session management, and authorization.
 *
 * Implementation Phases:
 * - Phase 1: localStorage-based authentication (current)
 * - Phase 2: JWT tokens with refresh tokens
 * - Phase 3: OAuth2/OIDC integration (Google, GitHub, etc.)
 *
 * Features:
 * - User login/logout/registration
 * - Session persistence
 * - Role-based access control
 * - Token management
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  avatar?: string;
  created_at: string;
  last_login?: string;
  preferences?: Record<string, any>;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: User['role'];
}

export interface AuthToken {
  token: string;
  expires_at: string;
  refresh_token?: string;
}

export interface AuthSession {
  user: User;
  token: AuthToken;
  created_at: string;
}

// ===================================================================
// AuthService Class
// ===================================================================

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private currentToken: AuthToken | null = null;
  private readonly STORAGE_USER_KEY = 'auth_user';
  private readonly STORAGE_TOKEN_KEY = 'auth_token';
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    // Load session from storage on initialization
    this.loadSessionFromStorage();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ===================================================================
  // Authentication Methods
  // ===================================================================

  /**
   * Log in user with email and password
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const { email, password, remember = false } = credentials;

    // Phase 1: Simple validation (replace with API call in Phase 2)
    // TODO: Replace with actual API authentication
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Simulate API call
    await this.simulateApiDelay();

    // Phase 1: Check against mock users
    const user = await this.mockUserLookup(email, password);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Create auth token
    const token: AuthToken = {
      token: this.generateToken(),
      expires_at: new Date(Date.now() + this.SESSION_DURATION).toISOString()
    };

    // Update last login
    user.last_login = new Date().toISOString();

    // Store session
    this.currentUser = user;
    this.currentToken = token;

    if (remember) {
      this.saveSessionToStorage(user, token);
    }

    return user;
  }

  /**
   * Log out current user
   */
  async logout(): Promise<void> {
    // Phase 2: Invalidate token on server
    // await this.revokeToken(this.currentToken?.token);

    // Clear local session
    this.currentUser = null;
    this.currentToken = null;

    // Clear storage
    this.clearSessionFromStorage();
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<User> {
    const { email, password, name, role = 'user' } = data;

    // Validate input
    if (!email || !password || !name) {
      throw new Error('Email, password, and name are required');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Simulate API call
    await this.simulateApiDelay();

    // Phase 1: Check if user exists
    const existingUser = await this.mockUserExists(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user
    const user: User = {
      id: this.generateUserId(),
      email,
      name,
      role,
      created_at: new Date().toISOString()
    };

    // Phase 1: Store in localStorage
    // Phase 2: Store on server via API
    this.mockStoreUser(user, password);

    // Auto-login after registration
    await this.login({ email, password, remember: true });

    return user;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<AuthToken> {
    if (!this.currentToken?.refresh_token) {
      throw new Error('No refresh token available');
    }

    // Phase 2: Call API to refresh token
    // const response = await fetch('/api/auth/refresh', {
    //   method: 'POST',
    //   body: JSON.stringify({ refresh_token: this.currentToken.refresh_token })
    // });

    // Simulate API call
    await this.simulateApiDelay();

    const newToken: AuthToken = {
      token: this.generateToken(),
      expires_at: new Date(Date.now() + this.SESSION_DURATION).toISOString(),
      refresh_token: this.currentToken.refresh_token
    };

    this.currentToken = newToken;
    this.saveSessionToStorage(this.currentUser!, newToken);

    return newToken;
  }

  // ===================================================================
  // Session Management
  // ===================================================================

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      // Check if token is expired
      if (this.isTokenExpired()) {
        try {
          await this.refreshToken();
        } catch {
          await this.logout();
          return null;
        }
      }
      return this.currentUser;
    }

    // Try loading from storage
    this.loadSessionFromStorage();

    return this.currentUser;
  }

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return this.currentToken?.token || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && !this.isTokenExpired();
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.currentToken?.expires_at) return true;

    const expiresAt = new Date(this.currentToken.expires_at);
    return Date.now() >= expiresAt.getTime();
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    if (!this.currentUser) {
      throw new Error('Not authenticated');
    }

    // Phase 2: Call API to update profile
    // const response = await fetch('/api/auth/profile', {
    //   method: 'PUT',
    //   body: JSON.stringify(updates)
    // });

    // Simulate API call
    await this.simulateApiDelay();

    // Update local user
    this.currentUser = {
      ...this.currentUser,
      ...updates
    };

    // Update storage
    if (this.currentToken) {
      this.saveSessionToStorage(this.currentUser, this.currentToken);
    }

    return this.currentUser;
  }

  // ===================================================================
  // Authorization Methods
  // ===================================================================

  /**
   * Check if user has specific role
   */
  hasRole(role: User['role']): boolean {
    return this.currentUser?.role === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: User['role'][]): boolean {
    return roles.some(role => this.hasRole(role));
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  /**
   * Check if user can perform action
   */
  can(permission: string): boolean {
    if (!this.currentUser) return false;

    // Phase 3: Implement permission system
    // For now, admins can do everything
    if (this.isAdmin()) return true;

    // Define permissions by role
    const permissions: Record<User['role'], string[]> = {
      admin: ['*'], // All permissions
      user: ['read', 'write', 'create'],
      viewer: ['read']
    };

    const userPermissions = permissions[this.currentUser.role] || [];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  }

  // ===================================================================
  // Storage Methods
  // ===================================================================

  /**
   * Save session to localStorage
   */
  private saveSessionToStorage(user: User, token: AuthToken): void {
    try {
      localStorage.setItem(this.STORAGE_USER_KEY, JSON.stringify(user));
      localStorage.setItem(this.STORAGE_TOKEN_KEY, JSON.stringify(token));
    } catch (error) {
      console.error('[Auth] Failed to save session:', error);
    }
  }

  /**
   * Load session from localStorage
   */
  private loadSessionFromStorage(): void {
    try {
      const userStr = localStorage.getItem(this.STORAGE_USER_KEY);
      const tokenStr = localStorage.getItem(this.STORAGE_TOKEN_KEY);

      if (userStr && tokenStr) {
        this.currentUser = JSON.parse(userStr);
        this.currentToken = JSON.parse(tokenStr);

        // Check if token is expired
        if (this.isTokenExpired()) {
          this.clearSessionFromStorage();
          this.currentUser = null;
          this.currentToken = null;
        }
      }
    } catch (error) {
      console.error('[Auth] Failed to load session:', error);
      this.clearSessionFromStorage();
    }
  }

  /**
   * Clear session from localStorage
   */
  private clearSessionFromStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_USER_KEY);
      localStorage.removeItem(this.STORAGE_TOKEN_KEY);
    } catch (error) {
      console.error('[Auth] Failed to clear session:', error);
    }
  }

  // ===================================================================
  // Mock/Helper Methods (Phase 1 - Replace in Phase 2)
  // ===================================================================

  /**
   * Simulate API delay
   */
  private async simulateApiDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Generate mock user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate mock token
   */
  private generateToken(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Mock user lookup (Phase 1)
   */
  private async mockUserLookup(email: string, password: string): Promise<User | null> {
    const users = this.getMockUsers();

    // Find user by email and password
    const user = users.find(u => u.email === email);

    if (user) {
      // In Phase 1, password is stored in localStorage
      // In Phase 2, this will be a proper API call
      const storedPassword = localStorage.getItem(`user_password_${user.id}`);
      if (storedPassword === password) {
        return user;
      }
    }

    return null;
  }

  /**
   * Check if user exists (Phase 1)
   */
  private async mockUserExists(email: string): Promise<boolean> {
    const users = this.getMockUsers();
    return users.some(u => u.email === email);
  }

  /**
   * Store user (Phase 1)
   */
  private mockStoreUser(user: User, password: string): void {
    const users = this.getMockUsers();
    users.push(user);
    localStorage.setItem('mock_users', JSON.stringify(users));
    localStorage.setItem(`user_password_${user.id}`, password);
  }

  /**
   * Get mock users from storage
   */
  private getMockUsers(): User[] {
    try {
      const usersStr = localStorage.getItem('mock_users');
      if (usersStr) {
        return JSON.parse(usersStr);
      }
    } catch (error) {
      console.error('[Auth] Failed to get mock users:', error);
    }

    // Default mock users
    const defaultUsers: User[] = [
      {
        id: 'admin_1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        created_at: new Date().toISOString()
      }
    ];

    // Store default password for admin
    localStorage.setItem('user_password_admin_1', 'admin123');
    localStorage.setItem('mock_users', JSON.stringify(defaultUsers));

    return defaultUsers;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
