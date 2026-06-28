"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Scale,
  Loader2,
  Users,
  Search,
  ArrowRightLeft,
  ArrowDownUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { getBalances, type Balance } from "@/lib/api/balances";
import { listGroups, type Group } from "@/lib/api/groups";
import { listGroupTransactions } from "@/lib/api/groups";
import type { GroupTransaction } from "@/lib/api/groups";

interface ComputedGroupBalance {
  counterpart_id: string;
  counterpart_name: string;
  net_amount: number;
  direction: Balance["direction"];
}

function formatCurrency(amount: number): string {
  return `₹${Math.abs(amount).toFixed(2)}`;
}

function computeGroupBalances(
  userId: string,
  transactions: GroupTransaction[],
  members: Group["members"],
): ComputedGroupBalance[] {
  const netByCounterpart: Record<string, number> = {};

  for (const t of transactions) {
    const isPayer = t.paid_by === userId;
    const isSplitUser = t.splits.some((s) => s.user_id === userId);

    if (!isPayer && !isSplitUser) continue;

    if (isPayer) {
      for (const split of t.splits) {
        if (split.user_id === userId) continue;
        netByCounterpart[split.user_id] =
          (netByCounterpart[split.user_id] ?? 0) + split.amount_owed;
      }
    }

    if (isSplitUser) {
      const ownSplit = t.splits.find((s) => s.user_id === userId);
      if (ownSplit) {
        netByCounterpart[t.paid_by] =
          (netByCounterpart[t.paid_by] ?? 0) - ownSplit.amount_owed;
      }
    }
  }

  return Object.entries(netByCounterpart)
    .filter(([, net]) => net !== 0)
    .map(([counterpartId, net]) => {
      const member = members.find((m) => m.id === counterpartId);
      return {
        counterpart_id: counterpartId,
        counterpart_name: member?.name ?? "Unknown",
        net_amount: net,
        direction: (net > 0
          ? "owed_to_you"
          : "you_owe") as Balance["direction"],
      };
    });
}

export default function BalancesPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");

  const { data: balancesData, isLoading: isBalancesLoading } = useQuery({
    queryKey: ["balances"],
    queryFn: getBalances,
  });

  const { data: groupsData, isLoading: isGroupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: listGroups,
  });

  const selectedGroup = groupsData?.items.find(
    (g) => g.id === selectedGroupId,
  );

  const { data: groupTransactionsData, isLoading: isGroupTransactionsLoading } =
    useQuery({
      queryKey: ["groups", selectedGroupId, "transactions"],
      queryFn: () => listGroupTransactions(selectedGroupId),
      enabled: selectedGroupId !== "all" && !!selectedGroupId,
    });

  const displayedBalances = useMemo(() => {
    if (selectedGroupId === "all") {
      return (balancesData?.items ?? []).filter((b) =>
        b.counterpart_name
          .toLowerCase()
          .includes(friendSearch.toLowerCase()),
      );
    }

    if (!groupTransactionsData || !selectedGroup) return [];

    const computed = computeGroupBalances(
      currentUser?.id ?? "",
      groupTransactionsData.items,
      selectedGroup.members,
    );
    return computed.filter((b) =>
      b.counterpart_name.toLowerCase().includes(friendSearch.toLowerCase()),
    );
  }, [
    selectedGroupId,
    balancesData,
    groupTransactionsData,
    selectedGroup,
    friendSearch,
    currentUser?.id,
  ]);

  const youOwe = displayedBalances.filter((b) => b.direction === "you_owe");
  const owedToYou = displayedBalances.filter(
    (b) => b.direction === "owed_to_you",
  );

  const isLoading =
    isBalancesLoading || isGroupsLoading || isGroupTransactionsLoading;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Balances
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          See who owes you and whom you owe
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Filter Balances
          </CardTitle>
          <CardDescription>
            Filter by group or search for a specific friend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="group-filter">Group</Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger id="group-filter" data-testid="balance-group-filter">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {groupsData?.items.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="friend-search">Friend</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="friend-search"
                  placeholder="Search friend..."
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="pl-9"
                  data-testid="balance-friend-search"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : displayedBalances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Scale className="mb-4 h-12 w-12 text-zinc-300" />
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              No balances found
            </p>
            <p className="text-sm text-zinc-500">
              Add a group transaction to start tracking balances.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <ArrowDownUp className="h-5 w-5" />
                You owe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {youOwe.length === 0 ? (
                <p className="text-sm text-zinc-500">No debts.</p>
              ) : (
                <div className="space-y-2">
                  {youOwe.map((b) => (
                    <BalanceRow key={b.counterpart_id} balance={b} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <ArrowRightLeft className="h-5 w-5" />
                Owed to you
              </CardTitle>
            </CardHeader>
            <CardContent>
              {owedToYou.length === 0 ? (
                <p className="text-sm text-zinc-500">No one owes you.</p>
              ) : (
                <div className="space-y-2">
                  {owedToYou.map((b) => (
                    <BalanceRow key={b.counterpart_id} balance={b} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function BalanceRow({
  balance,
}: {
  balance: ComputedGroupBalance | Balance;
}) {
  const isYouOwe = balance.direction === "you_owe";
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3",
        isYouOwe
          ? "border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10"
          : "border-green-100 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10",
      )}
      data-testid="balance-row"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium dark:bg-zinc-800">
          {balance.counterpart_name.charAt(0).toUpperCase()}
        </div>
        <p className="font-medium">{balance.counterpart_name}</p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "font-bold",
            isYouOwe ? "text-red-600" : "text-green-600",
          )}
        >
          {formatCurrency(balance.net_amount)}
        </p>
        <p className="text-xs text-zinc-500">
          {isYouOwe ? "You owe" : "Owed to you"}
        </p>
      </div>
    </div>
  );
}
