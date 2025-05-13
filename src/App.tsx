
import { BrowserRouter as Router, Route, Routes, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from '@/hooks/use-toast'; // Import from direct source
import { Toaster } from '@/components/ui/toaster';

import Index from './pages/Index';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProfileSetup from './pages/ProfileSetup';
import ProspectManagement from './pages/ProspectManagement';
import CampaignManagement from './pages/CampaignManagement';
import AgentConfig from './pages/AgentConfig';
import Analytics from './pages/Analytics';
import Help from './pages/Help';
import MainLayout from './components/MainLayout';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              <Route element={
                <ProtectedRoute>
                  <Outlet />
                </ProtectedRoute>
              }>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<ProfileSetup />} />
                <Route path="/prospects/*" element={<ProspectManagement />} />
                <Route path="/campaigns/*" element={<CampaignManagement />} />
                <Route path="/agent-config" element={<AgentConfig />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/help" element={<Help />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </Router>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
