
import { createClient } from '@supabase/supabase-js';

// Import from the integrations client which has all the right configurations
import { supabase as supabaseClient } from '@/integrations/supabase/client';

// Re-export the configured client
export const supabase = supabaseClient;

// Monitor authentication state and log key events for debugging
(function monitorAuthState() {
  try {
    // Set up listener for localStorage changes to detect token changes
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      if (key.includes('supabase.auth.') || key.includes('sb-')) {
        console.log(`[Auth Monitor] LocalStorage updated: ${key}`);
      }
      originalSetItem.call(this, key, value);
    };
    
    // Check auth state periodically
    const checkAuthInterval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const expiresAt = new Date(session.expires_at * 1000);
          const now = new Date();
          const timeRemaining = (expiresAt.getTime() - now.getTime()) / 1000 / 60;
          
          if (timeRemaining < 5) {
            console.log(`[Auth Monitor] Session expires soon: ${timeRemaining.toFixed(2)} minutes remaining`);
          }
        }
      });
    }, 30000); // Check every 30 seconds
    
    // Cleanup function for single page apps
    window.addEventListener('beforeunload', () => {
      clearInterval(checkAuthInterval);
    });
  } catch (err) {
    console.error("[Auth Monitor] Failed to set up auth monitoring:", err);
  }
})();

// Create a convenience function for edge functions to create Supabase clients
export const createSupabaseClient = (url: string, key: string) => {
  return createClient(url, key);
};
