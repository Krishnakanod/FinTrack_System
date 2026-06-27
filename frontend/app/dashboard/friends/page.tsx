"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserPlus, Trash2, Loader2, Users, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  searchUserByEmail,
  addFriend,
  listFriends,
  removeFriend,
  type FriendProfile,
} from "@/lib/api/friends";
import type { ApiError } from "@/lib/api/client";

// ===== Main Component =====

export default function FriendsPage() {
  const queryClient = useQueryClient();

  // Search state
  const [searchEmail, setSearchEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
  const [searchDone, setSearchDone] = useState(false);

  // Delete confirmation state
  const [deletingFriend, setDeletingFriend] = useState<FriendProfile | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch friends list
  const { data, isLoading, isError } = useQuery({
    queryKey: ["friends"],
    queryFn: listFriends,
  });

  const friends = data?.items ?? [];

  // Mutations
  const addFriendMutation = useMutation({
    mutationFn: addFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      toast.success("Friend added successfully");
      setSearchResult(null);
      setSearchDone(false);
      setSearchEmail("");
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to add friend");
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      toast.success("Friend removed");
      setIsDeleteDialogOpen(false);
      setDeletingFriend(null);
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to remove friend");
    },
  });

  // Search handler
  async function handleSearch() {
    const email = searchEmail.trim();
    if (!email) return;

    setIsSearching(true);
    setSearchDone(false);
    try {
      const result = await searchUserByEmail(email);
      setSearchResult(result ?? null);
      setSearchDone(true);
    } catch (e) {
      toast.error(
        (e as ApiError)?.message || "Search failed. Please try again.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  function handleAddFriend(friendId: string) {
    addFriendMutation.mutate(friendId);
  }

  function handleRemoveClick(friend: FriendProfile) {
    setDeletingFriend(friend);
    setIsDeleteDialogOpen(true);
  }

  function handleRemoveConfirm() {
    if (deletingFriend) {
      removeFriendMutation.mutate(deletingFriend.id);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Friends
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your friends list
          </p>
        </div>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find a Friend
          </CardTitle>
          <CardDescription>
            Search for other users by their email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="search-email" className="sr-only">
                Email
              </Label>
              <Input
                id="search-email"
                type="email"
                placeholder="friend@example.com"
                value={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.value);
                  setSearchResult(null);
                  setSearchDone(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchEmail.trim()}
            >
              {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Search
            </Button>
          </div>

          {/* Search Result */}
          {searchDone && (
            <div className="mt-4">
              {searchResult ? (
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-lg dark:bg-zinc-800">
                      {searchResult.avatar_url ? (
                        <img
                          src={searchResult.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        searchResult.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{searchResult.name}</p>
                      <p className="text-sm text-zinc-500">
                        {searchResult.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddFriend(searchResult.id)}
                    disabled={
                      addFriendMutation.isPending ||
                      friends.some((f) => f.id === searchResult.id)
                    }
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {friends.some((f) => f.id === searchResult.id)
                      ? "Already Friends"
                      : "Add Friend"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-300 py-8 text-center dark:border-zinc-700">
                  <p className="text-sm text-zinc-500">
                    No user found with that email
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Friends List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Friends
          </CardTitle>
          <CardDescription>
            {friends.length > 0
              ? `${friends.length} friend${friends.length !== 1 ? "s" : ""} in your list`
              : "You haven't added any friends yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-300 py-8 dark:border-zinc-700">
              <p className="text-sm text-zinc-500">
                Failed to load friends. Please try again.
              </p>
            </div>
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
              <UserX className="mb-2 h-8 w-8 text-zinc-400" />
              <p className="text-sm text-zinc-500">
                No friends yet. Search for someone above!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-lg font-medium dark:bg-zinc-800">
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        friend.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{friend.name}</p>
                      <p className="text-sm text-zinc-500">{friend.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveClick(friend)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                    <span className="ml-1 hidden sm:inline">Remove</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">{deletingFriend?.name}</span> from
              your friends list?
              {deletingFriend && (
                <div className="mt-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                  <p className="font-medium">{deletingFriend.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {deletingFriend.email}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingFriend(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeFriendMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}