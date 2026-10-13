import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    category: {
      type: String,
      enum: ['Electricity', 'Rent', 'Ink', 'Film', 'Powder', 'Other'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'must be integer paisa' },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Expense', expenseSchema);