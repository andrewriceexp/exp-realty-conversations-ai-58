
import { AuthProvider } from './AuthProvider';
import { useAuthContext } from './useAuthContext';
import { AuthContext } from './useAuthContext';
import type { AuthContextType, UserProfile } from './types';

/**
 * Primary hook to use the authentication context
 */
export const useAuth = useAuthContext;

/**
 * Export all components, hooks, and types
 */
export {
  AuthProvider,
  AuthContext,
  // Types
  type AuthContextType,
  type UserProfile
};

// For backward compatibility, export cleanupAuthState from our new location
export { cleanupAuthState } from '@/utils/authUtils';
