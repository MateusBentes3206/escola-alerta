import { Router } from 'express';
import { pool } from '../config/db';
import { mascararContato } from '../domain/mascara';
import { alertaService, alunoService, analiseTurmaService, cadastroFamiliaService, indicadorService, matrizService, mensagensExternas, motor, notificacaoRepository, publicador, solicitacaoService } from '../container';
import { AlertaController, AlunoController, IndicadorController, SolicitacaoController } from '../controllers/AlunoController';
import { AppError } from '../errors/AppError';
import { autenticar, exigirPerfil } from '../middlewares/auth';
import { PARAMETROS_PADRAO } from '../motor/parametros';
import { authRoutes } from './auth.routes';

export const routes = Router();

const alunos = new AlunoController(alunoService);
const indicadores = new IndicadorController(indicadorService);
const alertas = new AlertaController(alertaService);
const solicitacoes = new SolicitacaoController(solicitacaoService);

// Raiz: identifica a API e lista as rotas (abrir no navegador não dá mais 404).
routes.get('/', (_req, res) => {
  res.json({
    api: 'EscolaAlerta',
    status: 'ok',
    rotas: [
      'GET /health', 'GET /motor', 'POST /auth/login', 'GET /auth/me',
      'GET /alunos', 'POST /alunos', 'GET /alunos/:id', 'GET /alunos/:id/indicadores?tipo=',
      'POST /alunos/:id/indicadores', 'PATCH /indicadores/:id', 'DELETE /indicadores/:id',
      'GET /alertas/:alunoId', 'POST /alertas/:id/feedback', 'PATCH /alertas/:id/plano', 'GET /responsaveis',
      'POST /alunos/:id/solicitacoes', 'GET /solicitacoes?status=&alunoId=', 'PATCH /solicitacoes/:id',
      'GET /matriz', 'PUT /matriz', 'DELETE /matriz', 'GET /painel/analise', 'GET /alunos/:id/mensagens',
      'POST /auth/cadastro', 'GET /auth/orientadores', 'PATCH /alunos/:id/vinculo',
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
routes.patch('/alertas/:id/plano', autenticar, exigirPerfil('ORIENTADOR'), alertas.statusDoPlano);

// Agendamento de conversa família-escola: a família pede; o orientador confirma, remarca, recusa ou conclui.
routes.post('/alunos/:id/solicitacoes', autenticar, exigirPerfil('RESPONSAVEL'), solicitacoes.criar);
routes.get('/solicitacoes', autenticar, solicitacoes.listar);
routes.patch('/solicitacoes/:id', autenticar, solicitacoes.responder);

// Matriz de sugestões do plano de ação, editável pela escola (vale para planos novos).
routes.get('/matriz', autenticar, exigirPerfil('ORIENTADOR'), async (req, res) => {
  res.json(await matrizService.obter(req.usuario!));
});
routes.put('/matriz', autenticar, exigirPerfil('ORIENTADOR'), async (req, res) => {
  res.json(await matrizService.salvar(req.usuario!, req.body));
});
routes.delete('/matriz', autenticar, exigirPerfil('ORIENTADOR'), async (req, res) => {
  res.json(await matrizService.restaurarPadrao(req.usuario!));
});

// Cadastro feito pela família: o orientador confirma ou recusa o vínculo do aluno.
routes.patch('/alunos/:id/vinculo', autenticar, exigirPerfil('ORIENTADOR'), async (req, res) => {
  const confirmar = req.body?.confirmar;
  if (typeof confirmar !== 'boolean') throw new AppError(400, 'Informe confirmar: true ou false.');
  res.json(await cadastroFamiliaService.decidirVinculo(req.usuario!.sub, String(req.params.id), confirmar));
});

// Avisos enviados à família fora do app (e-mail, WhatsApp), com contato mascarado (LGPD).
routes.get('/alunos/:id/mensagens', autenticar, exigirPerfil('ORIENTADOR'), async (req, res) => {
  const aluno = await alunoService.obterComAcesso(req.usuario!, String(req.params.id));
  const lista = await mensagensExternas.listarPorAluno(aluno.id);
  res.json(lista.map((m) => ({ ...m, destino: mascararContato(m.destino) })));
});

// Painel do orientador: alunos por turma, grupos de perfil parecido e assuntos para reforço em grupo.
routes.get('/painel/analise', autenticar, exigirPerfil('ORIENTADOR'), async (req, res) => {
  res.json(await analiseTurmaService.analisar(req.usuario!));
});

// Notificações gravadas pelos observadores
routes.get('/notificacoes', autenticar, async (req, res) => {
  res.json(await notificacaoRepository.listarPorUsuario(req.usuario!.sub));
});
routes.patch('/notificacoes/:id/lida', autenticar, async (req, res) => {
  const ok = /^[0-9a-f-]{36}$/i.test(String(req.params.id)) && (await notificacaoRepository.marcarLida(String(req.params.id), req.usuario!.sub));
  if (!ok) throw new AppError(404, 'Notificação não encontrada.');
  res.status(204).end();
});
