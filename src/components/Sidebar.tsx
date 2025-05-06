
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Menu, LayoutDashboard, Users, ListChecks, BarChart2, Settings, Bot, UserCircle2, X, HelpCircle } from 'lucide-react';

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const { user, profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const initials = profile?.full_name
    ? profile.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const sidebarContent = (
    <div className={cn('h-full flex flex-col justify-between bg-slate-950', className)}>
      <div>
        <div className="py-4 flex items-center px-4">
          <h1 className="text-xl font-bold text-primary-foreground">eXp Voice AI</h1>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto text-primary-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 py-2">
          <div className="px-2 space-y-1">
            <NavItem href="/dashboard" icon={LayoutDashboard} text="Dashboard" pathname={location.pathname} />
            <NavItem href="/prospects" icon={Users} text="Prospects" pathname={location.pathname} />
            <NavItem href="/campaigns" icon={ListChecks} text="Campaigns" pathname={location.pathname} />
            <NavItem href="/agent-config" icon={Bot} text="AI Agents" pathname={location.pathname} />
            <NavItem href="/analytics" icon={BarChart2} text="Analytics" pathname={location.pathname} />
            <NavItem href="/help" icon={HelpCircle} text="Help" pathname={location.pathname} />
          </div>
        </ScrollArea>
      </div>

      <div className="py-2 px-2">
        <div className="border-t border-slate-800 pt-2">
          <NavItem href="/profile" icon={Settings} text="Settings" pathname={location.pathname} />
        </div>
        <div className="px-3 py-2">
          <ProfileMenu
            initials={initials}
            email={user?.email || ''}
            name={profile?.full_name}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className="sticky top-0 z-30 flex h-16 items-center bg-background border-b px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-slate-950 text-primary-foreground w-[250px]">
              {sidebarContent}
            </SheetContent>
          </Sheet>
          <div className="ml-4 font-medium text-lg">eXp Voice AI</div>
        </div>
      </>
    );
  }

  return <div className="hidden md:block w-[250px] h-screen bg-slate-950 text-primary-foreground border-r">{sidebarContent}</div>;
}

interface NavItemProps {
  href: string;
  icon: any;
  text: string;
  pathname: string;
}

function NavItem({ href, icon: Icon, text, pathname }: NavItemProps) {
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <Link to={href} className="block">
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-start h-10 rounded-md hover:bg-slate-800 hover:text-primary-foreground',
          isActive
            ? 'bg-slate-800 text-primary-foreground font-medium'
            : 'font-normal text-slate-300'
        )}
      >
        <Icon className="h-5 w-5 mr-2" />
        {text}
      </Button>
    </Link>
  );
}

interface ProfileMenuProps {
  initials: string;
  email: string;
  name?: string | null;
  onSignOut: () => void;
}

function ProfileMenu({ initials, email, name, onSignOut }: ProfileMenuProps) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start px-2 hover:bg-slate-800 hover:text-primary-foreground text-primary-foreground"
        >
          <div className="flex items-center">
            <Avatar className="h-7 w-7 mr-2 bg-slate-700">
              <AvatarImage src="" />
              <AvatarFallback className="bg-slate-800 text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-left truncate">
              <p className="text-sm font-medium truncate">
                {name || email}
              </p>
              {name && (
                <p className="text-xs text-slate-400 truncate">
                  {email}
                </p>
              )}
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <UserCircle2 className="h-4 w-4 mr-2" /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
