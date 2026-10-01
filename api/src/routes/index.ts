import { Router } from 'express';
import { pool } from '../config/db';
import { authRoutes } from './auth.routes';

export const routes = Router();

// Health check: o front (ou você no navegador) confirma se a API e o banco estão de pé.
routes.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', banco: 'ok' });
});

routes.use('/auth', authRoutes);

// Próximas sprints:
// routes.use('/alunos', alunoRoutes);
// routes.use('/indicadores', indicadorRoutes);
// routes.use('/alertas', alertaRoutes);
