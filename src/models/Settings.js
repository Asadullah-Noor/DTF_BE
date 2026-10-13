import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    businessName: { type: String, default: 'Waqas DTF Printing' },
    address: { type: String, default: 'Near Govt Higher Secondary School, Awan Town, Lahore' },
    phone: { type: String, default: '' },
    logoUrl: { type: String, default: '/logo.png' },
  },
  { timestamps: true }
);

export default mongoose.model('Settings', settingsSchema);