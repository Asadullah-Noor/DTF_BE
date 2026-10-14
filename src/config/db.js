import mongoose from 'mongoose';
import { env } from './env.js';

let pending;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (!pending) {
    pending = mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 }).catch((e) => {
      pending = null;
      throw e;
    });
  }
  await pending;
  console.log('MongoDB connected');
}