import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

await connectDB();

const email = env.ownerEmail.trim().toLowerCase();
const passwordHash = await bcrypt.hash(env.ownerPassword.trim(), 12);

await User.findOneAndUpdate({ email }, { email, passwordHash }, { upsert: true });
console.log('Owner reset done:', email);

await mongoose.disconnect();
