import { Router } from 'express';
import ExcelJS from 'exceljs';
import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getBalanceMap, withBalance } from '../services/partyService.js';
import { toRs } from '../utils/money.js';
import { KIND_LABELS } from '../utils/kinds.js';

const router = Router();
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function sheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 4) }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  return ws;
}

router.get(
  '/excel',
  asyncHandler(async (_req, res) => {
    const [parties, txns, invoices, expenses, map] = await Promise.all([
      Party.find().sort({ name: 1 }).lean(),
      Transaction.find({ partyId: { $ne: null } }).sort({ date: 1, createdAt: 1 }).populate('partyId', 'name type').lean(),
      Invoice.find().sort({ number: 1 }).populate('clientId', 'name').lean(),
      Expense.find().sort({ date: 1 }).lean(),
      getBalanceMap(),
    ]);

    const wb = new ExcelJS.Workbook();

    sheet(wb, 'Parties', ['Name', 'Type', 'Phone', 'Address', 'Opening (Rs)', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)'],
      parties.map((p) => {
        const b = withBalance(p, map);
        return [p.name, p.type, p.phone, p.address, toRs(p.openingBalance), toRs(b.totalDebit), toRs(b.totalCredit), toRs(b.balance)];
      })
    );

    // Pehle 5 columns wahi hain jo import ke liye chahiye (Type, Date, Client, Debit, Credit)
    sheet(wb, 'Transactions', ['Type', 'Date', 'Client', 'Debit', 'Credit', 'Kind', 'Ref No', 'Notes'],
      txns.map((t) => [t.partyId?.type, day(t.date), t.partyId?.name, toRs(t.debit), toRs(t.credit), KIND_LABELS[t.kind], t.refNo, t.notes])
    );

    sheet(wb, 'Invoices', ['Number', 'Client', 'Date', 'Total', 'Received', 'Remaining', 'Status'],
      invoices.map((i) => [i.number, i.clientId?.name, day(i.issueDate), toRs(i.total), toRs(i.paidAmount), toRs(i.total - i.paidAmount), i.status])
    );

    sheet(wb, 'Expenses', ['Date', 'Category', 'Amount', 'Notes'],
      expenses.map((e) => [day(e.date), e.category, toRs(e.amount), e.notes])
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="waqas-dtf-backup-${day(new Date())}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  })
);

export default router;