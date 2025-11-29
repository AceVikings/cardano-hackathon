// Re-export User type from AuthContext for convenience
export type { User } from '../context/AuthContext';

// API Error type
export interface ApiError {
  success: false;
  error: string;
  code?: string;
}
