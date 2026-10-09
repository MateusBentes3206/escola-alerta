import { ORDEM_NIVEL } from '../../domain/risco';
import { INotificacaoRepository } from '../../repositories/NotificacaoRepository';
import { AlertaGerado, ObservadorDeAlerta } from '../PublicadorDeAlertas';

const NIVEL_TEXTO = { BAIXO: 'baixo', MODERADO: 'moderado', ALTO: 'alto' } as const;
const CAUSA_TEXTO = { NOTAS: 'notas', FALTAS: 'frequência', OCORRENCIAS: 'ocorrências', SAIDAS: 'saídas antecipadas' } as const;

function piorou({ alerta, nivelAnterior }: AlertaGerado): boolean {
  return nivelAnterior === null || ORDEM_NIVEL[alerta.nivel] > ORDEM_NIVEL[nivelAnterior];
}

/** Canal família: avisa o responsável de qualquer mudança (inclusive melhora). */
export class NotificarResponsavel implements ObservadorDeAlerta {
  readonly nome = 'NotificarResponsavel';
  constructor(private readonly notificacoes: INotificacaoRepository) {}

  async notificar(evento: AlertaGerado): Promise<void> {
    const { aluno, alerta } = evento;
    if (!aluno.responsavelId) return;
    const primeiroNome = aluno.nome.split(' ')[0];

    const mensagem =
      alerta.nivel === 'BAIXO'
        ? `Boa notícia: o risco de ${primeiroNome} voltou para baixo.`
        : `${primeiroNome} está com risco ${NIVEL_TEXTO[alerta.nivel]}` +
          `${alerta.causaRaiz ? ` (principal motivo: ${CAUSA_TEXTO[alerta.causaRaiz]})` : ''}. Veja o plano de ação sugerido.`;

    await this.notificacoes.criar({ usuarioId: aluno.responsavelId, alertaId: alerta.id, mensagem });
  }
}

/** Canal escola: avisa o orientador só quando o risco piora para moderado ou alto. */
export class NotificarOrientador implements ObservadorDeAlerta {
  readonly nome = 'NotificarOrientador';
  constructor(private readonly notificacoes: INotificacaoRepository) {}

  async notificar(evento: AlertaGerado): Promise<void> {
    const { aluno, alerta } = evento;
    if (alerta.nivel === 'BAIXO' || !piorou(evento)) return;

    await this.notificacoes.criar({
      usuarioId: aluno.orientadorId,
      alertaId: alerta.id,
      mensagem: `${aluno.nome} (${aluno.turma}) passou para risco ${NIVEL_TEXTO[alerta.nivel]}` +
        `${alerta.correlacao ? ' por correlação de sinais' : ''}.`,
    });
  }
}
