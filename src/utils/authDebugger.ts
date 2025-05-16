
/**
 * Auth Debugger Utility
 * 
 * This utility helps diagnose authentication issues by checking for common problems
 * related to Supabase authentication and providing information about the current auth state.
 */

interface AuthDebugInfo {
  tokenCount: number;
  hasValidSession: boolean;
  sessionExpiry: string | null;
  potentialTokenConflicts: boolean;
  authKeys: string[];
}

/**
 * Checks the current authentication state in localStorage and returns diagnostic information
 */
export const checkAuthState = (): AuthDebugInfo => {
  // Find all auth-related keys in localStorage
  const authKeys = Object.keys(localStorage).filter(
    key => key.startsWith('supabase.auth.') || key.includes('sb-')
  );
  
  // Try to find and parse a session token
  let sessionData = null;
  let expiryDate = null;
  
  // Look for session token
  const sessionKey = authKeys.find(key => key.includes('session'));
  if (sessionKey) {
    try {
      const sessionStr = localStorage.getItem(sessionKey);
      if (sessionStr) {
        sessionData = JSON.parse(sessionStr);
        if (sessionData.expires_at) {
          const expiryTimestamp = sessionData.expires_at * 1000; // Convert to milliseconds
          expiryDate = new Date(expiryTimestamp).toLocaleString();
        }
      }
    } catch (e) {
      console.error("Failed to parse session data:", e);
    }
  }
  
  return {
    tokenCount: authKeys.length,
    hasValidSession: !!sessionData && !!sessionData.access_token,
    sessionExpiry: expiryDate,
    potentialTokenConflicts: authKeys.length > 3,
    authKeys
  };
};

/**
 * Prints auth debugging information to console
 */
export const debugAuth = (): void => {
  const debug = checkAuthState();
  
  console.group('🔍 Auth Debugging Information');
  console.log('Token count:', debug.tokenCount);
  console.log('Has valid session:', debug.hasValidSession);
  console.log('Session expiry:', debug.sessionExpiry || 'No expiry found');
  console.log('Auth keys:', debug.authKeys);
  
  if (debug.potentialTokenConflicts) {
    console.warn('⚠️ Potential token conflicts detected. Multiple auth tokens found.');
  }
  
  console.groupEnd();
};

/**
 * Clears all auth tokens - use only for emergency auth recovery
 */
export const emergencyAuthReset = (): void => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  if (typeof sessionStorage !== 'undefined') {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  }
  
  console.log('🧹 Auth reset complete. All auth tokens have been cleared.');
};
