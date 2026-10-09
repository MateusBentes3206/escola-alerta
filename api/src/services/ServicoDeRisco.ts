import { Alerta, Classificacao } from '../domain/risco';
import { AppError } from '../errors/AppError';
import { PublicadorDeAlertas } from '../eventos/PublicadorDeAlertas';
import { GeradorDePlanoDeAcao } from '../motor/GeradorDePlanoDeAcao';
import { MotorDeRegras } from '../motor/MotorDeRegras';
import { IAlertaRepository } from '../repositories/AlertaRepository';
import { IAlunoRepository } from '../repositories/AlunoRepository';
import { IIndicadorRepository } from '../repositories/IndicadorRepository';

/**
 * Orquestra o fluxo do alerta (RF07 + RF08 + RF12):
 *   histórico -> MotorDeRegras -> mudou? -> grava alerta + plano -> publica para os observadores.
 *
 * Só grava alerta novo quando o nível ou a causa raiz mudam. Assim a tabela de alertas
 * vira o histórico de evolução do risco (IT06), sem repetir o mesmo alerta a cada registro.
 */
export class ServicoDeRisco {
  constructor(
    private readonly alunos: IAlunoRepository,
    private readonly indicadores: IIndicadorRepository,
    private readonly alertas: IAlertaRepository,
    private readonly motor: MotorDeRegras,
    private readonly gerador: GeradorDePlanoDeAcao,
    private readonly publicador: PublicadorDeAlertas,
  ) {}

  async reavaliar(alunoId: string, dataReferencia?: string): Promise<{ classificacao: Classificacao; alerta: Alerta | null }> {
    const aluno = await this.alunos.buscarPorId(alunoId);
    if (!aluno) throw new AppError(404, 'Aluno não encontrado.');

    const historico = await this.indicadores.listarPorAluno(alunoId);
    const classificacao = this.motor.classificar(historico, dataReferencia);
    const ultimo = await this.alertas.ultimoDoAluno(alunoId);

    const mudou = ultimo
      ? ultimo.nivel !== classificacao.nivel || (classificacao.nivel !== 'BAIXO' && ultimo.causaRaiz !== classificacao.causaRaiz)
      : classificacao.nivel !== 'BAIXO';

    if (!mudou) return { classificacao, alerta: null };

    const plano = this.gerador.gerar(classificacao);
    const alerta = await this.alertas.criarComPlano(alunoId, classificacao, plano);
    await this.publicador.publicar({ alerta, aluno, plano, nivelAnterior: ultimo?.nivel ?? null });

    return { classificacao, alerta };
  }
}
