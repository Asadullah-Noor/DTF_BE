import mongoose from 'mongoose';
import { KINDS } from '../utils/kinds.js';

const int = {
  type: Number,
  default: 0,
  min: 0,
  validate: { validator: Number.isInteger, message: 'must be integer paisa' },
};

const transactionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', index: true },
    kind: { type: String, required: true, enum: KINDS },
    debit: int,
    credit: int,
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
    refNo: { type: String, default: '' },
    notes: { type: String, default: '' },
    attachmentUrl: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

transactionSchema.pre('validate', function () {
  if (this.debit > 0 && this.credit > 0) {
    this.invalidate('debit', 'A transaction cannot have both debit and credit');
  }
  if (this.kind !== 'expense' && !this.partyId) {
    this.invalidate('partyId', 'partyId is required unless kind is expense');
  }
});

export default mongoose.model('Transaction', transactionSchema);
