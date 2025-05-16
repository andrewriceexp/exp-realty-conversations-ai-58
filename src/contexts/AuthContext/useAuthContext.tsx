
import { useContext, createContext } from 'react';
import { AuthContextType, AuthContextDefaultValues } from './types';

// Create the context with default values
export const AuthContext = createContext<AuthContextType>(AuthContextDefaultValues);

/**
 * Custom hook to use the auth context - we're defining it here
 * for simplicity and consistency
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
};
