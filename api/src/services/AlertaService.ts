import { z } from 'zod';
import { TokenPayload } from '../domain/usuario';
import { AppError } from '../errors/AppError';
import { organizarPlano } from '../motor/GeradorDePlanoDeAcao';
import { IAlertaRepository } from '../repositories/AlertaRepository';
import { INotificacaoRepository } from '../repositories/NotificacaoRepository';
import { AlunoService } from './AlunoService';

export const feedbackSchema = z.object({
  status: z.enum(['em_andamento', 'resolvido'], { error: 'Status deve ser em_andamento ou resolvido.' }),
  observacao: z.string().trim().max(1000).nullish(),
});

export const statusPlanoSchema = z.object({
  status: z.enum(['EM_ANDAMENTO', 'RESOLVIDO'], { error: 'Status deve ser EM_ANDAMENTO ou RESOLVIDO.' }),
});

const uuid = z.string().uuid();

export class AlertaService {
  constructor(
    private readonly alertas: IAlertaRepository,
    private readonly notificacoes: INotificacaoRepository,
    private readonly alunos: AlunoService,
  ) {}

  /** RF08 / IT06: evolução do risco em ordem cronológica, com o plano de cada alerta. */
  async historico(usuario: TokenPayload, alunoId: string) {
    const aluno = await this.alunos.obterComAcesso(usuario, alunoId);
    const alertas = await this.alertas.listarPorAluno(aluno.id);
    return Promise.all(alertas.map(async (a) => {
      const sugestoes = await this.alertas.sugestoesDoAlerta(a.id);
      return { ...a, sugestoes, reforcos: organizarPlano(sugestoes).reforcos };
    }));
  }

  /**
   * RF13 / IT07: o responsável registra como está o plano. O feedback entra no histórico do aluno
   * e volta para a escola como notificação ao orientador (realimentação família -> escola).
   */
  async registrarFeedback(usuario: TokenPayload, alertaId: string, body: unknown) {
    const dados = feedbackSchema.parse(body);
    const alerta = uuid.safeParse(alertaId).success ? await this.alertas.buscarPorId(alertaId) : null;
    if (!alerta) throw new AppError(404, 'Alerta não encontrado.');
    const aluno = await this.alunos.obterComAcesso(usuario, alerta.alunoId);

    const feedback = await this.alertas.criarFeedback({
      alertaId: alerta.id,
      responsavelId: usuario.sub,
      status: dados.status,
      observacao: dados.observacao || null,
    });

    // A família respondeu: o plano sai de "aberto" e passa a "em andamento".
    // Só o orientador marca como resolvido (o "resolvido" da família é um aviso para ele confirmar).
    const plano = await this.alertas.statusDoPlano(alerta.id);
    if (plano?.status === 'ABERTO') await this.alertas.atualizarStatusDoPlano(alerta.id, 'EM_ANDAMENTO', usuario.sub);

    await this.notificacoes.criar({
      usuarioId: aluno.orientadorId,
      alertaId: alerta.id,
      mensagem: `${aluno.responsavelNome ?? 'O responsável'} marcou o plano de ${aluno.nome} como ` +
        `"${dados.status === 'resolvido' ? 'resolvido' : 'em andamento'}"${dados.observacao ? `: ${dados.observacao}` : '.'}`,
    });

    return feedback;
  }

  /** O orientador acompanha o plano: em andamento ou resolvido (tira o aluno da lista de atenção). */
  async atualizarStatusDoPlano(usuario: TokenPayload, alertaId: string, body: unknown) {
    const { status } = statusPlanoSchema.parse(body);
    const alerta = uuid.safeParse(alertaId).success ? await this.alertas.buscarPorId(alertaId) : null;
    if (!alerta) throw new AppError(404, 'Alerta não encontrado.');
    const aluno = await this.alunos.obterComAcesso(usuario, alerta.alunoId);
    if (!(await this.alertas.statusDoPlano(alerta.id))) throw new AppError(404, 'Este alerta não tem plano de ação.');

    await this.alertas.atualizarStatusDoPlano(alerta.id, status, usuario.sub);
    if (status === 'RESOLVIDO' && aluno.responsavelId) {
      await this.notificacoes.criar({
        usuarioId: aluno.responsavelId,
        alertaId: alerta.id,
        mensagem: `A escola marcou o plano de ação de ${aluno.nome.split(' ')[0]} como resolvido. Obrigado pelo acompanhamento!`,
      });
    }
    return this.alertas.statusDoPlano(alerta.id);
  }
}
