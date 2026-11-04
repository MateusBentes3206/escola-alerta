import { env } from '../../config/env';
import { textoParaFamilia } from '../../domain/mensagemFamilia';
import { CanalExterno, MensagemExterna } from '../../canais/CanalExterno';
import { IMensagemRepository } from '../../repositories/MensagemRepository';
import { IUsuarioRepository } from '../../repositories/UsuarioRepository';
import { AlertaGerado, ObservadorDeAlerta } from '../PublicadorDeAlertas';

/**
 * Observador (padrão Observer): quando o aluno ENTRA em risco alto, avisa o responsável fora do app
 * pelo canal recebido (hoje, e-mail). Um canal novo (SMS, WhatsApp) seria só mais uma instância
 * inscrita no PublicadorDeAlertas, sem mexer no motor.
 *
 * - Só dispara na entrada em risco alto (não repete enquanto continuar alto, para não virar spam).
 * - Mensagem curta e sem notas/detalhes do aluno (LGPD: o e-mail fica fora do controle da escola);
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
    this.nome = 'AvisoRiscoAltoPorEmail';
  }

  async notificar({ alerta, aluno, nivelAnterior }: AlertaGerado): Promise<void> {
    if (alerta.nivel !== 'ALTO' || nivelAnterior === 'ALTO' || !aluno.responsavelId || !aluno.vinculoConfirmado) return;

    const responsavel = await this.usuarios.buscarPorId(aluno.responsavelId);
    if (!responsavel) return;

    const primeiroNome = aluno.nome.split(' ')[0];
    const texto = textoParaFamilia({
      responsavelNome: responsavel.nome, alunoNome: aluno.nome, turma: aluno.turma, nivel: alerta.nivel, causa: alerta.causaRaiz, link: env.appUrl,
    });
    const mensagem: MensagemExterna = {
      destino: responsavel.email ?? '',
      assunto: `EscolaAlerta: ${primeiroNome} precisa de atenção`,
      texto,
      nomeDestinatario: responsavel.nome,
    };

    const registro = { usuarioId: responsavel.id, alunoId: aluno.id, alertaId: alerta.id, canal: this.canal.tipo, assunto: mensagem.assunto, conteudo: texto };
    if (!mensagem.destino) {
      await this.mensagens.registrar({ ...registro, destino: null, status: 'SEM_CONTATO', erro: 'Responsável sem e-mail.' });
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
