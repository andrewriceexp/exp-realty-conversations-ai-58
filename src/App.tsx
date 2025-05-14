
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from "./contexts/AuthContext";
import { ElevenLabsProvider } from "./contexts/ElevenLabsContext";
import { Toaster } from "@/components/ui/toaster";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ProfileSetup from "./pages/ProfileSetup";
import NotFound from "./pages/NotFound";
import AgentConfig from './pages/AgentConfig';
import CampaignManagement from './pages/CampaignManagement';
import ProspectManagement from './pages/ProspectManagement';
import Analytics from './pages/Analytics';
import Help from './pages/Help';
import ConversationTesting from './pages/ConversationTesting';
import ProtectedRoute from './components/ProtectedRoute';
import Index from './pages/Index';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ElevenLabsProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile-setup" element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
            } />
            <Route path="/agent-config" element={
              <ProtectedRoute>
                <AgentConfig />
              </ProtectedRoute>
            } />
            <Route path="/campaigns" element={
              <ProtectedRoute>
                <CampaignManagement />
              </ProtectedRoute>
            } />
            <Route path="/prospects" element={
              <ProtectedRoute>
                <ProspectManagement />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/help" element={
              <ProtectedRoute>
                <Help />
              </ProtectedRoute>
            } />
            <Route path="/conversations" element={
              <ProtectedRoute>
                <ConversationTesting />
              </ProtectedRoute>
            } />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" />} />
          </Routes>
          <Toaster />
        </ElevenLabsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
