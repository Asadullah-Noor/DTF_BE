import mongoose from 'mongoose';

const int = {
  type: Number,
  required: true,
  min: 1,
  validate: { validator: Number.isInteger, message: 'must be integer paisa' },
};

const paymentSchema = new mongoose.Schema(
  {
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    kind: { type: String, enum: ['payment_in', 'payment_out'], required: true },
    date: { type: Date, required: true },
    amount: int,
    allocations: [
      {
        _id: false,
        invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
        amount: int,
      },
    ],
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);