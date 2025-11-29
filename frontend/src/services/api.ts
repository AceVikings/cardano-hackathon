const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'adaflow_access_token';
const REFRESH_TOKEN_KEY = 'adaflow_refresh_token';
const USER_KEY = 'adaflow_user';

// Types - must be defined before use
export interface User {
  id: string;
  walletAddress: string;
  stakeAddress?: string;
  profile?: {
    displayName?: string;
    avatar?: string;
  };
  settings?: {
    notifications?: boolean;
    twoFactorEnabled?: boolean;
  };
  lastLogin?: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface NonceResponse {
  success: boolean;
  nonce: string;
}

export interface RefreshResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Get stored user
 */
export function getStoredUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Store tokens and user
 */
export function storeAuthData(accessToken: string, refreshToken: string, user: User): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Clear all auth data
 */
export function clearAuthData(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Update stored user
 */
export function updateStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Token refresh state (to prevent multiple simultaneous refreshes)
let isRefreshing = false;
let refreshPromise: Promise<RefreshResponse | null> | null = null;

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const accessToken = getAccessToken();
  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 (unauthorized) - try to refresh token
  if (response.status === 401 && accessToken) {
    const refreshed = await tryRefreshToken();
    
    if (refreshed) {
      // Retry original request with new token
      const newAccessToken = getAccessToken();
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;
      
      const retryResponse = await fetch(url, {
        ...options,
        headers,
      });
      
      if (!retryResponse.ok) {
        const error = await retryResponse.json();
        throw error;
      }
      
      return retryResponse.json();
    } else {
      // Refresh failed, clear auth data
      clearAuthData();
      throw { success: false, error: 'Session expired', code: 'SESSION_EXPIRED' };
    }
  }

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
}

/**
 * Try to refresh the access token
 */
async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    return false;
  }

  // Prevent multiple simultaneous refresh requests
  if (isRefreshing) {
    const result = await refreshPromise;
    return result !== null;
  }

  isRefreshing = true;
  refreshPromise = refreshAccessToken(refreshToken);
  
  try {
    const result = await refreshPromise;
    
    if (result) {
      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
      return true;
    }
    
    return false;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

/**
 * Request a nonce for wallet signature
 */
export async function requestNonce(walletAddress: string): Promise<NonceResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/nonce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
}

/**
 * Verify wallet signature and get tokens
 */
export async function verifySignature(
  walletAddress: string,
  signature: string,
  key: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress, signature, key }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  const data: AuthResponse = await response.json();
  
  // Store auth data
  storeAuthData(data.accessToken, data.refreshToken, data.user);
  
  return data;
}

/**
 * Refresh the access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

/**
 * Logout (revoke refresh token)
 */
export async function logout(logoutAll = false): Promise<void> {
  const refreshToken = getRefreshToken();
  
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken, logoutAll }),
    });
  } catch {
    // Ignore logout errors
  } finally {
    clearAuthData();
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiRequest<{ success: boolean; user: User }>('/auth/me');
  updateStoredUser(response.user);
  return response.user;
}

/**
 * Update user profile
 */
export async function updateProfile(data: { displayName?: string; avatar?: string }): Promise<{ displayName?: string; avatar?: string }> {
  const response = await apiRequest<{ success: boolean; profile: { displayName?: string; avatar?: string } }>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  
  // Update stored user
  const user = getStoredUser();
  if (user) {
    user.profile = response.profile;
    updateStoredUser(user);
  }
  
  return response.profile;
}

/**
 * Get active sessions
 */
export async function getSessions(): Promise<{ createdAt: string; expiresAt: string; userAgent: string }[]> {
  const response = await apiRequest<{ success: boolean; sessions: { createdAt: string; expiresAt: string; userAgent: string }[] }>('/auth/sessions');
  return response.sessions;
}

// ============================================================================
// Custodial Wallet API
// ============================================================================

export interface CustodialWalletStatus {
  initialized: boolean;
  scriptAddress: string;
  ownerPkh: string | null;
  approvedAgents: Array<{
    pkh: string;
    name: string;
    addedAt: string;
  }>;
  lastKnownBalance: {
    lovelace: string;
    tokens: Array<{ unit: string; quantity: string }>;
  };
  lastBalanceCheck: string | null;
}

/**
 * Get custodial wallet status
 */
export async function getWalletStatus(): Promise<CustodialWalletStatus> {
  const response = await apiRequest<{ success: boolean; wallet: CustodialWalletStatus }>('/wallet/status');
  return response.wallet;
}

/**
 * Initialize custodial wallet
 */
export async function initializeWallet(ownerPkh: string): Promise<CustodialWalletStatus> {
  const response = await apiRequest<{ success: boolean; wallet: CustodialWalletStatus }>('/wallet/initialize', {
    method: 'POST',
    body: JSON.stringify({ ownerPkh }),
  });
  return response.wallet;
}

/**
 * Add an approved agent
 */
export async function addAgent(agentPkh: string, agentName: string): Promise<Array<{ pkh: string; name: string; addedAt: string }>> {
  const response = await apiRequest<{ success: boolean; approvedAgents: Array<{ pkh: string; name: string; addedAt: string }> }>('/wallet/add-agent', {
    method: 'POST',
    body: JSON.stringify({ agentPkh, agentName }),
  });
  return response.approvedAgents;
}

/**
 * Remove an approved agent
 */
export async function removeAgent(agentPkh: string): Promise<Array<{ pkh: string; name: string; addedAt: string }>> {
  const response = await apiRequest<{ success: boolean; approvedAgents: Array<{ pkh: string; name: string; addedAt: string }> }>(`/wallet/remove-agent/${agentPkh}`, {
    method: 'DELETE',
  });
  return response.approvedAgents;
}

/**
 * Update cached balance
 */
export async function updateWalletBalance(lovelace: string, tokens: Array<{ unit: string; quantity: string }>): Promise<void> {
  await apiRequest('/wallet/update-balance', {
    method: 'POST',
    body: JSON.stringify({ lovelace, tokens }),
  });
}

/**
 * Initialize auth - check if we have valid tokens
 */
export async function initializeAuth(): Promise<User | null> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const storedUser = getStoredUser();
  
  if (!accessToken || !refreshToken) {
    clearAuthData();
    return null;
  }

  try {
    // Try to get current user to validate token
    const user = await getCurrentUser();
    return user;
  } catch (error: any) {
    // If token is expired, try to refresh
    if (error.code === 'INVALID_TOKEN' || error.code === 'SESSION_EXPIRED') {
      clearAuthData();
    }
    return storedUser; // Return cached user if available
  }
}

export { apiRequest };
