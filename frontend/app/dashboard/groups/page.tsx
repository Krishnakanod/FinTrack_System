"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UsersRound,
  Plus,
  Loader2,
  Search,
  Trash2,
  X,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createGroup,
  listGroups,
  type Group,
} from "@/lib/api/groups";
import { listFriends, type FriendProfile } from "@/lib/api/friends";
import { cn } from "@/lib/utils";

interface MemberOptionProps {
  friend: FriendProfile;
  selected: boolean;
  onToggle: () => void;
}

function MemberOption({ friend, selected, onToggle }: MemberOptionProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid="friend-option"
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-800"
          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium dark:bg-zinc-800">
        {friend.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{friend.name}</p>
        <p className="truncate text-xs text-zinc-500">{friend.email}</p>
      </div>
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border",
          selected
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
            : "border-zinc-300 dark:border-zinc-700",
        )}
      >
        {selected && <span className="text-xs">✓</span>}
      </div>
    </button>
  );
}

export default function GroupsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [friendSearch, setFriendSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["groups"],
    queryFn: listGroups,
  });

  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: listFriends,
  });

  const friends = friendsData?.items ?? [];
  const groups = data?.items ?? [];

  const filteredFriends = friends.filter(
    (f) =>
      f.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
      f.email.toLowerCase().includes(friendSearch.toLowerCase()),
  );

  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      toast.success("Group created successfully");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsDialogOpen(false);
      setName("");
      setDescription("");
      setSelectedIds(new Set());
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to create group");
    },
  });

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    createGroupMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      member_ids: Array.from(selectedIds),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Groups
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your groups and shared expenses
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-group-button">
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Create a group from your friends to manage shared expenses.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Trip to Goa"
                  data-testid="group-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-description">Description</Label>
                <Textarea
                  id="group-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  data-testid="group-description-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Members</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    placeholder="Search friends..."
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    className="pl-9"
                    data-testid="member-search-input"
                  />
                </div>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                  {filteredFriends.length === 0 ? (
                    <p className="py-4 text-center text-sm text-zinc-500">
                      No friends found. Add friends first.
                    </p>
                  ) : (
                    filteredFriends.map((friend) => (
                      <MemberOption
                        key={friend.id}
                        friend={friend}
                        selected={selectedIds.has(friend.id)}
                        onToggle={() => toggleMember(friend.id)}
                      />
                    ))
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createGroupMutation.isPending || !name.trim()}
                  data-testid="submit-create-group"
                >
                  {createGroupMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Group
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-zinc-500">Failed to load groups.</p>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <UsersRound className="mb-4 h-12 w-12 text-zinc-300" />
            <p className="text-zinc-900 dark:text-zinc-50 font-medium">No groups yet</p>
            <p className="text-sm text-zinc-500">
              Create a group to start splitting expenses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="groups-list">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/dashboard/groups/${group.id}`}
              data-testid="group-card"
            >
              <Card className="h-full transition-colors hover:border-zinc-400 dark:hover:border-zinc-600">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UsersRound className="h-5 w-5" />
                    {group.name}
                  </CardTitle>
                  {group.description && (
                    <CardDescription className="line-clamp-1">
                      {group.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-500">
                    {group.members.length} members
                  </p>
                  <div className="mt-2 flex items-center text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    View details
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
