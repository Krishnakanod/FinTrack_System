"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Users,
  UsersRound,
  Scale,
  Target,
  BarChart3,
  Bell,
  Settings,
  User,
  Menu,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getCookie, setCookie } from "@/lib/utils/cookies";
import { Tooltip } from "@/components/ui/tooltip";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Expenses", href: "/dashboard/expenses", icon: Receipt },
  { label: "Income", href: "/dashboard/income", icon: Wallet },
  { label: "Friends", href: "/dashboard/friends", icon: Users },
  { label: "Groups", href: "/dashboard/groups", icon: UsersRound },
  { label: "Balances", href: "/dashboard/balances", icon: Scale },
  { label: "Budget", href: "/dashboard/budget", icon: Target },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = getCookie("sidebar-collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    setCookie("sidebar-collapsed", String(next));
  };

  const handleNavClick = () => {
    setIsMobileOpen(false);
  };

  // Avoid layout shift before cookie is read
  if (!isMounted) {
    return (
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:block" />
    );
  }

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href="/dashboard"
          className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
        >
          FinTrack
        </Link>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Toggle menu"
        >
          {isMobileOpen ? (
            <X className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          ) : (
            <Menu className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          )}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex-shrink-0 border-r border-zinc-200 bg-white transition-[width] duration-300 ease-in-out lg:static dark:border-zinc-800 dark:bg-zinc-950",
          isCollapsed ? "w-16" : "w-60",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header / Toggle */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-zinc-200 dark:border-zinc-800",
            isCollapsed ? "justify-center px-2" : "justify-between px-6"
          )}
        >
          <Link
            href="/dashboard"
            className={cn(
              "overflow-hidden whitespace-nowrap text-xl font-bold text-zinc-900 transition-opacity duration-150 dark:text-zinc-50",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            FinTrack
          </Link>
          <button
            onClick={toggleCollapsed}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
            const Icon = item.icon;

            const link = (
              <Link
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isCollapsed ? "justify-center" : "justify-start",
                  isActive
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap transition-all duration-150",
                    isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );

            return isCollapsed ? (
              <Tooltip key={item.href} content={item.label}>
                {link}
              </Tooltip>
            ) : (
              <div key={item.href}>{link}</div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
