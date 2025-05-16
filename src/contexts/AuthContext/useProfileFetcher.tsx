
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from './types';

/**
 * Hook to handle fetching user profiles with retry logic
 */
export const useProfileFetcher = () => {
  /**
   * Function to fetch a user profile by ID with retry capability
   */
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    console.log(`Fetching user profile for ID: ${userId}`);
    let retries = 0;
    const maxRetries = 2; // Try up to 3 times (initial + 2 retries)
    
    while (retries <= maxRetries) {
      try {
        console.log(`Fetching user profile for ID: ${userId} (attempt ${retries + 1})`);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error(`Error fetching user profile (attempt ${retries + 1}):`, profileError);
          retries++;
          
          if (retries <= maxRetries) {
            // Exponential backoff
            const delay = 200 * Math.pow(2, retries);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.warn(`Failed to fetch profile after ${maxRetries + 1} attempts`);
            return null;
          }
        } else {
          console.log("Profile data retrieved:", profileData ? "Found" : "Not found");
          return profileData as UserProfile;
        }
      } catch (error) {
        console.error(`Error in fetchProfile (attempt ${retries + 1}):`, error);
        retries++;
        
        if (retries <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, retries)));
        } else {
          return null;
        }
      }
    }
    
    return null;
  }, []);

  return { fetchProfile };
};
