import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

if (!process.env.VERCEL) {
  await connectDB();
  app.listen(env.port, () => console.log(`API running on http://localhost:${env.port}`));
}

export default app;