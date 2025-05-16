
/**
 * Authentication utility functions
 * Helper functions for managing auth state and cleanup operations
 */

/**
 * Clean up authentication state in localStorage and sessionStorage
 * @param forceFullCleanup Whether to perform an aggressive cleanup (true) or a more targeted cleanup (false)
 */
export const cleanupAuthState = (forceFullCleanup = false): void => {
  // Only perform aggressive cleanup when forced (on logout or explicit cleanup)
  if (forceFullCleanup) {
    // Log the cleanup for debugging
    console.log('Performing full auth state cleanup');
    
    // Remove all Supabase auth keys from localStorage - directly
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        console.log(`Removing auth key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Clean sessionStorage as well if used
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } else {
    // For non-forced cleanups, just do a sanity check without removing valid tokens
    const authKeyCount = Object.keys(localStorage).filter(key => 
      key.startsWith('supabase.auth.') || key.includes('sb-')
    ).length;
    
    if (authKeyCount > 3) {
      console.warn(`Found ${authKeyCount} auth keys - possible token conflict`);
    }
  }
};
