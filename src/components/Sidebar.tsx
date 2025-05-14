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

interface DocsConfig {
  mainNav: MainNavItem[]
}

export function Sidebar({ isSuperAdmin }: SidebarProps): DocsConfig {
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

  return {
    mainNav,
  }
}
