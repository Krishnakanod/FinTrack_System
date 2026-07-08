"""Groups module — Business logic services.

Locked conventions per Spec-07:
- Bidirectional Balance documents updated on every transaction
- Equal splits computed server-side with deterministic paise remainder
- Custom splits validated to sum to total within 1 paisa
- Stored `splits` array excludes the payer
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from beanie import PydanticObjectId
from bson.decimal128 import Decimal128

from modules.auth.models import User
from modules.groups.models import Group, GroupTransaction, Balance
from modules.groups.schemas import (
    GroupCreate,
    GroupUpdate,
    GroupTransactionCreate,
    AddMemberRequest,
    MemberProfile,
    GroupResponse,
    GroupTransactionResponse,
    SplitResponse,
    BalanceResponse,
    BalanceListResponse,
    CustomSplitEntry,
)
from modules.notifications.service import create_notification
from modules.websocket.manager import connection_manager


# ===== Helpers =====

async def _get_user_public_info(user_id: str) -> MemberProfile | None:
    """Fetch public profile for a user, or None if not found."""
    try:
        user = await User.get(PydanticObjectId(user_id))
    except Exception:
        return None
    if not user:
        return None
    return MemberProfile(
        id=str(user.id),
        name=user.name,
        email=user.email,
        avatar_url=user.avatar_url,
        upi_id=user.upi_id,
    )


async def _member_profiles_from_ids(user_ids: list[str]) -> list[MemberProfile]:
    """Return populated MemberProfile list for a list of user_ids."""
    profiles = []
    for uid in user_ids:
        profile = await _get_user_public_info(uid)
        if profile:
            profiles.append(profile)
    return profiles


def _make_member_profile(user: User) -> MemberProfile:
    return MemberProfile(
        id=str(user.id),
        name=user.name,
        email=user.email,
        avatar_url=user.avatar_url,
        upi_id=user.upi_id,
    )


async def _make_group_response(group: Group) -> GroupResponse:
    # members are stored as IDs; need to populate asynchronously by caller
    creator = await _get_user_public_info(group.created_by)
    return GroupResponse(
        id=str(group.id),
        name=group.name,
        description=group.description,
        created_by=group.created_by,
        created_by_name=creator.name if creator else "Unknown",
        members=[],  # populated by caller
        created_at=group.created_at.isoformat(),
    )


def _make_transaction_response(transaction: GroupTransaction) -> GroupTransactionResponse:
    return GroupTransactionResponse(
        id=str(transaction.id),
        group_id=transaction.group_id,
        description=transaction.description,
        total_amount=transaction.total_amount,
        paid_by=transaction.paid_by,
        split_type=transaction.split_type,
        splits=[
            SplitResponse(
                user_id=s.user_id,
                amount_owed=s.amount_owed,
                is_settled=s.is_settled,
            )
            for s in transaction.splits
        ],
        date=transaction.date,
        created_by=transaction.created_by,
        created_at=transaction.created_at.isoformat(),
    )


# ===== Equal-Split Algorithm (Locked per Spec-07 §1.4, revised by Pre-Sprint-10) =====

def _compute_equal_splits(total_amount: Decimal, split_among: list[str], paid_by: str) -> list[SplitResponse]:
    """Compute equal split shares for ALL participants, including the payer.

    The total is divided equally among every member in `split_among` (including the
    payer). The payer's own share is stored in the transaction record but skipped
    when updating balances. Remainder paise are distributed 1 at a time to the
    first N members in the original `split_among` order.
    """
    n = len(split_among)
    total_paise = int((total_amount * 100).to_integral_value())
    base_paise = total_paise // n
    remainder_paise = total_paise % n

    splits: list[SplitResponse] = []
    for idx, user_id in enumerate(split_among):
        share_paise = base_paise + (1 if idx < remainder_paise else 0)
        amount = Decimal(share_paise) / Decimal("100")
        splits.append(SplitResponse(user_id=user_id, amount_owed=amount, is_settled=False))

    return splits


# ===== Group CRUD =====

async def create_group(user_id: str, data: GroupCreate) -> GroupResponse:
    """Create a group. Creator is auto-added to members."""
    member_ids = list(dict.fromkeys(data.member_ids))  # preserve order, remove dups
    if user_id not in member_ids:
        member_ids.insert(0, user_id)
    else:
        # Ensure creator is first while preserving order
        member_ids.remove(user_id)
        member_ids.insert(0, user_id)

    now = datetime.now(timezone.utc)
    group = Group(
        name=data.name,
        description=data.description or None,
        created_by=user_id,
        members=member_ids,
        created_at=now,
    )
    await group.insert()

    response = await _make_group_response(group)
    response.members = await _member_profiles_from_ids(member_ids)
    return response


async def get_group(user_id: str, group_id: str) -> GroupResponse:
    """Get a single group. Raises ValueError(NOT_A_MEMBER) if user is not a member."""
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")

    response = await _make_group_response(group)
    response.members = await _member_profiles_from_ids(group.members)
    return response


async def list_groups(user_id: str) -> list[GroupResponse]:
    """List all groups where the user is a member."""
    groups = await Group.find({"members": user_id}).to_list()
    responses = []
    for group in groups:
        response = await _make_group_response(group)
        response.members = await _member_profiles_from_ids(group.members)
        responses.append(response)
    return responses


async def update_group(user_id: str, group_id: str, data: GroupUpdate) -> GroupResponse:
    """Update group name/description. Only the creator can change the name."""
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")

    old_name = group.name
    name_changed = False

    if data.name is not None:
        if group.created_by != user_id:
            raise ValueError("NOT_AUTHORIZED")
        name = data.name.strip()
        if len(name) < 3 or len(name) > 50:
            raise ValueError("INVALID_NAME_LENGTH")
        group.name = name
        name_changed = True
    if data.description is not None:
        group.description = data.description or None

    await group.save()

    if name_changed:
        actor = await _get_user_public_info(user_id)
        for member_id in group.members:
            if member_id == user_id:
                continue
            await create_notification(
                user_id=member_id,
                type="group_transaction",
                title="Group Renamed",
                body=f"{actor.name if actor else 'Someone'} renamed the group to '{group.name}'",
                metadata={"group_id": group_id},
                category="groups",
            )

    response = await _make_group_response(group)
    response.members = await _member_profiles_from_ids(group.members)
    return response


async def add_member(user_id: str, group_id: str, data: AddMemberRequest) -> GroupResponse:
    """Add a new member to a group. Only the creator can add members."""
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")
    if group.created_by != user_id:
        raise ValueError("NOT_AUTHORIZED")

    new_member_id = data.user_id
    if new_member_id in group.members:
        raise ValueError("ALREADY_MEMBER")

    # New member must be a friend of the requesting user
    from modules.users.models import Friendship
    is_friend = await Friendship.find_one({
        "$or": [
            {"requester_id": user_id, "addressee_id": new_member_id},
            {"requester_id": new_member_id, "addressee_id": user_id},
        ],
        "status": "accepted",
    })
    if not is_friend:
        raise ValueError("NOT_FRIEND")

    group.members.append(new_member_id)
    await group.save()

    response = await _make_group_response(group)
    response.members = await _member_profiles_from_ids(group.members)
    return response


async def remove_member(user_id: str, group_id: str, member_id: str) -> None:
    """Remove a member from a group. Does not alter history."""
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")

    # Prevent removing the last member? Spec is silent; keep it permissive.
    if member_id in group.members:
        group.members.remove(member_id)
        await group.save()


async def delete_group(user_id: str, group_id: str) -> None:
    """Delete a group. Only the creator can delete."""
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")
    if group.created_by != user_id:
        raise ValueError("NOT_AUTHORIZED")

    await group.delete()


async def exit_group(user_id: str, group_id: str) -> None:
    """Exit a group. Blocked if the member has a non-zero net balance in the group.
    The creator cannot exit; they must delete the group instead.
    """
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")
    if group.created_by == user_id:
        raise ValueError("CREATOR_CANNOT_EXIT")

    # Check whether this user has any unsettled splits in THIS group's transactions.
    # We use group transactions as the source of truth rather than the global Balance
    # collection, which is cross-group and had a bug where user_id was included in
    # its own counterpart_id $in filter.
    group_transactions = await GroupTransaction.find(
        {"group_id": group_id}
    ).to_list()

    unsettled_owed_by_user = Decimal("0")   # user owes others (unsettled splits where user is debtor)
    unsettled_owed_to_user = Decimal("0")   # others owe user (unsettled splits where user paid)

    for txn in group_transactions:
        for split in txn.splits:
            if split.is_settled:
                continue
            if split.user_id == user_id and txn.paid_by != user_id:
                # User owes the payer
                unsettled_owed_by_user += split.amount_owed
            elif split.user_id != user_id and txn.paid_by == user_id:
                # Someone else owes the user
                unsettled_owed_to_user += split.amount_owed

    has_unsettled = unsettled_owed_by_user != Decimal("0") or unsettled_owed_to_user != Decimal("0")
    if has_unsettled:
        raise ValueError("BALANCE_NOT_ZERO")

    group.members.remove(user_id)
    await group.save()

    # Notify remaining members so their group detail page updates in real-time.
    # Also notify the exiting user so their groups list refreshes.
    await connection_manager.broadcast(
        group.members + [user_id],
        {
            "type": "GROUP_EVENT",
            "payload": {
                "action": "member_exited",
                "group_id": group_id,
                "actor_id": user_id,
            },
        },
    )


# ===== Group Transactions =====

async def add_transaction(
    user_id: str,
    group_id: str,
    data: GroupTransactionCreate,
    actor_name: str,
) -> GroupTransactionResponse:
    """Add a transaction to a group and update balances/notifications.

    Locked per Spec-07 §1.2, §1.3, §1.4, §1.5, §1.7.
    """
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")

    # Validate paid_by is a member
    if data.paid_by not in group.members:
        raise ValueError("PAID_BY_NOT_MEMBER")

    total_amount = data.amount

    # Determine stored splits based on split_type
    if data.split_type == "equal":
        if not data.split_among or len(data.split_among) == 0:
            raise ValueError("SPLIT_AMONG_EMPTY")
        # All split_among users must be members
        invalid = set(data.split_among) - set(group.members)
        if invalid:
            raise ValueError("INVALID_SPLIT_USER")
        stored_splits = _compute_equal_splits(total_amount, data.split_among, data.paid_by)
    else:
        # Custom split: validate provided splits sum to total
        if not data.splits:
            raise ValueError("SPLITS_EMPTY")

        seen = set()
        for entry in data.splits:
            if entry.user_id in seen:
                raise ValueError("DUPLICATE_SPLIT_USER")
            seen.add(entry.user_id)
            if entry.user_id not in group.members:
                raise ValueError("INVALID_SPLIT_USER")

        provided_sum = sum(entry.amount_owed for entry in data.splits)
        if abs(provided_sum - total_amount) > Decimal("0.01"):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "SPLIT_MISMATCH",
                    "message": "Split amounts must sum to the total amount.",
                    "details": {
                        "expected": float(total_amount),
                        "received": float(provided_sum),
                    },
                },
            )

        stored_splits = [
            SplitResponse(user_id=entry.user_id, amount_owed=entry.amount_owed, is_settled=False)
            for entry in data.splits
        ]

    now = datetime.now(timezone.utc)
    transaction = GroupTransaction(
        group_id=group_id,
        description=data.description,
        total_amount=total_amount,
        paid_by=data.paid_by,
        split_type=data.split_type,
        splits=[
            {"user_id": s.user_id, "amount_owed": s.amount_owed, "is_settled": s.is_settled}
            for s in stored_splits
        ],
        date=datetime.combine(data.date, datetime.min.time()).replace(tzinfo=timezone.utc),
        created_by=user_id,
        created_at=now,
    )
    await transaction.insert()

    # Update balances (bidirectional)
    await _update_balances_for_transaction(transaction)

    # Notification fan-out to affected members except actor
    affected_user_ids = {data.paid_by} | {s.user_id for s in stored_splits}
    for member_id in affected_user_ids:
        if member_id == user_id:
            continue
        await create_notification(
            user_id=member_id,
            type="group_transaction",
            title=f"New expense in {group.name}",
            body=f"{actor_name} added ₹{float(total_amount)} — {data.description}",
            metadata={"group_id": group_id, "transaction_id": str(transaction.id)},
            category="groups",
        )

    # Broadcast a dedicated GROUP_TRANSACTION event for real-time UI refresh.
    # Spec-07 §1.7 says create_notification handles the notification broadcast;
    # the additional event below is so group-detail pages can invalidate their
    # transaction/balance queries without relying on parsing notification text.
    await connection_manager.broadcast(
        user_ids=list(affected_user_ids - {user_id}),
        event={
            "type": "GROUP_TRANSACTION",
            "payload": {
                "group_id": group_id,
                "transaction_id": str(transaction.id),
                "description": data.description,
                "amount": float(total_amount),
                "actor_name": actor_name,
            },
        },
    )

    return _make_transaction_response(transaction)


async def _update_balances_for_transaction(transaction: GroupTransaction) -> None:
    """Update bidirectional Balance documents for a transaction."""
    paid_by = transaction.paid_by
    updated_at = datetime.now(timezone.utc)
    balance_collection = Balance.get_motor_collection()

    for split in transaction.splits:
        debtor_id = split.user_id
        # A person cannot owe themselves; skip self-balance records.
        if debtor_id == paid_by:
            continue
        amount = split.amount_owed
        amount_128 = Decimal128(amount)
        neg_amount_128 = Decimal128(-amount)

        # debtor owes payer
        await balance_collection.update_one(
            {"user_id": debtor_id, "counterpart_id": paid_by},
            {
                "$inc": {"net_amount": amount_128},
                "$set": {"updated_at": updated_at},
            },
            upsert=True,
        )

        # payer is owed by debtor
        await balance_collection.update_one(
            {"user_id": paid_by, "counterpart_id": debtor_id},
            {
                "$inc": {"net_amount": neg_amount_128},
                "$set": {"updated_at": updated_at},
            },
            upsert=True,
        )


async def _reverse_balances_for_transaction(transaction: GroupTransaction) -> None:
    """Reverse the balance effects of a transaction (used for edit/delete)."""
    paid_by = transaction.paid_by
    updated_at = datetime.now(timezone.utc)
    balance_collection = Balance.get_motor_collection()

    for split in transaction.splits:
        debtor_id = split.user_id
        if debtor_id == paid_by:
            continue
        amount = split.amount_owed
        amount_128 = Decimal128(amount)
        neg_amount_128 = Decimal128(-amount)

        # Reverse debtor owes payer
        await balance_collection.update_one(
            {"user_id": debtor_id, "counterpart_id": paid_by},
            {
                "$inc": {"net_amount": neg_amount_128},
                "$set": {"updated_at": updated_at},
            },
            upsert=True,
        )

        # Reverse payer is owed by debtor
        await balance_collection.update_one(
            {"user_id": paid_by, "counterpart_id": debtor_id},
            {
                "$inc": {"net_amount": amount_128},
                "$set": {"updated_at": updated_at},
            },
            upsert=True,
        )


async def delete_group_transaction(
    user_id: str,
    group_id: str,
    transaction_id: str,
    actor_name: str,
) -> None:
    """Delete a group transaction and reverse its balance effects."""
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")

    try:
        transaction = await GroupTransaction.get(PydanticObjectId(transaction_id))
    except Exception:
        transaction = None

    if not transaction or transaction.group_id != group_id:
        raise ValueError("NOT_FOUND")

    if transaction.paid_by != user_id:
        raise ValueError("NOT_AUTHORIZED")

    # Reverse balances
    await _reverse_balances_for_transaction(transaction)

    description = transaction.description
    await transaction.delete()

    # Notify members
    affected_user_ids = {transaction.paid_by} | {s.user_id for s in transaction.splits}
    for member_id in affected_user_ids:
        if member_id == user_id:
            continue
        await create_notification(
            user_id=member_id,
            type="group_transaction",
            title=f"Transaction deleted in {group.name}",
            body=f"{actor_name} deleted a transaction: {description}",
            metadata={"group_id": group_id, "transaction_id": transaction_id},
            category="groups",
        )


async def update_group_transaction(
    user_id: str,
    group_id: str,
    transaction_id: str,
    data: GroupTransactionCreate,
    actor_name: str,
) -> GroupTransactionResponse:
    """Update a group transaction and recalculate balances."""
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")

    try:
        transaction = await GroupTransaction.get(PydanticObjectId(transaction_id))
    except Exception:
        transaction = None

    if not transaction or transaction.group_id != group_id:
        raise ValueError("NOT_FOUND")

    if transaction.paid_by != user_id:
        raise ValueError("NOT_AUTHORIZED")

    # Validate paid_by is a member
    if data.paid_by not in group.members:
        raise ValueError("PAID_BY_NOT_MEMBER")

    total_amount = data.amount

    # Determine stored splits based on split_type
    if data.split_type == "equal":
        if not data.split_among or len(data.split_among) == 0:
            raise ValueError("SPLIT_AMONG_EMPTY")
        invalid = set(data.split_among) - set(group.members)
        if invalid:
            raise ValueError("INVALID_SPLIT_USER")
        stored_splits = _compute_equal_splits(total_amount, data.split_among, data.paid_by)
    else:
        if not data.splits:
            raise ValueError("SPLITS_EMPTY")
        seen = set()
        for entry in data.splits:
            if entry.user_id in seen:
                raise ValueError("DUPLICATE_SPLIT_USER")
            seen.add(entry.user_id)
            if entry.user_id not in group.members:
                raise ValueError("INVALID_SPLIT_USER")
        provided_sum = sum(entry.amount_owed for entry in data.splits)
        if abs(provided_sum - total_amount) > Decimal("0.01"):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "SPLIT_MISMATCH",
                    "message": "Split amounts must sum to the total amount.",
                    "details": {
                        "expected": float(total_amount),
                        "received": float(provided_sum),
                    },
                },
            )
        stored_splits = [
            SplitResponse(user_id=entry.user_id, amount_owed=entry.amount_owed, is_settled=False)
            for entry in data.splits
        ]

    # Reverse old balances
    await _reverse_balances_for_transaction(transaction)

    # Update transaction
    transaction.description = data.description
    transaction.total_amount = total_amount
    transaction.paid_by = data.paid_by
    transaction.split_type = data.split_type
    transaction.splits = [
        {"user_id": s.user_id, "amount_owed": s.amount_owed, "is_settled": s.is_settled}
        for s in stored_splits
    ]
    transaction.date = datetime.combine(data.date, datetime.min.time()).replace(tzinfo=timezone.utc)
    await transaction.save()

    # Apply new balances
    await _update_balances_for_transaction(transaction)

    # Notify members
    affected_user_ids = {data.paid_by} | {s.user_id for s in stored_splits}
    for member_id in affected_user_ids:
        if member_id == user_id:
            continue
        await create_notification(
            user_id=member_id,
            type="group_transaction",
            title=f"Transaction updated in {group.name}",
            body=f"{actor_name} updated a transaction: {data.description}",
            metadata={"group_id": group_id, "transaction_id": str(transaction.id)},
            category="groups",
        )

    return _make_transaction_response(transaction)


async def list_group_transactions(user_id: str, group_id: str) -> list[GroupTransactionResponse]:
    """List group transactions sorted by date descending."""
    try:
        group = await Group.get(PydanticObjectId(group_id))
    except Exception:
        group = None

    if not group:
        raise ValueError("NOT_FOUND")
    if user_id not in group.members:
        raise ValueError("NOT_A_MEMBER")

    transactions = await GroupTransaction.find({"group_id": group_id}).sort(-GroupTransaction.date).to_list()
    return [_make_transaction_response(t) for t in transactions]



# ===== Balances =====

async def get_balances(user_id: str) -> BalanceListResponse:
    """Return all non-zero balances for the current user."""
    balances = await Balance.find({
        "user_id": user_id,
        "net_amount": {"$ne": 0},
    }).to_list()

    items = []
    for balance in balances:
        counterpart = await _get_user_public_info(balance.counterpart_id)
        net = balance.net_amount
        if net > 0:
            direction = "you_owe"
        elif net < 0:
            direction = "owed_to_you"
        else:
            continue  # should not happen due to query, but guard

        items.append(
            BalanceResponse(
                counterpart_id=balance.counterpart_id,
                counterpart_name=counterpart.name if counterpart else "Unknown",
                counterpart_upi_id=counterpart.upi_id if counterpart else None,
                net_amount=net,
                direction=direction,  # type: ignore[arg-type]
            )
        )

    return BalanceListResponse(items=items)


async def get_balance_with_friend(user_id: str, friend_id: str) -> BalanceResponse:
    """Return balance with a specific friend. Zero balance is a valid state (200, not 404)."""
    balance = await Balance.find_one({"user_id": user_id, "counterpart_id": friend_id})
    if not balance:
        # No balance doc yet — return settled state
        return BalanceResponse(
            counterpart_id=friend_id,
            counterpart_name="",  # populated below if possible
            counterpart_upi_id=None,
            net_amount=Decimal("0"),
            direction="settled",
        )

    net = balance.net_amount
    if net > 0:
        direction = "you_owe"
    elif net < 0:
        direction = "owed_to_you"
    else:
        direction = "settled"

    counterpart = await _get_user_public_info(friend_id)
    return BalanceResponse(
        counterpart_id=friend_id,
        counterpart_name=counterpart.name if counterpart else "Unknown",
        counterpart_upi_id=counterpart.upi_id if counterpart else None,
        net_amount=net,
        direction=direction,  # type: ignore[arg-type]
    )


async def list_balance_transactions(user_id: str, friend_id: str) -> list[GroupTransactionResponse]:
    """List transactions between user and friend that contribute to their balance, sorted by date descending."""
    transactions = await GroupTransaction.find({
        "$or": [
            {"paid_by": user_id, "splits.user_id": friend_id},
            {"paid_by": friend_id, "splits.user_id": user_id}
        ]
    }).sort(-GroupTransaction.date).to_list()
    
    return [_make_transaction_response(t) for t in transactions]
