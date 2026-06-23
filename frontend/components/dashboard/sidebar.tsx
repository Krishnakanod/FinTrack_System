"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Expenses", href: "/expenses", icon: Receipt, comingSoon: true },
  { label: "Income", href: "/income", icon: Wallet, comingSoon: true },
  { label: "Friends", href: "/friends", icon: Users, comingSoon: true },
  { label: "Groups", href: "/groups", icon: UsersRound, comingSoon: true },
  { label: "Balances", href: "/balances", icon: Scale, comingSoon: true },
  { label: "Budget", href: "/budget", icon: Target, comingSoon: true },
  { label: "Analytics", href: "/analytics", icon: BarChart3, comingSoon: true },
  { label: "Notifications", href: "/notifications", icon: Bell, comingSoon: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-16 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
        <Link href="/dashboard" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          FinTrack
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.comingSoon) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 opacity-50 dark:text-zinc-500"
                title="Coming soon"
              >
                <Icon className="h-4 w-4" />
                {item.label}
                <span className="ml-auto text-xs">Soon</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
