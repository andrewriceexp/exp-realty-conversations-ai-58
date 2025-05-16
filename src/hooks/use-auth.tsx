
// Simply re-export the useAuth hook from AuthContext
export { useAuth, AuthContext, cleanupAuthState } from '@/contexts/AuthContext';
export { authChannel } from '@/integrations/supabase/client';
