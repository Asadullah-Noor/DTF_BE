import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import Party from '../models/Party.js';
import Transaction from '../models/Transaction.js';
import Expense from '../models/Expense.js';
import { toPaisa } from '../utils/money.js';

await connectDB();

// Owner + settings
const email = env.ownerEmail.toLowerCase();
if (!(await User.findOne({ email }))) {
  await User.create({ email, passwordHash: await bcrypt.hash(env.ownerPassword, 12) });
  console.log('Owner user created:', email);
} else {
  console.log('Owner already exists');
}
if (!(await Settings.findOne())) await Settings.create({});

// Sample data (sirf agar koi party na ho)
if ((await Party.countDocuments()) === 0) {
  const d = (m, day) => new Date(Date.UTC(2026, m - 1, day));
  const rs = toPaisa;

  const [engine, focus, club, sf, ink] = await Party.create([
    { name: 'Engine', type: 'client' },
    { name: 'Focus', type: 'client', openingBalance: rs(5000), notes: 'Purana hisaab' },
    { name: 'little club', type: 'client' },
    { name: 'SF traders', type: 'supplier' },
    { name: 'ink traders', type: 'supplier' },
  ]);

  const t = (party, date, kind, debit, credit, notes = '') =>
    ({ partyId: party._id, date, kind, debit: rs(debit), credit: rs(credit), notes });

  await Transaction.create([
    t(engine, d(9, 5), 'invoice', 25000, 0, 'DTF transfers'),
    t(engine, d(9, 12), 'payment_in', 0, 10000, 'Cash'),
    t(engine, d(9, 20), 'invoice', 18000, 0),
    t(focus, d(9, 8), 'invoice', 12000, 0),
    t(focus, d(9, 15), 'payment_in', 0, 12000),
    t(club, d(9, 18), 'invoice', 8000, 0),
    t(sf, d(9, 3), 'material_purchase', 0, 60000, 'Film rolls'),
    t(sf, d(9, 25), 'payment_out', 30000, 0),
    t(ink, d(9, 6), 'material_purchase', 0, 35000, 'Ink'),
    t(ink, d(9, 22), 'payment_out', 10000, 0),
  ]);

  const exp = await Expense.create({ date: d(9, 30), category: 'Electricity', amount: rs(14500), notes: 'September bill' });
  await Transaction.create({ date: exp.date, kind: 'expense', debit: exp.amount, expenseId: exp._id, notes: 'Electricity' });

  console.log('Sample data created');
} else {
  console.log('Parties already exist, sample data skipped');
}

await mongoose.disconnect();