"use client";

import { useState, useEffect } from "react";
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
  listFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  type FriendProfile,
  type FriendRequest,
} from "@/lib/api/friends";
import type { ApiError } from "@/lib/api/client";
import { useWebSocketStore } from "@/lib/store/websocket-store";

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

  // Fetch friend requests
  const { data: incomingData, isLoading: isIncomingLoading } = useQuery({
    queryKey: ["friend-requests", "incoming"],
    queryFn: () => listFriendRequests("incoming"),
  });

  const { data: outgoingData, isLoading: isOutgoingLoading } = useQuery({
    queryKey: ["friend-requests", "outgoing"],
    queryFn: () => listFriendRequests("outgoing"),
  });

  const incomingRequests = incomingData?.items ?? [];
  const outgoingRequests = outgoingData?.items ?? [];

  // Mutations
  const addFriendMutation = useMutation({
    mutationFn: addFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "outgoing"] });
      toast.success("Friend request sent!");
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

  const acceptRequestMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      toast.success("Friend request accepted");
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to accept request");
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: rejectFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      toast.success("Friend request rejected");
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to reject request");
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: cancelFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      toast.success("Friend request cancelled");
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to cancel request");
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

  // ─── Real-time sync: react to FRIEND_EVENT from any other user ───────────
  const lastEvent = useWebSocketStore((s) => s.lastEvent);
  useEffect(() => {
    if (lastEvent?.type === "FRIEND_EVENT") {
      // Invalidate all three friend query keys so both the actor
      // and the other user see changes without reloading.
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "incoming"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "outgoing"] });
    }
  }, [lastEvent, queryClient]);
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50" data-testid="friends-heading">
            Friends
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400" data-testid="friends-subtitle">
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
                data-testid="friend-search-email"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchEmail.trim()}
              data-testid="friend-search-button"
            >
              {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Search
            </Button>
          </div>

          {/* Search Result */}
          {searchDone && (
            <div className="mt-4">
              {searchResult ? (
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800" data-testid="friend-search-result">
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
                    data-testid="add-friend-button"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {friends.some((f) => f.id === searchResult.id)
                      ? "Already Friends"
                      : "Add Friend"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-300 py-8 text-center dark:border-zinc-700" data-testid="friend-not-found">
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
          <CardTitle className="flex items-center gap-2" data-testid="friends-list-title">
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
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700" data-testid="no-friends-message">
              <UserX className="mb-2 h-8 w-8 text-zinc-400" />
              <p className="text-sm text-zinc-500">
                No friends yet. Search for someone above!
              </p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="friends-list">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  data-testid="friend-row"
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
                    data-testid="remove-friend-button"
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

      {/* Incoming Friend Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="incoming-requests-title">
            <UserPlus className="h-5 w-5" />
            Incoming Requests
          </CardTitle>
          <CardDescription>
            {incomingRequests.length > 0
              ? `${incomingRequests.length} pending request${incomingRequests.length !== 1 ? "s" : ""}`
              : "No pending incoming requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isIncomingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : incomingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500">No incoming friend requests.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incomingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-lg font-medium dark:bg-zinc-800">
                      {request.sender_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{request.sender_name}</p>
                      <p className="text-sm text-zinc-500">{request.sender_email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptRequestMutation.mutate(request.id)}
                      disabled={acceptRequestMutation.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rejectRequestMutation.mutate(request.id)}
                      disabled={rejectRequestMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outgoing Friend Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="outgoing-requests-title">
            <UserPlus className="h-5 w-5" />
            Outgoing Requests
          </CardTitle>
          <CardDescription>
            {outgoingRequests.length > 0
              ? `${outgoingRequests.length} pending request${outgoingRequests.length !== 1 ? "s" : ""}`
              : "No pending outgoing requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isOutgoingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : outgoingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500">No outgoing friend requests.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {outgoingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-lg font-medium dark:bg-zinc-800">
                      {request.sender_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{request.sender_name}</p>
                      <p className="text-sm text-zinc-500">{request.sender_email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelRequestMutation.mutate(request.id)}
                    disabled={cancelRequestMutation.isPending}
                  >
                    Cancel
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
                <span className="mt-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800 block">
                  <span className="block font-medium">{deletingFriend.name}</span>
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    {deletingFriend.email}
                  </span>
                </span>
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