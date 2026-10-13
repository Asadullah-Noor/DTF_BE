import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

export async function nextInvoiceNumber() {
  const c = await Counter.findOneAndUpdate(
    { _id: 'invoice' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return 'INV-' + String(c.seq).padStart(4, '0');
}

export default Counter;