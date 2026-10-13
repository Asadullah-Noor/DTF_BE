import ExcelJS from 'exceljs';
import { KIND_LABELS } from '../utils/kinds.js';
import { toRs } from '../utils/money.js';

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const detail = (t) => [KIND_LABELS[t.kind], t.refNo, t.notes].filter(Boolean).join(' - ');

export async function statementWorkbook(st, settings) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Statement');

  ws.addRow([settings.businessName]).font = { bold: true, size: 14 };
  ws.addRow([`Statement: ${st.party.name} (${st.party.type})`]);
  ws.addRow([`Period: ${st.from ? fmt(st.from) : 'Start'} to ${st.to ? fmt(st.to) : 'Today'}`]);
  ws.addRow([]);
  ws.addRow(['Date', 'Detail', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)']).font = { bold: true };
  ws.addRow(['', 'Opening balance', '', '', toRs(st.openingBalance)]);

  for (const t of st.rows) {
    ws.addRow([fmt(t.date), detail(t), toRs(t.debit) || '', toRs(t.credit) || '', toRs(t.balance)]);
  }

  const last = ws.addRow([
    '',
    `Closing balance (${st.closingLabel})`,
    toRs(st.totalDebit),
    toRs(st.totalCredit),
    toRs(st.closingBalance),
  ]);
  last.font = { bold: true };

  ws.columns = [{ width: 12 }, { width: 44 }, { width: 14 }, { width: 14 }, { width: 16 }];
  return wb;
}