"""Excel report generator using openpyxl.

Locked sheet names and structure per Spec-09 §1.5.
"""

from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

from shared.period_utils import decimal_to_float


def _fmt_date(value):
    if hasattr(value, "date"):
        return value.date().isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()[:10]
    return str(value)[:10]


def _fmt_amount(value):
    if isinstance(value, Decimal):
        value = decimal_to_float(value)
    return value


def _add_amount_total_row(ws, row, amount_col, total):
    ws.cell(row=row, column=1, value="Total")
    ws.cell(row=row, column=amount_col, value=_fmt_amount(total))
    for col in range(1, ws.max_column + 1):
        ws.cell(row=row, column=col).font = Font(bold=True)


def generate_excel_report(data: dict, user_id: str) -> bytes:
    """Generate an Excel financial report from data produced by service.generate_report_data."""
    wb = Workbook()

    # Remove default sheet
    wb.remove(wb.active)

    header_fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    header_font = Font(bold=True)

    # ===== Expenses sheet =====
    ws_expenses = wb.create_sheet("Expenses")
    expense_headers = ["Date", "Category", "Description", "Amount", "Payment Type"]
    ws_expenses.append(expense_headers)
    for cell in ws_expenses[1]:
        cell.font = header_font
        cell.fill = header_fill

    expense_total = Decimal("0")
    for e in data["expenses"]:
        ws_expenses.append([
            _fmt_date(e.date),
            e.category.value if hasattr(e.category, "value") else str(e.category),
            e.description or "",
            _fmt_amount(e.amount),
            e.payment_type.value if hasattr(e.payment_type, "value") else str(e.payment_type),
        ])
        expense_total += e.amount

    total_row = ws_expenses.max_row + 1
    _add_amount_total_row(ws_expenses, total_row, 4, expense_total)

    # ===== Income sheet =====
    ws_income = wb.create_sheet("Income")
    income_headers = ["Date", "Source Type", "Description", "Amount", "Payment Type"]
    ws_income.append(income_headers)
    for cell in ws_income[1]:
        cell.font = header_font
        cell.fill = header_fill

    income_total = Decimal("0")
    for i in data["income"]:
        ws_income.append([
            _fmt_date(i.date),
            i.source_type.value if hasattr(i.source_type, "value") else str(i.source_type),
            i.description or "",
            _fmt_amount(i.amount),
            i.payment_type.value if hasattr(i.payment_type, "value") else str(i.payment_type),
        ])
        income_total += i.amount

    total_row = ws_income.max_row + 1
    _add_amount_total_row(ws_income, total_row, 4, income_total)

    # ===== Group Transactions sheet =====
    ws_group = wb.create_sheet("Group Transactions")
    group_headers = ["Date", "Group", "Description", "Role", "Amount"]
    ws_group.append(group_headers)
    for cell in ws_group[1]:
        cell.font = header_font
        cell.fill = header_fill

    groups = data["groups"]
    group_total = Decimal("0")
    for gt in data["group_transactions"]:
        group = groups.get(gt.group_id)
        group_name = group.name if group else gt.group_id
        if gt.paid_by == user_id:
            role = "Paid"
            amount = gt.total_amount
        else:
            role = "Owed"
            owed = next((s for s in gt.splits if s.user_id == user_id), None)
            amount = owed.amount_owed if owed else Decimal("0")
        ws_group.append([
            _fmt_date(gt.date),
            group_name,
            gt.description or "",
            role,
            _fmt_amount(amount),
        ])
        group_total += amount

    total_row = ws_group.max_row + 1
    _add_amount_total_row(ws_group, total_row, 5, group_total)

    # Auto-width columns for readability
    for ws in [ws_expenses, ws_income, ws_group]:
        for col in range(1, ws.max_column + 1):
            ws.column_dimensions[get_column_letter(col)].width = 18

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()
