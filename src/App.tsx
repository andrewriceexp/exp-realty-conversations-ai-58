
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/toaster';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ProfileSetup from './pages/ProfileSetup';
import ProspectManagement from './pages/ProspectManagement';
import CampaignManagement from './pages/CampaignManagement';
import ConversationTesting from './pages/ConversationTesting';
import AgentConfig from './pages/AgentConfig';
import Analytics from './pages/Analytics';
import Help from './pages/Help';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import { ElevenLabsProvider } from './contexts/ElevenLabsContext';

function App() {
  return (
    <AuthProvider>
      <ElevenLabsProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
            <Route path="/prospects" element={<ProtectedRoute><ProspectManagement /></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute><CampaignManagement /></ProtectedRoute>} />
            <Route path="/conversation-testing" element={<ProtectedRoute><ConversationTesting /></ProtectedRoute>} />
            <Route path="/agent-config" element={<ProtectedRoute><AgentConfig /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
            
            {/* Fallback routes */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
          <Toaster />
        </Router>
      </ElevenLabsProvider>
    </AuthProvider>
  );
}

export default App;
