import { z } from 'zod';
import { TokenPayload } from '../domain/usuario';
import { AppError } from '../errors/AppError';
import { IAlertaRepository } from '../repositories/AlertaRepository';
import { INotificacaoRepository } from '../repositories/NotificacaoRepository';
import { ISolicitacaoRepository, Solicitacao, StatusSolicitacao } from '../repositories/SolicitacaoRepository';
import { AlunoService } from './AlunoService';

const horario = z
  .string({ error: 'Informe o horário.' })
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Horário no formato AAAA-MM-DDTHH:MM.');

/** Agora no fuso local, no mesmo formato dos horários ('AAAA-MM-DDTHH:MM'), para comparar como texto. */
function agoraLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const futuro = horario.refine((h) => h > agoraLocal(), 'Escolha um horário no futuro.');

export const novaSolicitacaoSchema = z.object({
  motivo: z.string({ error: 'Informe o motivo.' }).trim().min(2, 'Informe o motivo.').max(120),
  opcoes: z.array(futuro, { error: 'Proponha de 1 a 3 horários.' }).min(1, 'Proponha de 1 a 3 horários.').max(3, 'Proponha de 1 a 3 horários.')
    .refine((l) => new Set(l).size === l.length, 'Os horários propostos devem ser diferentes.'),
  formato: z.enum(['PRESENCIAL', 'LIGACAO', 'VIDEO'], { error: 'Formato deve ser presencial, ligação ou vídeo.' }),
  observacao: z.string().trim().max(500).nullish(),
});

export const respostaSchema = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('confirmar'), horario }),
  z.object({ acao: z.literal('remarcar'), horario: futuro, mensagem: z.string().trim().max(500).nullish() }),
  z.object({ acao: z.literal('recusar'), justificativa: z.string({ error: 'Informe a justificativa.' }).trim().min(3, 'Informe a justificativa.').max(500) }),
  z.object({ acao: z.literal('concluir') }),
  z.object({ acao: z.literal('aceitar') }),
], { error: 'Ação inválida.' });

/** Quem pode fazer cada ação, e a partir de qual status (máquina de estados da solicitação). */
const TRANSICOES: Record<string, { perfil: TokenPayload['perfil']; de: StatusSolicitacao[]; para: StatusSolicitacao }> = {
  confirmar: { perfil: 'ORIENTADOR', de: ['PENDENTE'], para: 'CONFIRMADA' },
  remarcar: { perfil: 'ORIENTADOR', de: ['PENDENTE', 'REMARCADA'], para: 'REMARCADA' },
  recusar: { perfil: 'ORIENTADOR', de: ['PENDENTE', 'REMARCADA'], para: 'RECUSADA' },
  concluir: { perfil: 'ORIENTADOR', de: ['CONFIRMADA'], para: 'CONCLUIDA' },
  aceitar: { perfil: 'RESPONSAVEL', de: ['REMARCADA'], para: 'CONFIRMADA' },
};

const FILTROS: Record<string, StatusSolicitacao[]> = {
  pendentes: ['PENDENTE', 'REMARCADA'],
  confirmadas: ['CONFIRMADA'],
  concluidas: ['CONCLUIDA'],
  recusadas: ['RECUSADA'],
};

const FORMATO = { PRESENCIAL: 'presencial', LIGACAO: 'por ligação', VIDEO: 'por vídeo' } as const;
const uuid = z.string().uuid();

function formatarHorario(h: string): string {
  const [data, hora] = h.split('T');
  const [, m, d] = data.split('-');
  return `${d}/${m} às ${hora}`;
}

/**
 * Agendamento de conversa família-escola. Toda mudança de status notifica o outro lado:
 * a família pede -> o orientador é avisado; o orientador responde -> a família é avisada.
 */
export class SolicitacaoService {
  constructor(
    private readonly solicitacoes: ISolicitacaoRepository,
    private readonly alertas: IAlertaRepository,
    private readonly notificacoes: INotificacaoRepository,
    private readonly alunos: AlunoService,
  ) {}

  async criar(usuario: TokenPayload, alunoId: string, body: unknown) {
    const dados = novaSolicitacaoSchema.parse(body);
    const aluno = await this.alunos.obterComAcesso(usuario, alunoId);
    if (await this.solicitacoes.existeEmAberto(aluno.id)) {
      throw new AppError(409, 'Já existe uma solicitação em aberto para este aluno. Aguarde a resposta do orientador.');
    }

    const ultimoAlerta = await this.alertas.ultimoDoAluno(aluno.id);
    const solicitacao = await this.solicitacoes.criar({
      alunoId: aluno.id,
      alertaId: ultimoAlerta?.id ?? null,
      responsavelId: usuario.sub,
      motivo: dados.motivo,
      opcoes: [...dados.opcoes].sort(),
      formato: dados.formato,
      observacao: dados.observacao || null,
    });

    await this.notificacoes.criar({
      usuarioId: aluno.orientadorId,
      alertaId: solicitacao.alertaId,
      mensagem: `${solicitacao.responsavelNome} pediu uma conversa ${FORMATO[dados.formato]} sobre ${aluno.nome} (motivo: ${dados.motivo}).`,
    });
    return this.comRisco(solicitacao);
  }

  async listar(usuario: TokenPayload, filtros: { status?: string; alunoId?: string }) {
    const status = filtros.status ? FILTROS[filtros.status] : undefined;
    if (filtros.status && !status) throw new AppError(400, 'Filtro inválido. Use pendentes, confirmadas, concluidas ou recusadas.');
    if (filtros.alunoId) await this.alunos.obterComAcesso(usuario, filtros.alunoId);

    const lista = await this.solicitacoes.listar({
      ...(usuario.perfil === 'ORIENTADOR' ? { orientadorId: usuario.sub } : { responsavelId: usuario.sub }),
      alunoId: filtros.alunoId,
      status,
    });
    return Promise.all(lista.map((s) => this.comRisco(s)));
  }

  async responder(usuario: TokenPayload, solicitacaoId: string, body: unknown) {
    const dados = respostaSchema.parse(body);
    const atual = uuid.safeParse(solicitacaoId).success ? await this.solicitacoes.buscarPorId(solicitacaoId) : null;
    const dono = atual && (usuario.perfil === 'ORIENTADOR' ? atual.orientadorId === usuario.sub : atual.responsavelId === usuario.sub);
    if (!atual || !dono) throw new AppError(404, 'Solicitação não encontrada.');

    const regra = TRANSICOES[dados.acao];
    if (regra.perfil !== usuario.perfil) throw new AppError(403, 'Você não tem permissão para esta ação.');
    if (!regra.de.includes(atual.status)) {
      throw new AppError(409, `Não é possível ${dados.acao} uma solicitação com status ${atual.status.toLowerCase()}.`);
    }

    let mensagem: string;
    let atualizada: Solicitacao;
    switch (dados.acao) {
      case 'confirmar':
        if (!atual.opcoes.includes(dados.horario)) throw new AppError(400, 'Escolha um dos horários propostos, ou use "propor outro horário".');
        atualizada = await this.solicitacoes.atualizar(atual.id, { status: regra.para, horarioDefinido: dados.horario });
        mensagem = `Conversa sobre ${atual.alunoNome} confirmada para ${formatarHorario(dados.horario)} (${FORMATO[atual.formato]}).`;
        break;
      case 'remarcar':
        atualizada = await this.solicitacoes.atualizar(atual.id, { status: regra.para, horarioDefinido: dados.horario, resposta: dados.mensagem || null });
        mensagem = `O orientador propôs outro horário para a conversa sobre ${atual.alunoNome}: ${formatarHorario(dados.horario)}. Confirme no plano de ação.`;
        break;
      case 'recusar':
        atualizada = await this.solicitacoes.atualizar(atual.id, { status: regra.para, resposta: dados.justificativa });
        mensagem = `O pedido de conversa sobre ${atual.alunoNome} não pôde ser atendido: ${dados.justificativa}`;
        break;
      case 'concluir':
        atualizada = await this.solicitacoes.atualizar(atual.id, { status: regra.para });
        return this.comRisco(atualizada); // registro interno da escola, sem aviso
      case 'aceitar':
        atualizada = await this.solicitacoes.atualizar(atual.id, { status: regra.para });
        await this.notificacoes.criar({
          usuarioId: atual.orientadorId, alertaId: atual.alertaId,
          mensagem: `${atual.responsavelNome} aceitou o novo horário (${formatarHorario(atual.horarioDefinido!)}) para conversar sobre ${atual.alunoNome}.`,
        });
        return this.comRisco(atualizada);
    }

    await this.notificacoes.criar({ usuarioId: atual.responsavelId, alertaId: atual.alertaId, mensagem });
    return this.comRisco(atualizada);
  }

  /** Acrescenta o nível de risco atual do aluno (a caixa de solicitações mostra a prioridade). */
  private async comRisco(s: Solicitacao) {
    const ultimo = await this.alertas.ultimoDoAluno(s.alunoId);
    return { ...s, nivelRisco: ultimo?.nivel ?? 'BAIXO' };
  }
}
