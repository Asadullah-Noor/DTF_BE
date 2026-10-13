import mongoose from 'mongoose';

const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['client', 'supplier'], required: true },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    // signed paisa: client ka udhaar = +, supplier ko dena = -
    openingBalance: {
      type: Number,
      default: 0,
      validate: { validator: Number.isInteger, message: 'openingBalance must be integer paisa' },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

partySchema.index({ name: 1, type: 1 }, { unique: true });

export default mongoose.model('Party', partySchema);