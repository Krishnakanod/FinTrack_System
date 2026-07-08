"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, User, Bell, Mail, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth-store";
import { logout } from "@/lib/api/auth";
import { useConfirmModal } from "@/lib/hooks/use-confirm-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification,
} from "@/lib/api/notifications";
import { useWebSocketStore } from "@/lib/store/websocket-store";
import { formatDateIST } from "@/lib/utils/format-date";

export function Header() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const lastEvent = useWebSocketStore((s) => s.lastEvent);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const { confirm, ConfirmModal } = useConfirmModal();

  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (isFetching) return; // Prevent duplicate requests

    setIsFetching(true);
    try {
      const data = await listNotifications(null, 10, 0); // Get 10 most recent
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsFetching(false);
    }
  };

  // Initial load and refresh on dropdown open
  useEffect(() => {
    if (isDropdownOpen) {
      fetchNotifications();
    }
  }, [isDropdownOpen]);

  // Update unread count when WebSocket events occur
  useEffect(() => {
    if (lastEvent?.type === "NOTIFICATION") {
      // Refresh notifications to update unread count
      if (isDropdownOpen) {
        fetchNotifications();
      } else {
        // Just fetch the count without full list
        listNotifications(null, 1, 0)
          .then(data => setUnreadCount(data.unread_count))
          .catch(console.error);
      }
    }
  }, [lastEvent, isDropdownOpen]);

  // Handle mark as read
  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      toast.success("Notification marked as read");
    } catch (error) {
      toast.error("Failed to mark notification as read");
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markAllNotificationsAsRead();

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);

      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Failed to mark all notifications as read");
    }
  };

  async function handleLogout() {
    const confirmed = await confirm({
      title: "Log Out",
      message: "Are you sure you want to log out?",
      confirmLabel: "Log Out",
    });
    if (!confirmed) return;

    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Logout API might fail if cookie expired, but we still clear local state
    } finally {
      clearAuth();
      toast.success("Logged out successfully");
      router.push("/login");
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
      </h2>
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              ref={dropdownTriggerRef}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[0.6rem] text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-hidden">
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">Notifications</h3>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="h-7 text-xs"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
            </div>

            {isFetching ? (
              <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                <Mail className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-2" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer transition-colors ${
                      !notification.is_read
                        ? "bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                    onClick={() => !notification.is_read && handleMarkAsRead(notification.id, {} as any)}
                  >
                    <div className="flex justify-between">
                      <h4 className={`font-medium ${!notification.is_read ? 'text-blue-800 dark:text-blue-200' : 'text-zinc-900 dark:text-zinc-50'}`}>
                        {notification.title}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                        className={`h-6 w-6 p-0 ${!notification.is_read ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'}`}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className={`text-sm mt-1 ${!notification.is_read ? 'text-blue-600 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {notification.body}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                      {formatDateIST(notification.created_at, "datetime")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
            <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </div>
          <span className="hidden text-sm font-medium text-zinc-900 sm:inline dark:text-zinc-50">
            {user?.name || user?.email || "User"}
          </span>
        </div>

        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </header>
    <ConfirmModal />
    </>
  );
}
