
import { useContext } from 'react';
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Add cross-tab authentication sync functionality
export { authChannel } from '@/integrations/supabase/client';
