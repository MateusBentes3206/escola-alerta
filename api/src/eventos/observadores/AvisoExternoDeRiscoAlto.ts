import { env } from '../../config/env';
import { CanalExterno, MensagemExterna } from '../../canais/CanalExterno';
import { IMensagemRepository } from '../../repositories/MensagemRepository';
import { IUsuarioRepository } from '../../repositories/UsuarioRepository';
import { AlertaGerado, ObservadorDeAlerta } from '../PublicadorDeAlertas';

const CAUSA_TEXTO = { NOTAS: 'notas', FALTAS: 'frequência', OCORRENCIAS: 'ocorrências', SAIDAS: 'saídas antecipadas' } as const;

/**
 * Observador (padrão Observer): quando o aluno ENTRA em risco alto, avisa o responsável fora do app
 * pelo canal recebido (e-mail ou WhatsApp). Um observador por canal: um canal novo (SMS, por exemplo)
 * é só mais uma instância inscrita no PublicadorDeAlertas, sem mexer no motor.
 *
 * - Só dispara na entrada em risco alto (não repete enquanto continuar alto, para não virar spam).
 * - Mensagem curta e sem notas/detalhes do aluno (LGPD: WhatsApp e e-mail ficam fora do controle da escola);
 *   o detalhe completo fica no sistema, atrás do login.
 * - Todo envio é registrado (ENVIADA, SIMULADA, FALHOU ou SEM_CONTATO) para a escola acompanhar.
 */
export class AvisoExternoDeRiscoAlto implements ObservadorDeAlerta {
  readonly nome: string;

  constructor(
    private readonly canal: CanalExterno,
    private readonly usuarios: IUsuarioRepository,
    private readonly mensagens: IMensagemRepository,
  ) {
    this.nome = `AvisoRiscoAlto${canal.tipo === 'EMAIL' ? 'PorEmail' : 'PorWhatsApp'}`;
  }

  async notificar({ alerta, aluno, nivelAnterior }: AlertaGerado): Promise<void> {
    if (alerta.nivel !== 'ALTO' || nivelAnterior === 'ALTO' || !aluno.responsavelId || !aluno.vinculoConfirmado) return;

    const responsavel = await this.usuarios.buscarPorId(aluno.responsavelId);
    if (!responsavel) return;

    const primeiroNome = aluno.nome.split(' ')[0];
    const motivo = alerta.causaRaiz ? CAUSA_TEXTO[alerta.causaRaiz] : 'acompanhamento';
    const texto =
      `Olá, ${responsavel.nome.split(' ')[0]}. Aqui é a escola, pelo EscolaAlerta.\n\n` +
      `${primeiroNome} (${aluno.turma}) está com risco ALTO no acompanhamento escolar. Principal motivo: ${motivo}.\n\n` +
      `A escola preparou um plano de ação. Veja os detalhes e fale com a orientação em: ${env.appUrl}\n\n` +
      'Este é um aviso automático. Em caso de dúvida, procure a orientação escolar.';
    const mensagem: MensagemExterna = {
      destino: (this.canal.tipo === 'EMAIL' ? responsavel.email : responsavel.telefone) ?? '',
      assunto: `EscolaAlerta: ${primeiroNome} precisa de atenção`,
      texto,
      nomeDestinatario: responsavel.nome,
      variaveis: [responsavel.nome.split(' ')[0], primeiroNome, aluno.turma, motivo, env.appUrl],
    };

    const registro = { usuarioId: responsavel.id, alunoId: aluno.id, alertaId: alerta.id, canal: this.canal.tipo, assunto: mensagem.assunto, conteudo: texto };
    if (!mensagem.destino) {
      await this.mensagens.registrar({ ...registro, destino: null, status: 'SEM_CONTATO', erro: this.canal.tipo === 'WHATSAPP' ? 'Responsável sem telefone cadastrado.' : 'Responsável sem e-mail.' });
      return;
    }
    try {
      const status = await this.canal.enviar(mensagem);
      await this.mensagens.registrar({ ...registro, destino: mensagem.destino, status });
    } catch (err) {
      await this.mensagens.registrar({ ...registro, destino: mensagem.destino, status: 'FALHOU', erro: (err as Error).message.slice(0, 500) });
    }
  }
}
