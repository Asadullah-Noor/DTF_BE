import mongoose from 'mongoose';
import { computeInvoiceStatus } from '../services/invoiceStatus.js';

const int = (def = 0) => ({
  type: Number,
  default: def,
  min: 0,
  validate: { validator: Number.isInteger, message: 'must be integer paisa' },
});

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    size: { type: String, default: '' },
    qty: { type: Number, required: true, min: 0 },
    rate: int(),
    amount: int(),
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    subtotal: int(),
    discount: int(),
    total: int(),
    paidAmount: int(),
    status: { type: String, enum: ['pending', 'partial_paid', 'paid'], default: 'pending' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// status kabhi haath se set nahi hota
invoiceSchema.pre('validate', function () {
  this.status = computeInvoiceStatus(this.paidAmount, this.total);
});

export default mongoose.model('Invoice', invoiceSchema);