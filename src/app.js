import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import api from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientUrl }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/uploads', express.static(env.uploadsDir));
app.use('/api', api);

app.use(notFound);
app.use(errorHandler);

export default app;