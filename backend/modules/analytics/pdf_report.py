"""PDF report generator using ReportLab.

Locked structure per Spec-09 §1.4.
"""

from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

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
    return f"₹{value:,.2f}"


def generate_pdf_report(data: dict, user_id: str) -> bytes:
    """Generate a PDF financial report from data produced by service.generate_report_data."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=0.6 * inch, leftMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    story = []

    # Header
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=6,
    )
    story.append(Paragraph("FinTrack Financial Report", title_style))
    story.append(Paragraph(f"Date range: {data['start_date']} to {data['end_date']}", styles["Normal"]))
    story.append(Paragraph(f"Generated on: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # Expenses
    story.append(Paragraph("Expenses", styles["Heading2"]))
    expenses = data["expenses"]
    if expenses:
        expense_rows = [["Date", "Category", "Description", "Amount", "Payment Type"]]
        expense_total = Decimal("0")
        for e in expenses:
            expense_rows.append([
                _fmt_date(e.date),
                e.category.value if hasattr(e.category, "value") else str(e.category),
                e.description or "",
                _fmt_amount(e.amount),
                e.payment_type.value if hasattr(e.payment_type, "value") else str(e.payment_type),
            ])
            expense_total += e.amount
        expense_rows.append(["", "", "Total", _fmt_amount(expense_total), ""])
        story.append(_build_table(expense_rows))
    else:
        story.append(Paragraph("No expenses recorded in this period.", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # Income
    story.append(Paragraph("Income", styles["Heading2"]))
    incomes = data["income"]
    if incomes:
        income_rows = [["Date", "Source", "Description", "Amount", "Payment Type"]]
        income_total = Decimal("0")
        for i in incomes:
            income_rows.append([
                _fmt_date(i.date),
                i.source_type.value if hasattr(i.source_type, "value") else str(i.source_type),
                i.description or "",
                _fmt_amount(i.amount),
                i.payment_type.value if hasattr(i.payment_type, "value") else str(i.payment_type),
            ])
            income_total += i.amount
        income_rows.append(["", "", "Total", _fmt_amount(income_total), ""])
        story.append(_build_table(income_rows))
    else:
        story.append(Paragraph("No income recorded in this period.", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    # Group Transactions
    story.append(Paragraph("Group Transactions", styles["Heading2"]))
    group_rows = [["Date", "Group", "Description", "Role", "Amount"]]
    groups = data["groups"]
    group_txs = data["group_transactions"]
    group_total = Decimal("0")
    if group_txs:
        for gt in group_txs:
            group = groups.get(gt.group_id)
            group_name = group.name if group else gt.group_id
            if gt.paid_by == user_id:
                role = "Paid"
                amount = gt.total_amount
            else:
                role = "Owed"
                owed = next((s for s in gt.splits if s.user_id == user_id), None)
                amount = owed.amount_owed if owed else Decimal("0")
            group_rows.append([
                _fmt_date(gt.date),
                group_name,
                gt.description or "",
                role,
                _fmt_amount(amount),
            ])
            group_total += amount
    else:
        story.append(Paragraph("No group transactions in this period.", styles["Normal"]))

    if len(group_rows) > 1:
        group_rows.append(["", "", "Total", "", _fmt_amount(group_total)])
        story.append(_build_table(group_rows))
    story.append(Spacer(1, 0.2 * inch))

    # Summary
    story.append(Paragraph("Summary", styles["Heading2"]))
    summary_data = [
        ["Total Income", _fmt_amount(data["total_income"])],
        ["Total Expenses", _fmt_amount(data["total_expense"])],
        ["Net Balance", _fmt_amount(data["net_balance"])],
    ]
    story.append(_build_table(summary_data, header=False))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


def _build_table(rows, header=True):
    table = Table(rows, repeatRows=1 if header else 0)
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]
    if not header:
        # Make first row bold as a totals/summary row
        style_commands.append(("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"))
    table.setStyle(TableStyle(style_commands))
    return table
