"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Pencil, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/lib/store/auth-store";
import { updateProfile, getProfile } from "@/lib/api/users";
import type { ApiError } from "@/lib/api/client";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState(user?.username ?? "");

  const updateMutation = useMutation({
    mutationFn: (username: string) => updateProfile({ username }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (accessToken) {
        setAuth(accessToken, {
          id: data.id,
          email: data.email,
          username: data.username,
          name: data.name,
          avatar_url: data.avatar_url,
        });
      }
      toast.success("Username updated");
      setIsEditingUsername(false);
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to update username");
    },
  });

  function handleSave() {
    const trimmed = editedUsername.trim();
    if (!trimmed) {
      toast.error("Username cannot be empty");
      return;
    }
    if (trimmed === user?.username) {
      setIsEditingUsername(false);
      return;
    }
    updateMutation.mutate(trimmed);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Profile
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your account details
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Overview of your FinTrack profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Name
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {user?.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Email
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {user?.email ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Username
            </p>
            {isEditingUsername ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedUsername}
                  onChange={(e) => setEditedUsername(e.target.value)}
                  placeholder="Enter username"
                  className="max-w-sm"
                />
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingUsername(false);
                    setEditedUsername(user?.username ?? "");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {user?.username ?? "—"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingUsername(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
