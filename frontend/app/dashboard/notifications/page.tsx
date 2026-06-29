"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle, X, Mail, Bell, Check, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification,
} from "@/lib/api/notifications";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "unread" | "read">("all");
  const [isMarkAllDialogOpen, setIsMarkAllDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load notifications
  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await listNotifications(null, 100, 0); // Get all notifications
      setNotifications(response.items);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filter
  useEffect(() => {
    if (selectedFilter === "unread") {
      setFilteredNotifications(notifications.filter(n => !n.is_read));
    } else if (selectedFilter === "read") {
      setFilteredNotifications(notifications.filter(n => n.is_read));
    } else {
      setFilteredNotifications([...notifications]);
    }
  }, [notifications, selectedFilter]);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setIsProcessing(true);
      await markNotificationAsRead(notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );

      toast.success("Notification marked as read");
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      toast.error("Failed to mark notification as read");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setIsProcessing(true);
      await markAllNotificationsAsRead();

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );

      setIsMarkAllDialogOpen(false);
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      toast.error("Failed to mark all notifications as read");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Notifications
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your alerts and messages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800">
            {(["all", "unread", "read"] as const).map(filter => (
              <button
                key={filter}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  selectedFilter === filter
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                } ${filter !== "all" ? "border-l border-zinc-200 dark:border-zinc-800" : ""}`}
                onClick={() => setSelectedFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          {selectedFilter !== "read" && notifications.some(n => !n.is_read) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMarkAllDialogOpen(true)}
              disabled={isProcessing}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-2">
                  <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                  <div className="h-3 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                </div>
                <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="h-12 w-12 text-zinc-400 mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">
              No notifications
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {selectedFilter === "read"
                ? "You don't have any read notifications yet."
                : selectedFilter === "unread"
                ? "You're all caught up! No new notifications."
                : "You don't have any notifications yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map(notification => (
            <Card
              key={notification.id}
              className={`transition-all ${
                !notification.is_read
                  ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className={`font-medium truncate ${
                          !notification.is_read
                            ? "text-blue-800 dark:text-blue-200"
                            : "text-zinc-900 dark:text-zinc-50"
                        }`}
                      >
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 line-clamp-2">
                      {notification.body}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(notification.created_at)}
                      </span>
                      <span className="capitalize">{notification.type.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {notification.is_read ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-500 italic">Read</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={isProcessing}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mark All As Read Dialog */}
      <AlertDialog open={isMarkAllDialogOpen} onOpenChange={setIsMarkAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark All Notifications as Read?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark all your unread notifications as read. You can't undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkAllAsRead}
              className="bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </div>
              ) : (
                "Mark All Read"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}