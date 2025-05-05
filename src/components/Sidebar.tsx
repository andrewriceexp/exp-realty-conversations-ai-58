
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Menu, X, Home, UserCircle, Settings, Phone, List, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const { signOut, profile } = useAuth();
  const location = useLocation();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = location.pathname === to;
    
    return (
      <Link
        to={to}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive 
            ? 'bg-exp-blue text-white' 
            : 'hover:bg-exp-blue/10 text-gray-700 hover:text-exp-blue'
        )}
      >
        <Icon className="h-5 w-5" />
        {isOpen && <span>{label}</span>}
      </Link>
    );
  };

  return (
    <div className="relative">
      {/* Mobile Menu Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 md:hidden z-50 m-2"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          'flex flex-col h-screen bg-white border-r transition-all duration-300 shadow-sm',
          isOpen ? 'w-64' : 'w-16',
          'md:relative fixed z-40'
        )}
      >
        {/* Logo and Title */}
        <div className="p-4 exp-gradient text-white flex items-center gap-3 h-16">
          {isOpen ? (
            <div className="font-bold">eXp Voice AI</div>
          ) : (
            <div className="font-bold text-center w-full">eXp</div>
          )}
        </div>

        {/* Nav Links */}
        <div className="flex flex-col gap-2 p-3 flex-grow">
          <NavItem to="/" icon={Home} label="Dashboard" />
          <NavItem to="/prospects" icon={List} label="Prospects" />
          <NavItem to="/campaigns" icon={Phone} label="Campaigns" />
          <NavItem to="/analytics" icon={BarChart3} label="Analytics" />
          <NavItem to="/profile" icon={UserCircle} label="Profile" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>

        {/* User Info */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-exp-blue text-white flex items-center justify-center">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            {isOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">
                  {profile?.full_name || 'Agent'}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {profile?.email || ''}
                </span>
              </div>
            )}
          </div>
          
          {isOpen && (
            <Button
              variant="ghost"
              className="w-full mt-3 text-gray-600 hover:text-gray-900"
              onClick={() => signOut()}
            >
              Sign Out
            </Button>
          )}
        </div>

        {/* Toggle Button (Desktop) */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-4 top-20 hidden md:flex border bg-white rounded-full shadow-sm"
          onClick={toggleSidebar}
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
