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

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.name ?? "");

  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [editedUpi, setEditedUpi] = useState(user?.upi_id ?? "");

  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [editedAvatar, setEditedAvatar] = useState(user?.avatar_url ?? "");

  const updateMutation = useMutation({
    mutationFn: (data: { username?: string; name?: string; upi_id?: string; avatar_url?: string }) => updateProfile(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (accessToken) {
        setAuth(accessToken, {
          id: data.id,
          email: data.email,
          username: data.username,
          name: data.name,
          avatar_url: data.avatar_url,
          upi_id: data.upi_id,
        });
      }
      toast.success("Profile updated");
      setIsEditingUsername(false);
      setIsEditingName(false);
      setIsEditingUpi(false);
      setIsEditingAvatar(false);
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  function handleSaveUsername() {
    const trimmed = editedUsername.trim();
    if (!trimmed) {
      toast.error("Username cannot be empty");
      return;
    }
    if (trimmed === user?.username) {
      setIsEditingUsername(false);
      return;
    }
    updateMutation.mutate({ username: trimmed });
  }

  function handleSaveName() {
    const trimmed = editedName.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    if (trimmed === user?.name) {
      setIsEditingName(false);
      return;
    }
    updateMutation.mutate({ name: trimmed });
  }

  function handleSaveUpi() {
    const trimmed = editedUpi.trim();
    if (trimmed === (user?.upi_id ?? "")) {
      setIsEditingUpi(false);
      return;
    }
    updateMutation.mutate({ upi_id: trimmed });
  }

  function handleSaveAvatar() {
    const trimmed = editedAvatar.trim();
    if (trimmed === (user?.avatar_url ?? "")) {
      setIsEditingAvatar(false);
      return;
    }
    updateMutation.mutate({ avatar_url: trimmed });
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
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-2xl font-medium dark:bg-zinc-800 overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                user?.name.charAt(0).toUpperCase()
              )}
            </div>
            {isEditingAvatar ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editedAvatar}
                  onChange={(e) => setEditedAvatar(e.target.value)}
                  placeholder="Enter avatar URL"
                  className="max-w-sm"
                />
                <Button size="sm" onClick={handleSaveAvatar} disabled={updateMutation.isPending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingAvatar(false);
                    setEditedAvatar(user?.avatar_url ?? "");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditingAvatar(true)}>
                Change Avatar
              </Button>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Name
            </p>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter name"
                  className="max-w-sm"
                />
                <Button size="sm" onClick={handleSaveName} disabled={updateMutation.isPending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingName(false);
                    setEditedName(user?.name ?? "");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {user?.name ?? "—"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingName(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
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
                <Button size="sm" onClick={handleSaveUsername} disabled={updateMutation.isPending}>
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

          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              UPI ID
            </p>
            {isEditingUpi ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedUpi}
                  onChange={(e) => setEditedUpi(e.target.value)}
                  placeholder="Enter UPI ID (e.g. name@okbank)"
                  className="max-w-sm"
                />
                <Button size="sm" onClick={handleSaveUpi} disabled={updateMutation.isPending}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingUpi(false);
                    setEditedUpi(user?.upi_id ?? "");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {user?.upi_id ?? "—"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingUpi(true)}
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
