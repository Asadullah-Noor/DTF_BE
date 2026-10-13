import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import authRoutes from './auth.routes.js';
import settingsRoutes from './settings.routes.js';
import partiesRoutes from './parties.routes.js';
import transactionsRoutes from './transactions.routes.js';
import importRoutes from './import.routes.js';
import exportRoutes from './export.routes.js';
import invoicesRoutes from './invoices.routes.js';
import paymentsRoutes from './payments.routes.js';
import expensesRoutes from './expenses.routes.js';

const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true }));
api.use('/auth', authRoutes);

// Yahan se neeche sab kuch login mangta hai
api.use(requireAuth);
api.use('/settings', settingsRoutes);
api.use('/parties', partiesRoutes);
api.use('/transactions', transactionsRoutes);
api.use('/import', importRoutes);
api.use('/export', exportRoutes);
api.use('/invoices', invoicesRoutes);
api.use('/payments', paymentsRoutes);
api.use('/expenses', expensesRoutes);

export default api;