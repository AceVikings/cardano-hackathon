import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useWallet } from "@meshsdk/react";
import {
  type User,
  requestNonce,
  verifySignature,
  logout as apiLogout,
  initializeAuth,
  getStoredUser,
  clearAuthData,
  getCurrentUser,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
} from "../services/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: (logoutAll?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { wallet, connected, disconnect } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const storedUser = await initializeAuth();
        setUser(storedUser);
      } catch (err) {
        console.error("Auth initialization error:", err);
        clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Token refresh interval
  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      const accessToken = getAccessToken();
      const refreshTokenValue = getRefreshToken();

      if (!accessToken || !refreshTokenValue) return;

      try {
        // Decode the token to check if it's close to expiring
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        const expiresAt = payload.exp * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;

        // If token expires in less than 5 minutes, refresh now
        if (timeUntilExpiry < 5 * 60 * 1000) {
          const result = await refreshAccessToken(refreshTokenValue);
          if (result) {
            localStorage.setItem("adaflow_access_token", result.accessToken);
            localStorage.setItem("adaflow_refresh_token", result.refreshToken);
          } else {
            // Refresh failed
            setUser(null);
            clearAuthData();
          }
        }
      } catch {
        // Token parsing failed, will be handled by API calls
      }
    };

    // Check immediately
    refreshToken();

    // Then check every 4 minutes
    const interval = setInterval(refreshToken, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  // Handle wallet disconnection
  useEffect(() => {
    if (!connected && user) {
      // Wallet disconnected but user still logged in
      // You might want to keep the session or force logout
      // For now, we'll keep the session
    }
  }, [connected, user]);

  const login = useCallback(async () => {
    if (!wallet || !connected) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get wallet address
      const addresses = await wallet.getUsedAddresses();
      if (addresses.length === 0) {
        throw new Error("No addresses found in wallet");
      }
      const walletAddress = addresses[0];

      // Request nonce from backend
      const nonceResponse = await requestNonce(walletAddress);
      const { nonce } = nonceResponse;

      // Sign the nonce with wallet
      // signData expects (payload, address) or depending on wallet implementation
      const signatureResult = await wallet.signData(nonce, walletAddress);

      if (!signatureResult) {
        throw new Error("Signature rejected");
      }

      // Extract signature and key
      const { signature, key } = signatureResult;

      // Verify signature with backend and get tokens
      const authResponse = await verifySignature(walletAddress, signature, key);

      setUser(authResponse.user);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || err.error || "Authentication failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, connected]);

  const logout = useCallback(
    async (logoutAll = false) => {
      setIsLoading(true);
      try {
        await apiLogout(logoutAll);
        setUser(null);
        disconnect();
      } catch (err) {
        console.error("Logout error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [disconnect]
  );

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      console.error("Refresh user error:", err);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
