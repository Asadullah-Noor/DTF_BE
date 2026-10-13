import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

await connectDB();
console.log('DB:', mongoose.connection.name);

const users = await User.find().lean();
console.log('Users in DB:', users.map((u) => u.email));

const email = env.ownerEmail.trim().toLowerCase();
const user = users.find((u) => u.email === email);
console.log('Looking for:', JSON.stringify(email));
console.log('Found:', !!user);
if (user) {
  console.log('Password matches .env:', await bcrypt.compare(env.ownerPassword.trim(), user.passwordHash));
}

await mongoose.disconnect();
