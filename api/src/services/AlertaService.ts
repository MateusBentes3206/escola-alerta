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

    await this.notificacoes.criar({
      usuarioId: aluno.orientadorId,
      alertaId: alerta.id,
      mensagem: `${aluno.responsavelNome ?? 'O responsável'} marcou o plano de ${aluno.nome} como ` +
        `"${dados.status === 'resolvido' ? 'resolvido' : 'em andamento'}"${dados.observacao ? `: ${dados.observacao}` : '.'}`,
    });

    return feedback;
  }
}
