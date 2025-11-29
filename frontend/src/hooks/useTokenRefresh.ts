import { useEffect, useRef } from 'react';
import { getAccessToken, getRefreshToken, refreshAccessToken, clearAuthData } from '../services/api';

/**
 * Hook to automatically refresh the access token before it expires
 * Runs in the background and refreshes the token every 10 minutes
 */
export function useTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const refreshToken = async () => {
      const accessToken = getAccessToken();
      const refreshTokenValue = getRefreshToken();

      // Only refresh if we have both tokens
      if (!accessToken || !refreshTokenValue) {
        return;
      }

      try {
        const result = await refreshAccessToken(refreshTokenValue);
        
        if (result) {
          localStorage.setItem('adaflow_access_token', result.accessToken);
          localStorage.setItem('adaflow_refresh_token', result.refreshToken);
          console.log('Token refreshed successfully');
        } else {
          // Refresh failed, clear auth data
          console.log('Token refresh failed, clearing auth data');
          clearAuthData();
        }
      } catch (error) {
        console.error('Token refresh error:', error);
      }
    };

    // Refresh every 10 minutes (access token expires in 15 minutes)
    const REFRESH_INTERVAL = 10 * 60 * 1000;

    // Initial check
    const accessToken = getAccessToken();
    if (accessToken) {
      // Decode the token to check if it's close to expiring
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;

        // If token expires in less than 5 minutes, refresh now
        if (timeUntilExpiry < 5 * 60 * 1000) {
          refreshToken();
        }
      } catch {
        // Invalid token, will be handled by API calls
      }
    }

    // Set up interval for regular refresh
    intervalRef.current = setInterval(refreshToken, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}

export default useTokenRefresh;
