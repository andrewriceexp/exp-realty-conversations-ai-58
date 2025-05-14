
import {
  LayoutDashboard,
  ListChecks,
  BarChart,
  HelpCircle,
  MessageSquare,
  Users,
  Settings
} from "lucide-react"

import { MainNavItem } from "@/types"

interface SidebarProps {
  isSuperAdmin?: boolean;
}

export function Sidebar({ isSuperAdmin }: SidebarProps) {
  let mainNav: MainNavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard size={18} />,
    },
    {
      title: "Campaigns",
      href: "/campaigns",
      icon: <ListChecks size={18} />,
    },
    {
      title: "Prospects",
      href: "/prospects",
      icon: <Users size={18} />,
    },
    {
      title: "Analytics",
      href: "/analytics",
      icon: <BarChart size={18} />,
    },
    {
      title: "Conversations",
      href: "/conversations",
      icon: <MessageSquare size={18} />,
    },
    {
      title: "Agent Config",
      href: "/agent-config",
      icon: <Settings size={18} />,
    },
    {
      title: "Help",
      href: "/help",
      icon: <HelpCircle size={18} />,
    },
  ]

  if (isSuperAdmin) {
    mainNav = [
      ...mainNav,
      {
        title: "Admin",
        href: "/admin",
        icon: <Settings size={18} />,
      },
    ]
  }

  return (
    <aside className="fixed left-0 z-30 h-screen w-64 border-r bg-background">
      <div className="flex h-full flex-col px-3 py-4">
        <div className="mb-10 flex items-center px-2">
          <img src="/logo.png" alt="eXp Realty" className="h-10" />
          <span className="ml-2 text-lg font-semibold">Voice AI</span>
        </div>
        
        <nav className="flex-1 space-y-1">
          {mainNav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              {item.icon && <span className="mr-2">{item.icon}</span>}
              {item.title}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
