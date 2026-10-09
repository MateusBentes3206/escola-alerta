import { Router } from 'express';
import { pool } from '../config/db';
import { alertaService, alunoService, indicadorService, motor, notificacaoRepository, publicador } from '../container';
import { AlertaController, AlunoController, IndicadorController } from '../controllers/AlunoController';
import { AppError } from '../errors/AppError';
import { autenticar, exigirPerfil } from '../middlewares/auth';
import { PARAMETROS_PADRAO } from '../motor/parametros';
import { authRoutes } from './auth.routes';

export const routes = Router();

const alunos = new AlunoController(alunoService);
const indicadores = new IndicadorController(indicadorService);
const alertas = new AlertaController(alertaService);

// Raiz: identifica a API e lista as rotas (abrir no navegador não dá mais 404).
routes.get('/', (_req, res) => {
  res.json({
    api: 'EscolaAlerta',
    status: 'ok',
    rotas: [
      'GET /health', 'GET /motor', 'POST /auth/login', 'GET /auth/me',
      'GET /alunos', 'POST /alunos', 'GET /alunos/:id', 'GET /alunos/:id/indicadores?tipo=',
      'POST /alunos/:id/indicadores', 'PATCH /indicadores/:id', 'DELETE /indicadores/:id',
      'GET /alertas/:alunoId', 'POST /alertas/:id/feedback', 'GET /responsaveis',
      'GET /notificacoes', 'PATCH /notificacoes/:id/lida',
    ],
  });
});

// Health check: o front (ou você no navegador) confirma se a API e o banco estão de pé.
routes.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', banco: 'ok' });
});

// Explicabilidade (RNF07): quais regras e limites o motor usa, sem precisar ler o código.
routes.get('/motor', (_req, res) => {
  res.json({ regras: motor.nomesDasRegras, observadores: publicador.inscritos, parametros: PARAMETROS_PADRAO });
});

routes.use('/auth', authRoutes);

// Alunos (RF02) - orientador cadastra; os dois perfis consultam o que é seu.
routes.get('/alunos', autenticar, alunos.listar);
routes.post('/alunos', autenticar, exigirPerfil('ORIENTADOR'), alunos.criar);
routes.get('/alunos/:id', autenticar, alunos.detalhe);
routes.get('/responsaveis', autenticar, exigirPerfil('ORIENTADOR'), alunos.responsaveis);

// Indicadores (RF03-RF06) - só a escola registra; cada mudança reavalia o risco.
routes.get('/alunos/:id/indicadores', autenticar, indicadores.listar);
routes.post('/alunos/:id/indicadores', autenticar, exigirPerfil('ORIENTADOR'), indicadores.registrar);
routes.patch('/indicadores/:id', autenticar, exigirPerfil('ORIENTADOR'), indicadores.atualizar);
routes.delete('/indicadores/:id', autenticar, exigirPerfil('ORIENTADOR'), indicadores.excluir);

// Alertas (RF08) e feedback da família (RF13)
routes.get('/alertas/:alunoId', autenticar, alertas.historico);
routes.post('/alertas/:id/feedback', autenticar, exigirPerfil('RESPONSAVEL'), alertas.feedback);

// Notificações gravadas pelos observadores
routes.get('/notificacoes', autenticar, async (req, res) => {
  res.json(await notificacaoRepository.listarPorUsuario(req.usuario!.sub));
});
routes.patch('/notificacoes/:id/lida', autenticar, async (req, res) => {
  const ok = /^[0-9a-f-]{36}$/i.test(String(req.params.id)) && (await notificacaoRepository.marcarLida(String(req.params.id), req.usuario!.sub));
  if (!ok) throw new AppError(404, 'Notificação não encontrada.');
  res.status(204).end();
});
