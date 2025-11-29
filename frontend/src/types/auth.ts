// Auth types
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
